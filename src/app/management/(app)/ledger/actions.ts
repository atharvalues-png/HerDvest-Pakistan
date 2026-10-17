"use server";

import { Form, runAction, type ActionState } from "@/lib/erp/action";
import { saveFormFile } from "@/lib/server/attachments";

const paths = (accountId?: string) => ["/management/ledger", "/management", ...(accountId ? [`/management/accounts/${accountId}`] : [])];

export async function recordDeposit(accountId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const amount = f.money("amount", { required: true });
    const at = f.datetime("occurred_at", { required: true });
    const method = f.text("payment_method", { required: true, max: 40, label: "Payment method" });
    const reference = f.text("reference", { max: 120 });
    const notes = f.text("notes", { max: 1000 });
    const idem = f.text("idempotency_key", { max: 80 });
    f.check();
    const r = await db.query("select hv.record_deposit($1, $2::numeric, $3::timestamptz, $4, $5, $6, $7) id", [accountId, amount, at, method, reference, notes, idem]);
    const proof = await saveFormFile(db, fd.get("proof"), "ledger_entry", r.rows[0].id, "payment_proof");
    return `Deposit recorded as pending${proof ? " with proof of payment" : ""}. It counts toward balances only after verification.`;
  }, paths(accountId));
}

export async function verifyEntry(entryId: string, approve: boolean, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const note = f.text("note", { required: !approve, max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.verify_ledger_entry($1, $2, $3)", [entryId, approve, note]);
    return approve ? "Entry verified." : "Entry rejected.";
  }, paths());
}

export async function reverseEntry(entryId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const reason = f.text("reason", { required: true, max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.reverse_ledger_entry($1, $2)", [entryId, reason]);
    return "Entry reversed. Both the original and the reversal remain on record.";
  }, paths());
}

export async function recordDecision(accountId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const decision = f.choice("decision", ["retain_for_purchase", "allocate_to_expense", "return_to_investor", "hold_pending"] as const, { required: true });
    const notes = f.text("notes", { required: true, max: 1000, label: "Notes" });
    f.check();
    await db.query("select hv.record_unallocated_decision($1, $2, $3)", [accountId, decision, notes]);
    return decision === "return_to_investor"
      ? "Decision recorded. A refund entry was created as pending — verify it once the money has been sent."
      : "Decision recorded.";
  }, paths(accountId));
}
