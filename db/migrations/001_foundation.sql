-- ============================================================================
-- Herdvest Management System — 001 foundation
-- Schema, request context, roles & permissions, users, sessions, settings,
-- audit log and generic guard triggers.
--
-- Security model
--   * Migrations run as the schema owner. The web app connects as the
--     non-owner role `herdvest_app`, so row-level security (RLS) applies.
--   * For every authenticated request the app opens a transaction and sets
--     `hv.user_id` (transaction-local). Policies call hv.has_perm(), which
--     looks up the user's role permissions in the database — a value sent by
--     the browser can never grant a permission.
-- ============================================================================

create schema if not exists hv;
create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- context --
create or replace function hv.current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('hv.user_id', true), '')::uuid
$$;

-- ------------------------------------------------- roles and permissions --
create table hv.roles (
  id          text primary key,
  name        text not null,
  description text not null default '',
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table hv.permissions (
  id          text primary key,           -- e.g. 'finance.approve'
  module      text not null,
  description text not null
);

create table hv.role_permissions (
  role_id       text not null references hv.roles(id) on delete cascade,
  permission_id text not null references hv.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- ------------------------------------------------------------- employees --
create sequence hv.seq_employee;
create table hv.employees (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default 'EMP-' || lpad(nextval('hv.seq_employee')::text, 4, '0'),
  full_name       text not null,
  phone           text,
  email           citext,
  job_title       text,
  department      text,
  status          text not null default 'active' check (status in ('active','on_leave','inactive','terminated')),
  joining_date    date,
  assigned_areas  text,           -- districts / farms covered, free text
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------- users --
create table hv.users (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null unique,
  full_name       text not null,
  password_hash   text not null,
  role_id         text not null references hv.roles(id),
  employee_id     uuid unique references hv.employees(id),
  is_active       boolean not null default true,
  must_change_password boolean not null default false,
  failed_logins   int not null default 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now()
);

create table hv.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references hv.users(id) on delete cascade,
  token_hash  text not null unique,   -- sha256 of the cookie token; raw token is never stored
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  ip          text,
  user_agent  text
);
create index on hv.sessions (user_id);

create table hv.login_attempts (
  id         bigserial primary key,
  email      citext not null,
  success    boolean not null,
  ip         text,
  at         timestamptz not null default now()
);
create index on hv.login_attempts (email, at desc);
create index on hv.login_attempts (ip, at desc);

-- ------------------------------------------------------------- settings --
create table hv.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ----------------------------------------------------- permission checks --
create or replace function hv.has_perm(p text) returns boolean
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select exists (
    select 1 from hv.users u
    join hv.role_permissions rp on rp.role_id = u.role_id
    where u.id = hv.current_user_id() and u.is_active and rp.permission_id = p
  )
$$;

create or replace function hv.current_role_id() returns text
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select role_id from hv.users where id = hv.current_user_id() and is_active
$$;

create or replace function hv.current_employee_id() returns uuid
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select employee_id from hv.users where id = hv.current_user_id() and is_active
$$;

create or replace function hv.is_authenticated() returns boolean
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select exists (select 1 from hv.users where id = hv.current_user_id() and is_active)
$$;

create or replace function hv.require_perm(p text) returns void
language plpgsql stable as $$
begin
  if not hv.has_perm(p) then
    raise exception 'Permission denied: % is required', p using errcode = '42501';
  end if;
end $$;

create or replace function hv.setting(k text) returns jsonb
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select value from hv.settings where key = k
$$;

-- ------------------------------------------------------------- audit log --
create table hv.audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     uuid,
  action      text not null,          -- INSERT / UPDATE / DELETE / custom e.g. APPROVE
  table_name  text not null,
  record_id   text,
  old_values  jsonb,
  new_values  jsonb,
  note        text
);
create index on hv.audit_log (table_name, record_id);
create index on hv.audit_log (at desc);

-- Writes one row per change. Runs as the owner so the app role needs no write
-- access to audit_log (it can never edit or erase history).
create or replace function hv.audit_trigger() returns trigger
language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare
  o jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  k text;
  rid text;
begin
  -- never copy secrets into the audit trail
  o := o - 'password_hash' - 'token_hash';
  n := n - 'password_hash' - 'token_hash';
  if tg_op = 'UPDATE' then
    -- keep only changed keys
    for k in select jsonb_object_keys(n) loop
      if o -> k is not distinct from n -> k then
        o := o - k; n := n - k;
      end if;
    end loop;
    if n = '{}'::jsonb or n = jsonb_build_object('updated_at', n->'updated_at') then
      return new;
    end if;
  end if;
  rid := coalesce(n ->> 'id', o ->> 'id', (to_jsonb(coalesce(new, old)) ->> 'id'));
  insert into hv.audit_log (user_id, action, table_name, record_id, old_values, new_values)
  values (hv.current_user_id(), tg_op, tg_table_name, rid, o, n);
  return coalesce(new, old);
end $$;

-- Custom audit entries (approvals, logins, exports …)
create or replace function hv.audit_event(p_action text, p_table text, p_record text, p_note text, p_data jsonb default null)
returns void language sql security definer set search_path = hv, public, pg_temp as $$
  insert into hv.audit_log (user_id, action, table_name, record_id, new_values, note)
  values (hv.current_user_id(), p_action, p_table, p_record, p_data, p_note)
$$;

-- --------------------------------------------------------- guard triggers --
create or replace function hv.deny_delete() returns trigger
language plpgsql as $$
begin
  raise exception '% records cannot be deleted. Use a void, reversal or correction instead.', tg_table_name
    using errcode = '42501';
end $$;

create or replace function hv.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function hv.stamp_created_by() returns trigger
language plpgsql as $$
begin
  if new.created_by is null then new.created_by := hv.current_user_id(); end if;
  return new;
end $$;

-- Users: nobody can change their own role; only super admins can grant super admin.
create or replace function hv.guard_user_update() returns trigger
language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  if new.role_id is distinct from old.role_id then
    if old.id = hv.current_user_id() then
      raise exception 'You cannot change your own role' using errcode = '42501';
    end if;
    if not hv.has_perm('users.manage') then
      raise exception 'Permission denied: users.manage is required' using errcode = '42501';
    end if;
    if (new.role_id = 'super_admin' or old.role_id = 'super_admin') and hv.current_role_id() is distinct from 'super_admin' then
      raise exception 'Only a Super Admin can grant or remove Super Admin access' using errcode = '42501';
    end if;
  end if;
  if new.is_active is distinct from old.is_active and old.id = hv.current_user_id() then
    raise exception 'You cannot deactivate your own account' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger users_guard before update on hv.users for each row execute function hv.guard_user_update();
create trigger users_touch before update on hv.users for each row execute function hv.touch_updated_at();
create trigger users_audit after insert or update or delete on hv.users for each row execute function hv.audit_trigger();
create trigger employees_touch before update on hv.employees for each row execute function hv.touch_updated_at();
create trigger employees_created_by before insert on hv.employees for each row execute function hv.stamp_created_by();
create trigger employees_audit after insert or update or delete on hv.employees for each row execute function hv.audit_trigger();
create trigger roles_audit after insert or update or delete on hv.roles for each row execute function hv.audit_trigger();
create trigger settings_audit after insert or update or delete on hv.settings for each row execute function hv.audit_trigger();

-- role_permissions has a composite key; audit it with an explicit record id
create or replace function hv.audit_role_permissions() returns trigger
language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  insert into hv.audit_log (user_id, action, table_name, record_id, old_values, new_values)
  values (hv.current_user_id(), tg_op, 'role_permissions',
          coalesce(new.role_id, old.role_id) || ':' || coalesce(new.permission_id, old.permission_id),
          case when tg_op = 'DELETE' then to_jsonb(old) end,
          case when tg_op = 'INSERT' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger role_permissions_audit after insert or delete on hv.role_permissions
  for each row execute function hv.audit_role_permissions();
