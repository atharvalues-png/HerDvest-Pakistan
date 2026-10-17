"use server";

import { redirect } from "next/navigation";
import { Form, runAction, type ActionState } from "@/lib/erp/action";

const STATUSES = ["prospective", "active", "dormant", "exited", "suspended"] as const;
const PREFS = ["phone", "email", "whatsapp", "any"] as const;

function investorFields(f: Form) {
  return {
    name: f.text("full_legal_name", { required: true, max: 200, label: "Full legal name" }),
    phone: f.text("phone", { max: 40 }),
    email: f.text("email", { max: 200 }),
    address: f.text("address", { max: 500 }),
    city: f.text("city", { max: 100 }),
    country: f.text("country", { max: 100 }),
    status: f.choice("status", STATUSES) ?? "prospective",
    pref: f.choice("contact_preference", PREFS),
    comm: f.text("communication_notes", { max: 1000 }),
    notes: f.text("notes", { max: 4000 }),
    registered: f.date("registered_on"),
  };
}

export async function createInvestor(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = investorFields(f);
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) f.errors.email = "Enter a valid email.";
    f.check();
    const r = await db.query(
      `insert into hv.investors (full_legal_name, phone, email, address, city, country, status, contact_preference, communication_notes, notes, registered_on)
       values ($1,$2,$3,$4,$5,coalesce($6,'Pakistan'),$7,$8,$9,$10,coalesce($11::date, current_date)) returning id`,
      [v.name, v.phone, v.email, v.address, v.city, v.country, v.status, v.pref, v.comm, v.notes, v.registered],
    );
    id = r.rows[0].id;
    // every investor starts with one investment account
    await db.query("insert into hv.investment_accounts (investor_id) values ($1)", [id]);
  });
  if (res.ok) redirect(`/management/investors/${id}`);
  return res;
}

export async function updateInvestor(id: string, prev: ActionState, fd: FormData) {
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const v = investorFields(f);
    f.check();
    await db.query(
      `update hv.investors set full_legal_name=$2, phone=$3, email=$4, address=$5, city=$6, country=$7, status=$8,
         contact_preference=$9, communication_notes=$10, notes=$11, registered_on=coalesce($12::date, registered_on) where id=$1`,
      [id, v.name, v.phone, v.email, v.address, v.city, v.country, v.status, v.pref, v.comm, v.notes, v.registered],
    );
  });
  if (res.ok) redirect(`/management/investors/${id}`);
  return res;
}

export async function createAccount(investorId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const name = f.text("name", { max: 120 }) ?? "Livestock investment account";
    const agreement = f.text("agreement_ref", { max: 120 });
    const inv = f.number("investor_share_pct", { min: 0, max: 100 }) ?? 50;
    const fee = f.number("service_fee_pct", { min: 0, max: 100 }) ?? 20;
    const deduct = f.bool("deduct_sale_expenses");
    f.check();
    await db.query(
      `insert into hv.investment_accounts (investor_id, name, agreement_ref, investor_share_pct, service_fee_pct, deduct_sale_expenses)
       values ($1,$2,$3,$4,$5,$6)`,
      [investorId, name, agreement, inv, fee, deduct],
    );
    return "Investment account opened.";
  }, [`/management/investors/${investorId}`]);
}

export async function updateAccount(accountId: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const name = f.text("name", { required: true, max: 120 });
    const agreement = f.text("agreement_ref", { max: 120 });
    const status = f.choice("status", ["open", "closed", "suspended"] as const, { required: true });
    const deduct = f.bool("deduct_sale_expenses");
    const notes = f.text("notes", { max: 2000 });
    f.check();
    await db.query(
      "update hv.investment_accounts set name=$2, agreement_ref=$3, status=$4, deduct_sale_expenses=$5, notes=$6 where id=$1",
      [accountId, name, agreement, status, deduct, notes],
    );
    return "Account updated.";
  }, [`/management/accounts/${accountId}`]);
}
