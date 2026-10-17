"use server";

import { redirect } from "next/navigation";
import { Form, FieldErrors, runAction, type ActionState } from "@/lib/erp/action";
import { saveFormFile } from "@/lib/server/attachments";
import { sumMoney } from "@/lib/erp/format";

const CHARGE_TYPES = ["to_be_determined", "herdvest_operating", "chargeable_to_investment", "covered_by_service_fee", "paid_by_farmer", "reimbursement_required"] as const;

export async function createExpense(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = {
      date: f.date("expense_date", { required: true }),
      category: f.text("category_id", { required: true, max: 60, label: "Category" }),
      description: f.text("description", { required: true, max: 500, label: "Description" }),
      amount: f.money("amount", { required: true }),
      vendor: f.text("vendor", { max: 200 }),
      farmer: f.id("farmer_id"),
      vet: f.id("vet_record_id"),
      sale: f.id("sale_id"),
      method: f.text("payment_method", { max: 40 }),
      charge: f.choice("charge_type", CHARGE_TYPES) ?? "to_be_determined",
      notes: f.text("notes", { max: 2000 }),
      idem: f.text("idempotency_key", { max: 80 }),
    };
    // animal split: animal_ids[] + split amounts (blank = split evenly)
    const animals = f.list("animal_ids").filter((x) => /^[0-9a-f-]{36}$/i.test(x));
    if (Object.keys(f.errors).length) throw new FieldErrors(f.errors);
    const splits = splitEvenly(v.amount!, animals.length);
    if (animals.length && sumMoney(splits) !== sumMoney([v.amount])) throw new FieldErrors({ animal_ids: "Split does not add up." });

    if (v.idem) {
      const dup = await db.query("select id from hv.expenses where idempotency_key = $1", [v.idem]);
      if (dup.rows[0]) { id = dup.rows[0].id; return; }
    }
    id = (await db.query(
      `insert into hv.expenses (expense_date, category_id, description, amount, vendor, farmer_id, vet_record_id, sale_id, payment_method, charge_type, notes, idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [v.date, v.category, v.description, v.amount, v.vendor, v.farmer, v.vet, v.sale, v.method, v.charge, v.notes, v.idem])).rows[0].id;
    for (let i = 0; i < animals.length; i++) {
      await db.query("insert into hv.expense_allocations (expense_id, animal_id, amount) values ($1, $2, $3)", [id, animals[i], splits[i]]);
    }
    await saveFormFile(db, fd.get("receipt"), "expense", id, "expense_receipt");
  });
  if (res.ok) redirect(`/management/expenses/${id}`);
  return res;
}

/** Splits an amount evenly in paisa; the remainder goes to the first animals. */
function splitEvenly(amount: string, n: number): string[] {
  if (n === 0) return [];
  const [i, f = ""] = amount.split(".");
  const paisa = BigInt(i) * BigInt(100) + BigInt((f + "00").slice(0, 2));
  const base = paisa / BigInt(n);
  let rem = paisa % BigInt(n);
  return Array.from({ length: n }, () => {
    const p = base + (rem > BigInt(0) ? BigInt(1) : BigInt(0));
    if (rem > BigInt(0)) rem -= BigInt(1);
    return `${p / BigInt(100)}.${String(p % BigInt(100)).padStart(2, "0")}`;
  });
}

export async function decideExpense(id: string, approve: boolean, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const charge = approve ? f.choice("charge_type", CHARGE_TYPES.filter((c) => c !== "to_be_determined"), { required: true }) : null;
    const account = f.id("account_id");
    const note = f.text("note", { required: !approve, max: 1000, label: "Reason" });
    if (charge === "chargeable_to_investment" && !account) f.errors.account_id = "Select the investment account to charge.";
    f.check();
    await db.query("select hv.decide_expense($1, $2, $3, $4, $5)", [id, approve, charge, account, note]);
    return approve ? "Expense approved." : "Expense rejected.";
  }, [`/management/expenses/${id}`, "/management/expenses"]);
}

export async function payExpense(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const at = f.datetime("paid_at", { required: true });
    const method = f.text("payment_method", { required: true, max: 40, label: "Payment method" });
    const ref = f.text("payment_reference", { max: 120 });
    f.check();
    await db.query("select hv.mark_expense_paid($1, $2::timestamptz, $3, $4)", [id, at, method, ref]);
    return "Marked as paid.";
  }, [`/management/expenses/${id}`]);
}

export async function flagExpense(id: string, status: "disputed" | "voided", prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const note = f.text("note", { required: true, max: 1000, label: "Note" });
    f.check();
    await db.query("select hv.flag_expense($1, $2, $3)", [id, status, note]);
    return status === "disputed" ? "Expense marked as disputed." : "Expense voided.";
  }, [`/management/expenses/${id}`]);
}
