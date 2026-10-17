"use server";

import { redirect } from "next/navigation";
import { Form, FieldErrors, runAction, type ActionState } from "@/lib/erp/action";
import { saveFormFile } from "@/lib/server/attachments";

type AnimalRow = { species?: string; breed?: string; sex?: string; tag_number?: string; color?: string; age_months?: string; price?: string; condition?: string; vet_assessment?: string };

export async function createPurchase(prev: ActionState, fd: FormData) {
  let id = "";
  const res = await runAction(prev, async (db) => {
    const f = new Form(fd);
    const account = f.id("account_id", { required: true, label: "an investment account" });
    const date = f.date("purchase_date", { required: true });
    const seller = f.text("seller_name", { required: true, max: 200, label: "Seller" });
    const sellerContact = f.text("seller_contact", { max: 200 });
    const location = f.text("location", { required: true, max: 200, label: "Purchase location" });
    const notes = f.text("notes", { max: 2000 });
    const idem = f.text("idempotency_key", { max: 80 });
    let animals: AnimalRow[] = [];
    try {
      animals = JSON.parse(f.raw("animals") || "[]");
    } catch {
      animals = [];
    }
    if (!Array.isArray(animals) || animals.length === 0) f.errors.animals = "Add at least one animal.";
    animals.forEach((a, i) => {
      if (!a.price || !/^\d{1,12}(\.\d{1,2})?$/.test(String(a.price).replace(/,/g, "")) || Number(a.price) <= 0) {
        f.errors.animals = `Animal ${i + 1}: enter a purchase price greater than zero.`;
      }
      if (a.age_months && !/^\d{1,3}$/.test(a.age_months)) f.errors.animals = `Animal ${i + 1}: age must be whole months.`;
    });
    if (Object.keys(f.errors).length) throw new FieldErrors(f.errors);
    const clean = animals.map((a) => ({ ...a, price: String(a.price).replace(/,/g, "") }));
    id = (await db.query("select hv.create_purchase($1, $2::date, $3, $4, $5, $6::jsonb, $7, $8) id",
      [account, date, seller, sellerContact, location, JSON.stringify(clean), notes, idem])).rows[0].id;
    await saveFormFile(db, fd.get("receipt"), "purchase", id, "purchase_receipt");
  });
  if (res.ok) redirect(`/management/purchases/${id}`);
  return res;
}

export async function voidPurchase(id: string, prev: ActionState, fd: FormData) {
  return runAction(prev, async (db) => {
    const f = new Form(fd);
    const reason = f.text("reason", { required: true, max: 500, label: "Reason" });
    f.check();
    await db.query("select hv.void_purchase($1, $2)", [id, reason]);
    return "Purchase voided. Its funding allocation has been reversed; records are kept.";
  }, [`/management/purchases/${id}`]);
}
