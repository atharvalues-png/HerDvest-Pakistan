import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Alert, Badge, PageHeader } from "@/components/erp/ui";

export const metadata = { title: "Audit log" };

const short = (v: unknown) => {
  if (!v || typeof v !== "object") return "";
  return Object.entries(v as Record<string, unknown>).filter(([k]) => !["updated_at", "created_at"].includes(k)).slice(0, 6)
    .map(([k, x]) => `${k}: ${x === null ? "—" : typeof x === "object" ? JSON.stringify(x) : String(x)}`.slice(0, 80)).join(" · ");
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("audit.read");
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const table = param(sp, "table");
  const action = param(sp, "action");
  const from = param(sp, "from");
  const to = param(sp, "to");
  const lp = listParams(sp, { at: "a.at", table: "a.table_name", action: "a.action", user: "u.full_name" }, "at", "desc", 50);
  const { rows, total, tables } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select a.*, u.full_name who, count(*) over() total from hv.audit_log a left join hv.users u on u.id = a.user_id
        where ($1 = '' or a.record_id ilike $2 or u.full_name ilike $2 or a.note ilike $2 or a.new_values::text ilike $2)
          and ($3 = '' or a.table_name = $3) and ($4 = '' or a.action = $4)
          and ($5 = '' or a.at >= $5::date) and ($6 = '' or a.at < $6::date + 1)
        order by ${lp.orderBy} limit $7 offset $8`, [lp.q, lp.like, table, action, from, to, lp.pageSize, lp.offset]);
    const tables = (await db.query("select distinct table_name from hv.audit_log order by 1")).rows.map((x) => [x.table_name, x.table_name.replace(/_/g, " ")] as [string, string]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0, tables };
  });
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every create, change, approval, status change, upload and removal — with who and when. The log is append-only." />
      <div className="mb-4"><Alert tone="info">No user, including administrators, can edit or delete audit entries through the application. Password hashes and session tokens are never recorded.</Alert></div>
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} searchPlaceholder="Record ID, user, value"
        filters={<>
          <FilterSelect name="table" value={table} allLabel="All record types" options={tables} />
          <FilterSelect name="action" value={action} allLabel="All actions" options={[["INSERT", "Created"], ["UPDATE", "Changed"], ["DELETE", "Deleted"], ["LOGIN", "Sign-in"], ["EXPORT", "Export"], ["VIEW_FILE", "Sensitive file viewed"], ["PASSWORD_SET", "Password set"]]} />
          <input type="date" name="from" defaultValue={from} aria-label="From date" className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm" />
          <input type="date" name="to" defaultValue={to} aria-label="To date" className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm" />
        </>}
        emptyTitle="No audit entries"
        columns={[
          { key: "at", label: "When", sortable: true, render: (r) => <span className="whitespace-nowrap text-xs">{formatDate(r.at, timezone, true)}</span> },
          { key: "user", label: "User", sortable: true, render: (r) => r.who ?? "System / public" },
          { key: "action", label: "Action", sortable: true, render: (r) => <Badge tone={r.action === "UPDATE" ? "blue" : r.action === "INSERT" ? "green" : "gold"}>{r.action}</Badge> },
          { key: "table", label: "Record", sortable: true, render: (r) => <span className="text-xs">{r.table_name}<span className="block font-mono text-[0.65rem] text-ink-500">{r.record_id}</span></span> },
          { key: "change", label: "Change", render: (r) => (
            <span className="block max-w-md text-xs text-ink-600">
              {r.action === "UPDATE" ? <>from {short(r.old_values)}<br />to {short(r.new_values)}</> : short(r.new_values ?? r.old_values)}
              {r.note && <span className="block italic">{r.note}</span>}
            </span>) },
        ]} />
    </div>
  );
}
