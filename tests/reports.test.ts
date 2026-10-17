import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type pg from "pg";
import { admin, app, as, createUser, resetTestDatabase } from "./helpers/db";
import { filterParams, readFilters, reports } from "@/lib/erp/reports";
import { renderReportPdf } from "@/lib/erp/pdf";

let A: pg.Pool;
let P: pg.Pool;
let owner = "";
let investorId = "";

beforeAll(async () => {
  await resetTestDatabase();
  A = admin();
  P = app();
  owner = (await createUser(A, "super_admin", "Report Owner", true)).id;
  // minimal realistic data through the real workflows
  await as(P, owner, async (c) => {
    investorId = (await c.query("insert into hv.investors (full_legal_name) values ('Report Investor') returning id")).rows[0].id;
    const acc = (await c.query("insert into hv.investment_accounts (investor_id) values ($1) returning id", [investorId])).rows[0].id;
    const dep = (await c.query("select hv.record_deposit($1, 300000, now(), 'bank_transfer', 'R-1', null) id", [acc])).rows[0].id;
    await c.query("select hv.verify_ledger_entry($1, true, null)", [dep]);
    const pur = (await c.query(`select hv.create_purchase($1, current_date, 'S', null, 'L', '[{"price":"250000"}]'::jsonb, null) id`, [acc])).rows[0].id;
    const animal = (await c.query("select animal_id from hv.purchase_lines where purchase_id = $1", [pur])).rows[0].animal_id;
    const sale = (await c.query("select hv.record_sale($1, current_date, 'Buyer', null, 600000, null, null) id", [animal])).rows[0].id;
    await c.query("select hv.add_sale_receipt($1, 600000, now(), 'bank', 'B-1')", [sale]);
  });
}, 60_000);

afterAll(async () => {
  await P?.end();
  await A?.end();
});

describe("reports", () => {
  test("every report runs with no filters", async () => {
    for (const r of reports) {
      const f = readFilters(r.requires ? { [r.requires]: investorId } : {});
      const rows = await as(P, owner, async (c) => (await c.query(r.sql, filterParams(f))).rows);
      expect(Array.isArray(rows), r.slug).toBe(true);
    }
  });

  test("every report runs with all filters set", async () => {
    const f = readFilters({ from: "2026-01-01", to: "2030-12-31", investor: investorId, status: "approved", account_status: "open", category: "vaccination" });
    for (const r of reports) await as(P, owner, (c) => c.query(r.sql, filterParams(f)));
  });

  test("status and investment-status filters narrow results", async () => {
    const sales = reports.find((r) => r.slug === "sales")!;
    const run = (sp: Record<string, string>) => as(P, owner, async (c) => (await c.query(sales.sql, filterParams(readFilters(sp)))).rows);
    expect(await run({})).toHaveLength(1);
    expect(await run({ status: "calculated" })).toHaveLength(1);
    expect(await run({ status: "paid" })).toHaveLength(0);
    expect(await run({ account_status: "open" })).toHaveLength(1);
    expect(await run({ account_status: "closed" })).toHaveLength(0);
  });

  test("investor statement renders as a PDF", async () => {
    const r = reports.find((x) => x.slug === "investor-statement")!;
    const rows = await as(P, owner, async (c) => (await c.query(r.sql, filterParams(readFilters({ investor: investorId })))).rows);
    expect(rows.length).toBeGreaterThan(0);
    const pdf = await renderReportPdf({ report: r, rows, filterSummary: ["Investor: Report Investor"], generatedBy: "Test", timeZone: "Asia/Karachi" });
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
