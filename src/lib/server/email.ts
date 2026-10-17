import "server-only";
import type { Db } from "./db";

/**
 * Transactional email through Resend (https://resend.com). Not active until
 * RESEND_API_KEY and PORTAL_FROM_EMAIL (a verified sender) are set. Callers
 * must tell the user honestly when email is not configured.
 */
export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && (process.env.PORTAL_FROM_EMAIL || process.env.ENQUIRY_FROM_EMAIL));
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.PORTAL_FROM_EMAIL || process.env.ENQUIRY_FROM_EMAIL, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("[email] Resend returned", res.status);
    return res.ok;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}

/**
 * Emails pending investor notifications (only for active portal accounts).
 * Runs after a staff action that published something. Email bodies contain no
 * financial figures — only a prompt to sign in.
 */
export async function deliverNotificationEmails(db: Db, baseUrl: string) {
  const queue = (await db.query("select * from hv.notification_email_queue()")).rows;
  for (const n of queue) {
    if (!isEmailConfigured()) {
      await db.query("select hv.notification_email_mark($1, 'not_configured')", [n.id]);
      continue;
    }
    const ok = await sendEmail(
      n.email,
      `Herdvest Pakistan: ${n.title}`,
      `Dear ${n.investor_name},\n\n${n.title}.\n\nSign in to your investor portal to view it:\n${baseUrl}${n.link ?? "/portal"}\n\n` +
        `Herdvest Pakistan never asks for your password by email. If you did not expect this message, contact us.`,
    );
    await db.query("select hv.notification_email_mark($1, $2)", [n.id, ok ? "sent" : "failed"]);
  }
}
