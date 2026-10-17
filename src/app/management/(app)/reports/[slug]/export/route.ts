import { getSessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { filterParams, readFilters, reportBySlug } from "@/lib/erp/reports";

export const runtime = "nodejs";

const esc = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  // neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV export. Permission-checked, runs under RLS, and recorded in the audit log. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = reportBySlug(slug);
  if (!report) return new Response("Not found", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (!report.perms.some((p) => user.permissions.has(p))) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const f = readFilters(Object.fromEntries(url.searchParams));
  if (report.requires && !f[report.requires as keyof typeof f]) return new Response("Missing required filter", { status: 400 });

  const rows = await withUser(user.id, async (db) => {
    const r = await db.query(report.sql, filterParams(f));
    await db.query("select hv.audit_event('EXPORT', 'reports', $1, $2, $3)", [slug, `${r.rowCount} rows exported as CSV`, JSON.stringify(f)]);
    return r.rows;
  });
  const header = report.columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => report.columns.map((c) => esc(r[c.key])).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${header}\r\n${body}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="herdvest-${slug}-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
