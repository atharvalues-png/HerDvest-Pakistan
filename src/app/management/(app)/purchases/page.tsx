import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["purchases.read", "finance.read"]);
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const status = param(sp, "status");
  const lp = listParams(sp, { date: "p.purchase_date", code: "p.code", total: "p.total_cost", investor: "i.full_legal_name" }, "date");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select p.*, i.full_legal_name investor, a.code account_code, (select count(*) from hv.purchase_lines pl where pl.purchase_id = p.id) animals,
              (select l.status from hv.ledger_entries l where l.purchase_id = p.id and l.entry_type = 'purchase_allocation' order by l.created_at limit 1) funding_status,
              count(*) over() total
         from hv.purchases p join hv.investors i on i.id = p.investor_id join hv.investment_accounts a on a.id = p.account_id
        where ($1 = '' or p.code ilike $2 or i.full_legal_name ilike $2 or p.seller_name ilike $2 or p.location ilike $2)
          and ($3 = '' or p.status = $3)
        order by ${lp.orderBy} limit $4 offset $5`, [lp.q, lp.like, status, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  return (
    <div>
      <PageHeader title="Purchase register" subtitle="Each purchase is funded from a specific investor account and creates the animal records."
        actions={can(user, "purchases.write") && <LinkButton href="/management/purchases/new">Record purchase</LinkButton>} />
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/purchases/${r.id}`} searchPlaceholder="Purchase ID, investor, seller, location"
        filters={<FilterSelect name="status" value={status} allLabel="All" options={[["completed", "Completed"], ["voided", "Voided"]]} />}
        emptyTitle="No purchases recorded" emptyBody="Record a purchase once an investor's deposit has been verified."
        columns={[
          { key: "code", label: "Purchase", sortable: true, render: (r) => r.code },
          { key: "date", label: "Date", sortable: true, render: (r) => formatDate(r.purchase_date, timezone) },
          { key: "investor", label: "Investor / account", sortable: true, render: (r) => `${r.investor} · ${r.account_code}` },
          { key: "seller", label: "Seller / location", render: (r) => [r.seller_name, r.location].filter(Boolean).join(" · ") },
          { key: "animals", label: "Animals", align: "right", render: (r) => r.animals },
          { key: "total", label: "Total cost", sortable: true, align: "right", render: (r) => <Money value={r.total_cost} /> },
          { key: "funding", label: "Funding", render: (r) => <StatusBadge status={r.funding_status} /> },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
