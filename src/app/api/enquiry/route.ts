import { NextResponse } from "next/server";
import { validate, type FormType, type FormValues } from "@/lib/forms";
import { anonymous, isDatabaseConfigured } from "@/lib/server/db";

/**
 * Receives the public website's investor-enquiry, farmer-application and
 * contact forms.
 *
 * Delivery (configure at least one before launch):
 *   1. DATABASE_URL       → stored in the internal enquiry queue (/management/enquiries)
 *   2. FORM_WEBHOOK_URL   → optional forward to a CRM / form service (FORM_WEBHOOK_SECRET as Bearer)
 *   3. RESEND_API_KEY + ENQUIRY_NOTIFY_EMAIL + ENQUIRY_FROM_EMAIL → optional email alert
 *
 * A visitor only sees "received" when the enquiry was actually stored or
 * forwarded. If nothing is configured the route returns 503 and the site says
 * so honestly.
 */

const TYPES: FormType[] = ["investor", "farmer", "contact"];
const s = (v: FormValues[string] | undefined) => (Array.isArray(v) ? v.join(", ") : (v ?? "")).trim();

async function storeInDatabase(type: FormType, values: FormValues) {
  const details: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!["name", "email", "phone", "location", "budget", "horizon", "subject", "message", "company_website"].includes(k)) details[k] = v;
  }
  return anonymous(async (db) => {
    const r = await db.query("select hv.submit_enquiry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) code", [
      type, s(values.name), s(values.email) || null, s(values.phone) || null,
      type === "farmer" ? s(values.cityDistrict) : s(values.location) || null,
      s(values.budget) || null, s(values.horizon) || null, s(values.subject) || null,
      type === "farmer" ? s(values.farmDescription) : s(values.message) || null, JSON.stringify(details),
    ]);
    return r.rows[0].code as string;
  });
}

async function forwardToWebhook(type: FormType, values: FormValues) {
  const url = process.env.FORM_WEBHOOK_URL;
  if (!url) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.FORM_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.FORM_WEBHOOK_SECRET}` } : {}) },
    body: JSON.stringify({ type, values, submittedAt: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
  return true;
}

async function notifyByEmail(type: FormType, values: FormValues, code: string | null) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ENQUIRY_NOTIFY_EMAIL;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!key || !to || !from) return false;
  const lines = Object.entries(values).filter(([k]) => !["consent", "company_website"].includes(k)).map(([k, v]) => `${k}: ${s(v)}`);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [to], subject: `New ${type} enquiry${code ? ` ${code}` : ""} — Herdvest website`,
      text: `${lines.join("\n")}\n\n${code ? `Open in the management system: /management/enquiries (${code})` : "Not stored in the database (DATABASE_URL not configured)."}`,
    }),
  });
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
  return true;
}

export async function POST(request: Request) {
  let body: { type?: string; values?: FormValues };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const type = body.type as FormType;
  const values = body.values ?? {};
  if (!TYPES.includes(type)) return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });

  // Honeypot: silently accept and drop obvious bot submissions.
  if (typeof values.company_website === "string" && values.company_website.trim() !== "") return NextResponse.json({ ok: true });

  const errors = validate(type, values);
  if (Object.keys(errors).length > 0) return NextResponse.json({ ok: false, error: "validation", errors }, { status: 422 });

  const anyChannel = isDatabaseConfigured() || process.env.FORM_WEBHOOK_URL;
  if (!anyChannel) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  let delivered = false;
  let code: string | null = null;
  try {
    if (isDatabaseConfigured()) {
      code = await storeInDatabase(type, values);
      delivered = true;
    }
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("rate_limited")) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    console.error("[enquiry] database store failed", err);
  }
  try {
    if (await forwardToWebhook(type, values)) delivered = true;
  } catch (err) {
    console.error("[enquiry] webhook failed", err);
  }
  if (!delivered) return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
  // Email is a notification only; the enquiry is already safely stored.
  await notifyByEmail(type, values, code).catch((err) => console.error("[enquiry] email notification failed", err));
  return NextResponse.json({ ok: true, reference: code });
}
