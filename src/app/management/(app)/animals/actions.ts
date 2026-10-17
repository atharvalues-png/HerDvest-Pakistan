"use server";

import { Form, runAction, type ActionState } from "@/lib/erp/action";
import { saveFormFile } from "@/lib/server/attachments";

const p = (id: string) => [`/management/animals/${id}`, "/management/animals"];

export async function allocateAnimal(animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const farmer = f.id("farmer_id", { required: true, label: "a verified farmer" });
    const start = f.date("start_date", { required: true });
    const location = f.text("farm_location", { max: 300 });
    const agreement = f.text("agreement_ref", { max: 120 });
    const resp = f.text("responsibilities", { max: 2000 });
    const review = f.date("review_date");
    const reason = f.text("reason", { max: 500 });
    const condition = f.text("condition", { max: 500 });
    const care = f.choice("care_type", ["primary", "shared"] as const) ?? "primary";
    f.check();
    const r = await db.query("select hv.allocate_animal($1, $2, $3::date, $4, $5, $6, $7::date, $8, $9, $10) id",
      [animalId, farmer, start, location, agreement, resp, review, reason, condition, care]);
    const file = await saveFormFile(db, fd.get("file"), "allocation", r.rows[0].id, "animal_photo");
    return `Allocation recorded${file ? " with attachment" : ""}. Previous allocations are kept in the history.`;
  }, p(animalId));
}

export async function setAnimalStatus(animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const status = f.choice("status", ["sourcing", "purchased", "awaiting_allocation", "allocated", "active", "under_treatment", "sale_preparation", "deceased", "other"] as const, { required: true });
    const reason = f.text("reason", { required: true, max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.set_animal_status($1, $2, $3)", [animalId, status, reason]);
    return "Status updated.";
  }, p(animalId));
}

export async function updateAnimal(animalId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = {
      breed: f.text("breed", { max: 100 }), sex: f.choice("sex", ["female", "male", "unknown"] as const), color: f.text("color", { max: 60 }),
      tag: f.text("tag_number", { max: 60 }), dob: f.date("birth_date_estimate"), age: f.number("age_months_estimate", { integer: true, min: 0, max: 400 }),
      location: f.text("farm_location", { max: 300 }), notes: f.text("notes", { max: 4000 }),
    };
    f.check();
    await db.query(
      `update hv.animals set breed=$2, sex=$3, color=$4, tag_number=$5, birth_date_estimate=$6, age_months_estimate=$7, farm_location=$8, notes=$9 where id=$1`,
      [animalId, v.breed, v.sex, v.color, v.tag, v.dob, v.age, v.location, v.notes]);
    return "Animal details saved.";
  }, p(animalId));
}
