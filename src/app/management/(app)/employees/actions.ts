"use server";

import { redirect } from "next/navigation";
import { Form, runAction, type ActionState } from "@/lib/erp/action";

function fields(f: Form) {
  return {
    name: f.text("full_name", { required: true, max: 200, label: "Name" }), phone: f.text("phone", { max: 40 }), email: f.text("email", { max: 200 }),
    title: f.text("job_title", { max: 120 }), dept: f.text("department", { max: 120 }),
    status: f.choice("status", ["active", "on_leave", "inactive", "terminated"] as const) ?? "active",
    joined: f.date("joining_date"), areas: f.text("assigned_areas", { max: 1000 }), notes: f.text("notes", { max: 2000 }),
  };
}

export async function createEmployee(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = fields(f);
    f.check();
    id = (await db.query(
      `insert into hv.employees (full_name, phone, email, job_title, department, status, joining_date, assigned_areas, notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [v.name, v.phone, v.email, v.title, v.dept, v.status, v.joined, v.areas, v.notes])).rows[0].id;
  });
  if (res.ok) redirect(`/management/employees/${id}`);
  return res;
}

export async function updateEmployee(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = fields(f);
    f.check();
    await db.query(
      `update hv.employees set full_name=$2, phone=$3, email=$4, job_title=$5, department=$6, status=$7, joining_date=$8, assigned_areas=$9, notes=$10 where id=$1`,
      [id, v.name, v.phone, v.email, v.title, v.dept, v.status, v.joined, v.areas, v.notes]);
    return "Employee saved.";
  }, [`/management/employees/${id}`]);
}
