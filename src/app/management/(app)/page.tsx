import Link from "next/link";
import { redirect } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, formatMoney } from "@/lib/erp/format";
import { Alert, Card, Money, PageHeader, StatCard, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: { absolute: "Dashboard · Herdvest MS" } };

export default async function Dashboard() {
  const user = await requireUser();
  if (!can(user, "dashboard.view")) redirect("/management/tasks");
  const { timezone } = await getSettings();
  const fin = can(user, "finance.read");

  const d = await withUser(user.id, async (db) => {
    const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];
    const many = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
    return {
      funds: fin
        ? await one(`select coalesce(sum(funds_received),0) received, coalesce(sum(purchases_allocated),0) allocated,
                      coalesce(sum(expenses_charged),0) charged, coalesce(sum(returned_to_investor),0) returned,
                      coalesce(sum(unallocated),0) unallocated, coalesce(sum(awaiting_reconciliation),0) awaiting,
                      count(*) filter (where decision_required) decisions from hv.account_balances`)
        : null,
      pendingLedger: fin ? await one(`select count(*) n from hv.ledger_entries where status = 'pending'`) : null,
      cash: fin
        ? await one(`select *, deposits_in + buyer_receipts as cash_in,
              purchases_paid + expenses_paid + settlements_paid + refunds_paid as cash_out,
              deposits_in + buyer_receipts - (purchases_paid + expenses_paid + settlements_paid + refunds_paid) as position from (select
            (select coalesce(sum(amount),0) from hv.ledger_entries where entry_type = 'deposit' and status = 'verified') as deposits_in,
            (select coalesce(sum(amount),0) from hv.sale_receipts) as buyer_receipts,
            (select coalesce(sum(amount),0) from hv.ledger_entries where entry_type = 'purchase_allocation' and status = 'verified') as purchases_paid,
            (select coalesce(sum(amount),0) from hv.expenses where status = 'paid') as expenses_paid,
            (select coalesce(sum(amount),0) from hv.settlement_payments) as settlements_paid,
            (select coalesce(sum(amount),0) from hv.ledger_entries where entry_type = 'refund_to_investor' and status = 'verified') as refunds_paid) c`)
        : null,
      sales: can(user, "sales.read", "finance.read")
        ? await one(`select
            (select coalesce(sum(s.sale_price),0) - coalesce((select sum(amount) from hv.sale_receipts),0) from hv.sales s where s.status = 'recorded') as receivable,
            (select coalesce(sum(profit_pool),0) from hv.settlements where status in ('approved','partially_paid','paid')) as realised,
            (select coalesce(sum(herdvest_payable),0) from hv.settlements where status in ('approved','partially_paid','paid')) as fees_earned,
            (select count(*) from hv.settlements where status in ('calculated','review_required')) as awaiting_approval,
            (select count(*) from hv.settlements where status in ('approved','partially_paid')) as awaiting_payment,
            (select coalesce(sum(o.outstanding),0) from hv.settlements s cross join lateral hv.settlement_outstanding(s.id) o
               where s.status in ('approved','partially_paid')) as settlement_payable`)
        : null,
      atCost: can(user, "purchases.read", "finance.read")
        ? await one(`select coalesce(sum(pl.price),0) v from hv.purchase_lines pl join hv.animals a on a.id = pl.animal_id
                     where a.status not in ('sold','deceased','other')`)
        : null,
      animals: can(user, "livestock.read")
        ? await one(`select count(*) filter (where status in ('allocated','active','under_treatment','sale_preparation')) active,
                      count(*) filter (where status = 'sold') sold, count(*) filter (where status in ('purchased','awaiting_allocation')) awaiting,
                      count(*) filter (where status = 'under_treatment') treatment, count(*) filter (where status = 'deceased') deceased from hv.animals`)
        : null,
      farmers: can(user, "farmers.read")
        ? await one(`select count(*) filter (where verification_status = 'verified') verified,
                      count(*) filter (where verification_status not in ('verified','rejected','suspended')) pending from hv.farmers`)
        : null,
      vet: can(user, "vet.read")
        ? await one(`select count(*) filter (where status = 'scheduled' and scheduled_date <= current_date + 7) inspections,
                      count(*) filter (where status = 'scheduled' and scheduled_date < current_date) overdue,
                      (select count(*) from hv.vet_records v where v.next_due_date between current_date - 30 and current_date + 14
                         and not exists (select 1 from hv.vet_records l where l.animal_id = v.animal_id and l.visit_type = 'vaccination'
                                         and l.status = 'completed' and l.visit_date >= v.next_due_date)) vaccinations_due
                     from hv.vet_records`)
        : null,
      expensesPending: can(user, "expenses.read") ? await one(`select count(*) n, coalesce(sum(amount),0) total from hv.expenses where status = 'submitted'`) : null,
      expensesPayable: can(user, "expenses.read") ? await one(`select coalesce(sum(amount),0) total from hv.expenses where status = 'approved'`) : null,
      enquiries: can(user, "enquiries.read") ? await one(`select count(*) n from hv.enquiries where status = 'new'`) : null,
      intake: can(user, "intake.review") ? await one(`select count(*) n from hv.intake_items where status in ('pending_review','unmatched')`) : null,
      incidents: can(user, "incidents.read") ? await one(`select count(*) n from hv.incidents where status not in ('decided','closed')`) : null,
      tasks: await many(
        `select id, code, title, due_date, status from hv.tasks where status in ('open','in_progress')
         order by due_date nulls last limit 6`,
      ),
      recentPurchases: can(user, "purchases.read", "finance.read")
        ? await many(`select p.id, p.code, p.purchase_date, p.total_cost, i.full_legal_name investor,
                       (select count(*) from hv.purchase_lines pl where pl.purchase_id = p.id) animals
                      from hv.purchases p left join hv.investors i on i.id = p.investor_id order by p.created_at desc limit 5`)
        : [],
      recentSales: can(user, "sales.read", "finance.read")
        ? await many(`select s.id, s.code, s.sale_date, s.sale_price, a.code animal, st.status settlement
                      from hv.sales s join hv.animals a on a.id = s.animal_id left join hv.settlements st on st.sale_id = s.id
                      order by s.created_at desc limit 5`)
        : [],
    };
  });


  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome, ${user.fullName.split(" ")[0]}`} subtitle="Live figures from verified records. Every figure links to its source." />

      {d.funds && Number(d.funds.decisions) > 0 && (
        <Alert tone="warn" title="Unallocated investor funds need a decision">
          {d.funds.decisions} account{Number(d.funds.decisions) === 1 ? " has" : "s have"} money left after a purchase. Record whether it is
          retained, allocated to an approved expense, returned, or held. <Link href="/management/investors?decision=1" className="font-semibold underline">Review accounts</Link>
        </Alert>
      )}

      {d.funds && d.cash && (
        <section aria-labelledby="funds-h">
          <h2 id="funds-h" className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Investor funds (held on behalf of investors — not revenue)</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Investor funds received" value={formatMoney(d.funds.received)} hint="Verified deposits" href="/management/ledger?type=deposit&status=verified" tone="dark" />
            <StatCard label="Allocated to livestock" value={formatMoney(d.funds.allocated)} hint="Verified purchase allocations" href="/management/ledger?type=purchase_allocation" />
            <StatCard label="Unallocated investor funds" value={formatMoney(d.funds.unallocated)} hint="Available after committed outflows" href="/management/investors" />
            <StatCard label="Awaiting reconciliation" value={formatMoney(d.funds.awaiting)} hint={`${d.pendingLedger?.n ?? 0} pending ledger entries`} href="/management/ledger?status=pending" tone={Number(d.pendingLedger?.n) > 0 ? "warn" : "default"} />
          </div>
        </section>
      )}

      {d.cash && (
        <section aria-labelledby="cash-h">
          <h2 id="cash-h" className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Actual cash recorded</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Actual cash received" value={formatMoney(d.cash.cash_in)} hint={`Deposits ${formatMoney(d.cash.deposits_in)} + buyer receipts ${formatMoney(d.cash.buyer_receipts)}`} href="/management/reports/outstanding-balances" />
            <StatCard label="Actual cash paid" value={formatMoney(d.cash.cash_out)} hint="Purchases, paid expenses, settlement payments, refunds" href="/management/reports/outstanding-balances" />
            <StatCard label="Recorded cash position" value={formatMoney(d.cash.position)} hint="From verified records — reconcile against bank statements" />
            <StatCard label="Livestock at purchase cost" value={d.atCost ? formatMoney(d.atCost.v) : "—"} hint="Market value is not estimated by the system" href="/management/animals" />
          </div>
        </section>
      )}

      {d.sales && (
        <section aria-labelledby="sales-h">
          <h2 id="sales-h" className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Sales & settlements</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Realised profit / loss" value={formatMoney(d.sales.realised)} hint="Approved settlements only" href="/management/sales?status=approved" />
            <StatCard label="Herdvest fees (approved)" value={formatMoney(d.sales.fees_earned)} hint="20% of investor gross share, once per sale" href="/management/reports/management-fees" />
            <StatCard label="Buyer receivables" value={formatMoney(d.sales.receivable)} hint="Sale price not yet received" href="/management/reports/outstanding-balances" tone={Number(d.sales.receivable) > 0 ? "warn" : "default"} />
            <StatCard label="Settlement payables" value={formatMoney(d.sales.settlement_payable)} hint={`${d.sales.awaiting_approval} awaiting approval · ${d.sales.awaiting_payment} awaiting payment`} href="/management/sales?status=pending" />
          </div>
        </section>
      )}

      <section aria-labelledby="ops-h">
        <h2 id="ops-h" className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Operations</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {d.animals && <StatCard label="Active animals" value={d.animals.active} href="/management/animals?status=active_any" />}
          {d.animals && <StatCard label="Awaiting allocation" value={d.animals.awaiting} href="/management/animals?status=awaiting_allocation" tone={Number(d.animals.awaiting) > 0 ? "warn" : "default"} />}
          {d.animals && <StatCard label="Sold" value={d.animals.sold} href="/management/animals?status=sold" />}
          {d.farmers && <StatCard label="Verified farmers" value={d.farmers.verified} hint={`${d.farmers.pending} in verification`} href="/management/farmers" />}
          {d.vet && <StatCard label="Inspections due (7 days)" value={d.vet.inspections} hint={Number(d.vet.overdue) ? `${d.vet.overdue} overdue` : undefined} href="/management/veterinary?status=scheduled" tone={Number(d.vet.overdue) > 0 ? "warn" : "default"} />}
          {d.vet && <StatCard label="Vaccinations due" value={d.vet.vaccinations_due} hint="Next due within 14 days" href="/management/veterinary?due=1" />}
          {d.expensesPending && <StatCard label="Expenses to approve" value={d.expensesPending.n} hint={formatMoney(d.expensesPending.total)} href="/management/expenses?status=submitted" tone={Number(d.expensesPending.n) > 0 ? "warn" : "default"} />}
          {d.expensesPayable && <StatCard label="Approved, unpaid expenses" value={formatMoney(d.expensesPayable.total)} href="/management/expenses?status=approved" />}
          {d.enquiries && <StatCard label="New enquiries" value={d.enquiries.n} href="/management/enquiries?status=new" />}
          {d.intake && <StatCard label="Intake to review" value={d.intake.n} href="/management/intake" />}
          {d.incidents && <StatCard label="Open incidents" value={d.incidents.n} href="/management/incidents" tone={Number(d.incidents.n) > 0 ? "warn" : "default"} />}
          {d.animals && <StatCard label="Under treatment" value={d.animals.treatment} href="/management/animals?status=under_treatment" />}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Upcoming tasks" actions={<Link href="/management/tasks" className="text-xs font-semibold text-emerald">All tasks</Link>} bodyClassName="p-0">
          {d.tasks.length === 0 ? (
            <p className="p-5 text-sm text-ink-500">No open tasks.</p>
          ) : (
            <ul className="divide-y divide-forest/5">
              {d.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/management/tasks/${t.id}`} className="min-w-0 truncate font-medium text-forest hover:underline">{t.title}</Link>
                  <span className="shrink-0 text-xs text-ink-500">{formatDate(t.due_date, timezone)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {d.recentPurchases.length > 0 || can(user, "purchases.read") ? (
          <Card title="Recent purchases" actions={<Link href="/management/purchases" className="text-xs font-semibold text-emerald">All</Link>} bodyClassName="p-0">
            {d.recentPurchases.length === 0 ? <p className="p-5 text-sm text-ink-500">No purchases recorded.</p> : (
              <ul className="divide-y divide-forest/5">
                {d.recentPurchases.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <Link href={`/management/purchases/${p.id}`} className="min-w-0 hover:underline">
                      <span className="font-semibold text-forest">{p.code}</span>{" "}
                      <span className="text-ink-500">· {p.animals} animal{p.animals === 1 ? "" : "s"} · {p.investor}</span>
                    </Link>
                    <Money value={p.total_cost} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
        {can(user, "sales.read", "finance.read") && (
          <Card title="Recent sales" actions={<Link href="/management/sales" className="text-xs font-semibold text-emerald">All</Link>} bodyClassName="p-0">
            {d.recentSales.length === 0 ? <p className="p-5 text-sm text-ink-500">No sales recorded.</p> : (
              <ul className="divide-y divide-forest/5">
                {d.recentSales.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <Link href={`/management/sales/${s.id}`} className="min-w-0 hover:underline">
                      <span className="font-semibold text-forest">{s.code}</span> <span className="text-ink-500">· {s.animal}</span>
                    </Link>
                    <span className="flex items-center gap-2"><Money value={s.sale_price} /><StatusBadge status={s.settlement} /></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
