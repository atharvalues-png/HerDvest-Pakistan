"use client";

import { ActionForm, Checkbox, FileField, Input, MoneyInput, Select, Submit, Textarea } from "@/components/erp/form";
import type { ActionState } from "@/lib/erp/action";

type Opt = ReadonlyArray<readonly [string, string]>;

export function VetForm({ action, animals, employees, record, defaultAnimal, isNew }: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>; animals: Opt; employees: Opt;
  record?: Record<string, string | null>; defaultAnimal?: string; isNew?: boolean;
}) {
  const v = record ?? {};
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="animal_id" label="Animal" required options={animals} defaultValue={v.animal_id ?? defaultAnimal} className="sm:col-span-2" />
        <Select name="visit_type" label="Visit type" required defaultValue={v.visit_type ?? "inspection"} placeholder={false} options={[
          ["inspection", "Farm inspection"], ["vaccination", "Vaccination"], ["treatment", "Treatment"], ["health_check", "Health check"], ["follow_up", "Follow-up"], ["purchase_assessment", "Purchase assessment"]]} />
        <Select name="status" label="Record status" required defaultValue={v.status ?? "completed"} placeholder={false} options={[
          ["scheduled", "Scheduled (reminder)"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["missed", "Missed"]]} />
        <Input name="scheduled_date" label="Scheduled date" type="date" defaultValue={v.scheduled_date} />
        <Input name="visit_date" label="Actual visit date" type="date" defaultValue={v.visit_date} />
        <Input name="performed_by" label="Veterinarian / inspector name" defaultValue={v.performed_by} />
        <Select name="employee_id" label="Herdvest employee" defaultValue={v.employee_id} options={employees} placeholder="Me / not applicable" />
        <Input name="location" label="Location" defaultValue={v.location} className="sm:col-span-2" />
        <Select name="condition" label="Animal condition" defaultValue={v.condition} options={[["excellent", "Excellent"], ["good", "Good"], ["fair", "Fair"], ["poor", "Poor"], ["critical", "Critical"]]} />
        <Input name="weight_kg" label="Weight (kg), if measured" inputMode="decimal" defaultValue={v.weight_kg} />
        <Input name="vaccine_name" label="Vaccine name" defaultValue={v.vaccine_name} hint="e.g. HS, FMD, BQ" />
        <Input name="vaccination_date" label="Vaccination date" type="date" defaultValue={v.vaccination_date} />
        <Input name="next_due_date" label="Next due date" type="date" defaultValue={v.next_due_date} hint="Creates a reminder on the dashboard" />
        <MoneyInput name="cost" label="Cost" defaultValue={v.cost} />
      </div>
      <Textarea name="findings" label="Inspection findings" defaultValue={v.findings} />
      <Textarea name="treatment" label="Treatment / medication" defaultValue={v.treatment} rows={2} />
      <Textarea name="follow_up" label="Recommended follow-up" defaultValue={v.follow_up} rows={2} />
      <Textarea name="notes" label="Staff notes" defaultValue={v.notes} rows={2} />
      {isNew && (
        <>
          <FileField name="photo" label="Photo, video or receipt" accept="image/*,video/*,application/pdf" capture="environment" hint="Optional · opens the camera on phones" />
          <Checkbox name="create_expense" label="Also submit the cost as an expense claim for approval" hint="Creates a separate expense awaiting approval — nothing is charged automatically." />
        </>
      )}
      <p className="text-xs text-ink-500">Reminders support scheduling only — they are not a substitute for professional veterinary advice.</p>
      <Submit>{isNew ? "Save record" : "Save changes"}</Submit>
    </ActionForm>
  );
}
