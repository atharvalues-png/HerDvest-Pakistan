"use server";

import { redirect } from "next/navigation";
import { Form, runAction, type ActionState } from "@/lib/erp/action";

export async function updateEnquiry(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const status = f.choice("status", ["new", "contacted", "qualified", "closed"] as const, { required: true });
    const assigned = f.id("assigned_to");
    const notes = f.text("notes", { max: 4000 });
    f.check();
    await db.query("update hv.enquiries set status = $2, assigned_to = $3, notes = $4 where id = $1 and status <> 'converted'", [id, status, assigned, notes]);
    return "Enquiry updated.";
  }, [`/management/enquiries/${id}`, "/management/enquiries"]);
}

export async function convertEnquiry(id: string, kind: "investor" | "farmer", prev: ActionState) {
  let newId = "";
  const res = await runAction(prev, async (db) => {
    newId = (await db.query("select hv.convert_enquiry($1) id", [id])).rows[0].id;
    if (kind === "investor") await db.query("insert into hv.investment_accounts (investor_id) values ($1)", [newId]);
  });
  if (res.ok) redirect(kind === "farmer" ? `/management/farmers/${newId}` : `/management/investors/${newId}`);
  return res;
}
