import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, formatMoney, label } from "@/lib/erp/format";
import { paymentMethods } from "@/lib/erp/options";
import { Attachments } from "@/components/erp/Attachments";
import { Checkbox, ConfirmAction, FileField, Hidden, Input, MoneyInput, Select, Textarea } from "@/components/erp/form";
import { Alert, Card, DL, LinkButton, Money, PageHeader, StatCard, StatusBadge } from "@/components/erp/ui";
import { LedgerActions } from "../../ledger/LedgerActions";
import { recordDecision, recordDeposit } from "../../ledger/actions";
import { updateAccount } from "../../investors/actions";

export const metadata = { title: "Investment account" };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("investors.read");
  const { timezone } = await getSettings();
  const fin = can(user, "finance.read");

  const d = await withUser(user.id, async (db) => {
    const acc = (await db.query(
      `select a.*, i.full_legal_name investor, i.code investor_code from hv.investment_accounts a join hv.investors i on i.id = a.investor_id where a.id = $1`, [id])).rows[0];
    if (!acc) return null;
    const bal = (await db.query("select * from hv.account_balances where account_id = $1", [id])).rows[0];
    const ledger = (await db.query(
      `select l.*, u.full_name recorder, v.full_name verifier, p.code purchase_code, e.code expense_code,
              (select array_agg(at.id) from hv.attachments at where at.entity_type = 'ledger_entry' and at.entity_id = l.id and at.deleted_at is null) files
         from hv.ledger_entries l left join hv.users u on u.id = l.recorded_by left join hv.users v on v.id = l.verified_by
         left join hv.purchases p on p.id = l.purchase_id left join hv.expenses e on e.id = l.expense_id
        where l.account_id = $1 order by l.occurred_at desc, l.created_at desc`, [id])).rows;
    const decisions = (await db.query(
      `select d.*, u.full_name who from hv.unallocated_decisions d left join hv.users u on u.id = d.decided_by where d.account_id = $1 order by d.decided_at desc`, [id])).rows;
    const purchases = (await db.query(
      `select p.id, p.code, p.purchase_date, p.total_cost, p.status, (select count(*) from hv.purchase_lines pl where pl.purchase_id = p.id) n
         from hv.purchases p where p.account_id = $1 order by p.purchase_date desc`, [id])).rows;
    return { acc, bal, ledger, decisions, purchases };
  });
  if (!d) notFound();
  const { acc, bal } = d;
  const path = `/management/accounts/${id}`;
  const approve = can(user, "finance.approve");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${acc.code} · ${acc.name}`}
        subtitle={<span className="flex items-center gap-2"><Link className="hover:underline" href={`/management/investors/${acc.investor_id}`}>{acc.investor} ({acc.investor_code})</Link><StatusBadge status={acc.status} /></span>}
        crumbs={[{ href: "/management/investors", label: "Investors" }, { href: `/management/investors/${acc.investor_id}`, label: acc.investor_code }]}
        actions={
          <>
            {can(user, "finance.write") && acc.status === "open" && (
              <ConfirmAction action={recordDeposit.bind(null, id)} trigger="Record deposit" triggerVariant="primary" title="Record an investor deposit"
                description="The deposit is recorded as pending. It is added to balances only after a finance approver verifies it.">
                <MoneyInput name="amount" label="Amount received (PKR)" required />
                <Input name="occurred_at" label="Date & time received" type="datetime-local" required />
                <Select name="payment_method" label="Payment method" required options={paymentMethods} />
                <Input name="reference" label="Bank / receipt reference" hint="Used to detect duplicate deposits" />
                <Textarea name="notes" label="Notes" rows={2} />
                {can(user, "files.upload") && <FileField name="proof" label="Proof of payment" />}
                <Hidden name="idempotency_key" value={crypto.randomUUID()} />
              </ConfirmAction>
            )}
            {can(user, "purchases.write") && acc.status === "open" && <LinkButton href={`/management/purchases/new?account=${id}`} variant="secondary">Record purchase</LinkButton>}
          </>
        }
      />

      {fin && bal && (
        <>
          {bal.decision_required && (
            <Alert tone="warn" title={`${formatMoney(bal.unallocated)} remains unallocated after the latest purchase`}>
              <p>Record how this money is handled. Unallocated cash is not profit and is never spent automatically.</p>
              {can(user, "finance.write") && (
                <div className="mt-3">
                  <ConfirmAction action={recordDecision.bind(null, id)} trigger="Record decision" triggerVariant="primary" title="Unallocated funds decision"
                    description={`Applies to the current unallocated balance of ${formatMoney(bal.unallocated)}.`}>
                    <Select name="decision" label="Decision" required options={[
                      ["retain_for_purchase", "Retain for another purchase"], ["allocate_to_expense", "Allocate to an approved expense (if permitted by the agreement)"],
                      ["return_to_investor", "Return to the investor (creates a pending refund)"], ["hold_pending", "Hold pending a decision"]]} />
                    <Textarea name="notes" label="Notes" required rows={2} hint="e.g. investor instruction, date and channel" />
                  </ConfirmAction>
                </div>
              )}
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatCard label="1. Total funds received" value={formatMoney(bal.funds_received)} hint="Verified deposits" tone="dark" />
            <StatCard label="2. Spent on livestock" value={formatMoney(bal.purchases_allocated)} hint="Verified purchase allocations" />
            <StatCard label="3. Expenses charged" value={formatMoney(bal.expenses_charged)} hint="Under the agreement" />
            <StatCard label="4. Unallocated available" value={formatMoney(bal.unallocated)} hint="Not profit" />
            <StatCard label="5. Returned to investor" value={formatMoney(bal.returned_to_investor)} hint="Verified refunds" />
            <StatCard label="6. Awaiting reconciliation" value={formatMoney(bal.awaiting_reconciliation)} hint={`In ${formatMoney(bal.pending_deposits)} · out ${formatMoney(bal.pending_outflows)}`} tone={Number(bal.awaiting_reconciliation) > 0 ? "warn" : "default"} />
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Agreement terms" className="lg:col-span-1"
          actions={can(user, "investors.write") && (
            <ConfirmAction action={updateAccount.bind(null, id)} trigger="Edit" triggerVariant="ghost" title="Edit account">
              <Input name="name" label="Account name" required defaultValue={acc.name} />
              <Input name="agreement_ref" label="Signed agreement reference" defaultValue={acc.agreement_ref} />
              <Select name="status" label="Status" required placeholder={false} defaultValue={acc.status} options={[["open", "Open"], ["closed", "Closed"], ["suspended", "Suspended"]]} />
              <Checkbox name="deduct_sale_expenses" label="Deduct approved sale expenses before profit sharing" defaultChecked={acc.deduct_sale_expenses} />
              <Textarea name="notes" label="Notes" defaultValue={acc.notes} rows={2} />
            </ConfirmAction>
          )}>
          <DL cols={1} items={[
            ["Signed agreement", acc.agreement_ref ?? "Not recorded"],
            ["Profit split", `${Number(acc.investor_share_pct)}% investor / ${100 - Number(acc.investor_share_pct)}% farmer`],
            ["Herdvest fee", `${Number(acc.service_fee_pct)}% of investor gross share, once per completed sale`],
            ["Sale expenses", acc.deduct_sale_expenses ? "Deducted before sharing" : "Not deducted from sale proceeds"],
            ["Opened", formatDate(acc.opened_on, timezone)],
          ]} />
        </Card>
        <Card title="Purchases funded" className="lg:col-span-2" bodyClassName="p-0">
          {d.purchases.length === 0 ? <p className="p-5 text-sm text-ink-500">No purchases yet.</p> : (
            <ul className="divide-y divide-forest/5">
              {d.purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <Link href={`/management/purchases/${p.id}`} className="hover:underline"><span className="font-semibold text-forest">{p.code}</span> <span className="text-ink-500">· {formatDate(p.purchase_date, timezone)} · {p.n} animal{p.n === 1 ? "" : "s"}</span></Link>
                  <span className="flex items-center gap-2"><Money value={p.total_cost} /><StatusBadge status={p.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {fin && (
        <Card title="Ledger" bodyClassName="p-0">
          {d.ledger.length === 0 ? <p className="p-5 text-sm text-ink-500">No transactions yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-ivory/70 text-left text-xs text-ink-600">
                  <tr><th className="px-5 py-2">Transaction</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Reference / link</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
                </thead>
                <tbody className="divide-y divide-forest/5">
                  {d.ledger.map((l) => (
                    <tr key={l.id}>
                      <td className="px-5 py-2.5 font-semibold text-forest">{l.code}</td>
                      <td className="px-3 py-2.5">{formatDate(l.occurred_at, timezone, true)}</td>
                      <td className="px-3 py-2.5">{label(l.entry_type)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {l.reference ?? ""}
                        {l.purchase_code && <Link href={`/management/purchases/${l.purchase_id}`} className="text-emerald hover:underline"> {l.purchase_code}</Link>}
                        {l.expense_code && <Link href={`/management/expenses/${l.expense_id}`} className="text-emerald hover:underline"> {l.expense_code}</Link>}
                        {(l.files ?? []).map((fid: string, i: number) => <a key={fid} href={`/management/files/${fid}`} target="_blank" rel="noopener" className="ml-1 text-emerald hover:underline">proof{i ? ` ${i + 1}` : ""}</a>)}
                        <span className="block text-ink-500">{l.recorder}{l.verifier ? ` → ${l.verifier}` : ""}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right"><Money value={["deposit", "adjustment_in"].includes(l.entry_type) ? l.amount : `-${l.amount}`} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={l.status} /></td>
                      <td className="px-3 py-2.5 text-right"><LedgerActions id={l.id} status={l.status} entryType={l.entry_type} canApprove={approve} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {fin && d.decisions.length > 0 && (
        <Card title="Unallocated-funds decisions">
          <ul className="space-y-2 text-sm">
            {d.decisions.map((x) => (
              <li key={x.id}><strong className="text-forest">{label(x.decision)}</strong> — {formatMoney(x.amount)} · {x.notes} <span className="text-xs text-ink-500">({x.who}, {formatDate(x.decided_at, timezone, true)})</span></li>
            ))}
          </ul>
        </Card>
      )}

      <Attachments user={user} entityType="account" entityId={id} path={path} timeZone={timezone} defaultCategory="agreement" title="Agreement & payment documents" />
    </div>
  );
}
