"use client";

import { ActionForm, Input, Select, Submit, Textarea } from "@/components/erp/form";
import type { ActionState } from "@/lib/erp/action";

type Investor = Record<string, string | null>;

export function InvestorForm({ action, investor }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; investor?: Investor }) {
  const v = investor ?? {};
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="full_legal_name" label="Full legal name" required defaultValue={v.full_legal_name} className="sm:col-span-2" />
        <Input name="phone" label="Contact number" type="tel" defaultValue={v.phone} />
        <Input name="email" label="Email address" type="email" defaultValue={v.email} />
        <Input name="address" label="Address" defaultValue={v.address} className="sm:col-span-2" />
        <Input name="city" label="City" defaultValue={v.city} />
        <Input name="country" label="Country" defaultValue={v.country ?? "Pakistan"} />
        <Select name="status" label="Investor status" defaultValue={v.status ?? "prospective"} placeholder={false}
          options={[["prospective", "Prospective"], ["active", "Active"], ["dormant", "Dormant"], ["exited", "Exited"], ["suspended", "Suspended"]]} />
        <Input name="registered_on" label="Registration date" type="date" defaultValue={v.registered_on} />
        <Select name="contact_preference" label="Preferred contact method" defaultValue={v.contact_preference}
          options={[["phone", "Phone"], ["email", "Email"], ["whatsapp", "WhatsApp"], ["any", "Any"]]} />
        <Input name="communication_notes" label="Communication preferences" defaultValue={v.communication_notes} hint="e.g. time zone, best hours" />
        <Textarea name="notes" label="Authorised notes" defaultValue={v.notes} className="sm:col-span-2"
          hint="Store only what is necessary. Do not record bank or card numbers here." />
      </div>
      <Submit>{investor ? "Save changes" : "Create investor"}</Submit>
    </ActionForm>
  );
}
