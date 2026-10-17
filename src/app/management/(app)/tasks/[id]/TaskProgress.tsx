"use client";

import { ActionForm, FileField, Input, Select, Submit, Textarea } from "@/components/erp/form";
import { updateTaskProgress } from "../actions";

export function TaskProgress({ id, status, findings, location, canAttach }: { id: string; status: string; findings: string | null; location: string | null; canAttach: boolean }) {
  return (
    <ActionForm action={updateTaskProgress.bind(null, id)}>
      <Select name="status" label="Status" placeholder={false} defaultValue={status}
        options={[["open", "Open"], ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]]} />
      <Textarea name="findings" label="Findings" defaultValue={findings} rows={4} placeholder="What did you observe? Animal condition, farm conditions, issues…" />
      <Input name="location_note" label="Visit location / notes" defaultValue={location} />
      {canAttach && <FileField name="file" label="Photo or video" accept="image/*,video/*" capture="environment" hint="Optional · opens the camera on phones" />}
      <Submit className="w-full sm:w-auto">Save progress</Submit>
    </ActionForm>
  );
}
