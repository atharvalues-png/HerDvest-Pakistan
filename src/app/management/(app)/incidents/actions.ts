"use server";

import { redirect } from "next/navigation";
import { Form, runAction, type ActionState } from "@/lib/erp/action";
import { saveFormFile } from "@/lib/server/attachments";

export async function reportIncident(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const animal = f.id("animal_id", { required: true, label: "an animal" });
    const type = f.choice("incident_type", ["death", "major_injury", "serious_illness", "theft_or_loss", "other"] as const, { required: true });
    const at = f.datetime("occurred_at", { required: true });
    const by = f.text("reported_by_name", { required: true, max: 200, label: "Reported by" });
    const desc = f.text("description", { required: true, max: 4000, label: "Description" });
    const vet = f.text("vet_findings", { max: 4000 });
    f.check();
    id = (await db.query("select hv.report_incident($1, $2, $3::timestamptz, $4, $5, $6) id", [animal, type, at, by, desc, vet])).rows[0].id;
    await saveFormFile(db, fd.get("file"), "incident", id, "incident_document");
  });
  if (res.ok) redirect(`/management/incidents/${id}`);
  return res;
}

export async function updateIncident(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const status = f.choice("status", ["reported", "investigating", "under_review", "decided", "closed"] as const, { required: true });
    const note = f.text("note", { required: true, max: 2000, label: "Note" });
    const contractual = f.text("contractual_notes", { max: 4000 });
    const decision = f.text("decision", { max: 4000 });
    const est = f.money("estimated_loss", { allowZero: true });
    const inv = f.money("investor_loss", { allowZero: true });
    const farm = f.money("farmer_loss", { allowZero: true });
    const hv = f.money("herdvest_loss", { allowZero: true });
    f.check();
    await db.query("select hv.update_incident($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9::numeric)",
      [id, status, note, contractual, decision, inv, farm, hv, est]);
    return "Incident updated.";
  }, [`/management/incidents/${id}`]);
}

export async function updateVetFindings(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const vet = f.text("vet_findings", { max: 4000 });
    const outstanding = f.text("outstanding_items", { max: 2000 });
    f.check();
    await db.query("update hv.incidents set vet_findings = $2, outstanding_items = $3 where id = $1", [id, vet, outstanding]);
    return "Saved.";
  }, [`/management/incidents/${id}`]);
}
