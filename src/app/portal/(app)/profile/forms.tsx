"use client";

import { ActionForm, Input, Select, Submit, Textarea } from "@/components/erp/form";
import { changePortalPassword, confirmMfaSetup, disableMfa, requestCorrection, startMfaSetup } from "../../auth-actions";

export function CorrectionForm() {
  return (
    <ActionForm action={requestCorrection} resetOnSuccess>
      <Select name="field" label="What needs correcting?" required options={[
        ["full_legal_name", "Full legal name"], ["phone", "Phone number"], ["email", "Email address"], ["address", "Address"],
        ["city", "City"], ["country", "Country"], ["contact_preference", "Preferred contact method"], ["national_id", "National identity number"], ["other", "Something else"],
      ]} />
      <Input name="requested_value" label="Correct details" hint="Do not type your full CNIC here — Herdvest will verify it with you directly." />
      <Textarea name="message" label="Message (optional)" rows={2} />
      <Submit pendingLabel="Sending…">Send request</Submit>
    </ActionForm>
  );
}

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePortalPassword} resetOnSuccess>
      <Input name="current" label="Current password" type="password" autoComplete="current-password" required />
      <Input name="next" label="New password" type="password" autoComplete="new-password" required hint="At least 12 characters, with letters and numbers." />
      <Input name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
      <Submit pendingLabel="Saving…">Change password</Submit>
    </ActionForm>
  );
}

export function MfaStartForm() {
  return (
    <ActionForm action={startMfaSetup} successMessage={false}>
      <Submit variant="secondary" pendingLabel="Preparing…">Set up two-step verification</Submit>
    </ActionForm>
  );
}

export function MfaConfirmForm() {
  return (
    <ActionForm action={confirmMfaSetup}>
      <Input name="code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" required />
      <Submit pendingLabel="Checking…">Turn on</Submit>
    </ActionForm>
  );
}

export function MfaDisableForm() {
  return (
    <ActionForm action={disableMfa}>
      <Input name="code" label="Current code to confirm" inputMode="numeric" autoComplete="one-time-code" required />
      <Submit variant="secondary" pendingLabel="Turning off…">Turn off two-step verification</Submit>
    </ActionForm>
  );
}
