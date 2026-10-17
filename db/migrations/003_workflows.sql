-- ============================================================================
-- Herdvest Management System — 003 workflows, guards and calculations
--
-- Multi-record operations run inside single database functions so they are
-- atomic. Workflow functions are SECURITY DEFINER and check permissions
-- explicitly with hv.require_perm(); everything else goes through RLS.
-- A transaction-local flag (hv.via) marks changes made by an approved
-- workflow so guard triggers can block the same change made directly.
-- ============================================================================

create or replace function hv.set_via(v text) returns void
language sql as $$ select set_config('hv.via', v, true) $$;

create or replace function hv.via() returns text
language sql stable as $$ select coalesce(current_setting('hv.via', true), '') $$;

create or replace function hv.require_any(perms text[]) returns void
language plpgsql stable as $$
declare p text;
begin
  foreach p in array perms loop
    if hv.has_perm(p) then return; end if;
  end loop;
  raise exception 'Permission denied: one of % is required', array_to_string(perms, ', ') using errcode = '42501';
end $$;

-- ---------------------------------------------------- created_by stamps --
do $$
declare t text;
begin
  foreach t in array array['investors','investment_accounts','farmers','animals','purchases','vet_records','tasks','sales','incidents'] loop
    execute format('create trigger %1$s_created_by before insert on hv.%1$s for each row execute function hv.stamp_created_by()', t);
  end loop;
  foreach t in array array['investors','investment_accounts','farmers','animals','vet_records','expenses','tasks','incidents','enquiries'] loop
    execute format('create trigger %1$s_touch before update on hv.%1$s for each row execute function hv.touch_updated_at()', t);
  end loop;
  -- audit every business table
  foreach t in array array['enquiries','investors','investment_accounts','ledger_entries','unallocated_decisions','farmers',
      'animals','purchases','purchase_lines','allocations','vet_records','expenses','expense_allocations','tasks','sales',
      'sale_receipts','settlements','settlement_payments','incidents','attachments','intake_items','livestock_types','expense_categories'] loop
    execute format('create trigger %1$s_audit after insert or update or delete on hv.%1$s for each row execute function hv.audit_trigger()', t);
  end loop;
  -- financial and historical records are never deleted
  foreach t in array array['investors','investment_accounts','ledger_entries','unallocated_decisions','farmers','farmer_verification_events',
      'animals','animal_status_history','purchases','purchase_lines','allocations','vet_records','expenses','sales','sale_receipts',
      'settlements','settlement_payments','incidents','incident_events','attachments','enquiries','intake_items'] loop
    execute format('create trigger %1$s_no_delete before delete on hv.%1$s for each row execute function hv.deny_delete()', t);
  end loop;
end $$;

-- =========================================================== FUNDING ====
-- Balances per investment account, computed only from ledger rows.
create or replace function hv.account_balance_row(p_account uuid)
returns table (
  funds_received numeric, purchases_allocated numeric, expenses_charged numeric, returned_to_investor numeric,
  adjustments_net numeric, pending_deposits numeric, pending_outflows numeric, unallocated numeric,
  awaiting_reconciliation numeric, last_activity timestamptz)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  with l as (select * from hv.ledger_entries where account_id = p_account)
  select
    coalesce(sum(amount) filter (where entry_type = 'deposit' and status = 'verified'), 0),
    coalesce(sum(amount) filter (where entry_type = 'purchase_allocation' and status = 'verified'), 0),
    coalesce(sum(amount) filter (where entry_type = 'expense_charge' and status = 'verified'), 0),
    coalesce(sum(amount) filter (where entry_type = 'refund_to_investor' and status = 'verified'), 0),
    coalesce(sum(amount) filter (where entry_type = 'adjustment_in' and status = 'verified'), 0)
      - coalesce(sum(amount) filter (where entry_type = 'adjustment_out' and status = 'verified'), 0),
    coalesce(sum(amount) filter (where entry_type = 'deposit' and status = 'pending'), 0),
    coalesce(sum(amount) filter (where entry_type in ('purchase_allocation','expense_charge','refund_to_investor','adjustment_out') and status = 'pending'), 0),
    -- available cash = verified in − verified out − outflows already committed but not yet verified
      coalesce(sum(amount) filter (where entry_type in ('deposit','adjustment_in') and status = 'verified'), 0)
    - coalesce(sum(amount) filter (where entry_type in ('purchase_allocation','expense_charge','refund_to_investor','adjustment_out') and status in ('verified','pending')), 0),
    coalesce(sum(amount) filter (where status = 'pending'), 0),
    max(created_at)
  from l
$$;

create or replace view hv.account_balances with (security_invoker = true) as
select a.id as account_id, a.code, a.investor_id, a.status,
       b.*,
       (b.unallocated > 0
        and exists (select 1 from hv.ledger_entries x where x.account_id = a.id and x.entry_type = 'purchase_allocation' and x.status in ('pending','verified'))
        and coalesce((select max(decided_at) from hv.unallocated_decisions d where d.account_id = a.id), '-infinity') < b.last_activity
       ) as decision_required
from hv.investment_accounts a
cross join lateral hv.account_balance_row(a.id) b
where hv.has_perm('finance.read');

create or replace function hv.record_deposit(
  p_account uuid, p_amount numeric, p_occurred_at timestamptz, p_method text, p_reference text,
  p_notes text, p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare acc hv.investment_accounts; v_id uuid;
begin
  perform hv.require_perm('finance.write');
  if p_idempotency_key is not null then
    select id into v_id from hv.ledger_entries where idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  select * into acc from hv.investment_accounts where id = p_account;
  if not found then raise exception 'Investment account not found'; end if;
  if acc.status <> 'open' then raise exception 'Account % is %', acc.code, acc.status; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Deposit amount must be greater than zero'; end if;
  insert into hv.ledger_entries (account_id, investor_id, entry_type, amount, occurred_at, payment_method, reference, notes, recorded_by, idempotency_key)
  values (p_account, acc.investor_id, 'deposit', p_amount, coalesce(p_occurred_at, now()), p_method, nullif(trim(p_reference), ''), p_notes,
          hv.current_user_id(), p_idempotency_key)
  returning id into v_id;
  return v_id;
end $$;

create or replace function hv.verify_ledger_entry(p_entry uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare e hv.ledger_entries; dual boolean;
begin
  perform hv.require_perm('finance.approve');
  select * into e from hv.ledger_entries where id = p_entry for update;
  if not found then raise exception 'Ledger entry not found'; end if;
  if e.status <> 'pending' then raise exception 'Only pending entries can be verified (this one is %)', e.status; end if;
  dual := coalesce((hv.setting('dual_control') #>> '{}')::boolean, false);
  if dual and e.recorded_by = hv.current_user_id() then
    raise exception 'Dual control is on: a different person must verify this entry' using errcode = '42501';
  end if;
  if not p_approve and e.entry_type = 'purchase_allocation' then
    raise exception 'A purchase allocation cannot be rejected on its own. Void the purchase instead.';
  end if;
  perform hv.set_via('ledger_workflow');
  update hv.ledger_entries
     set status = case when p_approve then 'verified' else 'rejected' end,
         verified_by = hv.current_user_id(), verified_at = now(),
         notes = case when p_note is null then notes else concat_ws(E'\n', notes, p_note) end
   where id = p_entry;
end $$;

create or replace function hv.reverse_ledger_entry(p_entry uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare e hv.ledger_entries; v_id uuid;
begin
  perform hv.require_perm('finance.approve');
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required to reverse an entry'; end if;
  select * into e from hv.ledger_entries where id = p_entry for update;
  if not found then raise exception 'Ledger entry not found'; end if;
  if e.status <> 'verified' then raise exception 'Only verified entries can be reversed'; end if;
  if e.entry_type = 'reversal' then raise exception 'A reversal cannot itself be reversed'; end if;
  if e.entry_type = 'purchase_allocation' and exists (select 1 from hv.purchases where id = e.purchase_id and status = 'completed') then
    raise exception 'Void the purchase to reverse its allocation';
  end if;
  perform hv.set_via('ledger_workflow');
  update hv.ledger_entries set status = 'reversed' where id = p_entry;
  insert into hv.ledger_entries (account_id, investor_id, entry_type, amount, occurred_at, status, recorded_by, verified_by, verified_at, reverses_id, notes)
  values (e.account_id, e.investor_id, 'reversal', e.amount, now(), 'verified', hv.current_user_id(), hv.current_user_id(), now(), e.id,
          'Reversal of ' || e.code || ': ' || p_reason)
  returning id into v_id;
  return v_id;
end $$;

create or replace function hv.record_unallocated_decision(p_account uuid, p_decision text, p_notes text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare b record; acc hv.investment_accounts; v_ledger uuid; v_id uuid;
begin
  perform hv.require_perm('finance.write');
  select * into acc from hv.investment_accounts where id = p_account for update;
  if not found then raise exception 'Investment account not found'; end if;
  select * into b from hv.account_balance_row(p_account);
  if b.unallocated <= 0 then raise exception 'There is no unallocated balance to decide on'; end if;
  if p_decision = 'return_to_investor' then
    insert into hv.ledger_entries (account_id, investor_id, entry_type, amount, occurred_at, recorded_by, notes)
    values (p_account, acc.investor_id, 'refund_to_investor', b.unallocated, now(), hv.current_user_id(),
            coalesce(p_notes, 'Return of unallocated funds'))
    returning id into v_ledger;
  end if;
  insert into hv.unallocated_decisions (account_id, amount, decision, notes, ledger_entry_id, decided_by)
  values (p_account, b.unallocated, p_decision, p_notes, v_ledger, hv.current_user_id())
  returning id into v_id;
  return v_id;
end $$;

-- Ledger rows: amounts are fixed once recorded; status may only move
-- pending → verified/rejected and verified → reversed, through workflows.
create or replace function hv.guard_ledger_update() returns trigger
language plpgsql as $$
begin
  if (new.amount, new.account_id, new.investor_id, new.entry_type, new.purchase_id, new.expense_id, new.reverses_id)
     is distinct from (old.amount, old.account_id, old.investor_id, old.entry_type, old.purchase_id, old.expense_id, old.reverses_id) then
    raise exception 'Ledger amounts and links cannot be edited. Reject or reverse the entry and record a new one.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if hv.via() <> 'ledger_workflow' then
      raise exception 'Ledger status can only change through the verification or reversal workflow' using errcode = '42501';
    end if;
    if not ((old.status = 'pending' and new.status in ('verified','rejected')) or (old.status = 'verified' and new.status = 'reversed')) then
      raise exception 'Invalid ledger status change % → %', old.status, new.status;
    end if;
  end if;
  return new;
end $$;
create trigger ledger_guard before update on hv.ledger_entries for each row execute function hv.guard_ledger_update();

-- ========================================================== LIVESTOCK ===
create or replace function hv.log_animal_status() returns trigger
language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into hv.animal_status_history (animal_id, from_status, to_status, reason, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status,
            nullif(current_setting('hv.status_reason', true), ''), hv.current_user_id());
  end if;
  return new;
end $$;
create trigger animals_status_history after insert or update of status on hv.animals
  for each row execute function hv.log_animal_status();

create or replace function hv.guard_animal_update() returns trigger
language plpgsql as $$
begin
  if (new.investor_id, new.account_id) is distinct from (old.investor_id, old.account_id) and hv.via() <> 'purchase_workflow' then
    raise exception 'Investor links are set by the purchase workflow and cannot be edited directly' using errcode = '42501';
  end if;
  if new.current_farmer_id is distinct from old.current_farmer_id and hv.via() not in ('allocation_workflow','sale_workflow','incident_workflow') then
    raise exception 'Use the allocation workflow to change an animal''s farmer' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status in ('sold','deceased') and hv.via() <> 'status_workflow' then
      raise exception 'Status of a % animal can only be corrected through the status workflow', old.status using errcode = '42501';
    end if;
    if new.status = 'sold' and hv.via() <> 'sale_workflow' then
      raise exception 'Record a sale to mark an animal as sold' using errcode = '42501';
    end if;
    if new.status = 'deceased' and hv.via() not in ('incident_workflow','status_workflow') then
      raise exception 'Report an incident to mark an animal as deceased' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger animals_guard before update on hv.animals for each row execute function hv.guard_animal_update();

create or replace function hv.set_animal_status(p_animal uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  perform hv.require_perm('livestock.write');
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required for a status change'; end if;
  if p_status = 'sold' then raise exception 'Record a sale to mark an animal as sold'; end if;
  perform set_config('hv.status_reason', p_reason, true);
  perform hv.set_via('status_workflow');
  update hv.animals set status = p_status, status_note = p_reason where id = p_animal;
  if not found then raise exception 'Animal not found'; end if;
end $$;

-- Purchase one or more animals against an investment account, atomically.
-- p_animals: [{species, breed, sex, tag_number, color, age_months, price, condition, vet_assessment, notes}]
create or replace function hv.create_purchase(
  p_account uuid, p_purchase_date date, p_seller_name text, p_seller_contact text, p_location text,
  p_animals jsonb, p_notes text, p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare
  acc hv.investment_accounts; v_total numeric(14,2); v_available numeric(14,2);
  v_purchase uuid; v_animal uuid; a jsonb; v_ledger uuid;
begin
  perform hv.require_perm('purchases.write');
  if p_idempotency_key is not null then
    select id into v_purchase from hv.purchases where idempotency_key = p_idempotency_key;
    if found then return v_purchase; end if;
  end if;
  -- lock the account so two purchases cannot spend the same funds
  select * into acc from hv.investment_accounts where id = p_account for update;
  if not found then raise exception 'Investment account not found'; end if;
  if acc.status <> 'open' then raise exception 'Account % is %', acc.code, acc.status; end if;
  if p_animals is null or jsonb_typeof(p_animals) <> 'array' or jsonb_array_length(p_animals) = 0 then
    raise exception 'Add at least one animal to the purchase';
  end if;
  if exists (select 1 from jsonb_array_elements(p_animals) x where coalesce((x->>'price')::numeric, 0) <= 0) then
    raise exception 'Every animal needs a purchase price greater than zero';
  end if;
  select sum((x->>'price')::numeric(14,2)) into v_total from jsonb_array_elements(p_animals) x;
  select unallocated into v_available from hv.account_balance_row(p_account);
  if v_total > v_available then
    raise exception 'Insufficient verified unallocated funds in %: available PKR %, purchase requires PKR %',
      acc.code, to_char(v_available, 'FM999,999,999,990.00'), to_char(v_total, 'FM999,999,999,990.00');
  end if;

  insert into hv.purchases (account_id, investor_id, purchase_date, seller_name, seller_contact, location, total_cost, notes, idempotency_key)
  values (p_account, acc.investor_id, p_purchase_date, p_seller_name, p_seller_contact, p_location, v_total, p_notes, p_idempotency_key)
  returning id into v_purchase;

  perform set_config('hv.status_reason', 'Purchased', true);
  for a in select * from jsonb_array_elements(p_animals) loop
    insert into hv.animals (species, breed, sex, tag_number, color, age_months_estimate, status, investor_id, account_id,
                            condition_at_purchase, vet_assessment_at_purchase, notes)
    values (coalesce(nullif(a->>'species', ''), 'buffalo'), nullif(a->>'breed', ''), nullif(a->>'sex', ''), nullif(a->>'tag_number', ''),
            nullif(a->>'color', ''), nullif(a->>'age_months', '')::int, 'awaiting_allocation', acc.investor_id, p_account,
            nullif(a->>'condition', ''), nullif(a->>'vet_assessment', ''), nullif(a->>'notes', ''))
    returning id into v_animal;
    insert into hv.purchase_lines (purchase_id, animal_id, price) values (v_purchase, v_animal, (a->>'price')::numeric(14,2));
  end loop;

  insert into hv.ledger_entries (account_id, investor_id, entry_type, amount, occurred_at, recorded_by, purchase_id, notes)
  values (p_account, acc.investor_id, 'purchase_allocation', v_total, p_purchase_date::timestamptz, hv.current_user_id(), v_purchase,
          'Funding for purchase')
  returning id into v_ledger;
  return v_purchase;
end $$;

create or replace function hv.void_purchase(p_purchase uuid, p_reason text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare p hv.purchases; e hv.ledger_entries;
begin
  perform hv.require_perm('finance.approve');
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required to void a purchase'; end if;
  select * into p from hv.purchases where id = p_purchase for update;
  if not found or p.status <> 'completed' then raise exception 'Purchase not found or already voided'; end if;
  if exists (select 1 from hv.purchase_lines pl join hv.animals an on an.id = pl.animal_id
             where pl.purchase_id = p_purchase and an.status not in ('purchased','awaiting_allocation')) then
    raise exception 'Animals from this purchase are already allocated, sold or otherwise in progress';
  end if;
  update hv.purchases set status = 'voided', void_reason = p_reason where id = p_purchase;
  perform set_config('hv.status_reason', 'Purchase voided: ' || p_reason, true);
  update hv.animals set status = 'other', status_note = 'Purchase voided: ' || p_reason
   where id in (select animal_id from hv.purchase_lines where purchase_id = p_purchase);
  perform hv.set_via('ledger_workflow');
  for e in select * from hv.ledger_entries where purchase_id = p_purchase and entry_type = 'purchase_allocation' loop
    if e.status = 'pending' then
      update hv.ledger_entries set status = 'rejected', verified_by = hv.current_user_id(), verified_at = now(),
             notes = concat_ws(E'\n', notes, 'Purchase voided: ' || p_reason) where id = e.id;
    elsif e.status = 'verified' then
      update hv.ledger_entries set status = 'reversed' where id = e.id;
      insert into hv.ledger_entries (account_id, investor_id, entry_type, amount, status, recorded_by, verified_by, verified_at, reverses_id, notes)
      values (e.account_id, e.investor_id, 'reversal', e.amount, 'verified', hv.current_user_id(), hv.current_user_id(), now(), e.id,
              'Purchase ' || p.code || ' voided: ' || p_reason);
    end if;
  end loop;
end $$;

-- ============================================================ FARMERS ===
create or replace function hv.guard_farmer() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.verification_status in ('verified','suspended','rejected') then
      raise exception 'New farmers start unverified; use the verification workflow' using errcode = '42501';
    end if;
  elsif new.verification_status is distinct from old.verification_status and hv.via() <> 'farmer_verification' then
    raise exception 'Use the verification workflow to change verification status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger farmers_guard before insert or update on hv.farmers for each row execute function hv.guard_farmer();

create or replace function hv.set_farmer_verification(p_farmer uuid, p_status text, p_notes text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare f hv.farmers;
begin
  if p_status in ('verified','rejected','suspended') then
    perform hv.require_perm('farmers.verify');
    if coalesce(trim(p_notes), '') = '' then raise exception 'Notes are required for a % decision', p_status; end if;
  else
    perform hv.require_perm('farmers.write');
  end if;
  select * into f from hv.farmers where id = p_farmer for update;
  if not found then raise exception 'Farmer not found'; end if;
  if f.verification_status = p_status then return; end if;
  perform hv.set_via('farmer_verification');
  update hv.farmers set verification_status = p_status,
         verified_by = case when p_status = 'verified' then hv.current_user_id() else verified_by end,
         verified_at = case when p_status = 'verified' then now() else verified_at end
   where id = p_farmer;
  insert into hv.farmer_verification_events (farmer_id, from_status, to_status, notes, changed_by)
  values (p_farmer, f.verification_status, p_status, p_notes, hv.current_user_id());
end $$;

-- ======================================================== ALLOCATIONS ===
create or replace function hv.allocate_animal(
  p_animal uuid, p_farmer uuid, p_start date, p_farm_location text, p_agreement_ref text,
  p_responsibilities text, p_review_date date, p_reason text, p_condition text, p_care_type text default 'primary')
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare an hv.animals; f hv.farmers; cur hv.allocations; v_id uuid;
begin
  perform hv.require_perm('allocations.write');
  select * into an from hv.animals where id = p_animal for update;
  if not found then raise exception 'Animal not found'; end if;
  if an.status in ('sold','deceased','sourcing','other') then raise exception 'Animal % cannot be allocated while %', an.code, an.status; end if;
  select * into f from hv.farmers where id = p_farmer;
  if not found then raise exception 'Farmer not found'; end if;
  if f.verification_status <> 'verified' then
    raise exception 'Farmer % is not verified (status: %)', f.code, f.verification_status;
  end if;

  if p_care_type = 'primary' then
    select * into cur from hv.allocations where animal_id = p_animal and status = 'active' and care_type = 'primary' for update;
    if found then
      if cur.farmer_id = p_farmer then raise exception 'Animal is already allocated to this farmer'; end if;
      if coalesce(trim(p_reason), '') = '' then raise exception 'A transfer reason is required'; end if;
      update hv.allocations set status = 'ended', end_date = p_start, end_reason = p_reason, condition_at_end = p_condition
       where id = cur.id;
    end if;
  end if;

  insert into hv.allocations (animal_id, farmer_id, investor_id, account_id, start_date, farm_location, agreement_ref,
                              responsibilities, review_date, reason, condition_at_start, care_type, created_by)
  values (p_animal, p_farmer, an.investor_id, an.account_id, p_start, coalesce(p_farm_location, f.farm_location), p_agreement_ref,
          p_responsibilities, p_review_date, p_reason, p_condition, p_care_type, hv.current_user_id())
  returning id into v_id;

  if p_care_type = 'primary' then
    perform hv.set_via('allocation_workflow');
    perform set_config('hv.status_reason', 'Allocated to ' || f.code, true);
    update hv.animals set current_farmer_id = p_farmer, farm_location = coalesce(p_farm_location, f.farm_location),
           status = case when status in ('purchased','awaiting_allocation') then 'allocated' else status end
     where id = p_animal;
  end if;
  return v_id;
end $$;

-- ============================================================ EXPENSES ===
create or replace function hv.guard_expense() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if hv.via() <> 'intake_workflow' then
      new.submitted_by := hv.current_user_id();
    end if;
    new.status := 'submitted';
    new.approved_by := null; new.approved_at := null; new.paid_at := null;
    return new;
  end if;
  if new.status is distinct from old.status and hv.via() <> 'expense_workflow' then
    raise exception 'Expense status can only change through the approval workflow' using errcode = '42501';
  end if;
  if old.status in ('approved','paid','voided')
     and (new.amount, new.charge_type, new.account_id, new.investor_id, new.category_id, new.expense_date, new.sale_id)
         is distinct from (old.amount, old.charge_type, old.account_id, old.investor_id, old.category_id, old.expense_date, old.sale_id) then
    raise exception 'Approved expenses cannot be edited. Void it and submit a corrected expense.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger expenses_guard before insert or update on hv.expenses for each row execute function hv.guard_expense();

create or replace function hv.guard_expense_allocation() returns trigger
language plpgsql as $$
declare st text;
begin
  select status into st from hv.expenses where id = coalesce(new.expense_id, old.expense_id);
  if st <> 'submitted' then
    raise exception 'Animal splits can only be changed while the expense is awaiting approval' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger expense_allocations_guard before insert or update or delete on hv.expense_allocations
  for each row execute function hv.guard_expense_allocation();

create or replace function hv.decide_expense(p_expense uuid, p_approve boolean, p_charge_type text, p_account uuid, p_note text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare x hv.expenses; acc hv.investment_accounts; v_alloc numeric; v_available numeric; v_account uuid;
begin
  perform hv.require_perm('expenses.approve');
  select * into x from hv.expenses where id = p_expense for update;
  if not found then raise exception 'Expense not found'; end if;
  if x.status not in ('submitted','disputed') then raise exception 'Expense % is already %', x.code, x.status; end if;
  perform hv.set_via('expense_workflow');
  if not p_approve then
    if coalesce(trim(p_note), '') = '' then raise exception 'A rejection reason is required'; end if;
    update hv.expenses set status = 'rejected', rejection_reason = p_note, approved_by = hv.current_user_id(), approved_at = now()
     where id = p_expense;
    return;
  end if;
  if coalesce(p_charge_type, x.charge_type) = 'to_be_determined' then
    raise exception 'Choose who bears this expense before approving it';
  end if;
  select coalesce(sum(amount), 0) into v_alloc from hv.expense_allocations where expense_id = p_expense;
  if v_alloc > 0 and v_alloc <> x.amount then
    raise exception 'Animal splits total PKR % but the expense is PKR %', v_alloc, x.amount;
  end if;
  v_account := coalesce(p_account, x.account_id);
  update hv.expenses set status = 'approved', charge_type = coalesce(p_charge_type, charge_type), account_id = v_account,
         investor_id = coalesce(investor_id, (select investor_id from hv.investment_accounts where id = v_account)),
         approved_by = hv.current_user_id(), approved_at = now(),
         notes = case when p_note is null then notes else concat_ws(E'\n', notes, p_note) end
   where id = p_expense;

  if coalesce(p_charge_type, x.charge_type) = 'chargeable_to_investment' then
    if v_account is null then raise exception 'Select the investment account this expense is charged to'; end if;
    select * into acc from hv.investment_accounts where id = v_account for update;
    -- sale expenses deducted from sale proceeds (per agreement) are not also charged to the funding ledger
    if x.sale_id is not null and acc.deduct_sale_expenses then
      return;
    end if;
    select unallocated into v_available from hv.account_balance_row(v_account);
    if x.amount > v_available then
      raise exception 'Insufficient unallocated funds in % (available PKR %) to charge this expense', acc.code, v_available;
    end if;
    perform hv.set_via('ledger_workflow');
    insert into hv.ledger_entries (account_id, investor_id, entry_type, amount, occurred_at, status, recorded_by, verified_by, verified_at, expense_id, notes)
    values (v_account, acc.investor_id, 'expense_charge', x.amount, x.expense_date::timestamptz, 'verified', hv.current_user_id(),
            hv.current_user_id(), now(), p_expense, 'Approved expense ' || x.code);
  end if;
end $$;

create or replace function hv.mark_expense_paid(p_expense uuid, p_paid_at timestamptz, p_method text, p_reference text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare x hv.expenses;
begin
  perform hv.require_perm('finance.write');
  select * into x from hv.expenses where id = p_expense for update;
  if not found then raise exception 'Expense not found'; end if;
  if x.status <> 'approved' then raise exception 'Only approved expenses can be marked paid (this one is %)', x.status; end if;
  perform hv.set_via('expense_workflow');
  update hv.expenses set status = 'paid', paid_at = coalesce(p_paid_at, now()), payment_method = p_method, payment_reference = p_reference
   where id = p_expense;
end $$;

create or replace function hv.flag_expense(p_expense uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare x hv.expenses;
begin
  perform hv.require_perm('expenses.approve');
  if p_status not in ('disputed','voided') then raise exception 'Invalid status'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'A note is required'; end if;
  select * into x from hv.expenses where id = p_expense for update;
  if not found then raise exception 'Expense not found'; end if;
  if p_status = 'voided' and exists (select 1 from hv.ledger_entries where expense_id = p_expense and status = 'verified') then
    raise exception 'Reverse the ledger charge for % before voiding it', x.code;
  end if;
  perform hv.set_via('expense_workflow');
  update hv.expenses set status = p_status, notes = concat_ws(E'\n', notes, p_status || ': ' || p_note) where id = p_expense;
end $$;

-- ====================================================== SALES/SETTLE ===
create or replace function hv.calculate_settlement(p_sale uuid)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare
  s hv.sales; acc hv.investment_accounts; existing hv.settlements;
  v_cost numeric(14,2); v_ded numeric(14,2) := 0; v_net numeric(14,2); v_received numeric(14,2);
  v_cap numeric(14,2); v_short numeric(14,2); v_pool numeric(14,2);
  v_inv_pct numeric(5,2); v_fee_pct numeric(5,2);
  v_inv_gross numeric(14,2) := 0; v_farmer numeric(14,2) := 0; v_fee numeric(14,2) := 0; v_inv_net numeric(14,2);
  v_reasons text[] := '{}'; v_id uuid;
begin
  perform hv.require_any(array['sales.write','finance.write']);
  select * into s from hv.sales where id = p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  select * into existing from hv.settlements where sale_id = p_sale for update;
  if found and existing.status not in ('calculated','review_required') then
    raise exception 'Settlement % is already % and cannot be recalculated', existing.code, existing.status;
  end if;
  select * into acc from hv.investment_accounts where id = s.account_id;
  select price into v_cost from hv.purchase_lines where animal_id = s.animal_id;
  if v_cost is null then raise exception 'No purchase record found for this animal'; end if;
  v_inv_pct := coalesce(acc.investor_share_pct, 50);
  v_fee_pct := coalesce(acc.service_fee_pct, 20);

  if coalesce(acc.deduct_sale_expenses, false) then
    select coalesce(sum(amount), 0) into v_ded from hv.expenses
     where sale_id = p_sale and status in ('approved','paid') and charge_type = 'chargeable_to_investment';
  end if;
  v_net := s.sale_price - v_ded;

  if v_net >= v_cost then
    -- capital is returned first; the remainder is the profit pool
    v_cap := v_cost; v_short := 0; v_pool := v_net - v_cost;
    v_inv_gross := trunc(v_pool * v_inv_pct / 100, 2);
    v_farmer := v_pool - v_inv_gross;
    v_fee := round(v_inv_gross * v_fee_pct / 100, 2);   -- once per sale, never per year
    v_inv_net := v_inv_gross - v_fee;
  else
    v_cap := greatest(v_net, 0); v_short := v_cost - v_cap; v_pool := v_net - v_cost;
    v_inv_net := -v_short;
    v_reasons := array_append(v_reasons, 'loss_or_capital_shortfall');
  end if;

  select coalesce(sum(amount), 0) into v_received from hv.sale_receipts where sale_id = p_sale;
  if v_received < s.sale_price then v_reasons := array_append(v_reasons, 'buyer_payment_outstanding'); end if;
  if s.has_dispute then v_reasons := array_append(v_reasons, 'dispute_recorded'); end if;
  if exists (select 1 from hv.expenses e where e.status = 'disputed'
             and (e.sale_id = p_sale or e.id in (select expense_id from hv.expense_allocations where animal_id = s.animal_id))) then
    v_reasons := array_append(v_reasons, 'disputed_expense');
  end if;
  if exists (select 1 from hv.expenses where sale_id = p_sale and status = 'submitted') then
    v_reasons := array_append(v_reasons, 'unapproved_sale_expenses');
  end if;
  if exists (select 1 from hv.incidents where animal_id = s.animal_id and status not in ('decided','closed')) then
    v_reasons := array_append(v_reasons, 'open_incident');
  end if;

  perform hv.set_via('settlement_workflow');
  insert into hv.settlements (sale_id, purchase_cost, gross_proceeds, deducted_sale_expenses, net_proceeds, capital_returned, capital_shortfall,
                              profit_pool, investor_share_pct, service_fee_pct, investor_gross, farmer_share, herdvest_fee, investor_net,
                              investor_payable, farmer_payable, herdvest_payable, review_reasons, status, calculated_at)
  values (p_sale, v_cost, s.sale_price, v_ded, v_net, v_cap, v_short, v_pool, v_inv_pct, v_fee_pct, v_inv_gross, v_farmer, v_fee, v_inv_net,
          v_cap + greatest(v_inv_net, 0), v_farmer, v_fee, v_reasons,
          case when cardinality(v_reasons) > 0 then 'review_required' else 'calculated' end, now())
  on conflict (sale_id) do update set
    purchase_cost = excluded.purchase_cost, gross_proceeds = excluded.gross_proceeds, deducted_sale_expenses = excluded.deducted_sale_expenses,
    net_proceeds = excluded.net_proceeds, capital_returned = excluded.capital_returned, capital_shortfall = excluded.capital_shortfall,
    profit_pool = excluded.profit_pool, investor_share_pct = excluded.investor_share_pct, service_fee_pct = excluded.service_fee_pct,
    investor_gross = excluded.investor_gross, farmer_share = excluded.farmer_share, herdvest_fee = excluded.herdvest_fee,
    investor_net = excluded.investor_net, investor_payable = excluded.investor_payable, farmer_payable = excluded.farmer_payable,
    herdvest_payable = excluded.herdvest_payable, review_reasons = excluded.review_reasons, status = excluded.status,
    calculated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function hv.record_sale(
  p_animal uuid, p_sale_date date, p_buyer_name text, p_buyer_contact text, p_sale_price numeric,
  p_employee uuid, p_notes text, p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare an hv.animals; v_id uuid;
begin
  perform hv.require_perm('sales.write');
  if p_idempotency_key is not null then
    select id into v_id from hv.sales where idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  select * into an from hv.animals where id = p_animal for update;
  if not found then raise exception 'Animal not found'; end if;
  if an.status in ('sold','deceased','other') then raise exception 'Animal % cannot be sold while %', an.code, an.status; end if;
  if p_sale_price is null or p_sale_price < 0 then raise exception 'Enter the agreed sale price'; end if;
  insert into hv.sales (animal_id, investor_id, account_id, farmer_id, sale_date, buyer_name, buyer_contact, sale_price,
                        responsible_employee_id, notes, idempotency_key)
  values (p_animal, an.investor_id, an.account_id, an.current_farmer_id, p_sale_date, p_buyer_name, p_buyer_contact, p_sale_price,
          p_employee, p_notes, p_idempotency_key)
  returning id into v_id;
  update hv.allocations set status = 'ended', end_date = p_sale_date, end_reason = 'Animal sold'
   where animal_id = p_animal and status = 'active';
  perform hv.set_via('sale_workflow');
  perform set_config('hv.status_reason', 'Sold', true);
  update hv.animals set status = 'sold' where id = p_animal;
  perform hv.calculate_settlement(v_id);
  return v_id;
end $$;

create or replace function hv.add_sale_receipt(p_sale uuid, p_amount numeric, p_received_at timestamptz, p_method text, p_reference text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare s hv.sales; v_total numeric; v_id uuid; st text;
begin
  perform hv.require_any(array['sales.write','finance.write']);
  select * into s from hv.sales where id = p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  select coalesce(sum(amount), 0) into v_total from hv.sale_receipts where sale_id = p_sale;
  if v_total + p_amount > s.sale_price then
    raise exception 'Receipts would exceed the sale price (already received PKR %)', v_total;
  end if;
  insert into hv.sale_receipts (sale_id, amount, received_at, method, reference, recorded_by)
  values (p_sale, p_amount, coalesce(p_received_at, now()), p_method, p_reference, hv.current_user_id())
  returning id into v_id;
  select status into st from hv.settlements where sale_id = p_sale;
  if st in ('calculated','review_required') then perform hv.calculate_settlement(p_sale); end if;
  return v_id;
end $$;

create or replace function hv.approve_settlement(
  p_settlement uuid, p_note text, p_investor_payable numeric default null, p_farmer_payable numeric default null, p_herdvest_payable numeric default null)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare st hv.settlements; v_received numeric; v_inv numeric; v_farm numeric; v_hv numeric;
begin
  perform hv.require_perm('settlements.approve');
  select * into st from hv.settlements where id = p_settlement for update;
  if not found then raise exception 'Settlement not found'; end if;
  if st.status not in ('calculated','review_required') then raise exception 'Settlement is already %', st.status; end if;
  v_inv := coalesce(p_investor_payable, st.investor_payable);
  v_farm := coalesce(p_farmer_payable, st.farmer_payable);
  v_hv := coalesce(p_herdvest_payable, st.herdvest_payable);
  if least(v_inv, v_farm, v_hv) < 0 then raise exception 'Payable amounts cannot be negative'; end if;
  if (st.status = 'review_required' or (v_inv, v_farm, v_hv) is distinct from (st.investor_payable, st.farmer_payable, st.herdvest_payable))
     and coalesce(trim(p_note), '') = '' then
    raise exception 'A review note is required (reasons: %)', coalesce(array_to_string(st.review_reasons, ', '), 'payables changed');
  end if;
  select coalesce(sum(r.amount), 0) into v_received from hv.sale_receipts r where r.sale_id = st.sale_id;
  if v_inv + v_farm + v_hv > v_received then
    raise exception 'Payables (PKR %) exceed the sale money actually received (PKR %)', v_inv + v_farm + v_hv, v_received;
  end if;
  perform hv.set_via('settlement_workflow');
  update hv.settlements set status = 'approved', review_note = p_note, approved_by = hv.current_user_id(), approved_at = now(),
         investor_payable = v_inv, farmer_payable = v_farm, herdvest_payable = v_hv
   where id = p_settlement;
end $$;

create or replace function hv.settlement_outstanding(p_settlement uuid)
returns table (payee text, payable numeric, paid numeric, outstanding numeric)
language sql stable security definer set search_path = hv, public, pg_temp as $$
  select p.payee, p.payable, coalesce(sum(sp.amount), 0), p.payable - coalesce(sum(sp.amount), 0)
  from hv.settlements s
  cross join lateral (values ('investor', s.investor_payable), ('farmer', s.farmer_payable), ('herdvest', s.herdvest_payable)) p(payee, payable)
  left join hv.settlement_payments sp on sp.settlement_id = s.id and sp.payee = p.payee
  where s.id = p_settlement and (hv.has_perm('sales.read') or hv.has_perm('finance.read'))
  group by p.payee, p.payable
$$;

create or replace function hv.record_settlement_payment(
  p_settlement uuid, p_payee text, p_amount numeric, p_paid_at timestamptz, p_method text, p_reference text, p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare st hv.settlements; v_out numeric; v_id uuid; v_left numeric;
begin
  perform hv.require_perm('finance.write');
  if p_idempotency_key is not null then
    select id into v_id from hv.settlement_payments where idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  select * into st from hv.settlements where id = p_settlement for update;
  if not found then raise exception 'Settlement not found'; end if;
  if st.status not in ('approved','partially_paid') then
    raise exception 'Payments can only be recorded after the settlement is approved (status: %)', st.status;
  end if;
  select outstanding into v_out from hv.settlement_outstanding(p_settlement) where payee = p_payee;
  if p_amount <= 0 or p_amount > v_out then
    raise exception 'Payment must be between 0 and the outstanding PKR % for the %', v_out, p_payee;
  end if;
  insert into hv.settlement_payments (settlement_id, payee, amount, paid_at, method, reference, recorded_by, idempotency_key)
  values (p_settlement, p_payee, p_amount, coalesce(p_paid_at, now()), p_method, p_reference, hv.current_user_id(), p_idempotency_key)
  returning id into v_id;
  select coalesce(sum(outstanding), 0) into v_left from hv.settlement_outstanding(p_settlement);
  perform hv.set_via('settlement_workflow');
  update hv.settlements set status = case when v_left = 0 then 'paid' else 'partially_paid' end where id = p_settlement;
  return v_id;
end $$;

create or replace function hv.guard_settlement() returns trigger
language plpgsql as $$
begin
  if hv.via() <> 'settlement_workflow' then
    raise exception 'Settlements can only be changed through the settlement workflow' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger settlements_guard before insert or update on hv.settlements for each row execute function hv.guard_settlement();
create trigger settlement_payments_no_update before update on hv.settlement_payments for each row execute function hv.deny_delete();
create trigger sale_receipts_no_update before update on hv.sale_receipts for each row execute function hv.deny_delete();
create trigger purchase_lines_no_update before update on hv.purchase_lines for each row execute function hv.deny_delete();

create or replace function hv.guard_sale_update() returns trigger
language plpgsql as $$
begin
  if (new.sale_price, new.animal_id, new.account_id, new.investor_id) is distinct from (old.sale_price, old.animal_id, old.account_id, old.investor_id) then
    raise exception 'Recorded sale amounts cannot be edited' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger sales_guard before update on hv.sales for each row execute function hv.guard_sale_update();

-- ========================================================== INCIDENTS ===
create or replace function hv.report_incident(
  p_animal uuid, p_type text, p_occurred_at timestamptz, p_reported_by text, p_description text, p_vet_findings text)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare an hv.animals; v_id uuid;
begin
  perform hv.require_perm('incidents.write');
  select * into an from hv.animals where id = p_animal for update;
  if not found then raise exception 'Animal not found'; end if;
  if an.status = 'sold' then raise exception 'Animal % has been sold', an.code; end if;
  insert into hv.incidents (animal_id, investor_id, farmer_id, incident_type, occurred_at, reported_by_name, description, vet_findings)
  values (p_animal, an.investor_id, an.current_farmer_id, p_type, p_occurred_at, p_reported_by, p_description, p_vet_findings)
  returning id into v_id;
  insert into hv.incident_events (incident_id, to_status, note, changed_by) values (v_id, 'reported', p_description, hv.current_user_id());
  if p_type = 'death' and an.status <> 'deceased' then
    perform hv.set_via('incident_workflow');
    perform set_config('hv.status_reason', 'Death reported (incident)', true);
    update hv.animals set status = 'deceased' where id = p_animal;
    update hv.allocations set status = 'ended', end_date = p_occurred_at::date, end_reason = 'Animal deceased'
     where animal_id = p_animal and status = 'active';
  elsif p_type in ('serious_illness','major_injury') and an.status in ('allocated','active') then
    perform set_config('hv.status_reason', 'Incident reported', true);
    perform hv.set_via('incident_workflow');
    update hv.animals set status = 'under_treatment' where id = p_animal;
  end if;
  return v_id;
end $$;

create or replace function hv.update_incident(
  p_incident uuid, p_status text, p_note text, p_contractual_notes text default null, p_decision text default null,
  p_investor_loss numeric default null, p_farmer_loss numeric default null, p_herdvest_loss numeric default null,
  p_estimated_loss numeric default null)
returns void language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare i hv.incidents;
begin
  perform hv.require_perm('incidents.write');
  select * into i from hv.incidents where id = p_incident for update;
  if not found then raise exception 'Incident not found'; end if;
  if i.status = 'closed' then raise exception 'Incident is closed'; end if;
  if p_status in ('decided','closed') then
    perform hv.require_perm('incidents.approve');
    if coalesce(trim(coalesce(p_decision, i.decision)), '') = '' then
      raise exception 'Record the approved loss allocation decision first';
    end if;
  end if;
  perform hv.set_via('incident_workflow');
  update hv.incidents set status = p_status,
         contractual_notes = coalesce(p_contractual_notes, contractual_notes),
         estimated_loss = coalesce(p_estimated_loss, estimated_loss),
         decision = case when p_status in ('decided','closed') then coalesce(p_decision, decision) else decision end,
         investor_loss = case when p_status = 'decided' then coalesce(p_investor_loss, investor_loss) else investor_loss end,
         farmer_loss = case when p_status = 'decided' then coalesce(p_farmer_loss, farmer_loss) else farmer_loss end,
         herdvest_loss = case when p_status = 'decided' then coalesce(p_herdvest_loss, herdvest_loss) else herdvest_loss end,
         decided_by = case when p_status = 'decided' then hv.current_user_id() else decided_by end,
         decided_at = case when p_status = 'decided' then now() else decided_at end
   where id = p_incident;
  insert into hv.incident_events (incident_id, from_status, to_status, note, changed_by)
  values (p_incident, i.status, p_status, p_note, hv.current_user_id());
end $$;

create or replace function hv.guard_incident() returns trigger
language plpgsql as $$
begin
  if (new.status, new.decision, new.investor_loss, new.farmer_loss, new.herdvest_loss, new.decided_by)
     is distinct from (old.status, old.decision, old.investor_loss, old.farmer_loss, old.herdvest_loss, old.decided_by)
     and hv.via() <> 'incident_workflow' then
    raise exception 'Incident status and decisions change only through the incident workflow' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger incidents_guard before update on hv.incidents for each row execute function hv.guard_incident();

-- ========================================================== ENQUIRIES ===
-- Called by the public website (no signed-in user). Inserts only; public
-- visitors can never read enquiries back.
create or replace function hv.submit_enquiry(
  p_type text, p_name text, p_email text, p_phone text, p_location text, p_budget text, p_horizon text,
  p_subject text, p_message text, p_details jsonb)
returns text language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_code text;
begin
  if p_type not in ('investor','farmer','contact') then raise exception 'Invalid enquiry type'; end if;
  if (select count(*) from hv.enquiries
      where received_at > now() - interval '1 hour'
        and ((p_email is not null and email = p_email::citext) or (p_phone is not null and phone = p_phone))) >= 5 then
    raise exception 'rate_limited';
  end if;
  insert into hv.enquiries (enquiry_type, full_name, email, phone, location, budget, horizon, subject, message, details)
  values (p_type, left(p_name, 200), nullif(p_email, ''), nullif(p_phone, ''), left(p_location, 300), p_budget, p_horizon,
          p_subject, left(p_message, 4000), coalesce(p_details, '{}'))
  returning code into v_code;
  return v_code;
end $$;

create or replace function hv.convert_enquiry(p_enquiry uuid)
returns uuid language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare e hv.enquiries; v_id uuid;
begin
  select * into e from hv.enquiries where id = p_enquiry for update;
  if not found then raise exception 'Enquiry not found'; end if;
  if e.status = 'converted' then raise exception 'Enquiry % has already been converted', e.code; end if;
  if e.enquiry_type = 'farmer' then
    perform hv.require_perm('farmers.write');
    insert into hv.farmers (full_name, phone, city, district, farm_location, capacity, livestock_types, notes, enquiry_id)
    values (e.full_name, e.phone, e.details->>'cityDistrict', e.details->>'cityDistrict', e.details->>'farmLocation',
            nullif(regexp_replace(coalesce(e.details->>'capacity', ''), '\D.*$', ''), '')::int,
            coalesce(array(select jsonb_array_elements_text(e.details->'livestockTypes')), '{}'),
            concat_ws(E'\n', 'Experience: ' || (e.details->>'experience'), e.details->>'farmDescription'), e.id)
    returning id into v_id;
    update hv.enquiries set status = 'converted', converted_farmer_id = v_id where id = p_enquiry;
  else
    perform hv.require_perm('investors.write');
    insert into hv.investors (full_legal_name, phone, email, city, notes, enquiry_id)
    values (e.full_name, e.phone, e.email, e.location,
            concat_ws(E'\n', 'Converted from enquiry ' || e.code,
                      case when e.budget is not null then 'Indicative budget: ' || e.budget end,
                      case when e.horizon is not null then 'Preferred horizon: ' || e.horizon end), e.id)
    returning id into v_id;
    update hv.enquiries set status = 'converted', converted_investor_id = v_id where id = p_enquiry;
  end if;
  return v_id;
end $$;

-- ============================================================= INTAKE ===
-- Called by authenticated webhooks (email / WhatsApp) or reviewers.
create or replace function hv.intake_receive(
  p_source text, p_sender text, p_subject text, p_body text, p_external_id text, p_received_at timestamptz,
  p_detected text[], p_extracted jsonb, p_issues text[], p_matched_animal uuid)
returns table (id uuid, duplicate boolean) language plpgsql security definer set search_path = hv, public, pg_temp as $$
declare v_hash text; v_id uuid;
begin
  v_hash := encode(digest(coalesce(p_source, '') || '|' || coalesce(p_external_id, coalesce(p_sender, '') || '|' || coalesce(p_body, '')), 'sha256'), 'hex');
  select i.id into v_id from hv.intake_items i where i.dedupe_hash = v_hash;
  if found then return query select v_id, true; return; end if;
  insert into hv.intake_items (source, sender, subject, body, received_at, external_id, dedupe_hash, detected_types, extracted, issues,
                               matched_animal_id, status)
  values (p_source, p_sender, p_subject, p_body, coalesce(p_received_at, now()), p_external_id, v_hash, coalesce(p_detected, '{}'),
          coalesce(p_extracted, '{}'), coalesce(p_issues, '{}'), p_matched_animal,
          case when p_matched_animal is null then 'unmatched' else 'pending_review' end)
  returning intake_items.id into v_id;
  return query select v_id, false;
end $$;

-- Animal lookup for intake matching (code or tag only; returns no personal data)
create or replace function hv.intake_find_animal(p_ref text)
returns uuid language sql stable security definer set search_path = hv, public, pg_temp as $$
  select id from hv.animals where upper(code) = upper(p_ref) or upper(tag_number) = upper(p_ref) limit 1
$$;

-- ========================================================= ATTACHMENTS ==
-- Can the current user see the parent record? (RLS on the parent decides.)
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
    else false end;
end $$;

create or replace function hv.guard_attachment() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.uploaded_by := hv.current_user_id();
    new.deleted_at := null; new.deleted_by := null;
    if new.category in ('identity_document','verification_document') then new.sensitive := true; end if;
    return new;
  end if;
  -- only soft-delete fields (and caption) may change
  if (new.entity_type, new.entity_id, new.storage_key, new.sha256, new.size_bytes, new.mime_type, new.uploaded_by, new.sensitive)
     is distinct from (old.entity_type, old.entity_id, old.storage_key, old.sha256, old.size_bytes, old.mime_type, old.uploaded_by, old.sensitive) then
    raise exception 'Attachment files cannot be altered' using errcode = '42501';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    if coalesce(trim(new.delete_reason), '') = '' then raise exception 'A reason is required to remove an attachment'; end if;
    new.deleted_by := hv.current_user_id();
  end if;
  return new;
end $$;
create trigger attachments_guard before insert or update on hv.attachments for each row execute function hv.guard_attachment();

-- ============================================================== TASKS ===
create or replace function hv.guard_task() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and not hv.has_perm('tasks.write') then
    -- assignees may only update progress fields on their own task
    if (new.title, new.task_type, new.assigned_to, new.due_date, new.investor_id, new.animal_id, new.farmer_id, new.expense_id, new.instructions)
       is distinct from (old.title, old.task_type, old.assigned_to, old.due_date, old.investor_id, old.animal_id, old.farmer_id, old.expense_id, old.instructions) then
      raise exception 'You can only update the status and findings of your own task' using errcode = '42501';
    end if;
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end $$;
create trigger tasks_guard before insert or update on hv.tasks for each row execute function hv.guard_task();

-- ===================================================== FIELD SCOPING ====
-- Animals / farmers a field employee may see: those linked to their tasks.
create or replace function hv.is_assigned_animal(p_animal uuid)
returns boolean language sql stable security definer set search_path = hv, public, pg_temp as $$
  select exists (
    select 1 from hv.tasks t
    left join hv.animals a on a.current_farmer_id = t.farmer_id
    where t.assigned_to = hv.current_employee_id() and t.status in ('open','in_progress')
      and (t.animal_id = p_animal or a.id = p_animal)
  )
$$;

create or replace function hv.is_assigned_farmer(p_farmer uuid)
returns boolean language sql stable security definer set search_path = hv, public, pg_temp as $$
  select exists (
    select 1 from hv.tasks t
    left join hv.animals a on a.id = t.animal_id
    where t.assigned_to = hv.current_employee_id() and t.status in ('open','in_progress')
      and (t.farmer_id = p_farmer or a.current_farmer_id = p_farmer)
  )
$$;

-- ======================================================= SEARCH / DASH ==
-- Runs with the caller's rights: RLS removes anything they may not see.
create or replace function hv.global_search(p_q text)
returns table (kind text, id uuid, code text, label text, detail text)
language sql stable as $$
  with q as (select '%' || trim(p_q) || '%' as pat, trim(p_q) as raw)
  select * from (
    select 'animal', a.id, a.code, initcap(a.species) || coalesce(' · ' || a.breed, ''), coalesce('Tag ' || a.tag_number, a.status)
      from hv.animals a, q where a.code ilike q.pat or a.tag_number ilike q.pat
    union all
    select 'investor', i.id, i.code, i.full_legal_name, coalesce(i.city, '')
      from hv.investors i, q where i.code ilike q.pat or i.full_legal_name ilike q.pat or i.phone ilike q.pat or i.email::text ilike q.pat
    union all
    select 'farmer', f.id, f.code, f.full_name, coalesce(f.district, f.city, '')
      from hv.farmers f, q where f.code ilike q.pat or f.full_name ilike q.pat or f.phone ilike q.pat
    union all
    select 'ledger', l.id, l.code, initcap(replace(l.entry_type, '_', ' ')), coalesce(l.reference, '')
      from hv.ledger_entries l, q where l.code ilike q.pat or l.reference ilike q.pat
    union all
    select 'purchase', p.id, p.code, 'Purchase ' || p.purchase_date, coalesce(p.seller_name, '')
      from hv.purchases p, q where p.code ilike q.pat
    union all
    select 'expense', e.id, e.code, e.description, e.status
      from hv.expenses e, q where e.code ilike q.pat or e.payment_reference ilike q.pat
    union all
    select 'sale', s.id, s.code, 'Sale ' || s.sale_date, coalesce(s.buyer_name, '')
      from hv.sales s, q where s.code ilike q.pat
    union all
    select 'task', t.id, t.code, t.title, t.status
      from hv.tasks t, q where t.code ilike q.pat or t.title ilike q.pat
    union all
    select 'enquiry', e.id, e.code, e.full_name, e.status
      from hv.enquiries e, q where e.code ilike q.pat or e.full_name ilike q.pat or e.phone ilike q.pat
  ) r
  limit 40
$$;
