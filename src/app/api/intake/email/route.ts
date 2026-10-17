import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/server/db";
import { receiveIntake, type IncomingFile } from "@/lib/intake/receive";

export const runtime = "nodejs";

/**
 * Inbound-email webhook → intake review queue.
 *
 * NOT ACTIVE until configured: set INTAKE_WEBHOOK_SECRET and point an inbound
 * email provider (e.g. Postmark, Mailgun, SendGrid Inbound Parse, or a
 * forwarding function) at POST /api/intake/email with header
 *   Authorization: Bearer <INTAKE_WEBHOOK_SECRET>
 * Accepted JSON shapes: Postmark inbound ({From, Subject, TextBody, MessageID,
 * Attachments:[{Name, Content(base64)}]}) or a generic
 * {from, subject, text, messageId, attachments:[{filename, content(base64)}]}.
 */
export async function POST(req: Request) {
  const secret = process.env.INTAKE_WEBHOOK_SECRET;
  if (!secret || !isDatabaseConfigured()) return NextResponse.json({ error: "Email intake is not configured" }, { status: 503 });
  const auth = req.headers.get("authorization") ?? "";
  const given = Buffer.from(auth.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 30 * 1024 * 1024) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const str = (...keys: string[]) => keys.map((k) => p[k]).find((v) => typeof v === "string") as string | undefined;
  const body = str("TextBody", "text", "body", "plain") ?? "";
  if (!body.trim()) return NextResponse.json({ error: "Empty message body" }, { status: 400 });

  const atts = (Array.isArray(p.Attachments) ? p.Attachments : Array.isArray(p.attachments) ? p.attachments : []) as Array<Record<string, string>>;
  const files: IncomingFile[] = atts.slice(0, 10).flatMap((a) => {
    const content = a.Content ?? a.content;
    return content ? [{ name: a.Name ?? a.filename ?? "attachment", data: Buffer.from(content, "base64") }] : [];
  });

  const res = await receiveIntake({
    source: "email",
    sender: str("From", "from", "sender") ?? null,
    subject: str("Subject", "subject") ?? null,
    body: body.slice(0, 20_000),
    externalId: str("MessageID", "messageId", "message_id") ?? null,
    files,
  });
  return NextResponse.json({ id: res.id, duplicate: res.duplicate, status: "queued_for_review" });
}
