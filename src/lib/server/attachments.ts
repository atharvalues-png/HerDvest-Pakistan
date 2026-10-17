import "server-only";
import type { Db } from "./db";
import { deleteObject, fileRules, putObject, sniffMime } from "./storage";

/**
 * Saves a file submitted with a server-action form and links it to a record,
 * in the caller's transaction (RLS applies). Returns null when no file was
 * chosen. Throws a user-facing message for invalid files.
 */
export async function saveFormFile(db: Db, file: FormDataEntryValue | null, entityType: string, entityId: string, category: string) {
  if (!(file instanceof File) || file.size === 0) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime) throw Object.assign(new Error("Unsupported file type. Use JPG, PNG, WebP, HEIC, PDF, MP4, MOV or WebM."), { code: "P0001" });
  if (buf.length > fileRules[mime].max) throw Object.assign(new Error("The file is too large."), { code: "P0001" });
  const stored = await putObject(buf);
  try {
    await db.query("savepoint attach");
    const r = await db.query(
      `insert into hv.attachments (entity_type, entity_id, category, original_name, mime_type, size_bytes, storage_key, sha256)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [entityType, entityId, category, file.name.slice(0, 200) || "upload", mime, buf.length, stored.key, stored.sha256],
    );
    await db.query("release savepoint attach");
    return r.rows[0].id as string;
  } catch (err) {
    await db.query("rollback to savepoint attach").catch(() => {});
    await deleteObject(stored.key);
    throw err;
  }
}
