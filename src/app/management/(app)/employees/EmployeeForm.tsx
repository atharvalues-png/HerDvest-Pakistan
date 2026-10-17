"use client";

import { ActionForm, Input, Select, Submit, Textarea } from "@/components/erp/form";
import type { ActionState } from "@/lib/erp/action";

export function EmployeeForm({ action, employee }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; employee?: Record<string, string | null> }) {
  const v = employee ?? {};
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="full_name" label="Full name" required defaultValue={v.full_name} />
        <Input name="job_title" label="Job role" defaultValue={v.job_title} />
        <Input name="phone" label="Phone" type="tel" defaultValue={v.phone} />
        <Input name="email" label="Email" type="email" defaultValue={v.email} />
        <Input name="department" label="Department" defaultValue={v.department} />
        <Select name="status" label="Employment status" placeholder={false} defaultValue={v.status ?? "active"} options={[["active", "Active"], ["on_leave", "On leave"], ["inactive", "Inactive"], ["terminated", "Terminated"]]} />
        <Input name="joining_date" label="Joining date" type="date" defaultValue={v.joining_date} />
      </div>
      <Textarea name="assigned_areas" label="Assigned locations / districts / farmers" defaultValue={v.assigned_areas} rows={2} />
      <Textarea name="notes" label="Notes" defaultValue={v.notes} rows={2} />
      <Submit>{employee ? "Save" : "Create employee"}</Submit>
    </ActionForm>
  );
}
