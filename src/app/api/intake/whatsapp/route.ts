import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/server/db";
import { receiveIntake, type IncomingFile } from "@/lib/intake/receive";

export const runtime = "nodejs";

/**
 * WhatsApp Business Platform (Cloud API) webhook → intake review queue.
 *
 * NOT ACTIVE until configured and verified with Meta:
 *   WHATSAPP_VERIFY_TOKEN   — the token entered in the Meta app's webhook settings
 *   WHATSAPP_APP_SECRET     — used to verify X-Hub-Signature-256 on every POST
 *   WHATSAPP_ACCESS_TOKEN   — optional; needed to download photos/documents
 * This handler follows Meta's documented payload format but has not been
 * tested against a live WhatsApp account in this environment.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === token) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string };
  document?: { id: string; caption?: string; filename?: string };
  video?: { id: string; caption?: string };
};

async function downloadMedia(mediaId: string): Promise<Buffer | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return null;
  const meta = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!meta.ok) return null;
  const { url } = (await meta.json()) as { url?: string };
  if (!url) return null;
  const file = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!file.ok) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.length <= 25 * 1024 * 1024 ? buf : null;
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !isDatabaseConfigured()) return NextResponse.json({ error: "WhatsApp intake is not configured" }, { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { entry?: Array<{ changes?: Array<{ value?: { messages?: WaMessage[] } }> }> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const messages = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];
  let queued = 0;
  for (const m of messages.slice(0, 20)) {
    const media = m.image ?? m.document ?? m.video;
    const text = m.text?.body ?? media?.caption ?? "";
    const files: IncomingFile[] = [];
    let note = "";
    if (media) {
      const data = await downloadMedia(media.id).catch(() => null);
      if (data) files.push({ name: m.document?.filename ?? `${m.type}-${media.id}`, data });
      else note = `\n[${m.type} attachment ${media.id} not downloaded — WHATSAPP_ACCESS_TOKEN not configured or download failed]`;
    }
    if (!text && !files.length && !note) continue;
    await receiveIntake({
      source: "whatsapp",
      sender: m.from,
      body: `${text}${note}`.slice(0, 20_000),
      externalId: m.id,
      receivedAt: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
      files,
    });
    queued++;
  }
  // Always 200 so Meta does not retry valid-but-ignored events (status updates etc.)
  return NextResponse.json({ queued });
}
