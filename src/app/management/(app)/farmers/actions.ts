"use server";

import { redirect } from "next/navigation";
import { Form, runAction, type ActionState } from "@/lib/erp/action";

const TYPES = ["Cattle", "Buffalo", "Goats", "Sheep", "Mixed", "Other"];

function fields(f: Form) {
  return {
    name: f.text("full_name", { required: true, max: 200, label: "Full name" }),
    phone: f.text("phone", { max: 40 }),
    address: f.text("address", { max: 500 }),
    district: f.text("district", { max: 100 }),
    city: f.text("city", { max: 100 }),
    farm: f.text("farm_location", { max: 300 }),
    exp: f.number("experience_years", { min: 0, max: 80 }),
    cap: f.number("capacity", { min: 0, max: 100000, integer: true }),
    types: f.list("livestock_types").filter((t) => TYPES.includes(t)),
    agreement: f.choice("agreement_status", ["none", "draft", "signed", "expired", "terminated"] as const) ?? "none",
    bg: f.choice("background_check_status", ["not_started", "consent_pending", "in_progress", "clear", "concerns_noted", "not_required"] as const) ?? "not_started",
    refs: f.text("references_text", { max: 2000 }),
    vnotes: f.text("verification_notes", { max: 4000 }),
    notes: f.text("notes", { max: 4000 }),
  };
}

export async function createFarmer(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = fields(f);
    f.check();
    id = (await db.query(
      `insert into hv.farmers (full_name, phone, address, district, city, farm_location, experience_years, capacity, livestock_types,
         agreement_status, background_check_status, references_text, verification_notes, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
      [v.name, v.phone, v.address, v.district, v.city, v.farm, v.exp, v.cap, v.types, v.agreement, v.bg, v.refs, v.vnotes, v.notes])).rows[0].id;
  });
  if (res.ok) redirect(`/management/farmers/${id}`);
  return res;
}

export async function updateFarmer(id: string, prev: ActionState, fd: FormData) {
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = fields(f);
    f.check();
    await db.query(
      `update hv.farmers set full_name=$2, phone=$3, address=$4, district=$5, city=$6, farm_location=$7, experience_years=$8, capacity=$9,
         livestock_types=$10, agreement_status=$11, background_check_status=$12, references_text=$13, verification_notes=$14, notes=$15 where id=$1`,
      [id, v.name, v.phone, v.address, v.district, v.city, v.farm, v.exp, v.cap, v.types, v.agreement, v.bg, v.refs, v.vnotes, v.notes]);
  });
  if (res.ok) redirect(`/management/farmers/${id}`);
  return res;
}

export async function setVerification(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const status = f.choice("status", ["application_received", "documents_pending", "verification_in_progress", "farm_inspection_pending", "verified", "rejected", "suspended"] as const, { required: true });
    const notes = f.text("notes", { max: 2000 });
    f.check();
    await db.query("select hv.set_farmer_verification($1, $2, $3)", [id, status, notes]);
    return "Verification status updated.";
  }, [`/management/farmers/${id}`]);
}
