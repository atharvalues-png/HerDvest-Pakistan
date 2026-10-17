-- ============================================================================
-- Herdvest Management System — 005 authentication helpers
-- Called by the server before a user is known (login / session lookup), so
-- they are SECURITY DEFINER. Session tokens are stored only as SHA-256 hashes.
-- ============================================================================

create or replace function hv.auth_lookup(p_email text)
returns table (id uuid, password_hash text, is_active boolean, locked_until timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select id, password_hash, is_active, locked_until from hv.users where email = p_email::citext
$$;

create or replace function hv.auth_recent_failures(p_email text, p_ip text)
returns table (by_email int, by_ip int)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select
    (select count(*)::int from hv.login_attempts where email = p_email::citext and not success and at > now() - interval '15 minutes'),
    (select count(*)::int from hv.login_attempts where ip = p_ip and not success and at > now() - interval '15 minutes')
$$;

create or replace function hv.auth_record_attempt(p_email text, p_user uuid, p_success boolean, p_ip text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  insert into hv.login_attempts (email, success, ip) values (p_email::citext, p_success, p_ip);
  if p_user is null then return; end if;
  perform set_config('hv.user_id', p_user::text, true);
  if p_success then
    update hv.users set failed_logins = 0, locked_until = null, last_login_at = now() where id = p_user;
    insert into hv.audit_log (user_id, action, table_name, record_id, note) values (p_user, 'LOGIN', 'users', p_user::text, p_ip);
  else
    update hv.users set failed_logins = failed_logins + 1,
           locked_until = case when failed_logins + 1 >= 5 then now() + interval '15 minutes' else locked_until end
     where id = p_user;
  end if;
end $$;

create or replace function hv.auth_create_session(p_user uuid, p_token_hash text, p_hours int, p_ip text, p_ua text)
returns timestamptz language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_exp timestamptz := now() + make_interval(hours => p_hours);
begin
  insert into hv.sessions (user_id, token_hash, expires_at, ip, user_agent) values (p_user, p_token_hash, v_exp, p_ip, left(p_ua, 300));
  delete from hv.sessions where expires_at < now() - interval '7 days';
  return v_exp;
end $$;

create or replace function hv.auth_session(p_token_hash text)
returns table (user_id uuid, email text, full_name text, role_id text, role_name text, employee_id uuid,
               must_change_password boolean, permissions text[], expires_at timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select u.id, u.email::text, u.full_name, u.role_id, r.name, u.employee_id, u.must_change_password,
         coalesce(array(select permission_id from hv.role_permissions rp where rp.role_id = u.role_id order by 1), '{}'),
         s.expires_at
  from hv.sessions s
  join hv.users u on u.id = s.user_id
  join hv.roles r on r.id = u.role_id
  where s.token_hash = p_token_hash and s.revoked_at is null and s.expires_at > now() and u.is_active
$$;

create or replace function hv.auth_revoke_session(p_token_hash text)
returns void language sql security definer set search_path = hv, public, pg_temp as $$
  update hv.sessions set revoked_at = now() where token_hash = p_token_hash and revoked_at is null
$$;

-- Change your own password (current password verified by the server first),
-- or reset another user's password with users.manage. Other sessions end.
create or replace function hv.auth_set_password(p_user uuid, p_hash text, p_keep_token_hash text default null)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  if p_user <> hv.current_user_id() then
    perform hv.require_perm('users.manage');
    if (select role_id from hv.users where id = p_user) = 'super_admin' and hv.current_role_id() <> 'super_admin' then
      raise exception 'Only a Super Admin can reset a Super Admin password' using errcode = '42501';
    end if;
  end if;
  update hv.users set password_hash = p_hash,
         must_change_password = (p_user <> hv.current_user_id()), failed_logins = 0, locked_until = null
   where id = p_user;
  update hv.sessions set revoked_at = now()
   where user_id = p_user and revoked_at is null and token_hash is distinct from p_keep_token_hash;
  perform hv.audit_event('PASSWORD_SET', 'users', p_user::text, case when p_user = hv.current_user_id() then 'self' else 'reset by admin' end);
end $$;

create or replace function hv.admin_create_user(p_email text, p_name text, p_role text, p_employee uuid, p_hash text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_id uuid;
begin
  perform hv.require_perm('users.manage');
  if p_role = 'super_admin' and hv.current_role_id() <> 'super_admin' then
    raise exception 'Only a Super Admin can create a Super Admin' using errcode = '42501';
  end if;
  insert into hv.users (email, full_name, role_id, employee_id, password_hash, must_change_password, created_by)
  values (p_email::citext, p_name, p_role, p_employee, p_hash, true, hv.current_user_id())
  returning id into v_id;
  return v_id;
end $$;

-- Direct inserts into users are not allowed for the app role; use admin_create_user.
revoke insert on hv.users from herdvest_app;
grant execute on all functions in schema hv to herdvest_app;
