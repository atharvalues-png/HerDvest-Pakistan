"use server";

import { redirect } from "next/navigation";
import { Form, FieldErrors, runAction, type ActionState } from "@/lib/erp/action";
import { receiveIntake } from "@/lib/intake/receive";

export async function submitManualIntake(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db, user) => {
    if (!user.permissions.has("intake.review")) throw Object.assign(new Error("Permission denied: intake.review is required"), { code: "42501" });
    const f = new Form(fd);
    const sender = f.text("sender", { max: 200 });
    const body = f.text("body", { required: true, max: 20000, label: "Message" });
    f.check();
    const files = [];
    for (const v of fd.getAll("files")) {
      if (v instanceof File && v.size > 0) files.push({ name: v.name, data: Buffer.from(await v.arrayBuffer()) });
    }
    const r = await receiveIntake({ source: "manual", sender: sender ?? user.email, body: body!, files, db });
    id = r.id;
    if (r.duplicate) throw new FieldErrors({ body: "This exact message has already been received. Opened the existing item." });
  });
  if (res.ok || (res.errors?.body && id)) redirect(`/management/intake/${id}`);
  return res;
}

/**
 * Reviewer approval: writes the VERIFIED details as records in the reviewer's
 * own transaction (RLS + workflow rules apply). Expenses are created as claims
 * awaiting normal approval — intake never posts money directly.
 */
export async function approveIntake(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const animal = f.id("animal_id", { required: true, label: "the animal" });
    const date = f.date("date", { required: true });
    const createVet = f.bool("create_vet");
    const visitType = f.choice("visit_type", ["inspection", "vaccination", "treatment", "health_check", "follow_up"] as const) ?? "inspection";
    const condition = f.choice("condition", ["excellent", "good", "fair", "poor", "critical"] as const);
    const findings = f.text("findings", { max: 4000 });
    const vaccine = f.text("vaccine_name", { max: 120 });
    const weight = f.number("weight_kg", { min: 0, max: 3000 });
    const createExpense = f.bool("create_expense");
    const amount = createExpense ? f.money("amount", { required: true }) : null;
    const category = createExpense ? f.text("category_id", { required: true, max: 60, label: "Category" }) : null;
    const description = createExpense ? f.text("expense_description", { required: true, max: 500, label: "Description" }) : null;
    const charge = f.choice("charge_type", ["to_be_determined", "herdvest_operating", "chargeable_to_investment", "covered_by_service_fee", "paid_by_farmer", "reimbursement_required"] as const) ?? "to_be_determined";
    const note = f.text("note", { max: 1000 });
    if (!createVet && !createExpense) f.errors.create_vet = "Choose at least one record to create, or reject the item.";
    if (visitType === "vaccination" && createVet && !vaccine) f.errors.vaccine_name = "Enter the vaccine.";
    f.check();

    const created: Array<{ type: string; id: string }> = [];
    let vetId: string | null = null;
    if (createVet) {
      vetId = (await db.query(
        `insert into hv.vet_records (animal_id, visit_type, status, visit_date, condition, findings, vaccine_name, vaccination_date, weight_kg, notes, source_intake_id)
         values ($1, $2, 'completed', $3, $4, $5, $6, case when $2 = 'vaccination' then $3::date end, $7, $8, $9) returning id`,
        [animal, visitType, date, condition, findings, vaccine, weight, `Created from intake item after review.${note ? ` ${note}` : ""}`, id])).rows[0].id;
      created.push({ type: "vet_record", id: vetId! });
    }
    if (createExpense) {
      const exp = (await db.query(
        `insert into hv.expenses (expense_date, category_id, description, amount, vet_record_id, charge_type, notes, source_intake_id)
         values ($1, $2, $3, $4, $5, $6, 'Created from intake item after review; receipt is attached to the intake item.', $7) returning id`,
        [date, category, description, amount, vetId, charge, id])).rows[0].id;
      await db.query("insert into hv.expense_allocations (expense_id, animal_id, amount) values ($1, $2, $3)", [exp, animal, amount]);
      created.push({ type: "expense", id: exp });
    }
    await db.query("select hv.intake_mark_reviewed($1, 'approved', $2, $3)", [id, note, JSON.stringify(created)]);
    return createExpense ? "Records created. The expense now awaits normal approval." : "Records created.";
  }, [`/management/intake/${id}`, "/management/intake"]);
}

export async function closeIntake(id: string, status: "rejected" | "duplicate", prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const note = f.text("note", { required: true, max: 1000, label: "Reason" });
    f.check();
    await db.query("select hv.intake_mark_reviewed($1, $2, $3, '[]')", [id, status, note]);
    return status === "rejected" ? "Item rejected." : "Marked as duplicate.";
  }, [`/management/intake/${id}`, "/management/intake"]);
}
