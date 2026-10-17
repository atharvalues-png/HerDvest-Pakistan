import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { LinkButton, PageHeader, StatusBadge } from "@/components/erp/ui";
import { verificationOptions } from "@/lib/erp/options";

export const metadata = { title: "Farmers" };

export default async function FarmersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("farmers.read");
  const sp = await searchParams;
  const status = param(sp, "status");
  const lp = listParams(sp, { code: "f.code", name: "f.full_name", district: "f.district", status: "f.verification_status", animals: "animals", capacity: "f.capacity" }, "name", "asc");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select f.*, (select count(*) from hv.animals a where a.current_farmer_id = f.id and a.status not in ('sold','deceased')) animals, count(*) over() total
         from hv.farmers f
        where ($1 = '' or f.full_name ilike $2 or f.code ilike $2 or f.phone ilike $2 or f.district ilike $2 or f.city ilike $2)
          and ($3 = '' or f.verification_status = $3)
        order by ${lp.orderBy} limit $4 offset $5`, [lp.q, lp.like, status, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  return (
    <div>
      <PageHeader title="Farmers" subtitle="Partner farmers and their verification status. Only verified farmers can receive animals."
        actions={can(user, "farmers.write") && <LinkButton href="/management/farmers/new">New farmer</LinkButton>} />
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/farmers/${r.id}`} searchPlaceholder="Name, ID, phone, district"
        filters={<FilterSelect name="status" value={status} allLabel="All verification statuses" options={verificationOptions} />}
        emptyTitle="No farmers yet" emptyBody="Add a farmer, or convert a farmer application from the website."
        columns={[
          { key: "code", label: "ID", sortable: true, render: (r) => r.code },
          { key: "name", label: "Name", sortable: true, render: (r) => r.full_name },
          { key: "district", label: "District / city", sortable: true, render: (r) => [r.district, r.city].filter(Boolean).join(", ") || "—" },
          { key: "phone", label: "Phone", render: (r) => r.phone ?? "—" },
          { key: "capacity", label: "Capacity", sortable: true, align: "right", render: (r) => r.capacity ?? "—" },
          { key: "animals", label: "Current animals", sortable: true, align: "right", render: (r) => r.animals },
          { key: "status", label: "Verification", sortable: true, render: (r) => <StatusBadge status={r.verification_status} /> },
          { key: "agreement", label: "Agreement", render: (r) => <StatusBadge status={r.agreement_status === "none" ? null : r.agreement_status} /> },
        ]} />
    </div>
  );
}
