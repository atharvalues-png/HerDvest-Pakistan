import { getPortalSession } from "@/lib/auth/portal-session";
import { withInvestor } from "@/lib/server/db";
import { getObject } from "@/lib/server/storage";

export const runtime = "nodejs";

/**
 * Investor file download. hv.portal_file() returns the file only if it is
 * published, not sensitive, and belongs to the investor of THIS session — the
 * id in the URL is never enough on its own. Access is written to the audit log.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getPortalSession();
  if (!s || !s.mfaPassed) return new Response("Not signed in", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const row = await withInvestor(s.sessionHash, async (db) => (await db.query("select * from hv.portal_file($1)", [id])).rows[0]);
  if (!row) return new Response("Not found", { status: 404 });

  const data = await getObject(row.storage_key).catch(() => null);
  if (!data) return new Response("File unavailable", { status: 410 });
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
