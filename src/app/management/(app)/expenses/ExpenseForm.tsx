"use client";

import { useState } from "react";
import { ActionForm, FieldError, FileField, Hidden, Input, MoneyInput, Select, Submit, Textarea } from "@/components/erp/form";
import { createExpense } from "./actions";

type Opt = ReadonlyArray<readonly [string, string]>;

export function ExpenseForm({ categories, animals, farmers, chargeTypes, canChooseCharge, defaults, idem }: {
  categories: Opt; animals: Opt; farmers: Opt; chargeTypes: Opt; canChooseCharge: boolean;
  defaults: { animal?: string; vet?: string; sale?: string }; idem: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaults.animal ? [defaults.animal] : []);
  const [filter, setFilter] = useState("");
  const shown = animals.filter(([, l]) => l.toLowerCase().includes(filter.toLowerCase())).slice(0, 200);
  return (
    <ActionForm action={createExpense}>
      <Hidden name="idempotency_key" value={idem} />
      {defaults.vet && <Hidden name="vet_record_id" value={defaults.vet} />}
      {defaults.sale && <Hidden name="sale_id" value={defaults.sale} />}
      {selected.map((id) => <Hidden key={id} name="animal_ids" value={id} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="expense_date" label="Date" type="date" required />
        <Select name="category_id" label="Category" required options={categories} />
        <Input name="description" label="Description" required className="sm:col-span-2" />
        <MoneyInput name="amount" label="Amount" required />
        <Input name="vendor" label="Paid to / vendor" />
        <Select name="payment_method" label="Payment method" options={[["cash", "Cash"], ["bank_transfer", "Bank transfer"], ["mobile_wallet", "Mobile wallet"], ["card", "Company card"], ["other", "Other"]]} />
        {farmers.length > 0 && <Select name="farmer_id" label="Related farmer" options={farmers} placeholder="None" />}
        {canChooseCharge && (
          <Select name="charge_type" label="Proposed treatment" options={chargeTypes} placeholder="To be decided on approval" className="sm:col-span-2"
            hint="Final treatment is confirmed by the approver. Company operating costs are never deducted from investor funds automatically." />
        )}
      </div>
      <fieldset className="rounded-xl border border-forest/10 p-3">
        <legend className="px-1 text-xs font-semibold text-forest">Related animals ({selected.length} selected)</legend>
        <p className="mb-2 text-xs text-ink-500">The amount is split evenly across the selected animals. Each animal is charged once — no duplicate charges.</p>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter animals…" className="mb-2 w-full rounded-lg border border-forest/15 px-3 py-1.5 text-sm" />
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {shown.map(([id, l]) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-emerald" checked={selected.includes(id)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, id] : s.filter((x) => x !== id)))} />
              {l}
            </label>
          ))}
          {shown.length === 0 && <p className="text-xs text-ink-500">No animals.</p>}
        </div>
        <FieldError name="animal_ids" />
      </fieldset>
      <Textarea name="notes" label="Notes" rows={2} />
      <FileField name="receipt" label="Receipt or invoice" capture="environment" hint="Optional · opens the camera on phones" />
      <Submit>Submit expense</Submit>
    </ActionForm>
  );
}
