"use client";

import { ActionForm, FileField, Hidden, Input, MoneyInput, Select, Submit, Textarea } from "@/components/erp/form";
import { recordSale } from "../actions";

type Opt = ReadonlyArray<readonly [string, string]>;

export function SaleForm({ animals, employees, defaultAnimal, idem }: { animals: Opt; employees: Opt; defaultAnimal?: string; idem: string }) {
  return (
    <ActionForm action={recordSale}>
      <Hidden name="idempotency_key" value={idem} />
      <Select name="animal_id" label="Animal" required options={animals} defaultValue={defaultAnimal} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="sale_date" label="Sale date" type="date" required />
        <MoneyInput name="sale_price" label="Agreed sale price" required />
        <Input name="buyer_name" label="Buyer" required />
        <Input name="buyer_contact" label="Buyer contact" />
        <Select name="responsible_employee_id" label="Responsible employee" options={employees} placeholder="None" className="sm:col-span-2" />
      </div>
      <Textarea name="notes" label="Notes" rows={2} />
      <FileField name="agreement" label="Sale agreement / documentation" />
      <Submit>Record sale</Submit>
    </ActionForm>
  );
}
