"use client";

import { ActionForm, Input, Submit, Textarea } from "@/components/erp/form";
import { submitManualIntake } from "./actions";

export function ManualIntakeForm() {
  return (
    <ActionForm action={submitManualIntake}>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Input name="sender" label="From (name / number / email)" placeholder="e.g. Field inspector Ali, 0300…" />
        <div>
          <label className="text-xs font-semibold text-forest" htmlFor="intake-files">Attachments</label>
          <input id="intake-files" name="files" type="file" multiple accept="image/*,application/pdf,video/*"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ivory" />
        </div>
      </div>
      <Textarea name="body" label="Message" required rows={3}
        placeholder="Animal HV-001, farm inspection completed today. Animal healthy. Vaccination receipt attached. Expense PKR 2,500." />
      <Submit>Process message</Submit>
    </ActionForm>
  );
}
