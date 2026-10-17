import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { writeFileSync } from "node:fs";
import { admin, app, as, createUser, resetTestDatabase } from "./helpers/db";
import { renderReportPdf } from "@/lib/erp/pdf";
import { portalStatementReport, statementRows, type TxRow } from "@/lib/portal/statement";

/**
 * Investor portal: two investors with their own animals and money, checked
 * through the same database functions the portal pages call, connected as
 * the non-privileged app role (RLS applies).
 */

let A: pg.Pool;
let P: pg.Pool;
const U: Record<string, { id: string; employeeId: string | null }> = {};
type Inv = { id: string; account: string; animals: string[]; token: string; accountId: string };
const inv: Record<"a" | "b", Inv> = {
  a: { id: "", account: "", animals: [], token: "", accountId: "" },
  b: { id: "", account: "", animals: [], token: "", accountId: "" },
};
let farmer = "";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

/** Run fn in a portal context: only the session token hash is supplied. */
async function portal<T>(token: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await P.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('hv.portal_session', $1, true)", [sha(token)]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (err) {
    await c.query("rollback").catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}
const rows = async (token: string, sql: string, params: unknown[] = []) => portal(token, async (c) => (await c.query(sql, params)).rows);
const staff = <T>(who: string, fn: (c: pg.PoolClient) => Promise<T>) => as(P, U[who].id, fn);

async function addFile(who: string, entityType: string, entityId: string, category = "animal_photo", mime = "image/jpeg") {
  return staff(who, async (c) => (await c.query(
    `insert into hv.attachments (entity_type, entity_id, category, original_name, mime_type, size_bytes, storage_key, sha256)
     values ($1, $2, $3, 'photo.jpg', $4, 100, $5, 'x') returning id`,
    [entityType, entityId, category, mime, `2026/10/${crypto.randomUUID()}`])).rows[0].id as string);
}

/** Invite → activate → signed-in session. Returns the session token. */
async function provision(key: "a" | "b", email: string) {
  const activation = newToken();
  inv[key].accountId = await staff("finance", async (c) =>
    (await c.query("select hv.portal_invite($1, $2, $3) id", [inv[key].id, email, sha(activation)])).rows[0].id);
  await as(P, null, (c) => c.query("select hv.portal_use_token($1, 'scrypt$test-hash')", [sha(activation)]));
  const session = newToken();
  await as(P, null, (c) => c.query("select hv.portal_create_session($1, $2, 8, true, '127.0.0.1', 'test')", [inv[key].accountId, sha(session)]));
  inv[key].token = session;
}

beforeAll(async () => {
  await resetTestDatabase();
  A = admin();
  P = app();
  U.owner = await createUser(A, "super_admin", "Portal Owner");
  U.ops = await createUser(A, "operations_manager", "Portal Ops");
  U.finance = await createUser(A, "finance_officer", "Portal Finance");
  U.field = await createUser(A, "field_employee", "Portal Field", true);

  farmer = await staff("ops", async (c) => (await c.query("insert into hv.farmers (full_name, district, city) values ('Farmer One', 'Okara', 'Renala') returning id")).rows[0].id);
  await staff("ops", (c) => c.query("select hv.set_farmer_verification($1, 'verified', 'checked')", [farmer]));

  // Investor A: PKR 500,000 → two animals at 200,000. Investor B: 300,000 → one animal at 250,000.
  for (const [key, name, deposit, prices] of [["a", "Investor Alpha", "500000", ["200000", "200000"]], ["b", "Investor Beta", "300000", ["250000"]]] as const) {
    await staff("finance", async (c) => {
      inv[key].id = (await c.query("insert into hv.investors (full_legal_name, email, phone) values ($1, $2, '0300-0000000') returning id", [name, `${key}@inv.test`])).rows[0].id;
      inv[key].account = (await c.query("insert into hv.investment_accounts (investor_id, agreement_ref) values ($1, $2) returning id", [inv[key].id, `AGR-${key}`])).rows[0].id;
      const dep = (await c.query("select hv.record_deposit($1, $2, now(), 'bank_transfer', $3, null) id", [inv[key].account, deposit, `DEP-${key}`])).rows[0].id;
      await c.query("select hv.verify_ledger_entry($1, true, null)", [dep]);
    });
    const pur = await staff("owner", async (c) => (await c.query(
      "select hv.create_purchase($1, current_date - 30, 'Seller', null, 'Okara', $2::jsonb, null) id",
      [inv[key].account, JSON.stringify(prices.map((p) => ({ price: p, breed: "Nili-Ravi" })))])).rows[0].id);
    inv[key].animals = await staff("owner", async (c) => (await c.query(
      "select pl.animal_id from hv.purchase_lines pl join hv.animals a on a.id = pl.animal_id where purchase_id = $1 order by a.code", [pur])).rows.map((r) => r.animal_id));
    for (const animal of inv[key].animals) {
      await staff("ops", (c) => c.query("select hv.allocate_animal($1, $2, current_date - 20, null, null, null, null, null, 'good')", [animal, farmer]));
    }
  }
  await provision("a", "alpha@inv.test");
  await provision("b", "beta@inv.test");
}, 90_000);

afterAll(async () => {
  await P?.end();
  await A?.end();
});

describe("investor accounts", () => {
  test("only portal managers can invite; field staff and investors cannot", async () => {
    await expect(staff("field", (c) => c.query("select hv.portal_invite($1, 'x@y.test', 'h')", [inv.a.id]))).rejects.toThrow(/portal.manage/);
    await expect(staff("ops", (c) => c.query("select hv.portal_invite($1, 'x@y.test', 'h')", [inv.a.id]))).rejects.toThrow(/portal.manage/);
    await expect(portal(inv.a.token, (c) => c.query("select hv.portal_invite($1, 'x@y.test', 'h')", [inv.b.id]))).rejects.toThrow(/portal.manage/);
  });

  test("an active account cannot be re-invited (no silent takeover)", async () => {
    await expect(staff("finance", (c) => c.query("select hv.portal_invite($1, 'attacker@x.test', $2)", [inv.a.id, sha(newToken())]))).rejects.toThrow(/already has an active/);
  });

  test("activation links work once", async () => {
    const t = newToken();
    const inv3 = await staff("finance", async (c) => (await c.query("insert into hv.investors (full_legal_name) values ('Investor Gamma') returning id")).rows[0].id);
    await staff("finance", (c) => c.query("select hv.portal_invite($1, 'gamma@inv.test', $2)", [inv3, sha(t)]));
    const info = await as(P, null, async (c) => (await c.query("select * from hv.portal_token_info($1)", [sha(t)])).rows[0]);
    expect(info).toMatchObject({ purpose: "activation", email: "gamma@inv.test", valid: true });
    await as(P, null, (c) => c.query("select hv.portal_use_token($1, 'h1')", [sha(t)]));
    await expect(as(P, null, (c) => c.query("select hv.portal_use_token($1, 'h2')", [sha(t)]))).rejects.toThrow(/invalid or has expired/);
  });

  test("password hashes, MFA secrets, tokens and sessions are not readable by the app role", async () => {
    await expect(staff("owner", (c) => c.query("select password_hash from hv.portal_accounts"))).rejects.toThrow(/permission denied/);
    await expect(staff("owner", (c) => c.query("select mfa_secret from hv.portal_accounts"))).rejects.toThrow(/permission denied/);
    await expect(staff("owner", (c) => c.query("select * from hv.portal_tokens"))).rejects.toThrow(/permission denied/);
    await expect(staff("owner", (c) => c.query("select * from hv.portal_sessions"))).rejects.toThrow(/permission denied/);
    const visible = await staff("finance", async (c) => (await c.query("select id, email, status from hv.portal_accounts")).rows);
    expect(visible.length).toBeGreaterThanOrEqual(2);
  });

  test("a field employee cannot see portal accounts or investor finances", async () => {
    const r = await staff("field", async (c) => ({
      accounts: (await c.query("select id from hv.portal_accounts")).rowCount,
      ledger: (await c.query("select id from hv.ledger_entries")).rowCount,
      investors: (await c.query("select id from hv.investors")).rowCount,
      requests: (await c.query("select id from hv.payment_requests")).rowCount,
    }));
    expect(r).toEqual({ accounts: 0, ledger: 0, investors: 0, requests: 0 });
  });
});

describe("data isolation", () => {
  test("each investor sees only their own animals", async () => {
    const a = await rows(inv.a.token, "select id, code from hv.portal_animals()");
    const b = await rows(inv.b.token, "select id, code from hv.portal_animals()");
    expect(a.map((r) => r.id).sort()).toEqual([...inv.a.animals].sort());
    expect(b.map((r) => r.id)).toEqual(inv.b.animals);
  });

  test("passing another investor's animal id returns nothing (URL / parameter tampering)", async () => {
    const other = inv.b.animals[0];
    const r = await portal(inv.a.token, async (c) => ({
      owns: (await c.query("select hv.portal_owns_animal($1) v", [other])).rows[0].v,
      inspections: (await c.query("select * from hv.portal_inspections($1)", [other])).rowCount,
      weights: (await c.query("select * from hv.portal_weights($1)", [other])).rowCount,
      forecasts: (await c.query("select * from hv.portal_forecasts($1)", [other])).rowCount,
      updates: (await c.query("select * from hv.portal_updates($1)", [other])).rowCount,
      history: (await c.query("select * from hv.portal_status_history($1)", [other])).rowCount,
      settlement: (await c.query("select * from hv.portal_settlement($1)", [other])).rowCount,
    }));
    expect(r).toEqual({ owns: false, inspections: 0, weights: 0, forecasts: 0, updates: 0, history: 0, settlement: 0 });
    // and B can see its own history through the same call
    expect((await rows(inv.b.token, "select * from hv.portal_status_history($1)", [other])).length).toBeGreaterThan(0);
  });

  test("an investor session reads nothing from the base tables", async () => {
    const tables = ["investors", "investment_accounts", "ledger_entries", "animals", "vet_records", "attachments", "purchases",
      "settlements", "farmers", "animal_weights", "animal_forecasts", "payment_requests", "portal_accounts", "portal_notifications", "investor_identity"];
    for (const t of tables) {
      const n = await portal(inv.a.token, async (c) => (await c.query(`select count(*)::int n from hv.${t}`)).rows[0].n);
      expect(n, t).toBe(0);
    }
  });

  test("an investor session cannot call staff workflows", async () => {
    await expect(portal(inv.a.token, (c) => c.query("select hv.record_deposit($1, 1000, now(), 'cash', 'X', null)", [inv.a.account]))).rejects.toThrow(/Permission denied/);
    await expect(portal(inv.a.token, (c) => c.query("select hv.set_vet_publication(gen_random_uuid(), true)"))).rejects.toThrow(/Permission denied/);
  });

  test("files: published files of another investor cannot be downloaded", async () => {
    const fileB = await addFile("ops", "animal", inv.b.animals[0]);
    await staff("ops", (c) => c.query("select hv.set_attachment_publication($1, true)", [fileB]));
    expect(await rows(inv.a.token, "select * from hv.portal_file($1)", [fileB])).toHaveLength(0);
    expect(await rows(inv.b.token, "select * from hv.portal_file($1)", [fileB])).toHaveLength(1);
    expect((await rows(inv.a.token, "select id from hv.portal_files()")).map((r) => r.id)).not.toContain(fileB);
  });

  test("files: unpublished and sensitive files are never shared", async () => {
    const draft = await addFile("ops", "animal", inv.a.animals[0]);
    expect(await rows(inv.a.token, "select * from hv.portal_file($1)", [draft])).toHaveLength(0);
    const cnic = await addFile("owner", "investor", inv.a.id, "identity_document");
    await expect(staff("owner", (c) => c.query("select hv.set_attachment_publication($1, true)", [cnic]))).rejects.toThrow(/never be shared/);
    const farmerDoc = await addFile("ops", "farmer", farmer, "farm_photo");
    await expect(staff("ops", (c) => c.query("select hv.set_attachment_publication($1, true)", [farmerDoc]))).rejects.toThrow(/cannot be shared/);
    // publication flags cannot be flipped directly
    await expect(staff("owner", (c) => c.query("update hv.attachments set investor_visible = true where id = $1", [draft]))).rejects.toThrow(/publish/);
  });

  test("a suspended or revoked account loses access immediately", async () => {
    const t = newToken();
    const id = await staff("finance", async (c) => (await c.query("insert into hv.investors (full_legal_name) values ('Investor Delta') returning id")).rows[0].id);
    const acc = await staff("finance", async (c) => (await c.query("select hv.portal_invite($1, 'delta@inv.test', $2) id", [id, sha(t)])).rows[0].id);
    await as(P, null, (c) => c.query("select hv.portal_use_token($1, 'h')", [sha(t)]));
    const s = newToken();
    await as(P, null, (c) => c.query("select hv.portal_create_session($1, $2, 8, true, null, null)", [acc, sha(s)]));
    expect((await rows(s, "select hv.portal_investor() v"))[0].v).toBe(id);
    await expect(staff("finance", (c) => c.query("select hv.portal_set_status($1, 'suspended', '')", [acc]))).rejects.toThrow(/reason/);
    await staff("finance", (c) => c.query("select hv.portal_set_status($1, 'suspended', 'Investor asked to pause access')", [acc]));
    expect((await rows(s, "select hv.portal_investor() v"))[0].v).toBeNull();
    expect(await rows(s, "select * from hv.portal_profile()")).toHaveLength(0);
    // reactivation does not revive the old session
    await staff("finance", (c) => c.query("select hv.portal_set_status($1, 'active', null)", [acc]));
    expect((await rows(s, "select hv.portal_investor() v"))[0].v).toBeNull();
    await staff("finance", (c) => c.query("select hv.portal_set_status($1, 'revoked', 'Agreement ended')", [acc]));
    await expect(as(P, null, (c) => c.query("select hv.portal_create_session($1, $2, 8, true, null, null)", [acc, sha(newToken())]))).rejects.toThrow(/not active/);
  });

  test("an unverified MFA session has no access", async () => {
    const s = newToken();
    await as(P, null, (c) => c.query("select hv.portal_create_session($1, $2, 8, false, null, null)", [inv.a.accountId, sha(s)]));
    expect(await rows(s, "select * from hv.portal_animals()")).toHaveLength(0);
  });
});

describe("password reset and logout", () => {
  test("reset tokens are single-use and end other sessions", async () => {
    const t = newToken();
    const created = await as(P, null, async (c) => (await c.query("select hv.portal_request_reset('alpha@inv.test', $1) v", [sha(t)])).rows[0].v);
    expect(created).toBe(true);
    // unknown emails return false without error (the page shows the same message either way)
    expect(await as(P, null, async (c) => (await c.query("select hv.portal_request_reset('nobody@x.test', $1) v", [sha(newToken())])).rows[0].v)).toBe(false);
    const extra = newToken();
    await as(P, null, (c) => c.query("select hv.portal_create_session($1, $2, 8, true, null, null)", [inv.a.accountId, sha(extra)]));
    await as(P, null, (c) => c.query("select hv.portal_use_token($1, 'new-hash')", [sha(t)]));
    expect(await rows(extra, "select * from hv.portal_animals()")).toHaveLength(0);
    await expect(as(P, null, (c) => c.query("select hv.portal_use_token($1, 'again')", [sha(t)]))).rejects.toThrow();
    // sign back in for the remaining tests
    inv.a.token = newToken();
    await as(P, null, (c) => c.query("select hv.portal_create_session($1, $2, 8, true, null, null)", [inv.a.accountId, sha(inv.a.token)]));
  });

  test("logout revokes the session", async () => {
    const s = newToken();
    await as(P, null, (c) => c.query("select hv.portal_create_session($1, $2, 8, true, null, null)", [inv.b.accountId, sha(s)]));
    expect(await as(P, null, async (c) => (await c.query("select * from hv.portal_session_info($1)", [sha(s)])).rowCount)).toBe(1);
    await as(P, null, (c) => c.query("select hv.portal_revoke_session($1)", [sha(s)]));
    expect(await as(P, null, async (c) => (await c.query("select * from hv.portal_session_info($1)", [sha(s)])).rowCount)).toBe(0);
  });
});

describe("publication workflow", () => {
  test("veterinary reports are hidden until published; editing withdraws them", async () => {
    const animal = inv.a.animals[0];
    const vet = await staff("ops", async (c) => (await c.query(
      `insert into hv.vet_records (animal_id, visit_type, status, visit_date, performed_by, findings, condition, weight_kg, notes)
       values ($1, 'inspection', 'completed', current_date - 2, 'Dr. Test', 'Healthy, good body condition', 'good', 410, 'INTERNAL NOTE') returning id`, [animal])).rows[0].id);
    let r = (await rows(inv.a.token, "select * from hv.portal_inspections($1)", [animal])).find((x) => x.id === vet)!;
    expect(r.state).toBe("awaiting_review");
    expect(r.findings).toBeNull();
    expect(r.condition).toBeNull();
    expect((await rows(inv.a.token, "select * from hv.portal_animals()")).find((x) => x.id === animal)!.inspection_state).toBe("awaiting_review");

    await expect(staff("field", (c) => c.query("select hv.set_vet_publication($1, true)", [vet]))).rejects.toThrow(/portal.publish/);
    await staff("ops", (c) => c.query("select hv.set_vet_publication($1, true, 'Animal is healthy.')", [vet]));
    r = (await rows(inv.a.token, "select * from hv.portal_inspections($1)", [animal])).find((x) => x.id === vet)!;
    expect(r).toMatchObject({ state: "completed", findings: "Healthy, good body condition", condition: "good", summary: "Animal is healthy." });
    expect(JSON.stringify(r)).not.toContain("INTERNAL NOTE");

    await staff("ops", (c) => c.query("update hv.vet_records set findings = 'Changed after publication' where id = $1", [vet]));
    r = (await rows(inv.a.token, "select * from hv.portal_inspections($1)", [animal])).find((x) => x.id === vet)!;
    expect(r.state).toBe("awaiting_review");
    expect(r.findings).toBeNull();
    await staff("ops", (c) => c.query("select hv.set_vet_publication($1, true)", [vet]));
  });

  test("scheduled inspections show as scheduled, overdue ones as overdue — never as completed", async () => {
    const animal = inv.a.animals[1];
    await staff("ops", (c) => c.query(
      "insert into hv.vet_records (animal_id, visit_type, status, scheduled_date) values ($1, 'inspection', 'scheduled', current_date + 10), ($1, 'vaccination', 'scheduled', current_date - 40)", [animal]));
    const list = await rows(inv.a.token, "select state, visit_type from hv.portal_inspections($1)", [animal]);
    expect(list).toEqual(expect.arrayContaining([{ state: "scheduled", visit_type: "inspection" }, { state: "overdue", visit_type: "vaccination" }]));
    await expect(staff("ops", async (c) => {
      const id = (await c.query("select id from hv.vet_records where animal_id = $1 and status = 'scheduled' limit 1", [animal])).rows[0].id;
      await c.query("select hv.set_vet_publication($1, true)", [id]);
    })).rejects.toThrow(/Only completed/);
  });

  test("inspection due date follows the configured interval", async () => {
    const animal = inv.b.animals[0];
    let s = (await staff("ops", async (c) => (await c.query("select * from hv.inspection_status($1)", [animal])).rows[0]));
    expect(s.interval_months).toBe(6);
    expect(s.state).toBe("scheduled");
    await staff("ops", (c) => c.query("select hv.set_care_plan($1, 3, current_date - 3, 'quarterly checks')", [animal]));
    s = (await staff("ops", async (c) => (await c.query("select * from hv.inspection_status($1)", [animal])).rows[0]));
    expect(s).toMatchObject({ interval_months: 3, state: "pending" });
    await staff("ops", (c) => c.query("select hv.set_care_plan($1, 3, current_date - 30, null)", [animal]));
    s = (await staff("ops", async (c) => (await c.query("select * from hv.inspection_status($1)", [animal])).rows[0]));
    expect(s.state).toBe("overdue");
  });

  test("weights: only published, non-voided measurements reach the investor", async () => {
    const animal = inv.a.animals[0];
    await expect(staff("field", (c) => c.query("select hv.record_weight($1, current_date, 400, 'scale', null, null)", [animal]))).rejects.toThrow(/assigned to you/);
    const w1 = await staff("ops", async (c) => (await c.query("select hv.record_weight($1, current_date - 60, 380, 'scale', 'Field team', null) id", [animal])).rows[0].id);
    const w2 = await staff("ops", async (c) => (await c.query("select hv.record_weight($1, current_date - 1, 432.5, 'weigh_tape', 'Field team', null, null, true) id", [animal])).rows[0].id);
    let ws = await rows(inv.a.token, "select id, weight::text, source from hv.portal_weights($1)", [animal]);
    expect(ws.map((x) => x.id)).not.toContain(w1);
    expect(ws.find((x) => x.id === w2)).toMatchObject({ weight: "432.50", source: "weigh_tape" });
    await staff("ops", (c) => c.query("select hv.set_weight_publication($1, true)", [w1]));
    await expect(staff("ops", (c) => c.query("update hv.animal_weights set weight = 999 where id = $1", [w1]))).rejects.toThrow(/permission denied|cannot be edited/);
    await staff("ops", (c) => c.query("select hv.void_weight($1, 'Scale not calibrated')", [w1]));
    ws = await rows(inv.a.token, "select id from hv.portal_weights($1)", [animal]);
    expect(ws.map((x) => x.id)).not.toContain(w1);
    // the vet record weight (410 kg) is listed as a veterinary measurement
    expect((await rows(inv.a.token, "select source from hv.portal_weights($1)", [animal])).map((x) => x.source)).toContain("veterinary_record");
  });

  test("forecasts: drafts hidden; published figures follow the agreed model; never counted as cash", async () => {
    const animal = inv.a.animals[0];
    const id = await staff("ops", async (c) => (await c.query(
      "select hv.create_forecast($1, 600000, current_date + 200, 'Eid ul Adha', 520, current_date + 200, 'Based on current weight gain and recent Okara market prices') id", [animal])).rows[0].id);
    expect(await rows(inv.a.token, "select * from hv.portal_forecasts()")).toHaveLength(0);
    expect((await rows(inv.a.token, "select estimated_value from hv.portal_summary()"))[0].estimated_value).toBeNull();
    await expect(staff("finance", (c) => c.query("select hv.publish_forecast($1)", [id]))).rejects.toThrow(/portal.publish/);
    await staff("ops", (c) => c.query("select hv.publish_forecast($1)", [id]));
    const f = (await rows(inv.a.token, "select * from hv.portal_forecasts()"))[0];
    expect(f).toMatchObject({
      purchase_price: "200000.00", expected_sale_price: "600000.00", profit_pool: "400000.00", investor_gross: "200000.00",
      farmer_share: "200000.00", herdvest_fee: "40000.00", investor_net: "160000.00", investor_total: "360000.00",
    });
    const s = (await rows(inv.a.token, "select * from hv.portal_summary()"))[0];
    expect(s).toMatchObject({ funds_received: "500000.00", purchases_allocated: "400000.00", unallocated: "100000.00",
      estimated_value: "600000.00", realized_profit: "0", active_animals: 2, sold_animals: 0 });
    const tx = await rows(inv.a.token, "select * from hv.portal_transactions()");
    expect(tx.some((t) => /forecast|estimate/i.test(t.description))).toBe(false);
    expect(tx.filter((t) => t.category === "cash").map((t) => t.kind).sort()).toEqual(["deposit", "purchase_allocation"]);
    // B never sees A's forecast
    expect(await rows(inv.b.token, "select * from hv.portal_forecasts()")).toHaveLength(0);
  });

  test("loss forecasts show a shortfall, not a profit", async () => {
    const r = await staff("ops", async (c) => (await c.query("select * from hv.forecast_figures(250000, 180000, 50, 20)")).rows[0]);
    expect(r).toMatchObject({ investor_gross: "0", herdvest_fee: "0", capital_shortfall: "70000", investor_net: "-70000", investor_total: "180000" });
  });

  test("payment requests need the agreement, a reviewer, and are separate from money received", async () => {
    await expect(staff("ops", (c) => c.query("select hv.create_payment_request($1, 5000, 'Feed top-up', 'Clause 7.2', null)", [inv.a.account]))).rejects.toThrow(/finance.write/);
    const id = await staff("finance", async (c) => (await c.query("select hv.create_payment_request($1, 5000, 'Feed top-up for winter', 'Clause 7.2', current_date + 14) id", [inv.a.account])).rows[0].id);
    // drafts are invisible to the investor
    expect((await rows(inv.a.token, "select * from hv.portal_summary()"))[0].due_from_investor).toBe("0");
    await staff("owner", (c) => c.query("select hv.issue_payment_request($1)", [id]));
    const s = (await rows(inv.a.token, "select * from hv.portal_summary()"))[0];
    expect(s.due_from_investor).toBe("5000.00");
    expect(s.funds_received).toBe("500000.00");
    const t = (await rows(inv.a.token, "select * from hv.portal_transactions()")).find((x) => x.kind === "payment_request")!;
    expect(t).toMatchObject({ status: "outstanding", category: "request" });
    await expect(staff("finance", (c) => c.query("select hv.close_payment_request($1, 'paid', null, null)", [id]))).rejects.toThrow(/verified deposit/);
  });

  test("notifications come only from published records and only to the owner", async () => {
    const a = await rows(inv.a.token, "select kind, link from hv.portal_notifications_list()");
    const kinds = a.map((n) => n.kind);
    expect(kinds).toEqual(expect.arrayContaining(["inspection", "weight", "forecast", "payment_request"]));
    expect(a.every((n) => !n.link || !inv.b.animals.some((b) => n.link.includes(b)))).toBe(true);
    const b = await rows(inv.b.token, "select kind from hv.portal_notifications_list()");
    expect(b.map((n) => n.kind)).toEqual(["photos"]);
    await portal(inv.a.token, (c) => c.query("select hv.portal_mark_read(null)"));
    expect((await rows(inv.a.token, "select unread_notifications from hv.portal_summary()"))[0].unread_notifications).toBe(0);
    expect((await rows(inv.b.token, "select unread_notifications from hv.portal_summary()"))[0].unread_notifications).toBe(1);
  });

  test("settlements appear only after approval", async () => {
    const animal = inv.b.animals[0];
    const sale = await staff("owner", async (c) => (await c.query("select hv.record_sale($1, current_date, 'Buyer', null, 600000, null, null) id", [animal])).rows[0].id);
    await staff("owner", (c) => c.query("select hv.add_sale_receipt($1, 600000, now(), 'bank', 'B-9')", [sale]));
    expect(await rows(inv.b.token, "select * from hv.portal_settlement($1)", [animal])).toHaveLength(0);
    expect((await rows(inv.b.token, "select settlement_status from hv.portal_animals()"))[0].settlement_status).toBe("under_review");
    const st = await staff("owner", async (c) => (await c.query("select id, status from hv.settlements where sale_id = $1", [sale])).rows[0]);
    await staff("owner", (c) => c.query("select hv.approve_settlement($1, 'ok')", [st.id]));
    const r = (await rows(inv.b.token, "select * from hv.portal_settlement($1)", [animal]))[0];
    expect(r).toMatchObject({ gross_proceeds: "600000.00", profit_pool: "350000.00", herdvest_fee: "35000.00", investor_net: "140000.00", outstanding: "390000.00" });
    const s = (await rows(inv.b.token, "select * from hv.portal_summary()"))[0];
    expect(s).toMatchObject({ sold_animals: 1, realized_profit: "140000.00", due_to_investor: "390000.00" });
    expect((await rows(inv.b.token, "select kind from hv.portal_notifications_list()")).map((n) => n.kind)).toContain("settlement");
    // A still sees nothing of B's sale
    expect(await rows(inv.a.token, "select * from hv.portal_settlement($1)", [animal])).toHaveLength(0);
  });

  test("identity numbers are masked and only stored for sensitive-file holders", async () => {
    await expect(staff("ops", (c) => c.query("select hv.set_investor_identity($1, '35202-1234567-1')", [inv.a.id]))).rejects.toThrow(/Permission denied/);
    await staff("owner", (c) => c.query("select hv.set_investor_identity($1, '35202-1234567-1')", [inv.a.id]));
    const p = (await rows(inv.a.token, "select national_id_masked from hv.portal_profile()"))[0];
    expect(p.national_id_masked).toBe("•••••-••••••7-1");
    expect(p.national_id_masked).not.toContain("35202");
    expect(await staff("finance", async (c) => (await c.query("select hv.investor_identity_masked($1) v", [inv.a.id])).rows[0].v)).not.toContain("1234567");
  });

  test("investors can request profile corrections but cannot edit records", async () => {
    await portal(inv.a.token, (c) => c.query("select hv.portal_request_change('phone', '0301-1111111', 'New number')"));
    expect(await rows(inv.a.token, "select * from hv.portal_change_requests_list()")).toHaveLength(1);
    expect(await rows(inv.b.token, "select * from hv.portal_change_requests_list()")).toHaveLength(0);
    const n = await portal(inv.a.token, async (c) => (await c.query("update hv.investors set phone = 'x' where id = $1", [inv.a.id])).rowCount);
    expect(n).toBe(0);
    await expect(portal(inv.a.token, (c) => c.query("update hv.portal_accounts set investor_id = $1", [inv.b.id]))).rejects.toThrow(/permission denied/);
  });

  test("the investor's own statement renders as a PDF and separates figures from cash", async () => {
    const tx = (await rows(inv.b.token, "select * from hv.portal_transactions()")) as TxRow[];
    const r = statementRows(tx);
    // settlement figures and requests never land in the cash columns
    expect(r.filter((x) => x.category !== "cash").every((x) => x.money_in === null && x.money_out === null)).toBe(true);
    const pdf = await renderReportPdf({ report: portalStatementReport, rows: [...r].reverse(), filterSummary: ["Investor Beta"], generatedBy: "Investor portal", timeZone: "Asia/Karachi" });
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, pdf);
  });
});
