import Link from "next/link";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Alert, Money, PageHeader, StatusBadge } from "@/components/erp/ui";
import { LedgerActions } from "./LedgerActions";
import { entryTypes } from "@/lib/erp/options";

export const metadata = { title: "Funding ledger" };

export default async function LedgerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("finance.read");
  const sp = await searchParams;
  const { timezone, dualControl } = await getSettings();
  const type = param(sp, "type");
  const status = param(sp, "status");
  const lp = listParams(sp, { date: "l.occurred_at", code: "l.code", amount: "l.amount", type: "l.entry_type", status: "l.status" }, "date");

  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select l.*, i.full_legal_name investor, a.code account_code, u.full_name recorded_by_name, v.full_name verified_by_name,
              count(*) over() total
         from hv.ledger_entries l join hv.investors i on i.id = l.investor_id join hv.investment_accounts a on a.id = l.account_id
         left join hv.users u on u.id = l.recorded_by left join hv.users v on v.id = l.verified_by
        where ($1 = '' or l.code ilike $2 or l.reference ilike $2 or i.full_legal_name ilike $2 or a.code ilike $2)
          and ($3 = '' or l.entry_type = $3) and ($4 = '' or l.status = $4)
        order by ${lp.orderBy} limit $5 offset $6`,
      [lp.q, lp.like, type, status, lp.pageSize, lp.offset],
    );
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  const approve = can(user, "finance.approve");

  return (
    <div>
      <PageHeader title="Funding ledger" subtitle="Every movement of investor funds. Balances use verified entries only; pending entries await reconciliation." />
      <div className="mb-4">
        <Alert tone="info">
          Investor deposits are held on the investor&apos;s behalf — they are not revenue or profit. Entries cannot be edited or deleted; use
          reject (pending) or reverse (verified). Dual control is <strong>{dualControl ? "on" : "off"}</strong>
          {dualControl ? " — a different person must verify each entry." : "."}
        </Alert>
      </div>
      <DataTable
        sp={sp}
        meta={{ ...lp, total }}
        rows={rows}
        searchPlaceholder="TXN ID, reference, investor, account"
        filters={
          <>
            <FilterSelect name="type" value={type} allLabel="All types" options={entryTypes} />
            <FilterSelect name="status" value={status} allLabel="All statuses" options={[["pending", "Pending"], ["verified", "Verified"], ["rejected", "Rejected"], ["reversed", "Reversed"]]} />
          </>
        }
        emptyTitle="No ledger entries"
        emptyBody="Record a deposit from an investor's account page."
        columns={[
          { key: "code", label: "Transaction", sortable: true, render: (r) => <span className="font-semibold text-forest">{r.code}</span> },
          { key: "date", label: "Date", sortable: true, render: (r) => formatDate(r.occurred_at, timezone) },
          { key: "type", label: "Type", sortable: true, render: (r) => label(r.entry_type) },
          {
            key: "account", label: "Investor / account",
            render: (r) => <Link href={`/management/accounts/${r.account_id}`} className="relative z-10 text-forest hover:underline">{r.investor} · {r.account_code}</Link>,
          },
          { key: "ref", label: "Reference", render: (r) => r.reference ?? "—" },
          { key: "amount", label: "Amount", sortable: true, align: "right", render: (r) => <Money value={r.entry_type === "deposit" || r.entry_type === "adjustment_in" ? r.amount : `-${r.amount}`} /> },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
          { key: "by", label: "Recorded / verified", render: (r) => <span className="text-xs text-ink-500">{r.recorded_by_name ?? "—"}{r.verified_by_name ? ` / ${r.verified_by_name}` : ""}</span> },
          { key: "actions", label: "", render: (r) => <span className="relative z-10"><LedgerActions id={r.id} status={r.status} entryType={r.entry_type} canApprove={approve} /></span> },
        ]}
      />
    </div>
  );
}
