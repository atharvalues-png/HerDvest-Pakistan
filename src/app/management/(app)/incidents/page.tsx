import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Alert, LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Incidents" };

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["incidents.read", "incidents.write"]);
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const status = param(sp, "status");
  const lp = listParams(sp, { date: "x.occurred_at", code: "x.code", status: "x.status", animal: "a.code" }, "date");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select x.*, a.code animal_code, f.full_name farmer, count(*) over() total from hv.incidents x join hv.animals a on a.id = x.animal_id
         left join hv.farmers f on f.id = x.farmer_id
        where ($1 = '' or x.code ilike $2 or a.code ilike $2 or x.description ilike $2) and ($3 = '' or x.status = $3)
        order by ${lp.orderBy} limit $4 offset $5`, [lp.q, lp.like, status, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  return (
    <div>
      <PageHeader title="Mortality & incidents" subtitle="Deaths, major injuries, serious illness and losses — investigated and decided under the signed agreements."
        actions={can(user, "incidents.write") && <LinkButton href="/management/incidents/new">Report incident</LinkButton>} />
      <div className="mb-4"><Alert tone="info">Recording an incident never creates compensation, insurance payouts or repayments. The approved loss allocation is documented by an authorised person after review.</Alert></div>
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/incidents/${r.id}`} searchPlaceholder="Incident, animal ID, description"
        filters={<FilterSelect name="status" value={status} allLabel="All statuses" options={[["reported", "Reported"], ["investigating", "Investigating"], ["under_review", "Under review"], ["decided", "Decided"], ["closed", "Closed"]]} />}
        emptyTitle="No incidents recorded"
        columns={[
          { key: "code", label: "Incident", sortable: true, render: (r) => r.code },
          { key: "date", label: "Occurred", sortable: true, render: (r) => formatDate(r.occurred_at, timezone, true) },
          { key: "animal", label: "Animal", sortable: true, render: (r) => r.animal_code },
          { key: "type", label: "Type", render: (r) => label(r.incident_type) },
          { key: "farmer", label: "Farmer", render: (r) => r.farmer ?? "—" },
          { key: "loss", label: "Est. loss", align: "right", render: (r) => <Money value={r.estimated_loss} /> },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
