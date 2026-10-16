"use client";

import Link from "next/link";
import { budgetOptions, horizonOptions } from "@/config/business";
import { Notice } from "@/components/ui/primitives";
import { ConsentField, SelectField, TextArea, TextField } from "./fields";
import { FormShell } from "./FormShell";

export function InvestorEnquiryForm() {
  return (
    <div>
      <Notice tone="warning" title="This is an enquiry, not an investment order" className="mb-8">
        Submitting this form does not create an investment, an offer or a contract, and no payment
        is requested. Please do not include bank details, card numbers or identity documents.
      </Notice>
      <FormShell
        type="investor"
        submitLabel="Submit Enquiry"
        successTitle="Thank you — your enquiry has been received."
        successBody="A member of our team will contact you to discuss the model, the proposed agreement and the risks. This does not create any commitment."
      >
        {(errors) => (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField name="name" label="Full name" required autoComplete="name" error={errors.name} className="sm:col-span-2" />
              <TextField name="email" type="email" label="Email address" required autoComplete="email" error={errors.email} />
              <TextField name="phone" type="tel" label="Phone number" required autoComplete="tel" inputMode="tel" placeholder="+92 300 1234567" error={errors.phone} />
              <TextField
                name="location"
                label="City or country of residence"
                required
                autoComplete="address-level2"
                placeholder="e.g. Lahore, or Dubai, UAE"
                error={errors.location}
                className="sm:col-span-2"
              />
              <SelectField
                name="budget"
                label="Indicative budget (PKR)"
                required
                options={budgetOptions}
                hint="A preference only — not a minimum investment."
                error={errors.budget}
              />
              <SelectField name="horizon" label="Preferred investment horizon" required options={horizonOptions} error={errors.horizon} />
            </div>
            <TextArea name="message" label="Message or questions" rows={5} placeholder="Anything you'd like us to cover — fees, reporting, the agreement, risks…" error={errors.message} />
            <ConsentField name="consent" error={errors.consent}>
              I consent to Herdvest Pakistan contacting me about this enquiry by phone, email or
              WhatsApp. I understand this enquiry is not an investment or contract. See our{" "}
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
