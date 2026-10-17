"use client";

import { useRouter } from "next/navigation";
import { ActionForm, Input, Submit } from "@/components/erp/form";
import { changePassword } from "../../auth-actions";

export function ChangePasswordForm() {
  const router = useRouter();
  return (
    <ActionForm action={changePassword} resetOnSuccess onSuccess={() => router.refresh()}>
      <Input name="current" label="Current password" type="password" autoComplete="current-password" required />
      <Input name="next" label="New password" type="password" autoComplete="new-password" required hint="At least 12 characters, with letters and numbers." />
      <Input name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
      <Submit>Change password</Submit>
    </ActionForm>
  );
}
