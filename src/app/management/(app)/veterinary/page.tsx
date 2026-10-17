import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Badge, LinkButton, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Veterinary & inspections" };

export default async function VetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["vet.read", "vet.write"]);
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const status = param(sp, "status");
  const type = param(sp, "type");
  const due = param(sp, "due") === "1";
  const lp = listParams(sp, { date: "coalesce(v.visit_date, v.scheduled_date)", code: "v.code", animal: "a.code", type: "v.visit_type", status: "v.status", next: "v.next_due_date" }, due ? "next" : "date", due ? "asc" : "desc");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select v.*, a.code animal_code, f.full_name farmer, coalesce(v.visit_date, v.scheduled_date) d, count(*) over() total
         from hv.vet_records v join hv.animals a on a.id = v.animal_id left join hv.farmers f on f.id = v.farmer_id
        where ($1 = '' or v.code ilike $2 or a.code ilike $2 or v.vaccine_name ilike $2 or v.performed_by ilike $2 or f.full_name ilike $2)
          and ($3 = '' or v.status = $3) and ($4 = '' or v.visit_type = $4)
          and (not $5 or (v.next_due_date between current_date - 30 and current_date + 14
               and not exists (select 1 from hv.vet_records l where l.animal_id = v.animal_id and l.visit_type = 'vaccination' and l.status = 'completed' and l.visit_date >= v.next_due_date)))
        order by ${lp.orderBy} limit $6 offset $7`, [lp.q, lp.like, status, type, due, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader title="Veterinary care, vaccinations & inspections" subtitle="Scheduled visits act as reminders. Completed visits form each animal's health record."
        actions={can(user, "vet.write") && <LinkButton href="/management/veterinary/new">New record</LinkButton>} />
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/veterinary/${r.id}`} searchPlaceholder="Record, animal ID, vaccine, vet, farmer"
        filters={<>
          <FilterSelect name="status" value={status} allLabel="All statuses" options={[["scheduled", "Scheduled"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["missed", "Missed"]]} />
          <FilterSelect name="type" value={type} allLabel="All types" options={[["inspection", "Inspection"], ["vaccination", "Vaccination"], ["treatment", "Treatment"], ["health_check", "Health check"], ["follow_up", "Follow-up"]]} />
          <FilterSelect name="due" value={due ? "1" : ""} allLabel="Any due date" options={[["1", "Vaccinations due (±14 days)"]]} />
        </>}
        emptyTitle="No veterinary records" emptyBody="Record inspections, vaccinations and treatments, or schedule upcoming visits."
        columns={[
          { key: "code", label: "Record", sortable: true, render: (r) => r.code },
          { key: "animal", label: "Animal", sortable: true, render: (r) => r.animal_code },
          { key: "type", label: "Type", sortable: true, render: (r) => label(r.visit_type) },
          { key: "date", label: "Date", sortable: true, render: (r) => (
            <span className="inline-flex items-center gap-1.5">{formatDate(r.d, timezone)}{r.status === "scheduled" && r.d < today && <Badge tone="red">Overdue</Badge>}</span>) },
          { key: "farmer", label: "Farmer", render: (r) => r.farmer ?? "—" },
          { key: "detail", label: "Detail", render: (r) => <span className="text-xs">{[r.condition && label(r.condition), r.vaccine_name, r.weight_kg && `${r.weight_kg} kg`].filter(Boolean).join(" · ") || "—"}</span> },
          { key: "next", label: "Next due", sortable: true, render: (r) => formatDate(r.next_due_date, timezone) },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
