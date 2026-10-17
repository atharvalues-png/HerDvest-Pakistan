-- ============================================================================
-- Herdvest — 008 investor portal
--
-- Investors sign in to a separate portal. They are NOT rows in hv.users and
-- hold no staff permissions, so every staff RLS policy returns nothing for
-- them. Everything an investor sees comes from the SECURITY DEFINER
-- functions named hv.portal_*, which:
--   * resolve the investor from the portal session token hash that the server
--     puts in the transaction setting `hv.portal_session` (the token is a
--     256-bit secret from an httpOnly cookie, so a URL or form value can never
--     choose the investor);
--   * return only that investor's rows, only investor-safe columns, and only
--     content that an authorised staff member has published.
-- ============================================================================

-- ------------------------------------------------------------ permissions --
insert into hv.permissions (id, module, description) values
  ('portal.manage','portal','Invite, suspend and revoke investor portal accounts; resolve profile corrections'),
  ('portal.publish','portal','Publish inspection reports, photos, weights, forecasts and updates to investors'),
  ('forecasts.write','portal','Prepare sale forecasts for animals (not visible to investors until published)');
insert into hv.role_permissions (role_id, permission_id) values
  ('super_admin','portal.manage'), ('super_admin','portal.publish'), ('super_admin','forecasts.write'),
  ('operations_manager','portal.publish'), ('operations_manager','forecasts.write'),
  ('finance_officer','portal.manage'), ('finance_officer','forecasts.write');

insert into hv.settings (key, value) values
  ('inspection_interval_months', '6'),
  ('portal_show_farmer_name', 'false')
on conflict (key) do nothing;

-- never copy secrets into the audit trail
create or replace function hv.audit_trigger() returns trigger
language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare
  o jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  k text;
  rid text;
begin
  o := o - 'password_hash' - 'token_hash' - 'mfa_secret' - 'national_id';
  n := n - 'password_hash' - 'token_hash' - 'mfa_secret' - 'national_id';
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if o -> k is not distinct from n -> k then
        o := o - k; n := n - k;
      end if;
    end loop;
    if n = '{}'::jsonb or n = jsonb_build_object('updated_at', n->'updated_at') then
      return new;
    end if;
  end if;
  rid := coalesce(n ->> 'id', o ->> 'id', (to_jsonb(coalesce(new, old)) ->> 'id'), (to_jsonb(coalesce(new, old)) ->> 'animal_id'));
  insert into hv.audit_log (user_id, action, table_name, record_id, old_values, new_values)
  values (hv.current_user_id(), tg_op, tg_table_name, rid, o, n);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------- new columns --
alter table hv.investment_accounts add column agreed_budget numeric(14,2) check (agreed_budget > 0);

alter table hv.vet_records
  add column investor_visible boolean not null default false,
  add column investor_summary text,
  add column published_at timestamptz,
  add column published_by uuid;

alter table hv.attachments
  add column investor_visible boolean not null default false,
  add column published_at timestamptz,
  add column published_by uuid,
  add constraint attachments_sensitive_never_shared check (not (sensitive and investor_visible));

alter table hv.attachments drop constraint attachments_entity_type_check;
alter table hv.attachments add constraint attachments_entity_type_check check (entity_type in (
  'investor','account','ledger_entry','animal','purchase','farmer','allocation','vet_record','expense','task','sale','settlement',
  'incident','employee','enquiry','intake_item','animal_weight','payment_request'));

alter table hv.login_attempts add column channel text not null default 'staff' check (channel in ('staff','portal'));

-- Identity numbers live in their own table, readable only with files.sensitive.
create table hv.investor_identity (
  investor_id uuid primary key references hv.investors(id),
  national_id text not null check (length(national_id) between 5 and 40),
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

create or replace function hv.mask_identifier(t text) returns text
language sql immutable as $$
  select case when t is null then null
              else regexp_replace(left(t, greatest(length(t) - 3, 0)), '[0-9A-Za-z]', '•', 'g') || right(t, least(3, length(t))) end
$$;

-- ------------------------------------------------------- portal accounts --
create table hv.portal_accounts (
  id            uuid primary key default gen_random_uuid(),
  investor_id   uuid not null unique references hv.investors(id),
  email         citext not null unique,
  password_hash text,                       -- null until the investor activates the account
  status        text not null default 'invited' check (status in ('invited','active','suspended','revoked')),
  status_reason text,
  mfa_secret    text,
  mfa_enabled   boolean not null default false,
  failed_logins int not null default 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  invited_by    uuid,
  invited_at    timestamptz not null default now(),
  activated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table hv.portal_tokens (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references hv.portal_accounts(id),
  purpose     text not null check (purpose in ('activation','reset')),
  token_hash  text not null unique,         -- sha256 of the emailed/copied token
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid,                         -- null when the investor requested a reset
  created_at  timestamptz not null default now()
);
create index on hv.portal_tokens (account_id);

create table hv.portal_sessions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references hv.portal_accounts(id),
  token_hash  text not null unique,
  mfa_passed  boolean not null,
  mfa_attempts int not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  ip          text,
  user_agent  text
);
create index on hv.portal_sessions (account_id);

-- ----------------------------------------------------- care & monitoring --
create table hv.animal_care_plans (
  animal_id   uuid primary key references hv.animals(id),
  inspection_interval_months int check (inspection_interval_months between 1 and 24),
  next_inspection_due date,
  notes       text,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

create sequence hv.seq_weight;
create table hv.animal_weights (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default 'WT-' || lpad(nextval('hv.seq_weight')::text, 5, '0'),
  animal_id     uuid not null references hv.animals(id),
  measured_on   date not null,
  weight        numeric(7,2) not null check (weight > 0 and weight < 3000),
  unit          text not null default 'kg' check (unit = 'kg'),
  method        text not null check (method in ('scale','weigh_tape','visual_estimate','other')),
  measured_by   text,                       -- person or professional who measured
  employee_id   uuid references hv.employees(id),
  vet_record_id uuid references hv.vet_records(id),
  notes         text,
  investor_visible boolean not null default false,
  published_at  timestamptz,
  published_by  uuid,
  voided_at     timestamptz,
  void_reason   text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index on hv.animal_weights (animal_id, measured_on);

create table hv.animal_forecasts (
  id                  uuid primary key default gen_random_uuid(),
  animal_id           uuid not null references hv.animals(id),
  expected_sale_price numeric(14,2) not null check (expected_sale_price > 0),
  expected_sale_date  date,
  expected_sale_period text,                -- e.g. "Eid ul Adha 2027"
  estimated_weight_kg numeric(7,2) check (estimated_weight_kg > 0),
  estimated_weight_date date,
  assumptions         text not null check (length(trim(assumptions)) >= 10),
  status              text not null default 'draft' check (status in ('draft','published','superseded','withdrawn')),
  prepared_by         uuid,
  created_at          timestamptz not null default now(),
  published_by        uuid,
  published_at        timestamptz,
  withdrawn_reason    text
);
create unique index animal_forecasts_one_published on hv.animal_forecasts (animal_id) where status = 'published';

create table hv.animal_updates (
  id           uuid primary key default gen_random_uuid(),
  animal_id    uuid not null references hv.animals(id),
  kind         text not null check (kind in ('health','progress','sale','general')),
  title        text not null check (length(title) between 3 and 160),
  body         text not null check (length(body) between 3 and 4000),
  status       text not null default 'published' check (status in ('published','withdrawn')),
  published_by uuid,
  published_at timestamptz not null default now(),
  withdrawn_reason text
);

-- ---------------------------------------------------- payment requests --
create sequence hv.seq_payment_request;
create table hv.payment_requests (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique default 'PRQ-' || lpad(nextval('hv.seq_payment_request')::text, 4, '0'),
  account_id     uuid not null references hv.investment_accounts(id),
  investor_id    uuid not null references hv.investors(id),
  amount         hv.money not null check (amount > 0),
  reason         text not null check (length(trim(reason)) >= 5),
  agreement_clause text not null check (length(trim(agreement_clause)) >= 2),   -- which agreed term supports the request
  due_date       date,
  status         text not null default 'draft' check (status in ('draft','issued','paid','cancelled')),
  created_by     uuid,
  created_at     timestamptz not null default now(),
  issued_by      uuid,
  issued_at      timestamptz,
  ledger_entry_id uuid references hv.ledger_entries(id),
  closed_note    text,
  closed_by      uuid,
  closed_at      timestamptz
);

-- ------------------------------------------------- notifications & requests --
create table hv.portal_notifications (
  id           uuid primary key default gen_random_uuid(),
  investor_id  uuid not null references hv.investors(id),
  kind         text not null check (kind in ('inspection','veterinary','photos','document','weight','health','forecast',
                 'sale_upcoming','sale_completed','settlement','payment_request','account')),
  title        text not null,
  body         text,
  link         text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed','not_configured','no_account'))
);
create index on hv.portal_notifications (investor_id, created_at desc);

create table hv.portal_change_requests (
  id             uuid primary key default gen_random_uuid(),
  investor_id    uuid not null references hv.investors(id),
  field          text not null check (field in ('full_legal_name','phone','email','address','city','country','contact_preference','national_id','other')),
  requested_value text,
  message        text,
  status         text not null default 'open' check (status in ('open','resolved','declined')),
  created_at     timestamptz not null default now(),
  resolved_by    uuid,
  resolved_at    timestamptz,
  resolution_note text
);

-- ------------------------------------------------------------- triggers --
create trigger portal_accounts_touch before update on hv.portal_accounts for each row execute function hv.touch_updated_at();
do $$
declare t text;
begin
  foreach t in array array['portal_accounts','animal_care_plans','animal_weights','animal_forecasts','animal_updates',
                           'payment_requests','portal_change_requests','investor_identity'] loop
    execute format('create trigger %1$s_audit after insert or update or delete on hv.%1$s for each row execute function hv.audit_trigger()', t);
  end loop;
  foreach t in array array['portal_accounts','animal_weights','animal_forecasts','animal_updates','payment_requests',
                           'portal_change_requests','portal_notifications'] loop
    execute format('create trigger %1$s_no_delete before delete on hv.%1$s for each row execute function hv.deny_delete()', t);
  end loop;
end $$;
create trigger animal_weights_created_by before insert on hv.animal_weights for each row execute function hv.stamp_created_by();

-- Publication flags change only through the publication functions. Editing
-- a published veterinary record withdraws it until it is published again.
create or replace function hv.guard_publication() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.investor_visible and hv.via() is distinct from 'publication' then
      new.investor_visible := false;
    end if;
    if not new.investor_visible then new.published_at := null; new.published_by := null; end if;
    return new;
  end if;
  if (new.investor_visible, new.published_at, new.published_by) is distinct from (old.investor_visible, old.published_at, old.published_by)
     and hv.via() is distinct from 'publication' then
    raise exception 'Use the publish / unpublish action to change what investors can see' using errcode = '42501';
  end if;
  if tg_table_name <> 'vet_records' then return new; end if;
  if old.investor_visible and new.investor_visible and hv.via() is distinct from 'publication'
     and (new.findings, new.condition, new.weight_kg, new.vaccine_name, new.vaccination_date, new.treatment, new.follow_up,
          new.next_due_date, new.visit_date, new.status, new.animal_id, new.visit_type, new.performed_by)
         is distinct from
         (old.findings, old.condition, old.weight_kg, old.vaccine_name, old.vaccination_date, old.treatment, old.follow_up,
          old.next_due_date, old.visit_date, old.status, old.animal_id, old.visit_type, old.performed_by) then
    new.investor_visible := false; new.published_at := null; new.published_by := null;
  end if;
  return new;
end $$;
create trigger vet_records_publication before insert or update on hv.vet_records for each row execute function hv.guard_publication();
create trigger attachments_publication before insert or update on hv.attachments for each row execute function hv.guard_publication();
create trigger animal_weights_publication before insert or update on hv.animal_weights for each row execute function hv.guard_publication();

-- Weights: only void / publish via functions.
create or replace function hv.guard_weight() returns trigger
language plpgsql as $$
begin
  if hv.via() is distinct from 'publication' and hv.via() is distinct from 'weight_workflow' then
    raise exception 'Weight records cannot be edited. Void the record and enter a corrected measurement.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger animal_weights_guard before update on hv.animal_weights for each row execute function hv.guard_weight();

-- ---------------------------------------------------------- entity owner --
-- The investor a record belongs to, for deciding what may be shared.
create or replace function hv.entity_investor(p_type text, p_id uuid)
returns uuid language sql stable security definer set search_path = hv, public, pg_temp as $$
  select case p_type
    when 'investor'       then (select id from hv.investors where id = p_id)
    when 'account'        then (select investor_id from hv.investment_accounts where id = p_id)
    when 'ledger_entry'   then (select investor_id from hv.ledger_entries where id = p_id)
    when 'animal'         then (select investor_id from hv.animals where id = p_id)
    when 'purchase'       then (select investor_id from hv.purchases where id = p_id)
    when 'allocation'     then (select investor_id from hv.allocations where id = p_id)
    when 'vet_record'     then (select investor_id from hv.vet_records where id = p_id)
    when 'sale'           then (select investor_id from hv.sales where id = p_id)
    when 'settlement'     then (select s.investor_id from hv.settlements st join hv.sales s on s.id = st.sale_id where st.id = p_id)
    when 'animal_weight'  then (select a.investor_id from hv.animal_weights w join hv.animals a on a.id = w.animal_id where w.id = p_id)
    when 'payment_request' then (select investor_id from hv.payment_requests where id = p_id)
    when 'expense'        then (select investor_id from hv.expenses where id = p_id
                                  and charge_type = 'chargeable_to_investment' and status in ('approved','paid'))
    else null end   -- farmers, employees, incidents, tasks, enquiries and intake are never shared
$$;

create or replace function hv.can_access_entity(p_type text, p_id uuid)
returns boolean language plpgsql stable as $$
begin
  return case p_type
    when 'investor'     then exists (select 1 from hv.investors where id = p_id)
    when 'account'      then exists (select 1 from hv.investment_accounts where id = p_id)
    when 'ledger_entry' then exists (select 1 from hv.ledger_entries where id = p_id)
    when 'animal'       then exists (select 1 from hv.animals where id = p_id)
    when 'purchase'     then exists (select 1 from hv.purchases where id = p_id)
    when 'farmer'       then exists (select 1 from hv.farmers where id = p_id)
    when 'allocation'   then exists (select 1 from hv.allocations where id = p_id)
    when 'vet_record'   then exists (select 1 from hv.vet_records where id = p_id)
    when 'expense'      then exists (select 1 from hv.expenses where id = p_id)
    when 'task'         then exists (select 1 from hv.tasks where id = p_id)
    when 'sale'         then exists (select 1 from hv.sales where id = p_id)
    when 'settlement'   then exists (select 1 from hv.settlements where id = p_id)
    when 'incident'     then exists (select 1 from hv.incidents where id = p_id)
    when 'employee'     then exists (select 1 from hv.employees where id = p_id)
    when 'enquiry'      then exists (select 1 from hv.enquiries where id = p_id)
    when 'intake_item'  then exists (select 1 from hv.intake_items where id = p_id)
    when 'animal_weight' then exists (select 1 from hv.animal_weights where id = p_id)
    when 'payment_request' then exists (select 1 from hv.payment_requests where id = p_id)
    else false end;
end $$;

-- ------------------------------------------------------- notifications --
create or replace function hv.portal_notify(p_investor uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  if p_investor is null then return; end if;
  -- collapse repeats (e.g. several photos published together)
  if exists (select 1 from hv.portal_notifications where investor_id = p_investor and kind = p_kind and link is not distinct from p_link
             and read_at is null and created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into hv.portal_notifications (investor_id, kind, title, body, link, email_status)
  values (p_investor, p_kind, p_title, p_body, p_link,
          case when exists (select 1 from hv.portal_accounts where investor_id = p_investor and status = 'active') then 'pending' else 'no_account' end);
end $$;
revoke execute on function hv.portal_notify(uuid, text, text, text, text) from public;

-- Settlement approval publishes the settlement to the investor.
create or replace function hv.notify_settlement() returns trigger
language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare s record;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select sa.investor_id, a.code, a.id animal_id into s from hv.sales sa join hv.animals a on a.id = sa.animal_id where sa.id = new.sale_id;
    perform hv.portal_notify(s.investor_id, 'settlement', 'Sale completed — settlement statement for ' || s.code,
      'The sale of ' || s.code || ' has been settled and approved. View the settlement figures and payment status.', '/portal/livestock/' || s.animal_id);
  end if;
  return new;
end $$;
create trigger settlements_notify after update of status on hv.settlements for each row execute function hv.notify_settlement();

create or replace function hv.notify_animal_status() returns trigger
language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  if new.status = 'sale_preparation' and old.status is distinct from 'sale_preparation' then
    perform hv.portal_notify(new.investor_id, 'sale_upcoming', new.code || ' is being prepared for sale',
      'Herdvest has started preparing ' || new.code || ' for sale. Sale price and timing are not yet confirmed.', '/portal/livestock/' || new.id);
  end if;
  return new;
end $$;
create trigger animals_notify after update of status on hv.animals for each row execute function hv.notify_animal_status();

-- -------------------------------------------------- staff: publishing --
create or replace function hv.set_vet_publication(p_vet uuid, p_visible boolean, p_summary text default null)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v hv.vet_records; a hv.animals;
begin
  perform hv.require_perm('portal.publish');
  select * into v from hv.vet_records where id = p_vet for update;
  if not found then raise exception 'Record not found'; end if;
  if p_visible and v.status <> 'completed' then
    raise exception 'Only completed records can be published. Scheduled visits already show to the investor as scheduled.';
  end if;
  select * into a from hv.animals where id = v.animal_id;
  if p_visible and a.investor_id is null then raise exception 'This animal is not linked to an investor'; end if;
  perform hv.set_via('publication');
  update hv.vet_records set investor_visible = p_visible,
         investor_summary = case when p_summary is null then investor_summary else nullif(trim(p_summary), '') end,
         published_at = case when p_visible then now() end, published_by = case when p_visible then hv.current_user_id() end
   where id = p_vet;
  perform hv.set_via('');
  perform hv.audit_event(case when p_visible then 'PUBLISH' else 'UNPUBLISH' end, 'vet_records', p_vet::text, 'investor portal');
  if p_visible then
    perform hv.portal_notify(a.investor_id,
      case when v.visit_type in ('inspection','health_check','purchase_assessment','follow_up') then 'inspection' else 'veterinary' end,
      case when v.visit_type in ('inspection','health_check','purchase_assessment','follow_up') then 'New inspection report for ' else 'New veterinary record for ' end || a.code,
      initcap(replace(v.visit_type, '_', ' ')) || ' on ' || to_char(coalesce(v.visit_date, v.scheduled_date), 'DD Mon YYYY') || '.',
      '/portal/livestock/' || a.id);
    if v.condition in ('poor','critical') then
      perform hv.portal_notify(a.investor_id, 'health', 'Health update for ' || a.code,
        'The latest assessment recorded the animal''s condition as ' || v.condition || '. See the report for details.', '/portal/livestock/' || a.id);
    end if;
  end if;
end $$;

create or replace function hv.set_attachment_publication(p_file uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare f hv.attachments; inv uuid; v_link text;
begin
  perform hv.require_perm('portal.publish');
  select * into f from hv.attachments where id = p_file and deleted_at is null for update;
  if not found then raise exception 'File not found'; end if;
  if p_visible and f.sensitive then raise exception 'Sensitive documents (identity, verification) can never be shared with investors' using errcode = '42501'; end if;
  inv := hv.entity_investor(f.entity_type, f.entity_id);
  if p_visible and inv is null then
    raise exception 'Files on % records cannot be shared with investors', replace(f.entity_type, '_', ' ') using errcode = '42501';
  end if;
  perform hv.set_via('publication');
  update hv.attachments set investor_visible = p_visible,
         published_at = case when p_visible then now() end, published_by = case when p_visible then hv.current_user_id() end
   where id = p_file;
  perform hv.set_via('');
  perform hv.audit_event(case when p_visible then 'PUBLISH' else 'UNPUBLISH' end, 'attachments', p_file::text, 'investor portal');
  if p_visible then
    v_link := case f.entity_type
      when 'animal' then '/portal/livestock/' || f.entity_id
      when 'vet_record' then '/portal/livestock/' || (select animal_id from hv.vet_records where id = f.entity_id)
      when 'animal_weight' then '/portal/livestock/' || (select animal_id from hv.animal_weights where id = f.entity_id)
      else '/portal/documents' end;
    if f.mime_type like 'image/%' or f.mime_type like 'video/%' then
      perform hv.portal_notify(inv, 'photos', 'New photographs or videos uploaded', 'New media has been added to your records.', v_link);
    else
      perform hv.portal_notify(inv, 'document', 'New document available', coalesce(f.caption, f.original_name), '/portal/documents');
    end if;
  end if;
end $$;

-- ------------------------------------------------------- staff: weights --
create or replace function hv.record_weight(
  p_animal uuid, p_measured_on date, p_weight numeric, p_method text, p_measured_by text, p_notes text,
  p_vet_record uuid default null, p_publish boolean default false)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_id uuid; a hv.animals;
begin
  perform hv.require_perm('vet.write');
  if not (hv.has_perm('livestock.read') or hv.is_assigned_animal(p_animal)) then
    raise exception 'You can only record weights for animals assigned to you' using errcode = '42501';
  end if;
  select * into a from hv.animals where id = p_animal;
  if not found then raise exception 'Animal not found'; end if;
  if p_measured_on > current_date then raise exception 'Measurement date cannot be in the future'; end if;
  insert into hv.animal_weights (animal_id, measured_on, weight, method, measured_by, employee_id, vet_record_id, notes)
  values (p_animal, p_measured_on, p_weight, p_method, nullif(trim(p_measured_by), ''), hv.current_employee_id(), p_vet_record, p_notes)
  returning id into v_id;
  if p_publish then perform hv.set_weight_publication(v_id, true); end if;
  return v_id;
end $$;

create or replace function hv.set_weight_publication(p_weight uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare w hv.animal_weights; a hv.animals;
begin
  perform hv.require_perm('portal.publish');
  select * into w from hv.animal_weights where id = p_weight for update;
  if not found then raise exception 'Weight record not found'; end if;
  if p_visible and w.voided_at is not null then raise exception 'A voided measurement cannot be published'; end if;
  select * into a from hv.animals where id = w.animal_id;
  perform hv.set_via('publication');
  update hv.animal_weights set investor_visible = p_visible,
         published_at = case when p_visible then now() end, published_by = case when p_visible then hv.current_user_id() end
   where id = p_weight;
  perform hv.set_via('');
  if p_visible then
    perform hv.portal_notify(a.investor_id, 'weight', 'New weight recorded for ' || a.code,
      w.weight || ' kg measured on ' || to_char(w.measured_on, 'DD Mon YYYY') || '.', '/portal/livestock/' || a.id);
  end if;
end $$;

create or replace function hv.void_weight(p_weight uuid, p_reason text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_perm('vet.write');
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  perform hv.set_via('publication');
  update hv.animal_weights set voided_at = now(), void_reason = p_reason, investor_visible = false, published_at = null, published_by = null
   where id = p_weight and voided_at is null;
  if not found then raise exception 'Weight record not found or already voided'; end if;
  perform hv.set_via('');
end $$;

-- ----------------------------------------------------- staff: care plan --
create or replace function hv.set_care_plan(p_animal uuid, p_interval int, p_next_due date, p_notes text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_any(array['livestock.write','vet.write']);
  if not exists (select 1 from hv.animals where id = p_animal) then raise exception 'Animal not found'; end if;
  insert into hv.animal_care_plans (animal_id, inspection_interval_months, next_inspection_due, notes, updated_by, updated_at)
  values (p_animal, p_interval, p_next_due, p_notes, hv.current_user_id(), now())
  on conflict (animal_id) do update set inspection_interval_months = excluded.inspection_interval_months,
    next_inspection_due = excluded.next_inspection_due, notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- Planned inspection status for an animal (used by staff and portal views).
create or replace function hv.inspection_status(p_animal uuid)
returns table (last_completed date, next_due date, scheduled_date date, awaiting_review boolean, state text, interval_months int)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  with a as (select a.id, a.status, (select p.purchase_date from hv.purchase_lines pl join hv.purchases p on p.id = pl.purchase_id where pl.animal_id = a.id) purchased
               from hv.animals a where a.id = p_animal),
  cp as (select * from hv.animal_care_plans where animal_id = p_animal),
  iv as (select coalesce((select inspection_interval_months from cp), (hv.setting('inspection_interval_months') #>> '{}')::int, 6) m),
  lc as (select max(visit_date) d from hv.vet_records where animal_id = p_animal and status = 'completed'
           and visit_type in ('inspection','health_check','purchase_assessment','follow_up')),
  sc as (select min(scheduled_date) d from hv.vet_records where animal_id = p_animal and status = 'scheduled'),
  ar as (select exists (select 1 from hv.vet_records where animal_id = p_animal and status = 'completed' and not investor_visible
           and coalesce(visit_date, current_date) >= coalesce((select max(visit_date) from hv.vet_records where animal_id = p_animal and investor_visible), '-infinity'::date)) v),
  nd as (select coalesce((select next_inspection_due from cp),
                         ((select d from lc) + make_interval(months => (select m from iv)))::date,
                         ((select purchased from a) + make_interval(months => (select m from iv)))::date) d)
  select (select d from lc), (select d from nd), (select d from sc), (select v from ar),
         case
           when (select status from a) in ('sold','deceased') then 'closed'
           when (select v from ar) then 'awaiting_review'
           when (select d from sc) is not null and (select d from sc) >= current_date then 'scheduled'
           when (select d from nd) is null then 'not_planned'
           when (select d from nd) > current_date then 'scheduled'
           when coalesce((select d from sc), (select d from nd)) >= current_date - 14 then 'pending'
           else 'overdue' end,
         (select m from iv)
$$;

-- ----------------------------------------------------- staff: forecasts --
create or replace function hv.forecast_figures(p_cost numeric, p_price numeric, p_investor_pct numeric, p_fee_pct numeric)
returns table (profit_pool numeric, investor_gross numeric, farmer_share numeric, herdvest_fee numeric, investor_net numeric,
               capital_returned numeric, capital_shortfall numeric, investor_total numeric)
language sql immutable as $$
  -- mirrors hv.calculate_settlement: capital first, 50/50 of a positive pool, fee once on the investor share
  select p_price - p_cost,
         case when p_price >= p_cost then trunc((p_price - p_cost) * p_investor_pct / 100, 2) else 0 end,
         case when p_price >= p_cost then (p_price - p_cost) - trunc((p_price - p_cost) * p_investor_pct / 100, 2) else 0 end,
         case when p_price >= p_cost then round(trunc((p_price - p_cost) * p_investor_pct / 100, 2) * p_fee_pct / 100, 2) else 0 end,
         case when p_price >= p_cost then trunc((p_price - p_cost) * p_investor_pct / 100, 2) - round(trunc((p_price - p_cost) * p_investor_pct / 100, 2) * p_fee_pct / 100, 2)
              else p_price - p_cost end,
         least(p_price, p_cost),
         greatest(p_cost - p_price, 0),
         case when p_price >= p_cost then p_cost + trunc((p_price - p_cost) * p_investor_pct / 100, 2) - round(trunc((p_price - p_cost) * p_investor_pct / 100, 2) * p_fee_pct / 100, 2)
              else p_price end
$$;

create or replace function hv.create_forecast(
  p_animal uuid, p_price numeric, p_date date, p_period text, p_weight numeric, p_weight_date date, p_assumptions text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_id uuid; a hv.animals;
begin
  perform hv.require_perm('forecasts.write');
  select * into a from hv.animals where id = p_animal;
  if not found then raise exception 'Animal not found'; end if;
  if a.status in ('sold','deceased') then raise exception 'Forecasts cannot be prepared for a % animal', a.status; end if;
  if not exists (select 1 from hv.purchase_lines where animal_id = p_animal) then raise exception 'No purchase record — a forecast needs the actual purchase price'; end if;
  if p_date is null and coalesce(trim(p_period), '') = '' then raise exception 'Give an expected sale date or period'; end if;
  insert into hv.animal_forecasts (animal_id, expected_sale_price, expected_sale_date, expected_sale_period, estimated_weight_kg, estimated_weight_date, assumptions, prepared_by)
  values (p_animal, p_price, p_date, nullif(trim(p_period), ''), p_weight, p_weight_date, p_assumptions, hv.current_user_id())
  returning id into v_id;
  return v_id;
end $$;

create or replace function hv.publish_forecast(p_forecast uuid)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare f hv.animal_forecasts; a hv.animals;
begin
  perform hv.require_perm('portal.publish');
  select * into f from hv.animal_forecasts where id = p_forecast for update;
  if not found then raise exception 'Forecast not found'; end if;
  if f.status <> 'draft' then raise exception 'Only draft forecasts can be published (this one is %)', f.status; end if;
  select * into a from hv.animals where id = f.animal_id;
  if a.investor_id is null then raise exception 'This animal is not linked to an investor'; end if;
  update hv.animal_forecasts set status = 'superseded' where animal_id = f.animal_id and status = 'published';
  update hv.animal_forecasts set status = 'published', published_by = hv.current_user_id(), published_at = now() where id = p_forecast;
  perform hv.portal_notify(a.investor_id, 'forecast', 'Updated sale forecast for ' || a.code,
    'An estimate has been published. Estimates are not guaranteed.', '/portal/livestock/' || a.id);
end $$;

create or replace function hv.withdraw_forecast(p_forecast uuid, p_reason text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_any(array['portal.publish','forecasts.write']);
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  update hv.animal_forecasts set status = 'withdrawn', withdrawn_reason = p_reason
   where id = p_forecast and status in ('draft','published');
  if not found then raise exception 'Forecast not found or already closed'; end if;
end $$;

-- -------------------------------------------------- staff: animal updates --
create or replace function hv.publish_animal_update(p_animal uuid, p_kind text, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_id uuid; a hv.animals;
begin
  perform hv.require_perm('portal.publish');
  select * into a from hv.animals where id = p_animal;
  if not found then raise exception 'Animal not found'; end if;
  if a.investor_id is null then raise exception 'This animal is not linked to an investor'; end if;
  insert into hv.animal_updates (animal_id, kind, title, body, published_by) values (p_animal, p_kind, trim(p_title), trim(p_body), hv.current_user_id())
  returning id into v_id;
  perform hv.portal_notify(a.investor_id, case p_kind when 'health' then 'health' when 'sale' then 'sale_upcoming' else 'account' end,
    a.code || ': ' || trim(p_title), left(trim(p_body), 240), '/portal/livestock/' || a.id);
  return v_id;
end $$;

create or replace function hv.withdraw_animal_update(p_update uuid, p_reason text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_perm('portal.publish');
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  update hv.animal_updates set status = 'withdrawn', withdrawn_reason = p_reason where id = p_update and status = 'published';
  if not found then raise exception 'Update not found or already withdrawn'; end if;
end $$;

-- ------------------------------------------------ staff: payment requests --
create or replace function hv.create_payment_request(p_account uuid, p_amount numeric, p_reason text, p_clause text, p_due date)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare acc hv.investment_accounts; v_id uuid;
begin
  perform hv.require_perm('finance.write');
  select * into acc from hv.investment_accounts where id = p_account;
  if not found then raise exception 'Investment account not found'; end if;
  if acc.agreement_ref is null then
    raise exception 'Record the signed agreement reference on % before requesting a payment under it', acc.code;
  end if;
  insert into hv.payment_requests (account_id, investor_id, amount, reason, agreement_clause, due_date, created_by)
  values (p_account, acc.investor_id, p_amount, trim(p_reason), trim(p_clause), p_due, hv.current_user_id())
  returning id into v_id;
  return v_id;
end $$;

create or replace function hv.issue_payment_request(p_request uuid)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare r hv.payment_requests;
begin
  perform hv.require_perm('finance.approve');
  select * into r from hv.payment_requests where id = p_request for update;
  if not found then raise exception 'Payment request not found'; end if;
  if r.status <> 'draft' then raise exception 'Only draft requests can be issued (this one is %)', r.status; end if;
  if coalesce((hv.setting('dual_control') #>> '{}')::boolean, false) and r.created_by = hv.current_user_id() then
    raise exception 'Dual control is on: a different person must review and issue this request' using errcode = '42501';
  end if;
  update hv.payment_requests set status = 'issued', issued_by = hv.current_user_id(), issued_at = now() where id = p_request;
  perform hv.portal_notify(r.investor_id, 'payment_request', 'Payment request ' || r.code,
    'A payment request has been issued under your agreement (' || r.agreement_clause || ').', '/portal/transactions');
end $$;

create or replace function hv.close_payment_request(p_request uuid, p_status text, p_ledger uuid, p_note text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare r hv.payment_requests; l hv.ledger_entries;
begin
  perform hv.require_perm('finance.write');
  select * into r from hv.payment_requests where id = p_request for update;
  if not found then raise exception 'Payment request not found'; end if;
  if p_status not in ('paid','cancelled') then raise exception 'Invalid status'; end if;
  if r.status not in ('draft','issued') then raise exception 'This request is already %', r.status; end if;
  if p_status = 'paid' then
    if r.status <> 'issued' then raise exception 'Only an issued request can be marked paid'; end if;
    select * into l from hv.ledger_entries where id = p_ledger;
    if not found or l.account_id <> r.account_id or l.entry_type <> 'deposit' or l.status <> 'verified' then
      raise exception 'Link a verified deposit on the same account as evidence of payment';
    end if;
  elsif coalesce(trim(p_note), '') = '' then
    raise exception 'A reason is required to cancel a request';
  end if;
  update hv.payment_requests set status = p_status, ledger_entry_id = case when p_status = 'paid' then p_ledger end,
         closed_note = p_note, closed_by = hv.current_user_id(), closed_at = now() where id = p_request;
end $$;

-- --------------------------------------------- staff: identity & requests --
create or replace function hv.set_investor_identity(p_investor uuid, p_national_id text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_perm('investors.write');
  perform hv.require_perm('files.sensitive');
  if nullif(trim(p_national_id), '') is null then
    delete from hv.investor_identity where investor_id = p_investor;
  else
    insert into hv.investor_identity (investor_id, national_id, updated_by) values (p_investor, trim(p_national_id), hv.current_user_id())
    on conflict (investor_id) do update set national_id = excluded.national_id, updated_by = excluded.updated_by, updated_at = now();
  end if;
end $$;

-- masked identity number for anyone allowed to see the investor
create or replace function hv.investor_identity_masked(p_investor uuid)
returns text language sql stable security definer set search_path = hv, public, pg_temp as $$
  select hv.mask_identifier(national_id) from hv.investor_identity
   where investor_id = p_investor and hv.has_perm('investors.read')
$$;

create or replace function hv.resolve_change_request(p_request uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_any(array['portal.manage','investors.write']);
  if p_status not in ('resolved','declined') then raise exception 'Invalid status'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Add a note explaining what was done'; end if;
  update hv.portal_change_requests set status = p_status, resolution_note = p_note, resolved_by = hv.current_user_id(), resolved_at = now()
   where id = p_request and status = 'open';
  if not found then raise exception 'Request not found or already closed'; end if;
end $$;

-- ------------------------------------------- staff: portal account admin --
create or replace function hv.portal_invite(p_investor uuid, p_email text, p_token_hash text, p_hours int default 168)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare acc hv.portal_accounts; v_id uuid;
begin
  perform hv.require_perm('portal.manage');
  if not exists (select 1 from hv.investors where id = p_investor) then raise exception 'Investor not found'; end if;
  if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address'; end if;
  select * into acc from hv.portal_accounts where investor_id = p_investor for update;
  if found then
    if acc.status in ('active','suspended') then
      raise exception 'This investor already has an % portal account. Use a password reset or reactivate it instead.', acc.status;
    end if;
    update hv.portal_accounts set email = p_email::citext, status = 'invited', status_reason = null, password_hash = null,
           mfa_secret = null, mfa_enabled = false, invited_by = hv.current_user_id(), invited_at = now(), activated_at = null
     where id = acc.id;
    v_id := acc.id;
  else
    insert into hv.portal_accounts (investor_id, email, invited_by) values (p_investor, p_email::citext, hv.current_user_id())
    returning id into v_id;
  end if;
  update hv.portal_tokens set used_at = now() where account_id = v_id and used_at is null;
  insert into hv.portal_tokens (account_id, purpose, token_hash, expires_at, created_by)
  values (v_id, 'activation', p_token_hash, now() + make_interval(hours => p_hours), hv.current_user_id());
  perform hv.audit_event('PORTAL_INVITE', 'portal_accounts', v_id::text, 'invitation issued to ' || p_email);
  return v_id;
end $$;

create or replace function hv.portal_issue_reset(p_account uuid, p_token_hash text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_perm('portal.manage');
  if not exists (select 1 from hv.portal_accounts where id = p_account and status = 'active') then
    raise exception 'Password resets can only be issued for active accounts';
  end if;
  update hv.portal_tokens set used_at = now() where account_id = p_account and used_at is null;
  insert into hv.portal_tokens (account_id, purpose, token_hash, expires_at, created_by)
  values (p_account, 'reset', p_token_hash, now() + interval '24 hours', hv.current_user_id());
  perform hv.audit_event('PORTAL_RESET_ISSUED', 'portal_accounts', p_account::text, 'reset link issued by staff');
end $$;

create or replace function hv.portal_set_status(p_account uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare acc hv.portal_accounts;
begin
  perform hv.require_perm('portal.manage');
  select * into acc from hv.portal_accounts where id = p_account for update;
  if not found then raise exception 'Portal account not found'; end if;
  if p_status not in ('active','suspended','revoked') then raise exception 'Invalid status'; end if;
  if p_status = 'active' and (acc.status <> 'suspended' or acc.password_hash is null) then
    raise exception 'Only a suspended, previously activated account can be reactivated';
  end if;
  if p_status in ('suspended','revoked') and coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  update hv.portal_accounts set status = p_status, status_reason = p_reason, failed_logins = 0, locked_until = null where id = p_account;
  if p_status <> 'active' then
    update hv.portal_sessions set revoked_at = now() where account_id = p_account and revoked_at is null;
    update hv.portal_tokens set used_at = now() where account_id = p_account and used_at is null;
  end if;
end $$;

create or replace function hv.portal_reset_mfa(p_account uuid)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_perm('portal.manage');
  update hv.portal_accounts set mfa_enabled = false, mfa_secret = null where id = p_account;
  update hv.portal_sessions set revoked_at = now() where account_id = p_account and revoked_at is null;
  perform hv.audit_event('PORTAL_MFA_RESET', 'portal_accounts', p_account::text, 'two-step verification removed by staff');
end $$;

-- ===================================================== PORTAL CONTEXT ===
create or replace function hv.portal_account()
returns uuid language sql stable security definer set search_path = hv, public, pg_temp as $$
  select s.account_id from hv.portal_sessions s join hv.portal_accounts a on a.id = s.account_id
   where s.token_hash = nullif(current_setting('hv.portal_session', true), '')
     and s.revoked_at is null and s.expires_at > now() and s.mfa_passed and a.status = 'active'
$$;

create or replace function hv.portal_investor()
returns uuid language sql stable security definer set search_path = hv, public, pg_temp as $$
  select investor_id from hv.portal_accounts where id = hv.portal_account()
$$;

-- --------------------------------------------- portal auth (anonymous) --
create or replace function hv.portal_auth_lookup(p_email text)
returns table (id uuid, password_hash text, status text, locked_until timestamptz, mfa_enabled boolean)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select id, password_hash, status, locked_until, mfa_enabled from hv.portal_accounts where email = p_email::citext
$$;

create or replace function hv.portal_auth_failures(p_email text, p_ip text)
returns table (by_email int, by_ip int)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select
    (select count(*)::int from hv.login_attempts where channel = 'portal' and email = p_email::citext and not success and at > now() - interval '15 minutes'),
    (select count(*)::int from hv.login_attempts where channel = 'portal' and ip = p_ip and not success and at > now() - interval '15 minutes')
$$;

create or replace function hv.portal_auth_record(p_email text, p_account uuid, p_success boolean, p_ip text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  insert into hv.login_attempts (email, success, ip, channel) values (left(p_email, 200)::citext, p_success, p_ip, 'portal');
  if p_account is null then return; end if;
  if p_success then
    update hv.portal_accounts set failed_logins = 0, locked_until = null, last_login_at = now() where id = p_account;
    insert into hv.audit_log (action, table_name, record_id, note) values ('PORTAL_LOGIN', 'portal_accounts', p_account::text, p_ip);
  else
    update hv.portal_accounts set failed_logins = failed_logins + 1,
           locked_until = case when failed_logins + 1 >= 5 then now() + interval '15 minutes' else locked_until end
     where id = p_account;
  end if;
end $$;

create or replace function hv.portal_create_session(p_account uuid, p_token_hash text, p_hours int, p_mfa_passed boolean, p_ip text, p_ua text)
returns timestamptz language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_exp timestamptz := now() + make_interval(hours => p_hours);
begin
  if not exists (select 1 from hv.portal_accounts where id = p_account and status = 'active') then
    raise exception 'Account is not active' using errcode = '42501';
  end if;
  insert into hv.portal_sessions (account_id, token_hash, mfa_passed, expires_at, ip, user_agent)
  values (p_account, p_token_hash, p_mfa_passed, case when p_mfa_passed then v_exp else now() + interval '10 minutes' end, p_ip, left(p_ua, 300));
  delete from hv.portal_sessions where expires_at < now() - interval '7 days';
  return v_exp;
end $$;

create or replace function hv.portal_session_info(p_token_hash text)
returns table (account_id uuid, investor_id uuid, investor_code text, investor_name text, email text,
               mfa_enabled boolean, mfa_passed boolean, expires_at timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select a.id, i.id, i.code, i.full_legal_name, a.email::text, a.mfa_enabled, s.mfa_passed, s.expires_at
    from hv.portal_sessions s join hv.portal_accounts a on a.id = s.account_id join hv.investors i on i.id = a.investor_id
   where s.token_hash = p_token_hash and s.revoked_at is null and s.expires_at > now() and a.status = 'active'
$$;

create or replace function hv.portal_revoke_session(p_token_hash text)
returns void language sql security definer set search_path = hv, public, pg_temp as $$
  update hv.portal_sessions set revoked_at = now() where token_hash = p_token_hash and revoked_at is null
$$;

-- second step: the server verifies the TOTP code against this secret
create or replace function hv.portal_mfa_pending(p_token_hash text)
returns table (account_id uuid, secret text, attempts int)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select a.id, a.mfa_secret, s.mfa_attempts from hv.portal_sessions s join hv.portal_accounts a on a.id = s.account_id
   where s.token_hash = p_token_hash and not s.mfa_passed and s.revoked_at is null and s.expires_at > now()
     and a.status = 'active' and a.mfa_enabled
$$;

create or replace function hv.portal_mfa_result(p_token_hash text, p_success boolean, p_hours int)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  if p_success then
    update hv.portal_sessions set mfa_passed = true, expires_at = now() + make_interval(hours => p_hours)
     where token_hash = p_token_hash and not mfa_passed and revoked_at is null and expires_at > now();
  else
    update hv.portal_sessions set mfa_attempts = mfa_attempts + 1,
           revoked_at = case when mfa_attempts + 1 >= 5 then now() end
     where token_hash = p_token_hash and not mfa_passed and revoked_at is null;
  end if;
end $$;

-- activation / reset links
create or replace function hv.portal_token_info(p_token_hash text)
returns table (purpose text, email text, investor_name text, valid boolean)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select t.purpose, a.email::text, i.full_legal_name,
         t.used_at is null and t.expires_at > now()
           and ((t.purpose = 'activation' and a.status = 'invited') or (t.purpose = 'reset' and a.status = 'active'))
    from hv.portal_tokens t join hv.portal_accounts a on a.id = t.account_id join hv.investors i on i.id = a.investor_id
   where t.token_hash = p_token_hash
$$;

create or replace function hv.portal_use_token(p_token_hash text, p_password_hash text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare t hv.portal_tokens; a hv.portal_accounts;
begin
  select * into t from hv.portal_tokens where token_hash = p_token_hash for update;
  if not found or t.used_at is not null or t.expires_at <= now() then
    raise exception 'This link is invalid or has expired. Ask Herdvest for a new one.' using errcode = 'P0001';
  end if;
  select * into a from hv.portal_accounts where id = t.account_id for update;
  if not ((t.purpose = 'activation' and a.status = 'invited') or (t.purpose = 'reset' and a.status = 'active')) then
    raise exception 'This link is no longer valid. Ask Herdvest for a new one.' using errcode = 'P0001';
  end if;
  update hv.portal_tokens set used_at = now() where id = t.id;
  update hv.portal_accounts set password_hash = p_password_hash, failed_logins = 0, locked_until = null,
         status = 'active', activated_at = coalesce(activated_at, now())
   where id = a.id;
  update hv.portal_sessions set revoked_at = now() where account_id = a.id and revoked_at is null;
  insert into hv.audit_log (action, table_name, record_id, note)
  values (case when t.purpose = 'activation' then 'PORTAL_ACTIVATED' else 'PORTAL_PASSWORD_RESET' end, 'portal_accounts', a.id::text, null);
  return a.id;
end $$;

-- self-service reset request: returns true when a token was created
create or replace function hv.portal_request_reset(p_email text, p_token_hash text)
returns boolean language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare a hv.portal_accounts;
begin
  select * into a from hv.portal_accounts where email = p_email::citext and status = 'active';
  if not found then return false; end if;
  if (select count(*) from hv.portal_tokens where account_id = a.id and purpose = 'reset' and created_at > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  insert into hv.portal_tokens (account_id, purpose, token_hash, expires_at) values (a.id, 'reset', p_token_hash, now() + interval '1 hour');
  insert into hv.audit_log (action, table_name, record_id, note) values ('PORTAL_RESET_REQUESTED', 'portal_accounts', a.id::text, null);
  return true;
end $$;

-- ------------------------------------------ portal self-service (session) --
create or replace function hv.portal_self_password(p_hash text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_acc uuid := hv.portal_account();
begin
  if v_acc is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  update hv.portal_accounts set password_hash = p_hash where id = v_acc;
  update hv.portal_sessions set revoked_at = now()
   where account_id = v_acc and revoked_at is null and token_hash <> current_setting('hv.portal_session', true);
  insert into hv.audit_log (action, table_name, record_id, note) values ('PORTAL_PASSWORD_CHANGED', 'portal_accounts', v_acc::text, 'self');
end $$;

create or replace function hv.portal_self_email()
returns text language sql stable security definer set search_path = hv, public, pg_temp as $$
  select email::text from hv.portal_accounts where id = hv.portal_account()
$$;

create or replace function hv.portal_self_mfa_secret()
returns text language sql stable security definer set search_path = hv, public, pg_temp as $$
  select mfa_secret from hv.portal_accounts where id = hv.portal_account()
$$;

create or replace function hv.portal_self_mfa(p_secret text, p_enabled boolean)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_acc uuid := hv.portal_account();
begin
  if v_acc is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  update hv.portal_accounts set mfa_secret = p_secret, mfa_enabled = p_enabled and p_secret is not null where id = v_acc;
  insert into hv.audit_log (action, table_name, record_id, note)
  values (case when p_enabled then 'PORTAL_MFA_ENABLED' when p_secret is null then 'PORTAL_MFA_DISABLED' else 'PORTAL_MFA_SETUP' end, 'portal_accounts', v_acc::text, 'self');
end $$;

create or replace function hv.portal_request_change(p_field text, p_value text, p_message text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_inv uuid := hv.portal_investor();
begin
  if v_inv is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if (select count(*) from hv.portal_change_requests where investor_id = v_inv and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many requests today. Please contact Herdvest directly.';
  end if;
  insert into hv.portal_change_requests (investor_id, field, requested_value, message)
  values (v_inv, p_field, left(nullif(trim(p_value), ''), 500), left(nullif(trim(p_message), ''), 2000));
end $$;

create or replace function hv.portal_mark_read(p_notification uuid)
returns void language sql security definer set search_path = hv, public, pg_temp as $$
  update hv.portal_notifications set read_at = now()
   where investor_id = hv.portal_investor() and read_at is null and (p_notification is null or id = p_notification)
$$;

-- ------------------------------------------------- portal: read models --
create or replace function hv.portal_profile()
returns table (investor_code text, full_legal_name text, email text, phone text, address text, city text, country text,
               registered_on date, contact_preference text, national_id_masked text, identity_document_on_file boolean,
               login_email text, mfa_enabled boolean, last_login_at timestamptz, investor_status text)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select i.code, i.full_legal_name, i.email::text, i.phone, i.address, i.city, i.country, i.registered_on, i.contact_preference,
         hv.mask_identifier((select national_id from hv.investor_identity where investor_id = i.id)),
         exists (select 1 from hv.attachments at where at.entity_type = 'investor' and at.entity_id = i.id and at.category = 'identity_document' and at.deleted_at is null),
         a.email::text, a.mfa_enabled, a.last_login_at, i.status
    from hv.investors i join hv.portal_accounts a on a.investor_id = i.id
   where i.id = hv.portal_investor() and a.id = hv.portal_account()
$$;

create or replace function hv.portal_change_requests_list()
returns table (id uuid, field text, requested_value text, status text, created_at timestamptz, resolved_at timestamptz, resolution_note text)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select id, field, requested_value, status, created_at, resolved_at, resolution_note
    from hv.portal_change_requests where investor_id = hv.portal_investor() order by created_at desc
$$;

create or replace function hv.portal_accounts_overview()
returns table (account_id uuid, code text, name text, status text, agreement_ref text, investor_share_pct numeric, service_fee_pct numeric,
               opened_on date, agreed_budget numeric, funds_received numeric, purchases_allocated numeric, expenses_charged numeric,
               returned_to_investor numeric, adjustments_net numeric, pending_deposits numeric, pending_outflows numeric, unallocated numeric,
               purchases_committed numeric, purchases_unverified numeric)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select a.id, a.code, a.name, a.status, a.agreement_ref, a.investor_share_pct, a.service_fee_pct, a.opened_on, a.agreed_budget,
         b.funds_received, b.purchases_allocated, b.expenses_charged, b.returned_to_investor, b.adjustments_net,
         b.pending_deposits, b.pending_outflows, b.unallocated,
         coalesce((select sum(amount) from hv.ledger_entries l where l.account_id = a.id and l.entry_type = 'purchase_allocation' and l.status in ('verified','pending')), 0),
         coalesce((select sum(amount) from hv.ledger_entries l where l.account_id = a.id and l.entry_type = 'purchase_allocation' and l.status = 'pending'), 0)
    from hv.investment_accounts a cross join lateral hv.account_balance_row(a.id) b
   where a.investor_id = hv.portal_investor()
   order by a.opened_on, a.code
$$;

-- per-animal investor view (shared by list and detail)
create or replace function hv.portal_animals()
returns table (id uuid, code text, species text, breed text, sex text, color text, tag_number text, age_months_estimate int,
               birth_date_estimate date, status text, account_code text, purchase_date date, purchase_price numeric,
               condition_at_purchase text, vet_assessment_at_purchase text,
               farmer_label text, farm_area text, allocated_since date,
               latest_weight numeric, latest_weight_date date, latest_condition text, latest_condition_date date,
               last_inspection date, next_inspection_due date, inspection_state text, inspection_interval_months int,
               cover_photo uuid, sale_date date, sale_price numeric, settlement_status text)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select a.id, a.code, a.species, a.breed, a.sex, a.color, a.tag_number, a.age_months_estimate, a.birth_date_estimate, a.status,
         ac.code, p.purchase_date, pl.price, a.condition_at_purchase, a.vet_assessment_at_purchase,
         case when f.id is null then null
              when coalesce((hv.setting('portal_show_farmer_name') #>> '{}')::boolean, false) then f.full_name || ' (' || f.code || ')'
              else 'Partner farmer ' || f.code end,
         nullif(concat_ws(', ', f.district, f.city), ''),
         (select max(al.start_date) from hv.allocations al where al.animal_id = a.id and al.status = 'active'),
         w.weight, w.measured_on, vc.condition, vc.visit_date,
         ins.last_completed, ins.next_due, ins.state, ins.interval_months,
         (select at.id from hv.attachments at where at.entity_type = 'animal' and at.entity_id = a.id and at.investor_visible
             and at.deleted_at is null and at.mime_type in ('image/jpeg','image/png','image/webp') order by at.uploaded_at desc limit 1),
         case when st.status in ('approved','partially_paid','paid') then s.sale_date end,
         case when st.status in ('approved','partially_paid','paid') then s.sale_price end,
         case when st.status in ('approved','partially_paid','paid') then st.status when s.id is not null and s.status = 'recorded' then 'under_review' end
    from hv.animals a
    left join hv.investment_accounts ac on ac.id = a.account_id
    left join hv.purchase_lines pl on pl.animal_id = a.id
    left join hv.purchases p on p.id = pl.purchase_id
    left join hv.farmers f on f.id = a.current_farmer_id
    left join lateral (select x.weight, x.measured_on from (
                select ww.weight, ww.measured_on, ww.published_at from hv.animal_weights ww where ww.animal_id = a.id and ww.investor_visible and ww.voided_at is null
                union all
                select v.weight_kg, v.visit_date, v.published_at from hv.vet_records v where v.animal_id = a.id and v.investor_visible and v.weight_kg is not null
                  and not exists (select 1 from hv.animal_weights x2 where x2.vet_record_id = v.id)
              ) x order by x.measured_on desc, x.published_at desc limit 1) w on true
    left join lateral (select v.condition, v.visit_date from hv.vet_records v where v.animal_id = a.id and v.investor_visible and v.condition is not null
                        order by v.visit_date desc nulls last limit 1) vc on true
    left join lateral hv.inspection_status(a.id) ins on true
    left join hv.sales s on s.animal_id = a.id and s.status = 'recorded'
    left join hv.settlements st on st.sale_id = s.id
   where a.investor_id = hv.portal_investor() and hv.portal_investor() is not null
   order by a.code
$$;

create or replace function hv.portal_owns_animal(p_animal uuid)
returns boolean language sql stable security definer set search_path = hv, public, pg_temp as $$
  select exists (select 1 from hv.animals where id = p_animal and investor_id = hv.portal_investor() and hv.portal_investor() is not null)
$$;

-- inspection & veterinary history; unpublished reports show only as "awaiting review"
create or replace function hv.portal_inspections(p_animal uuid default null)
returns table (id uuid, animal_id uuid, animal_code text, code text, visit_type text, state text, event_date date,
               performed_by text, condition text, weight_kg numeric, findings text, vaccine_name text, vaccination_date date,
               treatment text, follow_up text, next_due_date date, summary text, published_at timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select v.id, a.id, a.code, v.code, v.visit_type,
         case when v.status = 'completed' and v.investor_visible then 'completed'
              when v.status = 'completed' then 'awaiting_review'
              when v.status = 'scheduled' and v.scheduled_date < current_date then 'overdue'
              when v.status = 'scheduled' then 'scheduled'
              else v.status end,
         coalesce(v.visit_date, v.scheduled_date),
         case when v.investor_visible then v.performed_by end,
         case when v.investor_visible then v.condition end,
         case when v.investor_visible then v.weight_kg end,
         case when v.investor_visible then v.findings end,
         case when v.investor_visible then v.vaccine_name end,
         case when v.investor_visible then v.vaccination_date end,
         case when v.investor_visible then v.treatment end,
         case when v.investor_visible then v.follow_up end,
         case when v.investor_visible then v.next_due_date end,
         case when v.investor_visible then v.investor_summary end,
         v.published_at
    from hv.vet_records v join hv.animals a on a.id = v.animal_id
   where a.investor_id = hv.portal_investor() and hv.portal_investor() is not null
     and (p_animal is null or a.id = p_animal)
     and v.status in ('completed','scheduled')
   order by coalesce(v.visit_date, v.scheduled_date) desc nulls last, v.code desc
$$;

create or replace function hv.portal_weights(p_animal uuid)
returns table (id uuid, measured_on date, weight numeric, unit text, source text, measured_by text, notes text, reference text)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select * from (
    select w.id, w.measured_on, w.weight, w.unit, w.method, w.measured_by, w.notes, w.code
      from hv.animal_weights w where w.animal_id = p_animal and w.investor_visible and w.voided_at is null
    union all
    select v.id, v.visit_date, v.weight_kg, 'kg', 'veterinary_record', v.performed_by, null, v.code
      from hv.vet_records v where v.animal_id = p_animal and v.investor_visible and v.weight_kg is not null and v.visit_date is not null
       and not exists (select 1 from hv.animal_weights x where x.vet_record_id = v.id)
  ) x where hv.portal_owns_animal(p_animal)
  order by measured_on
$$;

create or replace function hv.portal_forecasts(p_animal uuid default null)
returns table (animal_id uuid, animal_code text, purchase_price numeric, expected_sale_price numeric, expected_sale_date date,
               expected_sale_period text, estimated_weight_kg numeric, estimated_weight_date date, assumptions text,
               investor_share_pct numeric, service_fee_pct numeric, profit_pool numeric, investor_gross numeric, farmer_share numeric,
               herdvest_fee numeric, investor_net numeric, capital_shortfall numeric, investor_total numeric,
               published_at timestamptz, published_by_role text)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select a.id, a.code, pl.price, f.expected_sale_price, f.expected_sale_date, f.expected_sale_period, f.estimated_weight_kg,
         f.estimated_weight_date, f.assumptions, ac.investor_share_pct, ac.service_fee_pct,
         ff.profit_pool, ff.investor_gross, ff.farmer_share, ff.herdvest_fee, ff.investor_net, ff.capital_shortfall, ff.investor_total,
         f.published_at, r.name
    from hv.animal_forecasts f
    join hv.animals a on a.id = f.animal_id
    join hv.purchase_lines pl on pl.animal_id = a.id
    join hv.investment_accounts ac on ac.id = a.account_id
    left join hv.users u on u.id = f.published_by
    left join hv.roles r on r.id = u.role_id
    cross join lateral hv.forecast_figures(pl.price, f.expected_sale_price, ac.investor_share_pct, ac.service_fee_pct) ff
   where f.status = 'published' and a.status not in ('sold','deceased')
     and a.investor_id = hv.portal_investor() and hv.portal_investor() is not null
     and (p_animal is null or a.id = p_animal)
   order by a.code
$$;

create or replace function hv.portal_updates(p_animal uuid)
returns table (id uuid, kind text, title text, body text, published_at timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select u.id, u.kind, u.title, u.body, u.published_at from hv.animal_updates u
   where u.animal_id = p_animal and u.status = 'published' and hv.portal_owns_animal(p_animal)
   order by u.published_at desc
$$;

create or replace function hv.portal_status_history(p_animal uuid)
returns table (to_status text, changed_at timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select h.to_status, h.changed_at from hv.animal_status_history h
   where h.animal_id = p_animal and hv.portal_owns_animal(p_animal) order by h.changed_at desc
$$;

create or replace function hv.portal_settlement(p_animal uuid)
returns table (code text, sale_date date, gross_proceeds numeric, deducted_sale_expenses numeric, net_proceeds numeric, purchase_cost numeric,
               capital_returned numeric, capital_shortfall numeric, profit_pool numeric, investor_share_pct numeric, service_fee_pct numeric,
               investor_gross numeric, farmer_share numeric, herdvest_fee numeric, investor_net numeric, investor_payable numeric,
               paid_to_investor numeric, outstanding numeric, status text, approved_at timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select st.code, s.sale_date, st.gross_proceeds, st.deducted_sale_expenses, st.net_proceeds, st.purchase_cost, st.capital_returned,
         st.capital_shortfall, st.profit_pool, st.investor_share_pct, st.service_fee_pct, st.investor_gross, st.farmer_share,
         st.herdvest_fee, st.investor_net, st.investor_payable, p.paid, st.investor_payable - p.paid, st.status, st.approved_at
    from hv.sales s join hv.settlements st on st.sale_id = s.id
    cross join lateral (select coalesce(sum(amount), 0) paid from hv.settlement_payments sp where sp.settlement_id = st.id and sp.payee = 'investor') p
   where s.animal_id = p_animal and s.status = 'recorded' and st.status in ('approved','partially_paid','paid')
     and hv.portal_owns_animal(p_animal)
$$;

-- files an investor may see: published, not sensitive, on one of their own records,
-- and (for veterinary/weight records) only while that record itself is published
create or replace function hv.portal_files()
returns table (id uuid, entity_type text, entity_id uuid, entity_label text, animal_id uuid, category text, caption text,
               original_name text, mime_type text, size_bytes bigint, uploaded_at timestamptz, published_at timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select f.id, f.entity_type, f.entity_id,
         case f.entity_type
           when 'investor' then 'Your profile'
           when 'account' then 'Account ' || (select code from hv.investment_accounts where id = f.entity_id)
           when 'ledger_entry' then 'Transaction ' || (select code from hv.ledger_entries where id = f.entity_id)
           when 'animal' then 'Animal ' || (select code from hv.animals where id = f.entity_id)
           when 'purchase' then 'Purchase ' || (select code from hv.purchases where id = f.entity_id)
           when 'allocation' then 'Farmer handover · ' || (select a.code from hv.allocations al join hv.animals a on a.id = al.animal_id where al.id = f.entity_id)
           when 'vet_record' then 'Report ' || (select code from hv.vet_records where id = f.entity_id)
           when 'sale' then 'Sale ' || (select code from hv.sales where id = f.entity_id)
           when 'settlement' then 'Settlement ' || (select code from hv.settlements where id = f.entity_id)
           when 'animal_weight' then 'Weight ' || (select code from hv.animal_weights where id = f.entity_id)
           when 'payment_request' then 'Payment request ' || (select code from hv.payment_requests where id = f.entity_id)
           when 'expense' then 'Expense ' || (select code from hv.expenses where id = f.entity_id)
         end,
         case f.entity_type
           when 'animal' then f.entity_id
           when 'vet_record' then (select animal_id from hv.vet_records where id = f.entity_id)
           when 'animal_weight' then (select animal_id from hv.animal_weights where id = f.entity_id)
           when 'allocation' then (select animal_id from hv.allocations where id = f.entity_id)
           when 'sale' then (select animal_id from hv.sales where id = f.entity_id)
         end,
         f.category, f.caption, f.original_name, f.mime_type, f.size_bytes, f.uploaded_at, f.published_at
    from hv.attachments f
   where f.investor_visible and not f.sensitive and f.deleted_at is null
     and hv.portal_investor() is not null
     and hv.entity_investor(f.entity_type, f.entity_id) = hv.portal_investor()
     and (f.entity_type <> 'vet_record' or exists (select 1 from hv.vet_records v where v.id = f.entity_id and v.investor_visible))
     and (f.entity_type <> 'animal_weight' or exists (select 1 from hv.animal_weights w where w.id = f.entity_id and w.investor_visible and w.voided_at is null))
     and (f.entity_type <> 'settlement' or exists (select 1 from hv.settlements st where st.id = f.entity_id and st.status in ('approved','partially_paid','paid')))
   order by f.published_at desc nulls last
$$;

-- download check; records the access in the audit log
create or replace function hv.portal_file(p_file uuid)
returns table (original_name text, mime_type text, storage_key text)
language plpgsql volatile security definer set search_path = hv, public, pg_temp as $$
begin
  if not exists (select 1 from hv.portal_files() x where x.id = p_file) then return; end if;
  insert into hv.audit_log (action, table_name, record_id, note)
  values ('PORTAL_FILE', 'attachments', p_file::text, 'investor ' || hv.portal_investor());
  return query select a.original_name, a.mime_type, a.storage_key from hv.attachments a where a.id = p_file;
end $$;

create or replace function hv.portal_log(p_action text)
returns void language sql security definer set search_path = hv, public, pg_temp as $$
  insert into hv.audit_log (action, table_name, record_id, note)
  select 'PORTAL_' || upper(p_action), 'investors', hv.portal_investor()::text, 'investor portal'
   where hv.portal_investor() is not null and p_action in ('statement')
$$;

-- investor ledger: actual money (cash), approved settlement figures and payment requests
create or replace function hv.portal_transactions()
returns table (occurred_at timestamptz, reference text, kind text, description text, animal_codes text, amount numeric,
               direction text, status text, category text, document_ids uuid[])
language sql stable security definer set search_path = hv, public, pg_temp as $$
  with me as (select hv.portal_investor() id),
  docs as (select entity_type, entity_id, array_agg(id order by published_at) ids from hv.portal_files() group by 1, 2)
  select * from (
    select l.occurred_at, l.code, l.entry_type,
           case l.entry_type
             when 'deposit' then 'Funds received' || coalesce(' · ref ' || l.reference, '')
             when 'purchase_allocation' then 'Purchase of livestock' || coalesce(' (' || (select code from hv.purchases where id = l.purchase_id) || ')', '')
             when 'expense_charge' then 'Approved investment expense · ' || coalesce((select description from hv.expenses where id = l.expense_id), '')
             when 'refund_to_investor' then 'Capital returned to you'
             when 'adjustment_in' then 'Adjustment (credit)' || coalesce(' · ' || l.notes, '')
             when 'adjustment_out' then 'Adjustment (debit)' || coalesce(' · ' || l.notes, '')
             when 'reversal' then 'Reversal of an earlier entry'
           end,
           case l.entry_type
             when 'purchase_allocation' then (select string_agg(a.code, ', ' order by a.code) from hv.purchase_lines pl join hv.animals a on a.id = pl.animal_id where pl.purchase_id = l.purchase_id)
             when 'expense_charge' then (select string_agg(a.code, ', ' order by a.code) from hv.expense_allocations ea join hv.animals a on a.id = ea.animal_id where ea.expense_id = l.expense_id)
           end,
           l.amount,
           case when l.entry_type in ('deposit','adjustment_in') then 'in' when l.entry_type = 'reversal' then 'info' else 'out' end,
           l.status, 'cash', (select ids from docs where docs.entity_type = 'ledger_entry' and docs.entity_id = l.id)
      from hv.ledger_entries l, me where l.investor_id = me.id
    union all
    -- approved settlements: calculated statement lines (not cash movements)
    select st.approved_at, st.code, x.kind, x.label || ' · sale ' || s.code, a.code, x.amount, 'info', st.status, 'settlement',
           (select ids from docs where docs.entity_type = 'settlement' and docs.entity_id = st.id)
      from me, hv.settlements st join hv.sales s on s.id = st.sale_id join hv.animals a on a.id = s.animal_id
      cross join lateral (values
        ('sale_proceeds', 'Animal sale proceeds (gross)', st.gross_proceeds),
        ('capital_returned', 'Capital returned from sale', st.capital_returned),
        ('investor_profit', 'Your gross profit share', st.investor_gross),
        ('herdvest_fee', 'Herdvest service fee (charged once on this sale)', st.herdvest_fee),
        ('farmer_settlement', 'Farmer profit share', st.farmer_share),
        ('capital_shortfall', 'Capital shortfall (loss)', st.capital_shortfall),
        ('investor_payable', 'Approved amount payable to you', st.investor_payable)
      ) x(kind, label, amount)
     where s.investor_id = me.id and st.status in ('approved','partially_paid','paid') and x.amount <> 0
    union all
    select p.paid_at, st.code, 'settlement_payment', 'Settlement payment to you · sale ' || s.code, a.code, p.amount, 'out', 'paid', 'cash',
           (select ids from docs where docs.entity_type = 'settlement' and docs.entity_id = st.id)
      from hv.settlement_payments p join hv.settlements st on st.id = p.settlement_id join hv.sales s on s.id = st.sale_id
      join hv.animals a on a.id = s.animal_id, me
     where p.payee = 'investor' and s.investor_id = me.id
    union all
    select coalesce(r.issued_at, r.created_at), r.code, 'payment_request',
           'Payment requested under agreement (' || r.agreement_clause || ') · ' || r.reason || coalesce(' · due ' || to_char(r.due_date, 'DD Mon YYYY'), ''),
           null, r.amount, 'request', case when r.status = 'issued' then 'outstanding' else r.status end, 'request',
           (select ids from docs where docs.entity_type = 'payment_request' and docs.entity_id = r.id)
      from hv.payment_requests r, me where r.investor_id = me.id and r.status in ('issued','paid','cancelled')
  ) t where (select id from me) is not null
  order by 1 desc, 2
$$;

create or replace function hv.portal_summary()
returns table (funds_received numeric, purchases_allocated numeric, purchases_unverified numeric, expenses_charged numeric, returned_to_investor numeric,
               unallocated numeric, pending_deposits numeric, agreed_budget numeric,
               active_animals int, sold_animals int, deceased_animals int, total_animals int,
               due_from_investor numeric, due_to_investor numeric, paid_to_investor numeric,
               realized_profit numeric, realized_loss numeric, realized_net numeric, settled_sales int, settlements_under_review int,
               estimated_value numeric, estimated_value_animals int, unread_notifications int)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  with me as (select hv.portal_investor() id),
  acc as (select * from hv.portal_accounts_overview()),
  sx as (select t.*, (select coalesce(sum(amount),0) from hv.settlement_payments p where p.settlement_id = t.id and p.payee = 'investor') paid
           from hv.settlements t join hv.sales s on s.id = t.sale_id, me where s.investor_id = me.id and s.status = 'recorded')
  select coalesce((select sum(funds_received) from acc), 0), coalesce((select sum(purchases_committed) from acc), 0),
         coalesce((select sum(purchases_unverified) from acc), 0),
         coalesce((select sum(expenses_charged) from acc), 0), coalesce((select sum(returned_to_investor) from acc), 0),
         coalesce((select sum(unallocated) from acc), 0), coalesce((select sum(pending_deposits) from acc), 0),
         (select sum(agreed_budget) from acc),
         (select count(*)::int from hv.animals a, me where a.investor_id = me.id and a.status not in ('sold','deceased')),
         (select count(*)::int from hv.animals a, me where a.investor_id = me.id and a.status = 'sold'),
         (select count(*)::int from hv.animals a, me where a.investor_id = me.id and a.status = 'deceased'),
         (select count(*)::int from hv.animals a, me where a.investor_id = me.id),
         coalesce((select sum(amount) from hv.payment_requests r, me where r.investor_id = me.id and r.status = 'issued'), 0),
         coalesce((select sum(investor_payable - paid) from sx where status in ('approved','partially_paid','paid')), 0),
         coalesce((select sum(paid) from sx), 0),
         coalesce((select sum(investor_net) from sx where status in ('approved','partially_paid','paid') and investor_net > 0), 0),
         coalesce((select sum(capital_shortfall) from sx where status in ('approved','partially_paid','paid')), 0),
         coalesce((select sum(investor_net) from sx where status in ('approved','partially_paid','paid')), 0),
         (select count(*)::int from sx where status in ('approved','partially_paid','paid')),
         (select count(*)::int from sx where status in ('calculated','review_required')),
         (select sum(expected_sale_price) from hv.portal_forecasts()),
         (select count(*)::int from hv.portal_forecasts()),
         (select count(*)::int from hv.portal_notifications n, me where n.investor_id = me.id and n.read_at is null)
    from me where me.id is not null
$$;

create or replace function hv.portal_notifications_list(p_limit int default 50)
returns table (id uuid, kind text, title text, body text, link text, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select id, kind, title, body, link, created_at, read_at from hv.portal_notifications
   where investor_id = hv.portal_investor() and hv.portal_investor() is not null
   order by created_at desc limit least(p_limit, 200)
$$;

-- ------------------------------------------------ notification email queue --
create or replace function hv.notification_email_queue()
returns table (id uuid, email text, investor_name text, title text, body text, link text)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select n.id, a.email::text, i.full_legal_name, n.title, n.body, n.link
    from hv.portal_notifications n join hv.portal_accounts a on a.investor_id = n.investor_id and a.status = 'active'
    join hv.investors i on i.id = n.investor_id
   where n.email_status = 'pending' and hv.is_authenticated()
   order by n.created_at limit 50
$$;

create or replace function hv.notification_email_mark(p_id uuid, p_status text)
returns void language sql security definer set search_path = hv, public, pg_temp as $$
  update hv.portal_notifications set email_status = p_status
   where id = p_id and email_status = 'pending' and p_status in ('sent','failed','not_configured') and hv.is_authenticated()
$$;

-- ================================================================= RLS ===
do $$
declare t text;
begin
  foreach t in array array['investor_identity','portal_accounts','portal_tokens','portal_sessions','animal_care_plans','animal_weights',
                           'animal_forecasts','animal_updates','payment_requests','portal_notifications','portal_change_requests'] loop
    execute format('alter table hv.%I enable row level security', t);
    execute format('alter table hv.%I force row level security', t);
    execute format('create policy owner_all on hv.%I to %I using (true) with check (true)', t, current_user);
  end loop;
end $$;

-- staff reads (writes go through the functions above)
create policy read on hv.investor_identity for select to herdvest_app using (hv.has_perm('files.sensitive') and hv.has_perm('investors.read'));
create policy read on hv.portal_accounts for select to herdvest_app using (hv.has_perm('portal.manage') or hv.has_perm('investors.read'));
create policy read on hv.animal_care_plans for select to herdvest_app using (hv.has_perm('livestock.read') or hv.is_assigned_animal(animal_id));
create policy read on hv.animal_weights for select to herdvest_app
  using (hv.has_perm('livestock.read') or hv.has_perm('vet.read') or hv.is_assigned_animal(animal_id));
create policy read on hv.animal_forecasts for select to herdvest_app
  using (hv.has_perm('forecasts.write') or hv.has_perm('portal.publish') or hv.has_perm('finance.read'));
create policy read on hv.animal_updates for select to herdvest_app using (hv.has_perm('livestock.read'));
create policy read on hv.payment_requests for select to herdvest_app using (hv.has_perm('finance.read'));
create policy read on hv.portal_notifications for select to herdvest_app using (hv.has_perm('portal.manage'));
create policy read on hv.portal_change_requests for select to herdvest_app using (hv.has_perm('portal.manage') or hv.has_perm('investors.read'));

grant select on hv.investor_identity, hv.animal_care_plans, hv.animal_weights, hv.animal_forecasts, hv.animal_updates,
  hv.payment_requests, hv.portal_notifications, hv.portal_change_requests to herdvest_app;
-- password hashes, MFA secrets, tokens and sessions are never readable by the app role
grant select (id, investor_id, email, status, status_reason, mfa_enabled, failed_logins, locked_until, last_login_at,
              invited_by, invited_at, activated_at, created_at, updated_at) on hv.portal_accounts to herdvest_app;
revoke all on hv.portal_tokens, hv.portal_sessions from herdvest_app;
-- publication columns are changed only by the publication functions
revoke update on hv.vet_records from herdvest_app;
grant update (animal_id, visit_type, status, scheduled_date, visit_date, performed_by, employee_id, location, findings, condition,
              weight_kg, vaccine_name, vaccination_date, next_due_date, treatment, follow_up, cost, notes, source_intake_id, updated_at)
  on hv.vet_records to herdvest_app;
grant usage on all sequences in schema hv to herdvest_app;
grant execute on all functions in schema hv to herdvest_app;
revoke execute on function hv.portal_notify(uuid, text, text, text, text) from herdvest_app;
