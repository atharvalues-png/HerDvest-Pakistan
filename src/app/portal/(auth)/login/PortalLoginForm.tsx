"use client";

import { ActionForm, Hidden, Input, Submit } from "@/components/erp/form";
import { portalLogin } from "../../auth-actions";

export function PortalLoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={portalLogin}>
      <Hidden name="next" value={next} />
      <Input name="email" label="Email" type="email" autoComplete="username" required />
      <Input name="password" label="Password" type="password" autoComplete="current-password" required />
      <Submit className="w-full" pendingLabel="Signing in…">Sign in</Submit>
    </ActionForm>
  );
}
