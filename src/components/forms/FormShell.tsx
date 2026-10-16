"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert, Unplug } from "lucide-react";
import { formDataToValues, validate, type FormErrors, type FormType } from "@/lib/forms";
import { site } from "@/config/site";
import { Button, Value } from "@/components/ui/primitives";
import { Honeypot } from "./fields";

type Status = "idle" | "submitting" | "success" | "not_configured" | "error";

/**
 * Shared submit / validation / status handling for all site forms.
 * Children receive the current field errors to render inline.
 */
export function FormShell({
  type,
  submitLabel,
  successTitle,
  successBody,
  children,
}: {
  type: FormType;
  submitLabel: string;
  successTitle: string;
  successBody: string;
  children: (errors: FormErrors) => ReactNode;
}) {
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = formDataToValues(new FormData(e.currentTarget));
    const found = validate(type, values);
    setErrors(found);

    if (Object.keys(found).length > 0) {
      setStatus("idle");
      // Move focus to the first invalid field.
      const first = Object.keys(found)[0];
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>(`[name="${first}"]`)
          ?.focus();
      });
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, values }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus("success");
        formRef.current?.reset();
      } else if (data.error === "not_configured") {
        setStatus("not_configured");
      } else if (data.error === "validation" && data.errors) {
        setErrors(data.errors);
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  if (status === "success") {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="rounded-2xl border border-emerald/30 bg-emerald-50 p-8 text-center outline-none">
        <CircleCheck aria-hidden className="mx-auto h-10 w-10 text-emerald" />
        <h3 className="mt-4 text-xl font-semibold text-forest">{successTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">{successBody}</p>
        <Button variant="outline" className="mt-6" onClick={() => setStatus("idle")}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="relative space-y-6" aria-busy={status === "submitting"}>
      <Honeypot />
      {children(errors)}

      {Object.keys(errors).length > 0 && (
        <p className="text-sm font-medium text-alert" role="alert">
          Please correct the highlighted fields and try again.
        </p>
      )}

      <div ref={statusRef} tabIndex={-1} className="outline-none" aria-live="polite">
        {status === "not_configured" && (
          <div className="flex gap-3 rounded-xl border border-gold/60 bg-gold-50 p-4 text-sm leading-relaxed text-charcoal">
            <Unplug aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            <div>
              <p className="font-semibold text-forest">Online submission is not yet connected.</p>
              <p className="mt-1">
                Your details were <strong>not</strong> sent. While we finish setting up, please
                contact us directly at <Value value={site.contact.email} /> or{" "}
                <Value value={site.contact.phone} />.
              </p>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="flex gap-3 rounded-xl border border-alert/30 bg-alert-50 p-4 text-sm leading-relaxed text-charcoal">
            <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-alert" />
            <div>
              <p className="font-semibold text-alert">Something went wrong.</p>
              <p className="mt-1">
                Your details may not have been sent. Please try again in a moment, or contact us
                directly.
              </p>
            </div>
          </div>
        )}
      </div>

      <Button type="submit" disabled={status === "submitting"} className="w-full sm:w-auto">
        {status === "submitting" ? (
          <>
            <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
