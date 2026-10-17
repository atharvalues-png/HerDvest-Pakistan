import "server-only";
import type { Db } from "@/lib/server/db";
import { formatMoney } from "./format";

type Opt = readonly [string, string];

export async function accountOptions(db: Db, onlyOpen = true): Promise<Opt[]> {
  const r = await db.query(
    `select a.id, a.code, i.full_legal_name, b.unallocated
       from hv.investment_accounts a join hv.investors i on i.id = a.investor_id
       left join hv.account_balances b on b.account_id = a.id
      ${onlyOpen ? "where a.status = 'open'" : ""} order by i.full_legal_name`,
  );
  return r.rows.map((x) => [x.id, `${x.code} · ${x.full_legal_name}${x.unallocated !== null ? ` · available ${formatMoney(x.unallocated)}` : ""}`] as const);
}

export async function farmerOptions(db: Db, verifiedOnly = false): Promise<Opt[]> {
  const r = await db.query(
    `select id, code, full_name, district, verification_status from hv.farmers
      ${verifiedOnly ? "where verification_status = 'verified'" : ""} order by full_name`,
  );
  return r.rows.map((x) => [x.id, `${x.code} · ${x.full_name}${x.district ? ` (${x.district})` : ""}${verifiedOnly ? "" : ` — ${x.verification_status.replace(/_/g, " ")}`}`] as const);
}

export async function animalOptions(db: Db, where = "status not in ('sold','deceased','other')"): Promise<Opt[]> {
  const r = await db.query(`select id, code, species, breed, tag_number from hv.animals where ${where} order by code`);
  return r.rows.map((x) => [x.id, `${x.code} · ${x.species}${x.breed ? ` ${x.breed}` : ""}${x.tag_number ? ` · tag ${x.tag_number}` : ""}`] as const);
}

export async function employeeOptions(db: Db): Promise<Opt[]> {
  const r = await db.query(`select id, code, full_name from hv.employees where status = 'active' order by full_name`);
  return r.rows.map((x) => [x.id, `${x.full_name} (${x.code})`] as const);
}

export async function investorOptions(db: Db): Promise<Opt[]> {
  const r = await db.query(`select id, code, full_legal_name from hv.investors order by full_legal_name`);
  return r.rows.map((x) => [x.id, `${x.code} · ${x.full_legal_name}`] as const);
}

export async function categoryOptions(db: Db): Promise<Opt[]> {
  return (await db.query(`select id, label from hv.expense_categories order by label`)).rows.map((x) => [x.id, x.label] as const);
}

export async function speciesOptions(db: Db): Promise<Opt[]> {
  return (await db.query(`select id, label from hv.livestock_types order by label`)).rows.map((x) => [x.id, x.label] as const);
}

export const opts = (values: readonly string[]): Opt[] => values.map((v) => [v, v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())] as const);

export const paymentMethods = opts(["bank_transfer", "cash", "cheque", "mobile_wallet", "other"]);

export const entryTypes: Array<[string, string]> = [
  ["deposit", "Deposit"], ["purchase_allocation", "Purchase allocation"], ["expense_charge", "Expense charge"],
  ["refund_to_investor", "Refund to investor"], ["adjustment_in", "Adjustment in"], ["adjustment_out", "Adjustment out"], ["reversal", "Reversal"],
];

export const verificationOptions: Array<[string, string]> = [
  ["application_received", "Application received"], ["documents_pending", "Documents pending"], ["verification_in_progress", "Verification in progress"],
  ["farm_inspection_pending", "Farm inspection pending"], ["verified", "Verified"], ["rejected", "Rejected"], ["suspended", "Temporarily suspended"],
];


export const chargeTypeOptions: Array<[string, string]> = [
  ["herdvest_operating", "Herdvest operating expense (not charged to investor)"],
  ["chargeable_to_investment", "Chargeable to the investment under its agreement"],
  ["covered_by_service_fee", "Included in Herdvest's 20% service fee"],
  ["paid_by_farmer", "Paid by the farmer"],
  ["reimbursement_required", "Requires reimbursement / separate approval"],
];
