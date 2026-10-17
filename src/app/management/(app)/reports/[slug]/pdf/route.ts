import { getSessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { filterParams, readFilters, reportBySlug } from "@/lib/erp/reports";
import { renderReportPdf } from "@/lib/erp/pdf";
import { label } from "@/lib/erp/format";

export const runtime = "nodejs";

/** Server-generated PDF of a report. Permission-checked, runs under RLS, audited. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = reportBySlug(slug);
  if (!report) return new Response("Not found", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (!report.perms.some((p) => user.permissions.has(p))) return new Response("Forbidden", { status: 403 });

  const f = readFilters(Object.fromEntries(new URL(req.url).searchParams));
  if (report.requires && !f[report.requires as keyof typeof f]) return new Response("Missing required filter", { status: 400 });

  const { rows, names, timezone } = await withUser(user.id, async (db) => {
    const r = await db.query(`${report.sql} limit 5000`, filterParams(f));
    const names: string[] = [];
    if (f.investor) {
      const i = (await db.query("select code, full_legal_name from hv.investors where id = $1", [f.investor])).rows[0];
      if (i) names.push(`Investor: ${i.full_legal_name} (${i.code})`);
    }
    if (f.farmer) {
      const x = (await db.query("select code, full_name from hv.farmers where id = $1", [f.farmer])).rows[0];
      if (x) names.push(`Farmer: ${x.full_name} (${x.code})`);
    }
    const tz = (await db.query("select coalesce(hv.setting('timezone') #>> '{}', 'Asia/Karachi') tz")).rows[0].tz as string;
    await db.query("select hv.audit_event('EXPORT', 'reports', $1, $2, $3)", [slug, `${r.rowCount} rows exported as PDF`, JSON.stringify(f)]);
    return { rows: r.rows, names, timezone: tz };
  });

  const summary = [
    ...names,
    f.from || f.to ? `Period: ${f.from || "start"} to ${f.to || "today"}` : "",
    f.status ? `Status: ${label(f.status)}` : "",
    f.account_status ? `Investment status: ${label(f.account_status)}` : "",
  ].filter(Boolean);

  const pdf = await renderReportPdf({ report, rows, filterSummary: summary, generatedBy: user.fullName, timeZone: timezone });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="herdvest-${slug}-${date}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
