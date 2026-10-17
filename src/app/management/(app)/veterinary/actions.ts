"use server";

import { redirect } from "next/navigation";
import { Form, runAction, type ActionState } from "@/lib/erp/action";
import { saveFormFile } from "@/lib/server/attachments";

const TYPES = ["inspection", "vaccination", "treatment", "health_check", "follow_up", "purchase_assessment"] as const;
const STATUS = ["scheduled", "completed", "cancelled", "missed"] as const;
const COND = ["excellent", "good", "fair", "poor", "critical"] as const;

function fields(f: Form) {
  const v = {
    animal: f.id("animal_id", { required: true, label: "an animal" }),
    type: f.choice("visit_type", TYPES, { required: true }),
    status: f.choice("status", STATUS, { required: true }),
    scheduled: f.date("scheduled_date"),
    visit: f.date("visit_date"),
    by: f.text("performed_by", { max: 200 }),
    employee: f.id("employee_id"),
    location: f.text("location", { max: 300 }),
    findings: f.text("findings", { max: 4000 }),
    condition: f.choice("condition", COND),
    weight: f.number("weight_kg", { min: 0, max: 3000 }),
    vaccine: f.text("vaccine_name", { max: 200 }),
    vdate: f.date("vaccination_date"),
    next: f.date("next_due_date"),
    treatment: f.text("treatment", { max: 2000 }),
    followUp: f.text("follow_up", { max: 2000 }),
    cost: f.money("cost", { allowZero: true }),
    notes: f.text("notes", { max: 4000 }),
  };
  if (v.status === "scheduled" && !v.scheduled) f.errors.scheduled_date = "Choose the scheduled date.";
  if (v.status === "completed" && !v.visit) f.errors.visit_date = "Enter the actual visit date.";
  if (v.type === "vaccination" && v.status === "completed" && !v.vaccine) f.errors.vaccine_name = "Enter the vaccine given.";
  return v;
}

const params = (v: ReturnType<typeof fields>) => [v.animal, v.type, v.status, v.scheduled, v.visit, v.by, v.employee, v.location, v.findings, v.condition,
  v.weight, v.vaccine, v.vdate ?? (v.type === "vaccination" ? v.visit : null), v.next, v.treatment, v.followUp, v.cost, v.notes];

export async function createVetRecord(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db, user) => {
    const f = new Form(fd);
    const v = fields(f);
    f.check();
    id = (await db.query(
      `insert into hv.vet_records (animal_id, visit_type, status, scheduled_date, visit_date, performed_by, employee_id, location, findings, condition,
         weight_kg, vaccine_name, vaccination_date, next_due_date, treatment, follow_up, cost, notes)
       values ($1,$2,$3,$4,$5,$6,coalesce($7, $19::uuid),$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning id`,
      [...params(v), user.employeeId])).rows[0].id;
    await saveFormFile(db, fd.get("photo"), "vet_record", id, v.type === "vaccination" ? "vaccination_record" : "veterinary_report");
    if (f.bool("create_expense") && v.cost && Number(v.cost) > 0) {
      const exp = await db.query(
        `insert into hv.expenses (expense_date, category_id, description, amount, vendor, vet_record_id)
         values (coalesce($1::date, current_date), $2, $3, $4, $5, $6) returning id`,
        [v.visit ?? v.scheduled, v.type === "vaccination" ? "vaccination" : v.type === "treatment" ? "medicine" : "veterinary_fee",
          `${(v.type ?? "visit").replace(/_/g, " ")} — vet visit`, v.cost, v.by, id]);
      await db.query("insert into hv.expense_allocations (expense_id, animal_id, amount) values ($1, $2, $3)", [exp.rows[0].id, v.animal, v.cost]);
    }
  });
  if (res.ok) redirect(`/management/veterinary/${id}`);
  return res;
}

export async function updateVetRecord(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = fields(f);
    f.check();
    const r = await db.query(
      `update hv.vet_records set animal_id=$2, visit_type=$3, status=$4, scheduled_date=$5, visit_date=$6, performed_by=$7, employee_id=$8, location=$9,
         findings=$10, condition=$11, weight_kg=$12, vaccine_name=$13, vaccination_date=$14, next_due_date=$15, treatment=$16, follow_up=$17, cost=$18, notes=$19
       where id=$1`, [id, ...params(v)]);
    if (r.rowCount === 0) throw Object.assign(new Error("You can't edit this record."), { code: "P0001" });
    return "Record saved.";
  }, [`/management/veterinary/${id}`]);
}
