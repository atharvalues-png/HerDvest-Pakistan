"use client";

import { ActionForm, Hidden, Input, Submit } from "@/components/erp/form";
import { portalVerify } from "../../auth-actions";

export function VerifyForm({ next }: { next: string }) {
  return (
    <ActionForm action={portalVerify}>
      <Hidden name="next" value={next} />
      <Input name="code" label="Verification code" inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" />
      <Submit className="w-full" pendingLabel="Checking…">Verify</Submit>
    </ActionForm>
  );
}
