-- ============================================================================
-- Herdvest Management System — 004 row-level security, grants and seed data
-- ============================================================================

-- Fill investor/farmer links on veterinary records from the animal (so field
-- staff never need to see investor data to record a visit).
create or replace function hv.fill_vet_links() returns trigger
language plpgsql security definer set search_path = hv, public, pg_temp as $$
begin
  select investor_id, current_farmer_id into new.investor_id, new.farmer_id from hv.animals where id = new.animal_id;
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, hv.current_user_id()); end if;
  return new;
end $$;
create trigger vet_records_links before insert or update of animal_id on hv.vet_records for each row execute function hv.fill_vet_links();

-- ------------------------------------------------------------ enable RLS --
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'hv' loop
    execute format('alter table hv.%I enable row level security', t);
    execute format('alter table hv.%I force row level security', t);
  end loop;
end $$;

-- The schema owner (migrations / definer functions) bypasses RLS via BYPASSRLS
-- or ownership; FORCE only matters for the owner when it lacks BYPASSRLS, so
-- allow the owner explicitly.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'hv' loop
    execute format('create policy owner_all on hv.%I to %I using (true) with check (true)', t, current_user);
  end loop;
end $$;

-- ------------------------------------------------------------- policies --
-- reference data
create policy read_auth on hv.roles for select to herdvest_app using (hv.is_authenticated());
create policy manage on hv.roles for all to herdvest_app using (hv.has_perm('users.manage')) with check (hv.has_perm('users.manage'));
create policy read_auth on hv.permissions for select to herdvest_app using (hv.is_authenticated());
create policy read_auth on hv.role_permissions for select to herdvest_app using (hv.is_authenticated());
create policy manage on hv.role_permissions for all to herdvest_app
  using (hv.current_role_id() = 'super_admin') with check (hv.current_role_id() = 'super_admin' and role_id <> 'super_admin');
create policy read_auth on hv.settings for select to herdvest_app using (hv.is_authenticated());
create policy manage on hv.settings for all to herdvest_app using (hv.has_perm('settings.manage')) with check (hv.has_perm('settings.manage'));
create policy read_auth on hv.livestock_types for select to herdvest_app using (hv.is_authenticated());
create policy manage on hv.livestock_types for all to herdvest_app using (hv.has_perm('settings.manage')) with check (hv.has_perm('settings.manage'));
create policy read_auth on hv.expense_categories for select to herdvest_app using (hv.is_authenticated());
create policy manage on hv.expense_categories for all to herdvest_app using (hv.has_perm('settings.manage')) with check (hv.has_perm('settings.manage'));

-- people
create policy read on hv.users for select to herdvest_app using (hv.has_perm('users.manage') or id = hv.current_user_id());
create policy ins on hv.users for insert to herdvest_app with check (hv.has_perm('users.manage'));
create policy upd on hv.users for update to herdvest_app using (hv.has_perm('users.manage')) with check (hv.has_perm('users.manage'));
create policy read on hv.employees for select to herdvest_app using (hv.has_perm('employees.read') or id = hv.current_employee_id());
create policy ins on hv.employees for insert to herdvest_app with check (hv.has_perm('employees.manage'));
create policy upd on hv.employees for update to herdvest_app using (hv.has_perm('employees.manage')) with check (hv.has_perm('employees.manage'));

-- enquiries (public inserts go through hv.submit_enquiry only)
create policy read on hv.enquiries for select to herdvest_app using (hv.has_perm('enquiries.read'));
create policy upd on hv.enquiries for update to herdvest_app using (hv.has_perm('enquiries.write')) with check (hv.has_perm('enquiries.write'));

-- investors & accounts
create policy read on hv.investors for select to herdvest_app using (hv.has_perm('investors.read'));
create policy ins on hv.investors for insert to herdvest_app with check (hv.has_perm('investors.write'));
create policy upd on hv.investors for update to herdvest_app using (hv.has_perm('investors.write')) with check (hv.has_perm('investors.write'));
create policy read on hv.investment_accounts for select to herdvest_app using (hv.has_perm('investors.read'));
create policy ins on hv.investment_accounts for insert to herdvest_app with check (hv.has_perm('investors.write'));
create policy upd on hv.investment_accounts for update to herdvest_app using (hv.has_perm('investors.write')) with check (hv.has_perm('investors.write'));

-- money: read-only to the app; every write goes through workflow functions
create policy read on hv.ledger_entries for select to herdvest_app using (hv.has_perm('finance.read'));
create policy read on hv.unallocated_decisions for select to herdvest_app using (hv.has_perm('finance.read'));
create policy read on hv.purchases for select to herdvest_app using (hv.has_perm('purchases.read') or hv.has_perm('finance.read'));
create policy read on hv.purchase_lines for select to herdvest_app using (hv.has_perm('purchases.read') or hv.has_perm('finance.read'));
create policy read on hv.sales for select to herdvest_app using (hv.has_perm('sales.read') or hv.has_perm('finance.read'));
create policy upd on hv.sales for update to herdvest_app using (hv.has_perm('sales.write')) with check (hv.has_perm('sales.write'));
create policy read on hv.sale_receipts for select to herdvest_app using (hv.has_perm('sales.read') or hv.has_perm('finance.read'));
create policy read on hv.settlements for select to herdvest_app using (hv.has_perm('sales.read') or hv.has_perm('finance.read'));
create policy read on hv.settlement_payments for select to herdvest_app using (hv.has_perm('sales.read') or hv.has_perm('finance.read'));

-- farmers
create policy read on hv.farmers for select to herdvest_app using (hv.has_perm('farmers.read') or hv.is_assigned_farmer(id));
create policy ins on hv.farmers for insert to herdvest_app with check (hv.has_perm('farmers.write'));
create policy upd on hv.farmers for update to herdvest_app using (hv.has_perm('farmers.write')) with check (hv.has_perm('farmers.write'));
create policy read on hv.farmer_verification_events for select to herdvest_app using (hv.has_perm('farmers.read'));

-- livestock
create policy read on hv.animals for select to herdvest_app using (hv.has_perm('livestock.read') or hv.is_assigned_animal(id));
create policy upd on hv.animals for update to herdvest_app using (hv.has_perm('livestock.write')) with check (hv.has_perm('livestock.write'));
create policy read on hv.animal_status_history for select to herdvest_app using (hv.has_perm('livestock.read') or hv.is_assigned_animal(animal_id));
create policy read on hv.allocations for select to herdvest_app using (hv.has_perm('livestock.read') or hv.is_assigned_animal(animal_id));

-- veterinary & inspections
create policy read on hv.vet_records for select to herdvest_app
  using (hv.has_perm('vet.read') or created_by = hv.current_user_id() or hv.is_assigned_animal(animal_id));
create policy ins on hv.vet_records for insert to herdvest_app
  with check (hv.has_perm('vet.write') and (hv.has_perm('livestock.read') or hv.is_assigned_animal(animal_id)));
create policy upd on hv.vet_records for update to herdvest_app
  using (hv.has_perm('vet.write') and (hv.has_perm('vet.read') or created_by = hv.current_user_id()))
  with check (hv.has_perm('vet.write'));

-- expenses
create policy read on hv.expenses for select to herdvest_app using (hv.has_perm('expenses.read') or submitted_by = hv.current_user_id());
create policy ins on hv.expenses for insert to herdvest_app with check (hv.has_perm('expenses.submit'));
create policy upd on hv.expenses for update to herdvest_app
  using ((submitted_by = hv.current_user_id() and status = 'submitted') or hv.has_perm('expenses.approve'))
  with check ((submitted_by = hv.current_user_id() and status = 'submitted') or hv.has_perm('expenses.approve'));
create policy read on hv.expense_allocations for select to herdvest_app
  using (exists (select 1 from hv.expenses e where e.id = expense_id));
create policy write on hv.expense_allocations for all to herdvest_app
  using (exists (select 1 from hv.expenses e where e.id = expense_id and (e.submitted_by = hv.current_user_id() or hv.has_perm('expenses.approve'))))
  with check (exists (select 1 from hv.expenses e where e.id = expense_id and (e.submitted_by = hv.current_user_id() or hv.has_perm('expenses.approve'))));

-- tasks
create policy read on hv.tasks for select to herdvest_app
  using (hv.has_perm('tasks.read_all') or (assigned_to is not null and assigned_to = hv.current_employee_id()));
create policy ins on hv.tasks for insert to herdvest_app with check (hv.has_perm('tasks.write'));
create policy upd on hv.tasks for update to herdvest_app
  using (hv.has_perm('tasks.write') or (assigned_to is not null and assigned_to = hv.current_employee_id()))
  with check (hv.has_perm('tasks.write') or (assigned_to is not null and assigned_to = hv.current_employee_id()));

-- incidents
create policy read on hv.incidents for select to herdvest_app using (hv.has_perm('incidents.read') or created_by = hv.current_user_id());
create policy upd on hv.incidents for update to herdvest_app using (hv.has_perm('incidents.write')) with check (hv.has_perm('incidents.write'));
create policy read on hv.incident_events for select to herdvest_app
  using (exists (select 1 from hv.incidents i where i.id = incident_id));

-- attachments: parent must be visible; sensitive files need files.sensitive
create policy read on hv.attachments for select to herdvest_app
  using ((not sensitive or hv.has_perm('files.sensitive')) and hv.can_access_entity(entity_type, entity_id));
create policy ins on hv.attachments for insert to herdvest_app
  with check (hv.has_perm('files.upload') and (not sensitive or hv.has_perm('files.sensitive')) and hv.can_access_entity(entity_type, entity_id));
create policy upd on hv.attachments for update to herdvest_app
  using (hv.has_perm('files.delete') and (not sensitive or hv.has_perm('files.sensitive')))
  with check (hv.has_perm('files.delete'));

-- intake
create policy read on hv.intake_items for select to herdvest_app using (hv.has_perm('intake.review'));
create policy upd on hv.intake_items for update to herdvest_app using (hv.has_perm('intake.review')) with check (hv.has_perm('intake.review'));

-- audit (read-only, and only for permitted users)
create policy read on hv.audit_log for select to herdvest_app using (hv.has_perm('audit.read'));

-- ---------------------------------------------------------------- grants --
grant usage on schema hv to herdvest_app;
grant select, insert, update on all tables in schema hv to herdvest_app;
grant delete on hv.expense_allocations to herdvest_app;           -- only while expense is awaiting approval (trigger)
revoke insert, update on hv.audit_log, hv.ledger_entries, hv.unallocated_decisions, hv.purchases, hv.purchase_lines,
  hv.settlements, hv.settlement_payments, hv.sale_receipts, hv.allocations, hv.animal_status_history, hv.farmer_verification_events,
  hv.incident_events, hv.sessions, hv.login_attempts from herdvest_app;
revoke insert on hv.sales, hv.incidents, hv.animals, hv.enquiries, hv.intake_items from herdvest_app;
revoke all on hv.sessions, hv.login_attempts from herdvest_app;
-- password hashes are never readable by the application role
revoke select on hv.users from herdvest_app;
grant select (id, email, full_name, role_id, employee_id, is_active, must_change_password, failed_logins, locked_until,
              last_login_at, created_at, created_by, updated_at) on hv.users to herdvest_app;
revoke update on hv.users from herdvest_app;
grant update (full_name, role_id, employee_id, is_active, must_change_password, failed_logins, locked_until) on hv.users to herdvest_app;
grant usage on all sequences in schema hv to herdvest_app;
grant execute on all functions in schema hv to herdvest_app;
grant select on hv.account_balances to herdvest_app;

-- ------------------------------------------------------------ seed data --
insert into hv.permissions (id, module, description) values
  ('dashboard.view','general','View the management dashboard'),
  ('investors.read','investors','View investors and investment accounts'),
  ('investors.write','investors','Create and edit investors and accounts'),
  ('finance.read','finance','View funding ledger, balances and financial figures'),
  ('finance.write','finance','Record deposits, payments and unallocated-fund decisions'),
  ('finance.approve','finance','Verify or reverse ledger entries and void purchases'),
  ('purchases.read','livestock','View purchase records and prices'),
  ('purchases.write','livestock','Record livestock purchases against investor funds'),
  ('livestock.read','livestock','View all animals'),
  ('livestock.write','livestock','Edit animal details and status'),
  ('allocations.write','livestock','Allocate and transfer animals to farmers'),
  ('farmers.read','farmers','View all farmers'),
  ('farmers.write','farmers','Create and edit farmers'),
  ('farmers.verify','farmers','Approve, reject or suspend farmer verification'),
  ('vet.read','veterinary','View all veterinary and inspection records'),
  ('vet.write','veterinary','Create veterinary and inspection records'),
  ('expenses.submit','expenses','Submit expense claims'),
  ('expenses.read','expenses','View all expenses'),
  ('expenses.approve','expenses','Approve, reject, dispute or void expenses'),
  ('tasks.read_all','tasks','View all tasks'),
  ('tasks.write','tasks','Create and assign tasks'),
  ('sales.read','sales','View sales and settlements'),
  ('sales.write','sales','Record sales and buyer receipts'),
  ('settlements.approve','sales','Approve settlements and payable amounts'),
  ('incidents.read','incidents','View all incidents'),
  ('incidents.write','incidents','Report and update incidents'),
  ('incidents.approve','incidents','Decide loss allocation and close incidents'),
  ('enquiries.read','enquiries','View website enquiries'),
  ('enquiries.write','enquiries','Update and convert enquiries'),
  ('intake.review','intake','Review and approve email/WhatsApp intake'),
  ('files.upload','files','Upload attachments'),
  ('files.delete','files','Remove attachments (soft delete)'),
  ('files.sensitive','files','View and upload sensitive documents (identity, verification)'),
  ('reports.operational','reports','Operational reports'),
  ('reports.financial','reports','Financial reports and exports'),
  ('employees.read','people','View employees'),
  ('employees.manage','people','Create and edit employees'),
  ('users.manage','people','Manage user accounts and roles'),
  ('audit.read','admin','View the audit log'),
  ('settings.manage','admin','Change system settings');

insert into hv.roles (id, name, description, is_system) values
  ('super_admin','Super Admin / Business Owner','Full access to every module, user management and settings.', true),
  ('operations_manager','Operations Manager','Livestock, purchases, allocation, farmers, veterinary, tasks and sale preparation.', true),
  ('finance_officer','Finance Officer','Deposits, ledger, expenses, settlements, reconciliation and financial reports.', true),
  ('field_employee','Field Employee / Inspector','Assigned tasks only: inspections, photos, vet visits and expense claims.', true),
  ('auditor','Read-Only Auditor','Read access to records, reports and the audit log. Cannot change anything.', true);

insert into hv.role_permissions (role_id, permission_id) select 'super_admin', id from hv.permissions;

insert into hv.role_permissions (role_id, permission_id) select 'operations_manager', unnest(array[
  'dashboard.view','investors.read','purchases.read','purchases.write','livestock.read','livestock.write','allocations.write',
  'farmers.read','farmers.write','farmers.verify','vet.read','vet.write','expenses.submit','expenses.read','tasks.read_all','tasks.write',
  'sales.read','sales.write','incidents.read','incidents.write','enquiries.read','enquiries.write','intake.review',
  'files.upload','reports.operational','employees.read']);

insert into hv.role_permissions (role_id, permission_id) select 'finance_officer', unnest(array[
  'dashboard.view','investors.read','investors.write','finance.read','finance.write','finance.approve','purchases.read',
  'livestock.read','farmers.read','vet.read','expenses.submit','expenses.read','expenses.approve','tasks.read_all',
  'sales.read','sales.write','settlements.approve','incidents.read','enquiries.read','intake.review',
  'files.upload','files.sensitive','reports.operational','reports.financial','employees.read']);

insert into hv.role_permissions (role_id, permission_id) select 'field_employee', unnest(array[
  'vet.write','expenses.submit','files.upload','incidents.write']);

insert into hv.role_permissions (role_id, permission_id) select 'auditor', unnest(array[
  'dashboard.view','investors.read','finance.read','purchases.read','livestock.read','farmers.read','vet.read','expenses.read',
  'tasks.read_all','sales.read','incidents.read','enquiries.read','reports.operational','reports.financial','employees.read','audit.read']);

insert into hv.settings (key, value) values
  ('timezone', '"Asia/Karachi"'),
  ('currency', '"PKR"'),
  ('dual_control', 'false'),
  ('default_investor_share_pct', '50'),
  ('default_service_fee_pct', '20');

insert into hv.livestock_types (id, label) values ('buffalo','Buffalo'), ('cow','Cow'), ('goat','Goat'), ('sheep','Sheep'), ('other','Other');

insert into hv.expense_categories (id, label) values
  ('purchase_related','Livestock purchase-related cost'),
  ('veterinary_fee','Veterinary fee'),
  ('vaccination','Vaccination'),
  ('medicine','Medicine & treatment'),
  ('transport','Transportation'),
  ('inspection_visit','Inspection visit'),
  ('employee_travel','Employee travel'),
  ('feed_husbandry','Feeding / husbandry (where assigned to Herdvest)'),
  ('documentation','Documentation'),
  ('sale_related','Sale-related cost'),
  ('other','Other authorised operational expense');
