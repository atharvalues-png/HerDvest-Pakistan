import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { friendlyDbError, withUser } from "@/lib/server/db";
import { attachmentCategories, deleteObject, entityTypes, fileRules, putObject, sniffMime } from "@/lib/server/storage";

export const runtime = "nodejs";

/** Authenticated upload. Permission and parent-record access are enforced by RLS on insert. */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Cross-site upload rejected" }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.permissions.has("files.upload")) return NextResponse.json({ error: "You don't have permission to upload files" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const entityType = String(form?.get("entityType") ?? "");
  const entityId = String(form?.get("entityId") ?? "");
  const category = String(form?.get("category") ?? "other");
  const caption = String(form?.get("caption") ?? "").slice(0, 300) || null;

  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });
  if (!entityTypes.includes(entityType as (typeof entityTypes)[number]) || !/^[0-9a-f-]{36}$/i.test(entityId)) {
    return NextResponse.json({ error: "Invalid record reference" }, { status: 400 });
  }
  if (!attachmentCategories.some(([c]) => c === category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  if (file.size > 200 * 1024 * 1024) return NextResponse.json({ error: "File is larger than 200 MB" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime) return NextResponse.json({ error: "Unsupported file type. Use JPG, PNG, WebP, HEIC, PDF, MP4, MOV or WebM." }, { status: 415 });
  if (buf.length > fileRules[mime].max) {
    return NextResponse.json({ error: `This ${fileRules[mime].kind} exceeds the ${fileRules[mime].max / 1024 / 1024} MB limit` }, { status: 413 });
  }
  const sensitive = category === "identity_document" || category === "verification_document";
  if (sensitive && !user.permissions.has("files.sensitive")) {
    return NextResponse.json({ error: "You don't have permission to upload sensitive documents" }, { status: 403 });
  }

  const stored = await putObject(buf);
  try {
    const id = await withUser(user.id, async (db) => {
      const r = await db.query(
        `insert into hv.attachments (entity_type, entity_id, category, sensitive, original_name, mime_type, size_bytes, storage_key, sha256, caption)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
        [entityType, entityId, category, sensitive, file.name.slice(0, 200) || "upload", mime, buf.length, stored.key, stored.sha256, caption],
      );
      return r.rows[0].id as string;
    });
    return NextResponse.json({ id });
  } catch (err) {
    await deleteObject(stored.key); // no orphaned files
    const msg = friendlyDbError(err);
    return NextResponse.json({ error: msg.includes("permission") || msg.includes("row-level") ? "You can't attach files to this record" : msg }, { status: 403 });
  }
}
