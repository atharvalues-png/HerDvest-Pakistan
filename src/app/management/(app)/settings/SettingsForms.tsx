"use client";

import { ActionForm, Checkbox, Input, Submit } from "@/components/erp/form";
import { Card } from "@/components/erp/ui";
import { addCategory, addLivestockType, saveSettings } from "./actions";

type Row = { id: string; label: string };

export function SettingsForms({ timezone, dualControl, categories, types }: { timezone: string; dualControl: boolean; categories: Row[]; types: Row[] }) {
  return (
    <>
      <Card title="Business settings">
        <ActionForm action={saveSettings}>
          <Input name="timezone" label="Business timezone" required defaultValue={timezone} hint="IANA timezone used to display dates and interpret entered times, e.g. Asia/Karachi" />
          <Checkbox name="dual_control" label="Dual control for the funding ledger" defaultChecked={dualControl}
            hint="When on, the person who records a deposit or refund cannot also verify it." />
          <Submit>Save settings</Submit>
        </ActionForm>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Expense categories">
          <ul className="mb-4 space-y-1 text-sm">{categories.map((c) => <li key={c.id}>{c.label} <span className="font-mono text-xs text-ink-500">{c.id}</span></li>)}</ul>
          <ActionForm action={addCategory} resetOnSuccess>
            <div className="grid grid-cols-2 gap-2"><Input name="id" label="ID" required /><Input name="label" label="Label" required /></div>
            <Submit variant="secondary">Add category</Submit>
          </ActionForm>
        </Card>
        <Card title="Livestock types">
          <ul className="mb-4 space-y-1 text-sm">{types.map((c) => <li key={c.id}>{c.label} <span className="font-mono text-xs text-ink-500">{c.id}</span></li>)}</ul>
          <ActionForm action={addLivestockType} resetOnSuccess>
            <div className="grid grid-cols-2 gap-2"><Input name="id" label="ID" required /><Input name="label" label="Label" required /></div>
            <Submit variant="secondary">Add type</Submit>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
