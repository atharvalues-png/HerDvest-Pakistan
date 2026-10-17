"use client";

import { ActionForm, Hidden, Input, Submit } from "@/components/erp/form";
import { login } from "../auth-actions";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={login}>
      <Hidden name="next" value={next} />
      <Input name="email" label="Email" type="email" autoComplete="username" required />
      <Input name="password" label="Password" type="password" autoComplete="current-password" required />
      <Submit className="w-full" pendingLabel="Signing in…">
        Sign in
      </Submit>
    </ActionForm>
  );
}
