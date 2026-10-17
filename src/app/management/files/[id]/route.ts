import { getSessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getObject } from "@/lib/server/storage";

export const runtime = "nodejs";

/**
 * Authenticated download. The attachment row is read through RLS as the
 * signed-in user, so a file is only served if the user may see both the file
 * (sensitive files need files.sensitive) and its parent record. There are no
 * public or guessable file URLs.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const row = await withUser(user.id, async (db) => {
    const r = await db.query(
      "select original_name, mime_type, storage_key, sensitive from hv.attachments where id = $1 and deleted_at is null",
      [id],
    );
    if (r.rows[0]?.sensitive) await db.query("select hv.audit_event('VIEW_FILE', 'attachments', $1, 'sensitive file viewed')", [id]);
    return r.rows[0];
  });
  if (!row) return new Response("Not found", { status: 404 });

  const data = await getObject(row.storage_key).catch(() => null);
  if (!data) return new Response("File missing from storage", { status: 410 });
  const inline = row.mime_type.startsWith("image/") || row.mime_type === "application/pdf" || row.mime_type.startsWith("video/");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
