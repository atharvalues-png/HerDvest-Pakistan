import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { admin, app, as, createUser, resetTestDatabase } from "./helpers/db";

let A: pg.Pool; // privileged (setup only)
let P: pg.Pool; // application role — RLS applies
const U: Record<string, { id: string; employeeId: string | null }> = {};
const n = (v: unknown) => Number(v);

beforeAll(async () => {
  await resetTestDatabase();
  A = admin();
  P = app();
  U.owner = await createUser(A, "super_admin", "Owner One");
  U.ops = await createUser(A, "operations_manager", "Ops Manager", true);
  U.fin = await createUser(A, "finance_officer", "Finance Officer", true);
  U.field = await createUser(A, "field_employee", "Field Inspector", true);
  U.auditor = await createUser(A, "auditor", "Audit Person");
}, 60_000);

afterAll(async () => {
  await P?.end();
  await A?.end();
});

// ------------------------------------------------------------------ helpers
async function newInvestorAccount(name: string) {
  return as(P, U.fin.id, async (c) => {
    const inv = await c.query("insert into hv.investors (full_legal_name, phone, city) values ($1, '+92 300 0000000', 'Lahore') returning id, code", [name]);
    const acc = await c.query("insert into hv.investment_accounts (investor_id) values ($1) returning id, code", [inv.rows[0].id]);
    return { investorId: inv.rows[0].id as string, accountId: acc.rows[0].id as string };
  });
}

async function fundedAccount(name: string, amount: number) {
  const ids = await newInvestorAccount(name);
  const dep = await as(P, U.fin.id, (c) =>
    c.query("select hv.record_deposit($1, $2, now(), 'bank_transfer', $3, null) as id", [ids.accountId, amount, `REF-${name}`]),
  );
  await as(P, U.fin.id, (c) => c.query("select hv.verify_ledger_entry($1, true, 'bank statement checked')", [dep.rows[0].id]));
  return ids;
}

async function purchase(accountId: string, prices: number[]) {
  const animals = prices.map((price, i) => ({ species: "buffalo", breed: "Nili-Ravi", sex: "female", price, tag_number: `T-${Date.now()}-${i}-${Math.random()}` }));
  const r = await as(P, U.ops.id, (c) =>
    c.query("select hv.create_purchase($1, current_date, 'Seller', null, 'Sahiwal', $2::jsonb, null) as id", [accountId, JSON.stringify(animals)]),
  );
  const purchaseId = r.rows[0].id as string;
  const lines = await A.query("select animal_id from hv.purchase_lines where purchase_id = $1", [purchaseId]);
  return { purchaseId, animalIds: lines.rows.map((x) => x.animal_id as string) };
}

async function balance(accountId: string, user = U.fin.id) {
  return as(P, user, async (c) => (await c.query("select * from hv.account_balances where account_id = $1", [accountId])).rows[0]);
}

async function verifiedFarmer(name: string) {
  const f = await as(P, U.ops.id, (c) => c.query("insert into hv.farmers (full_name, district, farm_location) values ($1, 'Sahiwal', 'Chak 12') returning id", [name]));
  await as(P, U.ops.id, (c) => c.query("select hv.set_farmer_verification($1, 'verified', 'ID, farm visit and references checked')", [f.rows[0].id]));
  return f.rows[0].id as string;
}

// ================================================================ scenarios
describe("Investor funding", () => {
  test("PKR 500,000 deposit, two PKR 200,000 animals → PKR 100,000 unallocated, not profit", async () => {
    const { accountId, investorId } = await fundedAccount("Funding Scenario", 500_000);
    const { animalIds } = await purchase(accountId, [200_000, 200_000]);

    const b = await balance(accountId);
    expect(n(b.funds_received)).toBe(500_000);
    expect(n(b.purchases_allocated) + n(b.pending_outflows)).toBe(400_000);
    expect(n(b.unallocated)).toBe(100_000);
    expect(b.decision_required).toBe(true);

    const animals = await A.query("select investor_id, account_id, status from hv.animals where id = any($1)", [animalIds]);
    expect(animals.rows).toHaveLength(2);
    for (const a of animals.rows) {
      expect(a.investor_id).toBe(investorId);
      expect(a.account_id).toBe(accountId);
      expect(a.status).toBe("awaiting_allocation");
    }
    // nothing has been recorded as profit
    const settlements = await A.query("select count(*) from hv.settlements s join hv.sales x on x.id = s.sale_id where x.account_id = $1", [accountId]);
    expect(n(settlements.rows[0].count)).toBe(0);

    // authorised decision about the remaining cash
    await as(P, U.fin.id, (c) => c.query("select hv.record_unallocated_decision($1, 'retain_for_purchase', 'Hold for a third animal')", [accountId]));
    expect((await balance(accountId)).decision_required).toBe(false);

    // a later purchase links to the same investor and account
    const later = await purchase(accountId, [90_000]);
    const linked = await A.query("select investor_id from hv.animals where id = $1", [later.animalIds[0]]);
    expect(linked.rows[0].investor_id).toBe(investorId);
    expect(n((await balance(accountId)).unallocated)).toBe(10_000);
  });

  test("purchases cannot exceed verified unallocated funds; pending deposits do not count", async () => {
    const { accountId } = await fundedAccount("Overspend", 100_000);
    await as(P, U.fin.id, (c) => c.query("select hv.record_deposit($1, 900000, now(), 'bank_transfer', 'UNVERIFIED', null)", [accountId]));
    await expect(purchase(accountId, [150_000])).rejects.toThrow(/Insufficient verified unallocated funds/);
  });

  test("duplicate deposit references and idempotency keys are rejected / deduplicated", async () => {
    const { accountId } = await newInvestorAccount("Dupes");
    const k = "idem-123";
    const a = await as(P, U.fin.id, (c) => c.query("select hv.record_deposit($1, 1000, now(), 'cash', 'R-1', null, $2) id", [accountId, k]));
    const b = await as(P, U.fin.id, (c) => c.query("select hv.record_deposit($1, 1000, now(), 'cash', 'R-1', null, $2) id", [accountId, k]));
    expect(a.rows[0].id).toBe(b.rows[0].id);
    await expect(as(P, U.fin.id, (c) => c.query("select hv.record_deposit($1, 1000, now(), 'cash', 'R-1', null)", [accountId]))).rejects.toThrow(/duplicate/);
  });

  test("ledger rows cannot be edited or deleted, only reversed", async () => {
    const { accountId } = await fundedAccount("Immutable", 50_000);
    const row = await A.query("select id from hv.ledger_entries where account_id = $1", [accountId]);
    const id = row.rows[0].id;
    await expect(as(P, U.owner.id, (c) => c.query("delete from hv.ledger_entries where id = $1", [id]))).rejects.toThrow();
    await expect(as(P, U.owner.id, (c) => c.query("update hv.ledger_entries set amount = 1 where id = $1", [id]))).rejects.toThrow();
    await as(P, U.fin.id, (c) => c.query("select hv.reverse_ledger_entry($1, 'Bank recalled transfer')", [id]));
    expect(n((await balance(accountId)).funds_received)).toBe(0);
  });
});

describe("Purchase and allocation", () => {
  test("animal links purchase cost, investor, farmer; transfers keep history; unverified farmers blocked", async () => {
    const { accountId, investorId } = await fundedAccount("Allocation", 300_000);
    const { animalIds, purchaseId } = await purchase(accountId, [250_000]);
    const animal = animalIds[0];

    const unverified = await as(P, U.ops.id, (c) => c.query("insert into hv.farmers (full_name) values ('New Applicant') returning id, verification_status"));
    expect(unverified.rows[0].verification_status).toBe("application_received");
    await expect(
      as(P, U.ops.id, (c) => c.query("select hv.allocate_animal($1, $2, current_date, null, null, null, null, 'Initial', 'good')", [animal, unverified.rows[0].id])),
    ).rejects.toThrow(/not verified/);
    // verification cannot be forced by a direct update
    await expect(
      as(P, U.ops.id, (c) => c.query("update hv.farmers set verification_status = 'verified' where id = $1", [unverified.rows[0].id])),
    ).rejects.toThrow(/verification workflow/);

    const f1 = await verifiedFarmer("Farmer Alpha");
    const f2 = await verifiedFarmer("Farmer Beta");
    await as(P, U.ops.id, (c) => c.query("select hv.allocate_animal($1, $2, current_date - 30, null, 'AGR-1', 'Daily care', null, 'Initial allocation', 'good')", [animal, f1]));
    await as(P, U.ops.id, (c) => c.query("select hv.allocate_animal($1, $2, current_date, null, 'AGR-2', 'Daily care', null, 'Farmer relocated', 'good')", [animal, f2]));

    const a = (await A.query("select * from hv.animals where id = $1", [animal])).rows[0];
    expect(a.current_farmer_id).toBe(f2);
    expect(a.investor_id).toBe(investorId);
    const cost = (await A.query("select price from hv.purchase_lines where animal_id = $1 and purchase_id = $2", [animal, purchaseId])).rows[0];
    expect(n(cost.price)).toBe(250_000);
    const hist = (await A.query("select farmer_id, status, end_reason from hv.allocations where animal_id = $1 order by start_date", [animal])).rows;
    expect(hist.map((h) => [h.farmer_id, h.status])).toEqual([[f1, "ended"], [f2, "active"]]);
    expect(hist[0].end_reason).toBe("Farmer relocated");
    // farmer cannot be changed by a direct update
    await expect(as(P, U.owner.id, (c) => c.query("update hv.animals set current_farmer_id = $2 where id = $1", [animal, f1]))).rejects.toThrow(/allocation workflow/);
  });
});

describe("Expenses", () => {
  test("PKR 2,500 vaccination claim: submitted ≠ approved ≠ paid; charged once; locked after approval", async () => {
    const { accountId } = await fundedAccount("Expense", 300_000);
    const { animalIds } = await purchase(accountId, [200_000]);
    const animal = animalIds[0];
    const farmer = await verifiedFarmer("Farmer Expense");
    await as(P, U.ops.id, (c) => c.query("select hv.allocate_animal($1, $2, current_date, null, null, null, null, 'Initial', 'good')", [animal, farmer]));
    // field employee gets a task on this animal, then submits a claim
    await as(P, U.ops.id, (c) => c.query("insert into hv.tasks (title, task_type, assigned_to, animal_id) values ('Vaccinate', 'vaccination_verification', $1, $2)", [U.field.employeeId, animal]));

    const exp = await as(P, U.field.id, async (c) => {
      const r = await c.query(
        "insert into hv.expenses (expense_date, category_id, description, amount, vendor, status) values (current_date, 'vaccination', 'HS vaccine', 2500, 'Vet clinic', 'paid') returning id, status, submitted_by",
      );
      await c.query("insert into hv.expense_allocations (expense_id, animal_id, amount) values ($1, $2, 2500)", [r.rows[0].id, animal]);
      return r.rows[0];
    });
    expect(exp.status).toBe("submitted"); // cannot self-mark as paid
    expect(exp.submitted_by).toBe(U.field.id);
    await expect(as(P, U.field.id, (c) => c.query("select hv.decide_expense($1, true, 'chargeable_to_investment', $2, null)", [exp.id, accountId]))).rejects.toThrow(/Permission denied/);

    const before = n((await balance(accountId)).unallocated);
    await as(P, U.fin.id, (c) => c.query("select hv.decide_expense($1, true, 'chargeable_to_investment', $2, 'Per agreement clause 4')", [exp.id, accountId]));
    const after = n((await balance(accountId)).unallocated);
    expect(before - after).toBe(2500);
    const x = (await A.query("select status from hv.expenses where id = $1", [exp.id])).rows[0];
    expect(x.status).toBe("approved");
    // cannot approve again / charge twice
    await expect(as(P, U.fin.id, (c) => c.query("select hv.decide_expense($1, true, 'chargeable_to_investment', $2, null)", [exp.id, accountId]))).rejects.toThrow(/already approved/);
    await expect(as(P, U.fin.id, (c) => c.query("update hv.expenses set amount = 9999 where id = $1", [exp.id]))).rejects.toThrow(/cannot be edited/);
    await as(P, U.fin.id, (c) => c.query("select hv.mark_expense_paid($1, now(), 'cash', 'RCPT-77')", [exp.id]));
    expect((await A.query("select status from hv.expenses where id = $1", [exp.id])).rows[0].status).toBe("paid");
    expect(n((await A.query("select count(*) from hv.ledger_entries where expense_id = $1", [exp.id])).rows[0].count)).toBe(1);
  });

  test("Herdvest operating expenses are not deducted from investor funds", async () => {
    const { accountId } = await fundedAccount("Opex", 100_000);
    const exp = await as(P, U.ops.id, (c) =>
      c.query("insert into hv.expenses (expense_date, category_id, description, amount) values (current_date, 'employee_travel', 'Fuel', 3000) returning id"),
    );
    await as(P, U.fin.id, (c) => c.query("select hv.decide_expense($1, true, 'herdvest_operating', null, null)", [exp.rows[0].id]));
    expect(n((await balance(accountId)).unallocated)).toBe(100_000);
  });
});

describe("Sales and settlement", () => {
  test("PKR 250,000 → 600,000: pool 350,000; 175,000 / 175,000; fee 35,000 once; net 140,000", async () => {
    const { accountId } = await fundedAccount("Sale", 250_000);
    const { animalIds } = await purchase(accountId, [250_000]);
    const animal = animalIds[0];
    const farmer = await verifiedFarmer("Farmer Sale");
    await as(P, U.ops.id, (c) => c.query("select hv.allocate_animal($1, $2, current_date - 1000, null, null, null, null, 'Initial', 'good')", [animal, farmer]));

    const sale = await as(P, U.ops.id, (c) => c.query("select hv.record_sale($1, current_date, 'Buyer Co', null, 600000, null, null) id", [animal]));
    const saleId = sale.rows[0].id;
    let s = (await A.query("select * from hv.settlements where sale_id = $1", [saleId])).rows[0];
    expect([s.profit_pool, s.investor_gross, s.farmer_share, s.herdvest_fee, s.investor_net].map(n)).toEqual([350_000, 175_000, 175_000, 35_000, 140_000]);
    expect(n(s.capital_returned)).toBe(250_000);
    // buyer has not paid yet → review required, not a normal settlement
    expect(s.status).toBe("review_required");
    expect(s.review_reasons).toContain("buyer_payment_outstanding");

    await as(P, U.fin.id, (c) => c.query("select hv.add_sale_receipt($1, 600000, now(), 'bank_transfer', 'BUY-1')", [saleId]));
    s = (await A.query("select * from hv.settlements where sale_id = $1", [saleId])).rows[0];
    expect(s.status).toBe("calculated");

    // a calculation is not a payment
    const out0 = (await as(P, U.fin.id, (c) => c.query("select * from hv.settlement_outstanding($1)", [s.id]))).rows;
    expect(out0.every((r) => n(r.paid) === 0)).toBe(true);
    await expect(as(P, U.fin.id, (c) => c.query("select hv.record_settlement_payment($1, 'investor', 1000, now(), 'bank', 'P-0')", [s.id]))).rejects.toThrow(/after the settlement is approved/);

    await as(P, U.fin.id, (c) => c.query("select hv.approve_settlement($1, null)", [s.id]));
    await as(P, U.fin.id, (c) => c.query("select hv.record_settlement_payment($1, 'investor', 200000, now(), 'bank', 'P-1')", [s.id]));
    expect((await A.query("select status from hv.settlements where id = $1", [s.id])).rows[0].status).toBe("partially_paid");
    const outstanding = (await as(P, U.fin.id, (c) => c.query("select * from hv.settlement_outstanding($1)", [s.id]))).rows;
    expect(n(outstanding.find((r) => r.payee === "investor").outstanding)).toBe(190_000);
    await expect(as(P, U.fin.id, (c) => c.query("select hv.record_settlement_payment($1, 'investor', 999999, now(), 'bank', 'P-2')", [s.id]))).rejects.toThrow(/outstanding/);

    // one sale and one fee per animal — holding longer never adds a fee
    await expect(as(P, U.ops.id, (c) => c.query("select hv.record_sale($1, current_date, 'Again', null, 600000, null, null)", [animal]))).rejects.toThrow();
    expect(n((await A.query("select count(*) from hv.settlements where sale_id = $1", [saleId])).rows[0].count)).toBe(1);
  });

  test("sale below cost: no positive split, shortfall shown, review note required", async () => {
    const { accountId } = await fundedAccount("Loss", 250_000);
    const { animalIds } = await purchase(accountId, [250_000]);
    const sale = await as(P, U.ops.id, (c) => c.query("select hv.record_sale($1, current_date, 'Buyer', null, 180000, null, null) id", [animalIds[0]]));
    await as(P, U.fin.id, (c) => c.query("select hv.add_sale_receipt($1, 180000, now(), 'cash', 'L-1')", [sale.rows[0].id]));
    const s = (await A.query("select * from hv.settlements where sale_id = $1", [sale.rows[0].id])).rows[0];
    expect(s.status).toBe("review_required");
    expect(s.review_reasons).toContain("loss_or_capital_shortfall");
    expect([s.investor_gross, s.farmer_share, s.herdvest_fee].map(n)).toEqual([0, 0, 0]);
    expect(n(s.capital_returned)).toBe(180_000);
    expect(n(s.capital_shortfall)).toBe(70_000);
    expect(n(s.investor_net)).toBe(-70_000);
    await expect(as(P, U.fin.id, (c) => c.query("select hv.approve_settlement($1, null)", [s.id]))).rejects.toThrow(/review note is required/);
    await expect(as(P, U.fin.id, (c) => c.query("select hv.approve_settlement($1, 'over-pay', 500000, 0, 0)", [s.id]))).rejects.toThrow(/exceed/);
    await as(P, U.fin.id, (c) => c.query("select hv.approve_settlement($1, 'Loss reviewed against agreement; proceeds returned to investor')", [s.id]));
  });
});

describe("Mortality", () => {
  test("death: animal deceased, allocation ended, history kept, no automatic compensation", async () => {
    const { accountId } = await fundedAccount("Mortality", 200_000);
    const { animalIds } = await purchase(accountId, [200_000]);
    const animal = animalIds[0];
    const farmer = await verifiedFarmer("Farmer Mortality");
    await as(P, U.ops.id, (c) => c.query("select hv.allocate_animal($1, $2, current_date - 10, null, null, null, null, 'Initial', 'good')", [animal, farmer]));
    const inc = await as(P, U.ops.id, (c) =>
      c.query("select hv.report_incident($1, 'death', now(), 'Farmer', 'Found dead in the morning', 'Suspected HS') id", [animal]),
    );
    const a = (await A.query("select status from hv.animals where id = $1", [animal])).rows[0];
    expect(a.status).toBe("deceased");
    const alloc = (await A.query("select status, end_reason from hv.allocations where animal_id = $1", [animal])).rows[0];
    expect(alloc).toMatchObject({ status: "ended", end_reason: "Animal deceased" });
    // nothing paid or reimbursed automatically
    const ledgerOut = (await A.query("select count(*) from hv.ledger_entries where account_id = $1 and entry_type in ('refund_to_investor','adjustment_in')", [accountId])).rows[0];
    expect(n(ledgerOut.count)).toBe(0);
    expect(n((await balance(accountId)).funds_received)).toBe(200_000);
    // cannot be sold, cannot be deleted
    await expect(as(P, U.ops.id, (c) => c.query("select hv.record_sale($1, current_date, 'x', null, 1, null, null)", [animal]))).rejects.toThrow(/cannot be sold/);
    await expect(as(P, U.owner.id, (c) => c.query("delete from hv.animals where id = $1", [animal]))).rejects.toThrow();
    // decision needs incidents.approve (ops has write but not approve)
    await expect(
      as(P, U.ops.id, (c) => c.query("select hv.update_incident($1, 'decided', 'x', null, 'Investor bears loss', 200000, 0, 0)", [inc.rows[0].id])),
    ).rejects.toThrow(/incidents.approve/);
    await as(P, U.owner.id, (c) =>
      c.query("select hv.update_incident($1, 'decided', 'Reviewed vet report', 'Clause 9 mortality', 'Investor bears capital loss; no negligence found', 200000, 0, 0)", [inc.rows[0].id]),
    );
    const hist = (await A.query("select to_status from hv.animal_status_history where animal_id = $1 order by changed_at", [animal])).rows.map((r) => r.to_status);
    expect(hist).toEqual(["awaiting_allocation", "allocated", "deceased"]);
    const audit = (await A.query("select count(*) from hv.audit_log where record_id = $1", [inc.rows[0].id])).rows[0];
    expect(n(audit.count)).toBeGreaterThan(0);
  });
});

describe("Permissions", () => {
  test("field employee: no investor finance, only assigned animals", async () => {
    const { accountId } = await fundedAccount("Perms", 400_000);
    const { animalIds } = await purchase(accountId, [100_000, 100_000]);
    await as(P, U.ops.id, (c) => c.query("insert into hv.tasks (title, task_type, assigned_to, animal_id) values ('Photo', 'animal_photography', $1, $2)", [U.field.employeeId, animalIds[0]]));
    await as(P, U.field.id, async (c) => {
      expect((await c.query("select * from hv.investors")).rowCount).toBe(0);
      expect((await c.query("select * from hv.ledger_entries")).rowCount).toBe(0);
      expect((await c.query("select * from hv.account_balances")).rowCount).toBe(0);
      expect((await c.query("select * from hv.purchases")).rowCount).toBe(0);
      expect((await c.query("select * from hv.settlements")).rowCount).toBe(0);
      const visible = (await c.query("select id from hv.animals")).rows.map((r) => r.id);
      expect(visible).toContain(animalIds[0]);
      expect(visible).not.toContain(animalIds[1]);
    });
  });

  test("nobody can change their own role; only Super Admin grants Super Admin", async () => {
    // RLS hides other users' rows from non-admins, so the update touches nothing
    const self = await as(P, U.field.id, (c) => c.query("update hv.users set role_id = 'super_admin' where id = $1", [U.field.id]));
    expect(self.rowCount).toBe(0);
    const other = await as(P, U.fin.id, (c) => c.query("update hv.users set role_id = 'super_admin' where id = $1", [U.ops.id]));
    expect(other.rowCount).toBe(0);
    const roles = await A.query("select id, role_id from hv.users where id = any($1)", [[U.field.id, U.ops.id]]);
    expect(roles.rows.map((r) => r.role_id).sort()).toEqual(["field_employee", "operations_manager"]);
    // a user manager who is not a Super Admin cannot grant Super Admin
    await A.query("insert into hv.roles (id, name) values ('people_admin', 'People admin') on conflict do nothing");
    await A.query("insert into hv.role_permissions values ('people_admin', 'users.manage') on conflict do nothing");
    const pa = await createUser(A, "people_admin", "People Admin");
    await expect(as(P, pa.id, (c) => c.query("update hv.users set role_id = 'super_admin' where id = $1", [U.ops.id]))).rejects.toThrow(/Only a Super Admin/);
    await expect(as(P, U.owner.id, (c) => c.query("update hv.users set role_id = 'field_employee' where id = $1", [U.owner.id]))).rejects.toThrow(/own role/);
    // password hashes are not readable by the app role at all
    await expect(as(P, U.owner.id, (c) => c.query("select password_hash from hv.users"))).rejects.toThrow(/permission denied/);
    // role_permissions cannot be edited by non-owners
    await expect(as(P, U.fin.id, (c) => c.query("insert into hv.role_permissions values ('finance_officer', 'users.manage')"))).rejects.toThrow();
  });

  test("signed-out / public context reads nothing private", async () => {
    await as(P, null, async (c) => {
      for (const t of ["investors", "investment_accounts", "ledger_entries", "animals", "farmers", "expenses", "sales", "settlements", "attachments", "enquiries", "audit_log", "employees", "tasks"]) {
        expect((await c.query(`select * from hv.${t}`)).rowCount, t).toBe(0);
      }
      await expect(c.query("select * from hv.sessions")).rejects.toThrow(/permission denied/);
    });
  });

  test("sensitive attachments hidden without files.sensitive; audit log is append-only", async () => {
    const { investorId } = await newInvestorAccount("Docs");
    await as(P, U.fin.id, (c) =>
      c.query(
        "insert into hv.attachments (entity_type, entity_id, category, original_name, mime_type, size_bytes, storage_key, sha256) values ('investor', $1, 'identity_document', 'cnic.jpg', 'image/jpeg', 10, $2, 'x')",
        [investorId, `k-${Date.now()}`],
      ),
    );
    expect((await as(P, U.fin.id, (c) => c.query("select * from hv.attachments where entity_id = $1", [investorId]))).rowCount).toBe(1);
    expect((await as(P, U.ops.id, (c) => c.query("select * from hv.attachments where entity_id = $1", [investorId]))).rowCount).toBe(0);
    expect((await as(P, U.auditor.id, (c) => c.query("select * from hv.attachments where entity_id = $1", [investorId]))).rowCount).toBe(0);
    await expect(as(P, U.owner.id, (c) => c.query("delete from hv.audit_log"))).rejects.toThrow(/permission denied/);
    await expect(as(P, U.owner.id, (c) => c.query("update hv.audit_log set note = 'x'"))).rejects.toThrow(/permission denied/);
    expect(n((await as(P, U.auditor.id, (c) => c.query("select count(*) from hv.audit_log"))).rows[0].count)).toBeGreaterThan(0);
  });

  test("auditor is read-only", async () => {
    await expect(as(P, U.auditor.id, (c) => c.query("insert into hv.investors (full_legal_name) values ('x')"))).rejects.toThrow();
    await expect(as(P, U.auditor.id, (c) => c.query("select hv.record_deposit(gen_random_uuid(), 1, now(), null, null, null)"))).rejects.toThrow(/Permission denied/);
  });
});

describe("Website enquiries", () => {
  test("public enquiry enters the internal queue but cannot be read back publicly; converts to investor", async () => {
    const code = await as(P, null, (c) =>
      c.query("select hv.submit_enquiry('investor', 'Ayesha Test', 'ayesha@test.local', '+92 300 1112223', 'Lahore', '250000', '2-3', null, 'Interested', '{}') code"),
    );
    expect(code.rows[0].code).toMatch(/^ENQ-/);
    expect((await as(P, null, (c) => c.query("select * from hv.enquiries"))).rowCount).toBe(0);
    const seen = await as(P, U.ops.id, (c) => c.query("select id, status from hv.enquiries where code = $1", [code.rows[0].code]));
    expect(seen.rows[0].status).toBe("new");
    const inv = await as(P, U.fin.id, (c) => c.query("select hv.convert_enquiry($1) id", [seen.rows[0].id]));
    const investor = (await A.query("select full_legal_name, email, status from hv.investors where id = $1", [inv.rows[0].id])).rows[0];
    expect(investor).toMatchObject({ full_legal_name: "Ayesha Test", email: "ayesha@test.local", status: "prospective" });
    // an enquiry is not a deposit
    expect(n((await A.query("select count(*) from hv.ledger_entries where investor_id = $1", [inv.rows[0].id])).rows[0].count)).toBe(0);
  });
});
