import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Alert, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("enquiries.read");
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const status = param(sp, "status");
  const type = param(sp, "type");
  const lp = listParams(sp, { received: "e.received_at", code: "e.code", name: "e.full_name", status: "e.status", type: "e.enquiry_type" }, "received");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select e.*, emp.full_name assignee, count(*) over() total from hv.enquiries e left join hv.employees emp on emp.id = e.assigned_to
        where ($1 = '' or e.full_name ilike $2 or e.code ilike $2 or e.email::text ilike $2 or e.phone ilike $2)
          and ($3 = '' or e.status = $3) and ($4 = '' or e.enquiry_type = $4)
        order by ${lp.orderBy} limit $5 offset $6`,
      [lp.q, lp.like, status, type, lp.pageSize, lp.offset],
    );
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  return (
    <div>
      <PageHeader title="Website enquiries" subtitle="Submitted through the public website forms. An enquiry is not an investor, a commitment or a deposit." />
      <div className="mb-4"><Alert tone="info">Convert an enquiry to create an investor or farmer record without retyping. Investors still need a signed agreement and a verified deposit before any purchase.</Alert></div>
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/enquiries/${r.id}`} searchPlaceholder="Name, ID, email, phone"
        filters={<>
          <FilterSelect name="status" value={status} allLabel="All statuses" options={[["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["converted", "Converted"], ["closed", "Closed"]]} />
          <FilterSelect name="type" value={type} allLabel="All sources" options={[["investor", "Investor enquiry"], ["farmer", "Farmer application"], ["contact", "Contact form"]]} />
        </>}
        emptyTitle="No enquiries yet" emptyBody="Enquiries appear here when visitors submit the website forms."
        columns={[
          { key: "code", label: "ID", sortable: true, render: (r) => r.code },
          { key: "name", label: "Name", sortable: true, render: (r) => r.full_name },
          { key: "type", label: "Source", sortable: true, render: (r) => `${label(r.enquiry_type)} · ${r.source}` },
          { key: "contact", label: "Contact", render: (r) => <span className="text-xs">{[r.phone, r.email].filter(Boolean).join(" · ")}</span> },
          { key: "received", label: "Received", sortable: true, render: (r) => formatDate(r.received_at, timezone, true) },
          { key: "assignee", label: "Assigned", render: (r) => r.assignee ?? "—" },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
