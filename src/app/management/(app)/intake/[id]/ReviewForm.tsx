"use client";

import { ActionForm, Checkbox, Input, MoneyInput, Select, Submit, Textarea } from "@/components/erp/form";
import { approveIntake } from "../actions";

type Opt = ReadonlyArray<readonly [string, string]>;
type Defaults = {
  animal?: string | null; date?: string; createVet: boolean; visitType: string; condition?: string; findings?: string;
  vaccine?: string; weight?: string; createExpense: boolean; amount?: string; category?: string; description?: string;
};

export function ReviewForm({ id, animals, categories, chargeTypes, defaults: v }: { id: string; animals: Opt; categories: Opt; chargeTypes: Opt; defaults: Defaults }) {
  return (
    <ActionForm action={approveIntake.bind(null, id)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="animal_id" label="Animal (verify)" required options={animals} defaultValue={v.animal ?? undefined} />
        <Input name="date" label="Date of visit / expense" type="date" required defaultValue={v.date} />
      </div>
      <fieldset className="space-y-3 rounded-xl border border-forest/10 p-4">
        <Checkbox name="create_vet" label="Create inspection / veterinary record" defaultChecked={v.createVet} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="visit_type" label="Visit type" placeholder={false} defaultValue={v.visitType}
            options={[["inspection", "Inspection"], ["vaccination", "Vaccination"], ["treatment", "Treatment"], ["health_check", "Health check"], ["follow_up", "Follow-up"]]} />
          <Select name="condition" label="Inspection result / condition" defaultValue={v.condition} options={[["excellent", "Excellent"], ["good", "Good / healthy"], ["fair", "Fair"], ["poor", "Poor"], ["critical", "Critical"]]} />
          <Input name="vaccine_name" label="Vaccine" defaultValue={v.vaccine} />
          <Input name="weight_kg" label="Weight (kg)" inputMode="decimal" defaultValue={v.weight} />
        </div>
        <Textarea name="findings" label="Findings" defaultValue={v.findings} rows={3} />
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-forest/10 p-4">
        <Checkbox name="create_expense" label="Create expense claim (awaits normal approval)" defaultChecked={v.createExpense} />
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput name="amount" label="Amount" defaultValue={v.amount} />
          <Select name="category_id" label="Category" options={categories} defaultValue={v.category} />
          <Input name="expense_description" label="Description" defaultValue={v.description} className="sm:col-span-2" />
          <Select name="charge_type" label="Proposed treatment (confirmed on approval)" options={chargeTypes} placeholder="Decide on approval" className="sm:col-span-2" />
        </div>
      </fieldset>
      <Textarea name="note" label="Reviewer note" rows={2} />
      <Submit>Approve & create records</Submit>
    </ActionForm>
  );
}
