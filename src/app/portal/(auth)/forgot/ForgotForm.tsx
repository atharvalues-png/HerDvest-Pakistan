"use client";

import { ActionForm, Input, Submit } from "@/components/erp/form";
import { requestPasswordReset } from "../../auth-actions";

export function ForgotForm() {
  return (
    <ActionForm action={requestPasswordReset} resetOnSuccess>
      <Input name="email" label="Email you sign in with" type="email" autoComplete="username" required />
      <Submit className="w-full" pendingLabel="Sending…">Send reset link</Submit>
    </ActionForm>
  );
}
