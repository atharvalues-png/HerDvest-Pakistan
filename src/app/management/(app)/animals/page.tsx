import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { label } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Alert, LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Animals" };

const statuses: Array<[string, string]> = [
  ["active_any", "All active (allocated / under care)"], ["sourcing", "Sourcing"], ["purchased", "Purchased"], ["awaiting_allocation", "Awaiting allocation"],
  ["allocated", "Allocated to farmer"], ["active", "Active & under care"], ["under_treatment", "Under veterinary treatment"],
  ["sale_preparation", "Sale preparation"], ["sold", "Sold"], ["deceased", "Deceased"], ["other", "Other"],
];

export default async function AnimalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = param(sp, "status");
  const species = param(sp, "species");
  const full = can(user, "livestock.read");
  const prices = can(user, "purchases.read", "finance.read");
  const lp = listParams(sp, { code: "a.code", species: "a.species", status: "a.status", farmer: "f.full_name", investor: "i.full_legal_name", price: "pl.price" }, "code", "asc");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select a.id, a.code, a.species, a.breed, a.sex, a.tag_number, a.status, a.farm_location, f.full_name farmer, i.full_legal_name investor, pl.price,
              count(*) over() total
         from hv.animals a left join hv.farmers f on f.id = a.current_farmer_id left join hv.investors i on i.id = a.investor_id
         left join hv.purchase_lines pl on pl.animal_id = a.id
        where ($1 = '' or a.code ilike $2 or a.tag_number ilike $2 or a.breed ilike $2 or f.full_name ilike $2 or i.full_legal_name ilike $2)
          and ($3 = '' or a.status = $3 or ($3 = 'active_any' and a.status in ('allocated','active','under_treatment','sale_preparation')))
          and ($4 = '' or a.species = $4)
        order by ${lp.orderBy} limit $5 offset $6`, [lp.q, lp.like, status, species, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  return (
    <div>
      <PageHeader title="Livestock inventory" subtitle="Every animal keeps a permanent Herdvest ID and its full history, including after sale or death."
        actions={can(user, "purchases.write") && <LinkButton href="/management/purchases/new">Record purchase</LinkButton>} />
      {!full && <div className="mb-4"><Alert tone="info">You are seeing the animals linked to your assigned tasks.</Alert></div>}
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/animals/${r.id}`} searchPlaceholder="Animal ID, tag, breed, farmer, investor"
        filters={<>
          <FilterSelect name="status" value={status} allLabel="All statuses" options={statuses} />
          <FilterSelect name="species" value={species} allLabel="All types" options={[["buffalo", "Buffalo"], ["cow", "Cow"], ["goat", "Goat"], ["sheep", "Sheep"], ["other", "Other"]]} />
        </>}
        emptyTitle="No animals yet" emptyBody="Animals are created when a purchase is recorded."
        columns={[
          { key: "code", label: "Animal ID", sortable: true, render: (r) => r.code },
          { key: "species", label: "Type / breed", sortable: true, render: (r) => `${label(r.species)}${r.breed ? ` · ${r.breed}` : ""}` },
          { key: "tag", label: "Tag", render: (r) => r.tag_number ?? "—" },
          { key: "farmer", label: "Farmer", sortable: true, render: (r) => r.farmer ?? "—" },
          ...(full ? [{ key: "investor", label: "Investor", sortable: true, render: (r: typeof rows[number]) => r.investor ?? "—" }] : []),
          ...(prices ? [{ key: "price", label: "Purchase price", sortable: true, align: "right" as const, render: (r: typeof rows[number]) => <Money value={r.price} /> }] : []),
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
