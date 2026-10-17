import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Sales & settlements" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["sales.read", "finance.read"]);
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const status = param(sp, "status");
  const lp = listParams(sp, { date: "s.sale_date", code: "s.code", price: "s.sale_price", animal: "a.code", status: "st.status" }, "date");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select s.*, a.code animal_code, i.full_legal_name investor, f.full_name farmer, st.status settlement_status, st.profit_pool, st.herdvest_fee,
              (select coalesce(sum(amount),0) from hv.sale_receipts r where r.sale_id = s.id) received, count(*) over() total
         from hv.sales s join hv.animals a on a.id = s.animal_id left join hv.investors i on i.id = s.investor_id
         left join hv.farmers f on f.id = s.farmer_id left join hv.settlements st on st.sale_id = s.id
        where ($1 = '' or s.code ilike $2 or a.code ilike $2 or s.buyer_name ilike $2 or i.full_legal_name ilike $2)
          and ($3 = '' or st.status = $3 or ($3 = 'pending' and st.status in ('calculated','review_required','approved','partially_paid')))
        order by ${lp.orderBy} limit $4 offset $5`, [lp.q, lp.like, status, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  return (
    <div>
      <PageHeader title="Sales & settlements" subtitle="Calculated settlements are not payments. Payments are recorded separately against approved settlements."
        actions={can(user, "sales.write") && <LinkButton href="/management/sales/new">Record sale</LinkButton>} />
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/sales/${r.id}`} searchPlaceholder="Sale ID, animal, buyer, investor"
        filters={<FilterSelect name="status" value={status} allLabel="All settlements" options={[["pending", "Pending (not fully paid)"], ["review_required", "Review required"], ["calculated", "Calculated"], ["approved", "Approved"], ["partially_paid", "Partially paid"], ["paid", "Paid"]]} />}
        emptyTitle="No sales recorded" emptyBody="Record a sale from an animal's page when it is sold."
        columns={[
          { key: "code", label: "Sale", sortable: true, render: (r) => r.code },
          { key: "date", label: "Date", sortable: true, render: (r) => formatDate(r.sale_date, timezone) },
          { key: "animal", label: "Animal", sortable: true, render: (r) => r.animal_code },
          { key: "investor", label: "Investor / farmer", render: (r) => <span className="text-xs">{[r.investor, r.farmer].filter(Boolean).join(" · ")}</span> },
          { key: "price", label: "Sale price", sortable: true, align: "right", render: (r) => <Money value={r.sale_price} /> },
          { key: "received", label: "Received", align: "right", render: (r) => <Money value={r.received} /> },
          { key: "pool", label: "Profit / loss", align: "right", render: (r) => <Money value={r.profit_pool} /> },
          { key: "status", label: "Settlement", sortable: true, render: (r) => <StatusBadge status={r.settlement_status} /> },
        ]} />
    </div>
  );
}
