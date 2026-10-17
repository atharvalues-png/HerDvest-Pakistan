"use client";

import { ActionForm, Input, Select, Submit, Textarea } from "@/components/erp/form";
import type { ActionState } from "@/lib/erp/action";

const TYPES = ["Cattle", "Buffalo", "Goats", "Sheep", "Mixed", "Other"];

export function FarmerForm({ action, farmer }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; farmer?: Record<string, unknown> }) {
  const v = (farmer ?? {}) as Record<string, string | null>;
  const types = (farmer?.livestock_types as string[] | undefined) ?? [];
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="full_name" label="Full name" required defaultValue={v.full_name} />
        <Input name="phone" label="Contact number" type="tel" defaultValue={v.phone} />
        <Input name="address" label="Address" defaultValue={v.address} className="sm:col-span-2" />
        <Input name="district" label="District" defaultValue={v.district} />
        <Input name="city" label="City / tehsil" defaultValue={v.city} />
        <Input name="farm_location" label="Farm location" defaultValue={v.farm_location} className="sm:col-span-2" />
        <Input name="experience_years" label="Livestock experience (years)" inputMode="decimal" defaultValue={v.experience_years} />
        <Input name="capacity" label="Farm capacity (animals)" inputMode="numeric" defaultValue={v.capacity} />
      </div>
      <fieldset>
        <legend className="text-xs font-semibold text-forest">Livestock types managed</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="livestock_types" value={t} defaultChecked={types.includes(t)} className="accent-emerald" />{t}</label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="agreement_status" label="Agreement status" placeholder={false} defaultValue={v.agreement_status ?? "none"}
          options={[["none", "None"], ["draft", "Draft"], ["signed", "Signed"], ["expired", "Expired"], ["terminated", "Terminated"]]} />
        <Select name="background_check_status" label="Background check (lawful & consented only)" placeholder={false} defaultValue={v.background_check_status ?? "not_started"}
          options={[["not_started", "Not started"], ["consent_pending", "Consent pending"], ["in_progress", "In progress"], ["clear", "Clear"], ["concerns_noted", "Concerns noted"], ["not_required", "Not required"]]} />
      </div>
      <Textarea name="references_text" label="References" defaultValue={v.references_text} rows={2} />
      <Textarea name="verification_notes" label="Verification notes" defaultValue={v.verification_notes} rows={2} />
      <Textarea name="notes" label="Notes" defaultValue={v.notes} rows={2} />
      <p className="text-xs text-ink-500">Verification status is changed separately through the verification workflow — a new record is never marked verified automatically.</p>
      <Submit>{farmer ? "Save changes" : "Create farmer"}</Submit>
    </ActionForm>
  );
}
