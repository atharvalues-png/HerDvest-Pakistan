import { NextResponse } from "next/server";
import { validate, type FormType, type FormValues } from "@/lib/forms";

/**
 * Receives enquiry, farmer-application and contact form submissions.
 *
 * ─── LAUNCH CONFIGURATION REQUIRED ───────────────────────────────────────────
 * Set FORM_WEBHOOK_URL (server-side env var, never NEXT_PUBLIC_) to an endpoint
 * that stores or forwards submissions — e.g. a CRM webhook, a form service
 * (Formspree, Basin), or an email-sending function. Optionally set
 * FORM_WEBHOOK_SECRET; it is sent as a Bearer token.
 *
 * Until it is configured, this route returns 503 and the site tells visitors
 * honestly that online submission is not yet available. It never pretends to
 * have received a submission.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TYPES: FormType[] = ["investor", "farmer", "contact"];

export async function POST(request: Request) {
  let body: { type?: string; values?: FormValues };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const type = body.type as FormType;
  const values = body.values ?? {};
  if (!TYPES.includes(type)) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  // Honeypot: silently accept and drop obvious bot submissions.
  if (typeof values.company_website === "string" && values.company_website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const errors = validate(type, values);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, error: "validation", errors }, { status: 422 });
  }

  const webhook = process.env.FORM_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.FORM_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.FORM_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ type, values, submittedAt: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[enquiry] delivery failed", err);
    return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
  }
}
