import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, formatMoney, label, sumMoney } from "@/lib/erp/format";
import { categoryOptions, employeeOptions, farmerOptions, investorOptions, animalOptions } from "@/lib/erp/options";
import { filterParams, readFilters, reportBySlug, totalRows, type ReportCol } from "@/lib/erp/reports";
import type { SearchParams } from "@/lib/erp/list";
import { Alert, Empty, Money, PageHeader, StatusBadge } from "@/components/erp/ui";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Report" };

const LIMIT = 2000;

function cell(c: ReportCol, v: unknown, tz: string) {
  if (v === null || v === undefined || v === "") return "—";
  switch (c.type) {
    case "money": return <Money value={v as string} />;
    case "date": return formatDate(v as string, tz);
    case "datetime": return formatDate(v as Date, tz, true);
    case "status": return <StatusBadge status={v as string} />;
    default: return typeof v === "string" && c.key.includes("type") ? label(v) : String(v);
  }
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const report = reportBySlug(slug);
  if (!report) notFound();
  const user = await requireUser(report.perms);
  const sp = await searchParams;
  const f = readFilters(sp);
  const { timezone } = await getSettings();
  const missing = report.requires && !f[report.requires as keyof typeof f];

  const d = await withUser(user.id, async (db) => ({
    rows: missing ? [] : (await db.query(`${report.sql} limit ${LIMIT + 1}`, filterParams(f))).rows,
    investors: report.filters.includes("investor") && can(user, "investors.read") ? await investorOptions(db) : [],
    farmers: report.filters.includes("farmer") && can(user, "farmers.read") ? await farmerOptions(db) : [],
    employees: report.filters.includes("employee") && can(user, "employees.read") ? await employeeOptions(db) : [],
    categories: report.filters.includes("category") ? await categoryOptions(db) : [],
    animals: report.filters.includes("animal") && can(user, "livestock.read") ? await animalOptions(db, "true") : [],
  }));
  const truncated = d.rows.length > LIMIT;
  const rows = d.rows.slice(0, LIMIT);
  const totals = totalRows(report, rows);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const sel = "rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm";

  return (
    <div>
      <PageHeader title={report.title} subtitle={report.description} crumbs={[{ href: "/management/reports", label: "Reports" }]}
        actions={!missing && <>
          <a href={`/management/reports/${slug}/export${qs ? `?${qs}` : ""}`} className="inline-flex items-center rounded-lg bg-forest px-3.5 py-2 text-sm font-semibold text-ivory hover:bg-forest-700">Export CSV</a>
          <a href={`/management/reports/${slug}/pdf${qs ? `?${qs}` : ""}`} className="inline-flex items-center rounded-lg border border-forest/15 bg-white px-3.5 py-2 text-sm font-semibold text-forest hover:border-forest/40">Download PDF</a>
          <PrintButton />
        </>} />
      <form className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
        {report.filters.includes("dates") && <>
          <label className="text-xs text-ink-600">From<input type="date" name="from" defaultValue={f.from} className={`${sel} block`} /></label>
          <label className="text-xs text-ink-600">To<input type="date" name="to" defaultValue={f.to} className={`${sel} block`} /></label>
        </>}
        {([["investor", d.investors, "All investors"], ["farmer", d.farmers, "All farmers"], ["employee", d.employees, "All employees"],
          ["category", d.categories, "All categories"], ["animal", d.animals, "All animals"]] as const).map(([key, options, all]) =>
          report.filters.includes(key) && options.length > 0 ? (
            <label key={key} className="text-xs text-ink-600">{label(key)}
              <select name={key} defaultValue={f[key]} className={`${sel} block max-w-[16rem]`}>
                <option value="">{report.requires === key ? "Select…" : all}</option>
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          ) : null)}
        {report.filters.includes("status") && report.statusOptions && (
          <label className="text-xs text-ink-600">Status
            <select name="status" defaultValue={f.status} className={`${sel} block`}>
              <option value="">All</option>
              {report.statusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        {report.filters.includes("account_status") && (
          <label className="text-xs text-ink-600">Investment status
            <select name="account_status" defaultValue={f.account_status} className={`${sel} block`}>
              <option value="">All accounts</option>
              <option value="open">Open</option><option value="closed">Closed</option><option value="suspended">Suspended</option>
            </select>
          </label>
        )}
        {report.filters.length > 0 && <button className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm font-semibold text-forest">Apply</button>}
      </form>

      {missing ? (
        <Empty title={`Select ${report.requires === "investor" ? "an investor" : "a filter"} to run this report`} />
      ) : rows.length === 0 ? (
        <Empty title="No records for these filters" />
      ) : (
        <>
          {truncated && <div className="mb-3"><Alert tone="warn">Showing the first {LIMIT} rows. Narrow the filters or use CSV export for the complete set.</Alert></div>}
          {report.sensitive && <div className="mb-3 print:hidden"><Alert tone="info">Contains personal financial information. Share only with the investor concerned.</Alert></div>}
          <div className="overflow-x-auto rounded-2xl border border-forest/10 bg-white print:border-0">
            <p className="hidden px-4 py-3 text-sm print:block">Herdvest Pakistan · {report.title} · generated {formatDate(new Date(), timezone, true)} by {user.fullName}</p>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-forest/10 bg-ivory/70 text-xs text-ink-600">
                <tr>{report.columns.map((c) => <th key={c.key} className={`px-4 py-2 font-semibold ${c.type === "money" || c.type === "number" ? "text-right" : ""}`}>{c.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {rows.map((r, i) => (
                  <tr key={i}>{report.columns.map((c) => <td key={c.key} className={`px-4 py-2 align-top ${c.type === "money" || c.type === "number" ? "text-right" : ""}`}>{cell(c, r[c.key], timezone)}</td>)}</tr>
                ))}
              </tbody>
              {report.totals && (
                <tfoot className="border-t-2 border-forest/20 bg-ivory/50 font-semibold">
                  <tr>{report.columns.map((c, i) => (
                    <td key={c.key} className={`px-4 py-2 ${c.type === "money" || c.type === "number" ? "text-right" : ""}`}>
                      {i === 0 ? totals.label : report.totals!.includes(c.key) ? (c.type === "money" ? formatMoney(sumMoney(totals.counted.map((r) => r[c.key] as string))) : totals.counted.reduce((a, r) => a + Number(r[c.key] ?? 0), 0)) : ""}
                    </td>))}</tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
