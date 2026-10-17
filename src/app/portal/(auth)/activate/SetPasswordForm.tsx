"use client";

import { ActionForm, Input, Submit } from "@/components/erp/form";
import { completeTokenPassword } from "../../auth-actions";

export function SetPasswordForm({ token, label }: { token: string; label: string }) {
  return (
    <ActionForm action={completeTokenPassword.bind(null, token)}>
      <Input name="password" label="New password" type="password" autoComplete="new-password" required
        hint="At least 12 characters, with letters and numbers. Do not reuse a password from another site." />
      <Input name="confirm" label="Confirm password" type="password" autoComplete="new-password" required />
      <Submit className="w-full" pendingLabel="Saving…">{label}</Submit>
    </ActionForm>
  );
}
