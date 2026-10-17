"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, FieldError, FileField, Hidden, Input, Select, Submit, Textarea } from "@/components/erp/form";
import { formatMoney, sumMoney } from "@/lib/erp/format";
import { createPurchase } from "./actions";

type Row = { species: string; breed: string; sex: string; tag_number: string; color: string; age_months: string; price: string; condition: string; vet_assessment: string };
const blank = (): Row => ({ species: "buffalo", breed: "", sex: "female", tag_number: "", color: "", age_months: "", price: "", condition: "", vet_assessment: "" });

const cell = "w-full rounded-md border border-forest/15 bg-white px-2 py-1.5 text-sm focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/15";

export function PurchaseForm({ accounts, species, defaultAccount, idem }: {
  accounts: ReadonlyArray<readonly [string, string]>; species: ReadonlyArray<readonly [string, string]>; defaultAccount?: string; idem: string;
}) {
  const [rows, setRows] = useState<Row[]>([blank()]);
  const set = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const total = sumMoney(rows.map((r) => (/^\d+(\.\d{1,2})?$/.test(r.price.replace(/,/g, "")) ? r.price.replace(/,/g, "") : "0")));

  return (
    <ActionForm action={createPurchase}>
      <Hidden name="animals" value={JSON.stringify(rows)} />
      <Hidden name="idempotency_key" value={idem} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="account_id" label="Funding investment account" required options={accounts} defaultValue={defaultAccount}
          hint="Only verified, unallocated funds can be used. The purchase is blocked if funds are insufficient." className="sm:col-span-2" />
        <Input name="purchase_date" label="Purchase date" type="date" required />
        <Input name="location" label="Purchase location / market" required />
        <Input name="seller_name" label="Seller" required />
        <Input name="seller_contact" label="Seller contact" />
      </div>

      <fieldset className="rounded-xl border border-forest/10 p-3">
        <legend className="px-1 text-xs font-semibold text-forest">Animals purchased *</legend>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg bg-ivory/50 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-600">
                Animal {i + 1}
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 text-alert">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="text-xs">Type<select className={cell} value={r.species} onChange={(e) => set(i, "species", e.target.value)}>{species.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="text-xs">Breed<input className={cell} value={r.breed} onChange={(e) => set(i, "breed", e.target.value)} placeholder="e.g. Nili-Ravi" /></label>
                <label className="text-xs">Sex<select className={cell} value={r.sex} onChange={(e) => set(i, "sex", e.target.value)}><option value="female">Female</option><option value="male">Male</option><option value="unknown">Unknown</option></select></label>
                <label className="text-xs">Purchase price (PKR) *<input className={cell} inputMode="decimal" value={r.price} onChange={(e) => set(i, "price", e.target.value)} /></label>
                <label className="text-xs">Ear tag / ID<input className={cell} value={r.tag_number} onChange={(e) => set(i, "tag_number", e.target.value)} /></label>
                <label className="text-xs">Colour<input className={cell} value={r.color} onChange={(e) => set(i, "color", e.target.value)} placeholder="e.g. Black" /></label>
                <label className="text-xs">Estimated age (months)<input className={cell} inputMode="numeric" value={r.age_months} onChange={(e) => set(i, "age_months", e.target.value)} /></label>
                <label className="text-xs">Condition at purchase<input className={cell} value={r.condition} onChange={(e) => set(i, "condition", e.target.value)} /></label>
                <label className="col-span-2 text-xs md:col-span-4">Veterinary assessment (if available)<input className={cell} value={r.vet_assessment} onChange={(e) => set(i, "vet_assessment", e.target.value)} /></label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={() => setRows((x) => [...x, blank()])} className="inline-flex items-center gap-1 rounded-lg border border-forest/15 bg-white px-3 py-1.5 text-sm font-semibold text-forest">
            <Plus className="h-4 w-4" /> Add animal
          </button>
          <p className="text-sm">Total purchase cost: <strong className="tabular-nums text-forest">{formatMoney(total)}</strong></p>
        </div>
        <FieldError name="animals" />
      </fieldset>
      <Textarea name="notes" label="Notes" rows={2} />
      <FileField name="receipt" label="Purchase receipt" />
      <Submit>Record purchase</Submit>
    </ActionForm>
  );
}
