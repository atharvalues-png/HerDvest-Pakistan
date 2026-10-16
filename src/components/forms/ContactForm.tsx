"use client";

import Link from "next/link";
import { ConsentField, SelectField, TextArea, TextField } from "./fields";
import { FormShell } from "./FormShell";

const topics = [
  { value: "investing", label: "Livestock investment" },
  { value: "farming", label: "Farmer partnership" },
  { value: "services", label: "Our services" },
  { value: "media", label: "Media or partnership" },
  { value: "other", label: "Something else" },
];

export function ContactForm() {
  return (
    <FormShell
      type="contact"
      submitLabel="Send Message"
      successTitle="Thank you — your message has been received."
      successBody="We'll get back to you as soon as we can."
    >
      {(errors) => (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField name="name" label="Full name" required autoComplete="name" error={errors.name} />
            <TextField name="email" type="email" label="Email address" required autoComplete="email" error={errors.email} />
            <TextField name="phone" type="tel" label="Phone number" autoComplete="tel" inputMode="tel" error={errors.phone} />
            <SelectField name="subject" label="Topic" required options={topics} error={errors.subject} />
          </div>
          <TextArea name="message" label="Message" required rows={6} error={errors.message} />
          <ConsentField name="consent" error={errors.consent}>
            I consent to Herdvest Pakistan contacting me about my message. See our{" "}
            <Link href="/legal/privacy" className="font-semibold text-emerald underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </ConsentField>
        </>
      )}
    </FormShell>
  );
}
