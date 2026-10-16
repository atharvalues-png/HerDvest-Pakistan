"use client";

import Link from "next/link";
import { livestockTypes } from "@/config/business";
import { Notice } from "@/components/ui/primitives";
import { CheckboxGroup, ConsentField, SelectField, TextArea, TextField } from "./fields";
import { FormShell } from "./FormShell";

const experienceOptions = [
  { value: "<2", label: "Less than 2 years" },
  { value: "2-5", label: "2–5 years" },
  { value: "5-10", label: "5–10 years" },
  { value: "10+", label: "More than 10 years" },
];

export function FarmerApplicationForm() {
  return (
    <div>
      <Notice className="mb-8">
        Applying does not guarantee allocation of livestock or any income. Verification may include
        identity, address, farm and reference checks, carried out only with your consent.
      </Notice>
      <FormShell
        type="farmer"
        submitLabel="Submit Application"
        successTitle="Thank you — your application has been received."
        successBody="Our team will contact you to discuss your farm and experience, and to explain the verification process."
      >
        {(errors) => (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField name="name" label="Full name" required autoComplete="name" error={errors.name} />
              <TextField name="phone" type="tel" label="Phone number" required autoComplete="tel" inputMode="tel" placeholder="0300 1234567" error={errors.phone} />
              <TextField name="cityDistrict" label="City and district" required placeholder="e.g. Sahiwal, Sahiwal District" error={errors.cityDistrict} />
              <TextField name="farmLocation" label="Farm location" required placeholder="Village / nearest town" error={errors.farmLocation} />
              <SelectField name="experience" label="Livestock experience" required options={experienceOptions} error={errors.experience} />
              <TextField
                name="capacity"
                label="Current livestock capacity"
                required
                placeholder="e.g. 10 cattle, 20 goats"
                hint="How many additional animals could you care for?"
                error={errors.capacity}
              />
            </div>
            <CheckboxGroup name="livestockTypes" legend="Type of livestock managed" required options={livestockTypes} error={errors.livestockTypes} />
            <TextArea
              name="farmDescription"
              label="Brief description of your farm"
              required
              rows={5}
              placeholder="Shelter, water and fodder access, land, family members who help, nearest veterinary services…"
              error={errors.farmDescription}
            />
            <ConsentField name="consent" error={errors.consent}>
              I consent to Herdvest Pakistan contacting me and, if I proceed, carrying out lawful
              verification checks on my identity, address, farm and references. See our{" "}
              <Link href="/legal/privacy" className="font-semibold text-emerald underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </ConsentField>
          </>
        )}
      </FormShell>
    </div>
  );
}
