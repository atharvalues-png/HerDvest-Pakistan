"use server";

import { redirect } from "next/navigation";
import { Form, runAction, type ActionState } from "@/lib/erp/action";
import { saveFormFile } from "@/lib/server/attachments";

const TYPES = ["farm_inspection", "animal_photography", "vet_coordination", "vaccination_verification", "status_check", "receipt_collection", "farmer_verification", "sale_preparation", "other"] as const;

export async function createTask(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = {
      title: f.text("title", { required: true, max: 200, label: "Title" }), type: f.choice("task_type", TYPES, { required: true }),
      assigned: f.id("assigned_to", { required: true, label: "an employee" }), due: f.date("due_date"),
      investor: f.id("investor_id"), animal: f.id("animal_id"), farmer: f.id("farmer_id"), instructions: f.text("instructions", { max: 4000 }),
    };
    f.check();
    id = (await db.query(
      `insert into hv.tasks (title, task_type, assigned_to, due_date, investor_id, animal_id, farmer_id, instructions) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [v.title, v.type, v.assigned, v.due, v.investor, v.animal, v.farmer, v.instructions])).rows[0].id;
  });
  if (res.ok) redirect(`/management/tasks/${id}`);
  return res;
}

export async function updateTaskProgress(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const status = f.choice("status", ["open", "in_progress", "completed", "cancelled"] as const, { required: true });
    const findings = f.text("findings", { max: 4000 });
    const loc = f.text("location_note", { max: 300 });
    if (status === "completed" && !findings) f.errors.findings = "Record your findings before completing the task.";
    f.check();
    const r = await db.query("update hv.tasks set status = $2, findings = $3, location_note = $4 where id = $1", [id, status, findings, loc]);
    if (r.rowCount === 0) throw Object.assign(new Error("You can't update this task."), { code: "P0001" });
    const file = await saveFormFile(db, fd.get("file"), "task", id, "animal_photo");
    return file ? "Task updated and file attached." : "Task updated.";
  }, [`/management/tasks/${id}`, "/management/tasks"]);
}
