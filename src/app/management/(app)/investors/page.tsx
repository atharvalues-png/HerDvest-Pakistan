import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Badge, LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Investors" };

export default async function InvestorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("investors.read");
  const sp = await searchParams;
  const fin = can(user, "finance.read");
  const status = param(sp, "status");
  const decision = param(sp, "decision") === "1";
  const lp = listParams(sp, { code: "i.code", name: "i.full_legal_name", city: "i.city", status: "i.status", received: "received", unallocated: "unallocated", registered: "i.registered_on" }, "registered");

  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select i.id, i.code, i.full_legal_name, i.city, i.country, i.status, i.registered_on,
              sum(b.funds_received) received, sum(b.unallocated) unallocated, bool_or(b.decision_required) decision_required,
              (select count(*) from hv.animals a where a.investor_id = i.id) animals,
              count(*) over() total
         from hv.investors i
         left join hv.investment_accounts ac on ac.investor_id = i.id
         left join hv.account_balances b on b.account_id = ac.id
        where ($1 = '' or i.full_legal_name ilike $2 or i.code ilike $2 or i.phone ilike $2 or i.email::text ilike $2 or i.city ilike $2)
          and ($3 = '' or i.status = $3)
        group by i.id
        having (not $4 or bool_or(b.decision_required))
        order by ${lp.orderBy} limit $5 offset $6`,
      [lp.q, lp.like, status, decision, lp.pageSize, lp.offset],
    );
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });

  return (
    <div>
      <PageHeader
        title="Investors"
        subtitle="Investor records and their investment accounts. Website enquiries become investors only when converted."
        actions={can(user, "investors.write") && <LinkButton href="/management/investors/new">New investor</LinkButton>}
      />
      <DataTable
        sp={sp}
        meta={{ ...lp, total }}
        rows={rows}
        rowHref={(r) => `/management/investors/${r.id}`}
        searchPlaceholder="Name, ID, phone, email, city"
        filters={
          <>
            <FilterSelect name="status" value={status} allLabel="All statuses" options={[["prospective", "Prospective"], ["active", "Active"], ["dormant", "Dormant"], ["exited", "Exited"], ["suspended", "Suspended"]]} />
            {fin && <FilterSelect name="decision" value={decision ? "1" : ""} allLabel="Any balance" options={[["1", "Needs unallocated-funds decision"]]} />}
          </>
        }
        emptyTitle="No investors yet"
        emptyBody="Create an investor, or convert a website enquiry."
        columns={[
          { key: "code", label: "ID", sortable: true, render: (r) => r.code },
          { key: "name", label: "Name", sortable: true, render: (r) => r.full_legal_name },
          { key: "city", label: "City / country", sortable: true, render: (r) => [r.city, r.country].filter(Boolean).join(", ") || "—" },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
          { key: "animals", label: "Animals", align: "right", render: (r) => r.animals },
          ...(fin
            ? [
                { key: "received", label: "Funds received", sortable: true, align: "right" as const, render: (r: typeof rows[number]) => <Money value={r.received ?? "0"} /> },
                {
                  key: "unallocated", label: "Unallocated", sortable: true, align: "right" as const,
                  render: (r: typeof rows[number]) => (
                    <span className="inline-flex items-center gap-1.5"><Money value={r.unallocated ?? "0"} />{r.decision_required && <Badge tone="gold">Decide</Badge>}</span>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
