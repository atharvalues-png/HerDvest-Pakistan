"use server";

import { redirect } from "next/navigation";
import { Form, runAction, type ActionState } from "@/lib/erp/action";
import { saveFormFile } from "@/lib/server/attachments";

const p = (id: string) => [`/management/sales/${id}`, "/management/sales", "/management"];

export async function recordSale(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const animal = f.id("animal_id", { required: true, label: "an animal" });
    const date = f.date("sale_date", { required: true });
    const buyer = f.text("buyer_name", { required: true, max: 200, label: "Buyer" });
    const contact = f.text("buyer_contact", { max: 200 });
    const price = f.money("sale_price", { required: true });
    const employee = f.id("responsible_employee_id");
    const notes = f.text("notes", { max: 2000 });
    const idem = f.text("idempotency_key", { max: 80 });
    f.check();
    id = (await db.query("select hv.record_sale($1, $2::date, $3, $4, $5::numeric, $6, $7, $8) id", [animal, date, buyer, contact, price, employee, notes, idem])).rows[0].id;
    await saveFormFile(db, fd.get("agreement"), "sale", id, "sale_agreement");
  });
  if (res.ok) redirect(`/management/sales/${id}`);
  return res;
}

export async function addReceipt(saleId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const amount = f.money("amount", { required: true });
    const at = f.datetime("received_at", { required: true });
    const method = f.text("method", { required: true, max: 40, label: "Method" });
    const ref = f.text("reference", { required: true, max: 120, label: "Reference" });
    f.check();
    await db.query("select hv.add_sale_receipt($1, $2::numeric, $3::timestamptz, $4, $5)", [saleId, amount, at, method, ref]);
    await saveFormFile(db, fd.get("receipt"), "sale", saleId, "sale_receipt");
    return "Buyer payment recorded. The settlement has been recalculated.";
  }, p(saleId));
}

export async function recalculate(saleId: string, prev: ActionState) {
  return runAction(prev, async (db) => {
    await db.query("select hv.calculate_settlement($1)", [saleId]);
    return "Settlement recalculated from current records.";
  }, p(saleId));
}

export async function setDispute(saleId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const on = f.bool("has_dispute");
    const note = f.text("dispute_note", { required: on, max: 1000, label: "Dispute note" });
    f.check();
    await db.query("update hv.sales set has_dispute = $2, dispute_note = $3 where id = $1", [saleId, on, note]);
    const st = await db.query("select status from hv.settlements where sale_id = $1", [saleId]);
    if (["calculated", "review_required"].includes(st.rows[0]?.status)) await db.query("select hv.calculate_settlement($1)", [saleId]);
    return on ? "Dispute recorded; settlement held for review." : "Dispute cleared.";
  }, p(saleId));
}

export async function approveSettlement(saleId: string, settlementId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const note = f.text("note", { max: 2000 });
    const inv = f.money("investor_payable", { allowZero: true });
    const farm = f.money("farmer_payable", { allowZero: true });
    const hv = f.money("herdvest_payable", { allowZero: true });
    f.check();
    await db.query("select hv.approve_settlement($1, $2, $3::numeric, $4::numeric, $5::numeric)", [settlementId, note, inv, farm, hv]);
    return "Settlement approved. Record payments as they are actually made.";
  }, p(saleId));
}

export async function recordPayment(saleId: string, settlementId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const payee = f.choice("payee", ["investor", "farmer", "herdvest"] as const, { required: true });
    const amount = f.money("amount", { required: true });
    const at = f.datetime("paid_at", { required: true });
    const method = f.text("method", { required: true, max: 40, label: "Method" });
    const ref = f.text("reference", { required: true, max: 120, label: "Reference" });
    const idem = f.text("idempotency_key", { max: 80 });
    f.check();
    await db.query("select hv.record_settlement_payment($1, $2, $3::numeric, $4::timestamptz, $5, $6, $7)", [settlementId, payee, amount, at, method, ref, idem]);
    return "Payment recorded.";
  }, p(saleId));
}
