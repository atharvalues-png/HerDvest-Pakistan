-- ============================================================================
-- Herdvest Management System — 002 business records
-- Money is numeric(14,2) (never floating point). Timestamps are timestamptz;
-- display uses the configurable business timezone in hv.settings.
-- ============================================================================

create domain hv.money as numeric(14,2) check (value >= 0);

-- ------------------------------------------------------------- enquiries --
create sequence hv.seq_enquiry;
create table hv.enquiries (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default 'ENQ-' || lpad(nextval('hv.seq_enquiry')::text, 4, '0'),
  enquiry_type  text not null check (enquiry_type in ('investor','farmer','contact')),
  source        text not null default 'website',
  full_name     text not null,
  email         citext,
  phone         text,
  location      text,
  budget        text,
  horizon       text,
  subject       text,
  message       text,
  details       jsonb not null default '{}',    -- remaining form fields
  status        text not null default 'new' check (status in ('new','contacted','qualified','converted','closed')),
  assigned_to   uuid references hv.employees(id),
  notes         text,
  converted_investor_id uuid,
  converted_farmer_id   uuid,
  received_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on hv.enquiries (status, received_at desc);

-- ------------------------------------------------------------- investors --
create sequence hv.seq_investor;
create table hv.investors (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default 'INV-' || lpad(nextval('hv.seq_investor')::text, 4, '0'),
  full_legal_name text not null,
  phone           text,
  email           citext,
  address         text,
  city            text,
  country         text default 'Pakistan',
  registered_on   date not null default current_date,
  status          text not null default 'prospective' check (status in ('prospective','active','dormant','exited','suspended')),
  contact_preference text check (contact_preference in ('phone','email','whatsapp','any')),
  communication_notes text,
  notes           text,
  enquiry_id      uuid references hv.enquiries(id),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now()
);
alter table hv.enquiries add constraint enquiries_investor_fk foreign key (converted_investor_id) references hv.investors(id);

create sequence hv.seq_account;
create table hv.investment_accounts (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique default 'ACC-' || lpad(nextval('hv.seq_account')::text, 4, '0'),
  investor_id      uuid not null references hv.investors(id),
  name             text not null default 'Livestock investment account',
  agreement_ref    text,                 -- signed agreement reference
  investor_share_pct numeric(5,2) not null default 50 check (investor_share_pct between 0 and 100),
  service_fee_pct  numeric(5,2) not null default 20 check (service_fee_pct between 0 and 100),
  deduct_sale_expenses boolean not null default false,  -- per agreement: are approved sale expenses deducted before sharing?
  status           text not null default 'open' check (status in ('open','closed','suspended')),
  opened_on        date not null default current_date,
  notes            text,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now()
);
create index on hv.investment_accounts (investor_id);

-- ----------------------------------------------------- funding ledger ----
-- Every movement of investor funds. Balances are always computed from rows
-- with status 'verified'; typed totals are never stored.
create sequence hv.seq_txn;
create table hv.ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default 'TXN-' || lpad(nextval('hv.seq_txn')::text, 5, '0'),
  account_id      uuid not null references hv.investment_accounts(id),
  investor_id     uuid not null references hv.investors(id),
  entry_type      text not null check (entry_type in
                    ('deposit','purchase_allocation','expense_charge','refund_to_investor','adjustment_in','adjustment_out','reversal')),
  amount          hv.money not null check (amount > 0),
  currency        text not null default 'PKR',
  occurred_at     timestamptz not null default now(),
  payment_method  text,
  reference       text,                  -- bank / receipt reference
  status          text not null default 'pending' check (status in ('pending','verified','rejected','reversed')),
  recorded_by     uuid,
  verified_by     uuid,
  verified_at     timestamptz,
  reverses_id     uuid references hv.ledger_entries(id),
  purchase_id     uuid,
  expense_id      uuid unique,           -- an expense can be charged to an account only once
  idempotency_key text unique,
  notes           text,
  created_at      timestamptz not null default now()
);
create index on hv.ledger_entries (account_id, status);
create unique index ledger_deposit_reference_uq on hv.ledger_entries (account_id, reference)
  where entry_type = 'deposit' and reference is not null and status <> 'rejected';

-- Decisions about unallocated cash (retain / expense / return / hold)
create table hv.unallocated_decisions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references hv.investment_accounts(id),
  amount      hv.money not null,
  decision    text not null check (decision in ('retain_for_purchase','allocate_to_expense','return_to_investor','hold_pending')),
  notes       text,
  ledger_entry_id uuid references hv.ledger_entries(id),
  decided_by  uuid,
  decided_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- farmers --
create sequence hv.seq_farmer;
create table hv.farmers (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique default 'FRM-' || lpad(nextval('hv.seq_farmer')::text, 4, '0'),
  full_name          text not null,
  phone              text,
  address            text,
  district           text,
  city               text,
  farm_location      text,
  experience_years   numeric(4,1),
  capacity           int check (capacity >= 0),
  livestock_types    text[] not null default '{}',
  agreement_status   text not null default 'none' check (agreement_status in ('none','draft','signed','expired','terminated')),
  verification_status text not null default 'application_received' check (verification_status in
                       ('application_received','documents_pending','verification_in_progress','farm_inspection_pending','verified','rejected','suspended')),
  background_check_status text not null default 'not_started' check (background_check_status in
                       ('not_started','consent_pending','in_progress','clear','concerns_noted','not_required')),
  references_text    text,
  verification_notes text,
  notes              text,
  verified_by        uuid,
  verified_at        timestamptz,
  enquiry_id         uuid references hv.enquiries(id),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now()
);
alter table hv.enquiries add constraint enquiries_farmer_fk foreign key (converted_farmer_id) references hv.farmers(id);

create table hv.farmer_verification_events (
  id          uuid primary key default gen_random_uuid(),
  farmer_id   uuid not null references hv.farmers(id),
  from_status text,
  to_status   text not null,
  notes       text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

-- ------------------------------------------------------- livestock -------
create table hv.livestock_types (
  id    text primary key,
  label text not null
);

create sequence hv.seq_animal;
create table hv.animals (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique default 'HV-' || lpad(nextval('hv.seq_animal')::text, 3, '0'),
  species           text not null default 'buffalo' references hv.livestock_types(id),
  breed             text,
  sex               text check (sex in ('female','male','unknown')),
  birth_date_estimate date,
  age_months_estimate int,
  color             text,
  tag_number        text unique,
  status            text not null default 'purchased' check (status in
                      ('sourcing','purchased','awaiting_allocation','allocated','active','under_treatment','sale_preparation','sold','deceased','other')),
  status_note       text,
  investor_id       uuid references hv.investors(id),
  account_id        uuid references hv.investment_accounts(id),
  current_farmer_id uuid references hv.farmers(id),
  farm_location     text,
  condition_at_purchase text,
  vet_assessment_at_purchase text,
  notes             text,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now()
);
create index on hv.animals (investor_id);
create index on hv.animals (current_farmer_id);
create index on hv.animals (status);

create table hv.animal_status_history (
  id          uuid primary key default gen_random_uuid(),
  animal_id   uuid not null references hv.animals(id),
  from_status text,
  to_status   text not null,
  reason      text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index on hv.animal_status_history (animal_id, changed_at);

-- -------------------------------------------------------------- purchases --
create sequence hv.seq_purchase;
create table hv.purchases (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default 'PUR-' || lpad(nextval('hv.seq_purchase')::text, 4, '0'),
  account_id      uuid not null references hv.investment_accounts(id),
  investor_id     uuid not null references hv.investors(id),
  purchase_date   date not null,
  seller_name     text,
  seller_contact  text,
  location        text,
  total_cost      hv.money not null,
  status          text not null default 'completed' check (status in ('completed','voided')),
  void_reason     text,
  idempotency_key text unique,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid
);
alter table hv.ledger_entries add constraint ledger_purchase_fk foreign key (purchase_id) references hv.purchases(id);

create table hv.purchase_lines (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references hv.purchases(id),
  animal_id   uuid not null unique references hv.animals(id),   -- one purchase line per animal
  price       hv.money not null check (price > 0)
);

-- ------------------------------------------------------------ allocations --
create table hv.allocations (
  id                uuid primary key default gen_random_uuid(),
  animal_id         uuid not null references hv.animals(id),
  farmer_id         uuid not null references hv.farmers(id),
  investor_id       uuid references hv.investors(id),
  account_id        uuid references hv.investment_accounts(id),
  start_date        date not null,
  end_date          date,
  farm_location     text,
  agreement_ref     text,
  responsibilities  text,
  review_date       date,
  status            text not null default 'active' check (status in ('active','ended')),
  care_type         text not null default 'primary' check (care_type in ('primary','shared')),
  reason            text,                -- reason for this allocation / transfer
  condition_at_start text,
  end_reason        text,
  condition_at_end  text,
  created_by        uuid,
  created_at        timestamptz not null default now()
);
-- one current primary care assignment per animal
create unique index allocations_one_active_primary on hv.allocations (animal_id)
  where status = 'active' and care_type = 'primary';

-- --------------------------------------------------- veterinary records --
create sequence hv.seq_vet;
create table hv.vet_records (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default 'VET-' || lpad(nextval('hv.seq_vet')::text, 5, '0'),
  animal_id       uuid not null references hv.animals(id),
  investor_id     uuid references hv.investors(id),
  farmer_id       uuid references hv.farmers(id),
  visit_type      text not null check (visit_type in ('inspection','vaccination','treatment','health_check','follow_up','purchase_assessment')),
  status          text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','missed')),
  scheduled_date  date,
  visit_date      date,
  performed_by    text,                -- veterinarian name (may be external)
  employee_id     uuid references hv.employees(id),
  location        text,
  findings        text,
  condition       text check (condition in ('excellent','good','fair','poor','critical')),
  weight_kg       numeric(7,2),
  vaccine_name    text,
  vaccination_date date,
  next_due_date   date,
  treatment       text,
  follow_up       text,
  cost            numeric(14,2) check (cost >= 0),
  notes           text,
  source_intake_id uuid,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now()
);
create index on hv.vet_records (animal_id, coalesce(visit_date, scheduled_date));
create index on hv.vet_records (next_due_date) where next_due_date is not null;

-- --------------------------------------------------------------- expenses --
create sequence hv.seq_expense;
create table hv.expense_categories (
  id    text primary key,
  label text not null
);

create table hv.expenses (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default 'EXP-' || lpad(nextval('hv.seq_expense')::text, 5, '0'),
  expense_date    date not null,
  category_id     text not null references hv.expense_categories(id),
  description     text not null,
  amount          hv.money not null check (amount > 0),
  currency        text not null default 'PKR',
  vendor          text,
  investor_id     uuid references hv.investors(id),
  account_id      uuid references hv.investment_accounts(id),
  farmer_id       uuid references hv.farmers(id),
  vet_record_id   uuid references hv.vet_records(id),
  sale_id         uuid,
  charge_type     text not null default 'to_be_determined' check (charge_type in
                    ('to_be_determined','herdvest_operating','chargeable_to_investment','covered_by_service_fee','paid_by_farmer','reimbursement_required')),
  status          text not null default 'submitted' check (status in ('submitted','approved','rejected','paid','disputed','voided')),
  payment_method  text,
  payment_reference text,
  submitted_by    uuid,
  approved_by     uuid,
  approved_at     timestamptz,
  paid_at         timestamptz,
  rejection_reason text,
  notes           text,
  source_intake_id uuid,
  idempotency_key text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on hv.expenses (status);

-- split of one expense across animals (sum must equal expense amount)
create table hv.expense_allocations (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references hv.expenses(id),
  animal_id  uuid not null references hv.animals(id),
  amount     hv.money not null check (amount > 0),
  unique (expense_id, animal_id)
);

-- ------------------------------------------------------------------ tasks --
create sequence hv.seq_task;
create table hv.tasks (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default 'TSK-' || lpad(nextval('hv.seq_task')::text, 4, '0'),
  title         text not null,
  task_type     text not null check (task_type in ('farm_inspection','animal_photography','vet_coordination','vaccination_verification',
                  'status_check','receipt_collection','farmer_verification','sale_preparation','other')),
  assigned_to   uuid references hv.employees(id),
  due_date      date,
  investor_id   uuid references hv.investors(id),
  animal_id     uuid references hv.animals(id),
  farmer_id     uuid references hv.farmers(id),
  expense_id    uuid references hv.expenses(id),
  instructions  text,
  status        text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  completed_at  timestamptz,
  findings      text,
  location_note text,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now()
);
create index on hv.tasks (assigned_to, status);

-- ------------------------------------------------------- sales/settlement --
create sequence hv.seq_sale;
create table hv.sales (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default 'SAL-' || lpad(nextval('hv.seq_sale')::text, 4, '0'),
  animal_id       uuid not null unique references hv.animals(id),   -- an animal is sold once
  investor_id     uuid references hv.investors(id),
  account_id      uuid references hv.investment_accounts(id),
  farmer_id       uuid references hv.farmers(id),
  sale_date       date not null,
  buyer_name      text,
  buyer_contact   text,
  sale_price      hv.money not null,
  responsible_employee_id uuid references hv.employees(id),
  status          text not null default 'recorded' check (status in ('recorded','voided')),
  has_dispute     boolean not null default false,
  dispute_note    text,
  idempotency_key text unique,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid
);
alter table hv.expenses add constraint expenses_sale_fk foreign key (sale_id) references hv.sales(id);

-- Actual money received from the buyer (may be in instalments)
create table hv.sale_receipts (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references hv.sales(id),
  amount      hv.money not null check (amount > 0),
  received_at timestamptz not null,
  method      text,
  reference   text,
  recorded_by uuid,
  created_at  timestamptz not null default now(),
  unique (sale_id, reference)
);

create sequence hv.seq_settlement;
create table hv.settlements (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique default 'STL-' || lpad(nextval('hv.seq_settlement')::text, 4, '0'),
  sale_id            uuid not null unique references hv.sales(id),   -- one settlement (and one fee) per sale
  -- calculated values (system)
  purchase_cost      numeric(14,2) not null,
  gross_proceeds     numeric(14,2) not null,
  deducted_sale_expenses numeric(14,2) not null default 0,
  net_proceeds       numeric(14,2) not null,
  capital_returned   numeric(14,2) not null,
  capital_shortfall  numeric(14,2) not null,
  profit_pool        numeric(14,2) not null,
  investor_share_pct numeric(5,2) not null,
  service_fee_pct    numeric(5,2) not null,
  investor_gross     numeric(14,2) not null,
  farmer_share       numeric(14,2) not null,
  herdvest_fee       numeric(14,2) not null,
  investor_net       numeric(14,2) not null,
  -- payable amounts (default = calculated; may be changed only on authorised review)
  investor_payable   numeric(14,2) not null,
  farmer_payable     numeric(14,2) not null,
  herdvest_payable   numeric(14,2) not null,
  review_reasons     text[] not null default '{}',
  status             text not null default 'calculated' check (status in
                       ('calculated','review_required','approved','partially_paid','paid','voided')),
  review_note        text,
  approved_by        uuid,
  approved_at        timestamptz,
  calculated_at      timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create table hv.settlement_payments (
  id            uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references hv.settlements(id),
  payee         text not null check (payee in ('investor','farmer','herdvest')),
  amount        hv.money not null check (amount > 0),
  paid_at       timestamptz not null,
  method        text,
  reference     text,
  recorded_by   uuid,
  idempotency_key text unique,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------- incidents --
create sequence hv.seq_incident;
create table hv.incidents (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique default 'INC-' || lpad(nextval('hv.seq_incident')::text, 4, '0'),
  animal_id        uuid not null references hv.animals(id),
  investor_id      uuid references hv.investors(id),
  farmer_id        uuid references hv.farmers(id),
  incident_type    text not null check (incident_type in ('death','major_injury','serious_illness','theft_or_loss','other')),
  occurred_at      timestamptz not null,
  reported_by_name text,
  description      text not null,
  vet_findings     text,
  status           text not null default 'reported' check (status in ('reported','investigating','under_review','decided','closed')),
  contractual_notes text,
  estimated_loss   numeric(14,2),
  outstanding_items text,
  decision         text,                -- approved loss allocation, in words
  investor_loss    numeric(14,2),
  farmer_loss      numeric(14,2),
  herdvest_loss    numeric(14,2),
  decided_by       uuid,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now()
);

create table hv.incident_events (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references hv.incidents(id),
  from_status text,
  to_status   text not null,
  note        text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ attachments --
create table hv.attachments (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('investor','account','ledger_entry','animal','purchase','farmer','allocation',
                  'vet_record','expense','task','sale','settlement','incident','employee','enquiry','intake_item')),
  entity_id     uuid not null,
  category      text not null default 'other' check (category in ('agreement','identity_document','payment_proof','purchase_receipt',
                  'animal_photo','farm_photo','veterinary_report','vaccination_record','inspection_video','expense_receipt',
                  'sale_agreement','sale_receipt','incident_document','verification_document','other')),
  sensitive     boolean not null default false,   -- identity docs etc. need files.sensitive
  original_name text not null,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  storage_key   text not null unique,              -- private object key; never a public URL
  sha256        text not null,
  caption       text,
  uploaded_by   uuid,
  uploaded_at   timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid,
  delete_reason text
);
create index on hv.attachments (entity_type, entity_id) where deleted_at is null;

-- --------------------------------------------------------- intake queue --
create table hv.intake_items (
  id             uuid primary key default gen_random_uuid(),
  source         text not null check (source in ('email','whatsapp','manual','api')),
  sender         text,
  subject        text,
  body           text,
  received_at    timestamptz not null default now(),
  external_id    text,                     -- provider message id
  dedupe_hash    text not null unique,     -- duplicate detection
  detected_types text[] not null default '{}',
  extracted      jsonb not null default '{}',
  issues         text[] not null default '{}',
  matched_animal_id uuid references hv.animals(id),
  status         text not null default 'pending_review' check (status in ('pending_review','unmatched','approved','rejected','duplicate')),
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  review_note    text,
  created_records jsonb not null default '[]',
  created_at     timestamptz not null default now()
);
