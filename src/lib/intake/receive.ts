import "server-only";
import { anonymous, type Db } from "@/lib/server/db";
import { deleteObject, fileRules, putObject, sniffMime } from "@/lib/server/storage";
import { parseMessage } from "./parse";

export type IncomingFile = { name: string; data: Buffer };

/**
 * Common intake pipeline used by the email and WhatsApp webhooks and by the
 * manual intake form: parse → match animal → store as a draft for review
 * (with duplicate detection). Nothing is posted to business records here.
 */
export async function receiveIntake(input: {
  source: "email" | "whatsapp" | "manual" | "api";
  sender: string | null;
  subject?: string | null;
  body: string;
  externalId?: string | null;
  receivedAt?: Date;
  files?: IncomingFile[];
  db?: Db; // reviewer's transaction for manual intake; anonymous otherwise
}) {
  const parsed = parseMessage(input.body, input.receivedAt ?? new Date());
  const allowed = (process.env.INTAKE_ALLOWED_SENDERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (input.source !== "manual" && allowed.length && !allowed.includes((input.sender ?? "").toLowerCase())) {
    parsed.issues.unshift(`Sender ${input.sender ?? "unknown"} is not on the approved sender list.`);
  }

  const run = async (db: Db) => {
    let animalId: string | null = null;
    if (parsed.extracted.animalRefs.length === 1) {
      animalId = (await db.query("select hv.intake_find_animal($1) id", [parsed.extracted.animalRefs[0]])).rows[0].id;
      if (!animalId) parsed.issues.unshift(`Animal ${parsed.extracted.animalRefs[0]} was not found in the system.`);
    }
    const r = await db.query("select * from hv.intake_receive($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
      input.source, input.sender, input.subject ?? null, input.body, input.externalId ?? null, input.receivedAt ?? new Date(),
      parsed.detected, JSON.stringify(parsed.extracted), parsed.issues, animalId,
    ]);
    const { id, duplicate } = r.rows[0] as { id: string; duplicate: boolean };
    if (!duplicate) {
      for (const f of input.files ?? []) {
        const mime = sniffMime(f.data);
        if (!mime || f.data.length > fileRules[mime].max) continue;
        const stored = await putObject(f.data);
        try {
          await db.query("select hv.intake_add_attachment($1,$2,$3,$4,$5,$6)", [id, f.name, mime, f.data.length, stored.key, stored.sha256]);
        } catch (e) {
          await deleteObject(stored.key);
          throw e;
        }
      }
    }
    return { id, duplicate, parsed };
  };
  return input.db ? run(input.db) : anonymous(run);
}
