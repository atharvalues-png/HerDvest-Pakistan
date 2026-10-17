import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { accountOptions, chargeTypeOptions, paymentMethods } from "@/lib/erp/options";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { ConfirmAction, Input, Select, Textarea } from "@/components/erp/form";
import { Alert, Card, DL, Money, PageHeader, StatusBadge } from "@/components/erp/ui";
import { decideExpense, flagExpense, payExpense } from "../actions";

export const metadata = { title: "Expense" };

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["expenses.read", "expenses.submit"]);
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const e = (await db.query(
      `select e.*, c.label category, u.full_name submitter, ap.full_name approver, i.full_legal_name investor, ac.code account_code,
              f.full_name farmer, v.code vet_code, s.code sale_code
         from hv.expenses e join hv.expense_categories c on c.id = e.category_id left join hv.users u on u.id = e.submitted_by
         left join hv.users ap on ap.id = e.approved_by left join hv.investors i on i.id = e.investor_id
         left join hv.investment_accounts ac on ac.id = e.account_id left join hv.farmers f on f.id = e.farmer_id
         left join hv.vet_records v on v.id = e.vet_record_id left join hv.sales s on s.id = e.sale_id where e.id = $1`, [id])).rows[0];
    if (!e) return null;
    const splits = (await db.query(
      `select ea.amount, a.id, a.code, a.investor_id, a.account_id from hv.expense_allocations ea join hv.animals a on a.id = ea.animal_id where ea.expense_id = $1 order by a.code`, [id])).rows;
    const ledger = (await db.query("select code, status, amount from hv.ledger_entries where expense_id = $1", [id])).rows;
    const accounts = can(user, "expenses.approve") ? await accountOptions(db, false) : [];
    return { e, splits, ledger, accounts };
  });
  if (!d) notFound();
  const { e } = d;
  const suggestedAccount = e.account_id ?? (new Set(d.splits.map((s) => s.account_id)).size === 1 ? d.splits[0]?.account_id : null);
  const approver = can(user, "expenses.approve");

  return (
    <div className="space-y-6">
      <PageHeader title={`${e.code} · ${e.description}`} subtitle={<span className="flex items-center gap-2"><StatusBadge status={e.status} /> <Money value={e.amount} strong /></span>}
        crumbs={[{ href: "/management/expenses", label: "Expenses" }]}
        actions={<>
          {approver && ["submitted", "disputed"].includes(e.status) && (
            <>
              <ConfirmAction action={decideExpense.bind(null, id, true)} trigger="Approve" triggerVariant="primary" title="Approve expense"
                description="Decide who bears this cost. Only 'Chargeable to the investment' reduces an investor's funds, and only once.">
                <Select name="charge_type" label="Who bears this cost?" required options={chargeTypeOptions} defaultValue={e.charge_type === "to_be_determined" ? null : e.charge_type} />
                <Select name="account_id" label="Investment account (if chargeable)" options={d.accounts} defaultValue={suggestedAccount} placeholder="Not applicable" />
                <Textarea name="note" label="Approval note / agreement clause" rows={2} />
              </ConfirmAction>
              <ConfirmAction action={decideExpense.bind(null, id, false)} trigger="Reject" triggerVariant="danger" variant="danger" confirmLabel="Reject" title="Reject expense">
                <Textarea name="note" label="Reason" required rows={2} />
              </ConfirmAction>
            </>
          )}
          {can(user, "finance.write") && e.status === "approved" && (
            <ConfirmAction action={payExpense.bind(null, id)} trigger="Mark paid" triggerVariant="primary" title="Record payment" description="Record the actual payment made for this approved expense.">
              <Input name="paid_at" label="Paid on" type="datetime-local" required />
              <Select name="payment_method" label="Method" required options={paymentMethods} />
              <Input name="payment_reference" label="Payment reference" />
            </ConfirmAction>
          )}
          {approver && ["approved", "paid"].includes(e.status) && (
            <ConfirmAction action={flagExpense.bind(null, id, "disputed")} trigger="Mark disputed" triggerVariant="secondary" title="Mark as disputed" description="Disputed expenses hold any related sale settlement for review.">
              <Textarea name="note" label="Note" required rows={2} />
            </ConfirmAction>
          )}
          {approver && !["voided", "paid"].includes(e.status) && (
            <ConfirmAction action={flagExpense.bind(null, id, "voided")} trigger="Void" triggerVariant="danger" variant="danger" confirmLabel="Void" title="Void expense"
              description="If it was charged to an investor, reverse that ledger charge first. The record is kept.">
              <Textarea name="note" label="Reason" required rows={2} />
            </ConfirmAction>
          )}
        </>} />
      {e.status === "submitted" && <Alert tone="warn">Awaiting approval. This claim has not been approved or paid, and has not affected any investor balance.</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Expense" className="lg:col-span-2">
          <DL cols={3} items={[
            ["Date", formatDate(e.expense_date, timezone)], ["Category", e.category], ["Amount", <Money key="a" value={e.amount} strong />],
            ["Paid to / vendor", e.vendor], ["Payment method", label(e.payment_method)], ["Payment reference", e.payment_reference],
            ["Borne by", label(e.charge_type)], ["Investor / account", e.investor ? `${e.investor}${e.account_code ? ` · ${e.account_code}` : ""}` : null],
            ["Farmer", e.farmer], ["Veterinary record", e.vet_code ? <Link key="v" href={`/management/veterinary/${e.vet_record_id}`} className="text-emerald hover:underline">{e.vet_code}</Link> : null],
            ["Sale", e.sale_code ? <Link key="s" href={`/management/sales/${e.sale_id}`} className="text-emerald hover:underline">{e.sale_code}</Link> : null],
            ["Submitted by", e.submitter], ["Approved / decided by", e.approver ? `${e.approver}, ${formatDate(e.approved_at, timezone, true)}` : null],
            ["Paid", e.paid_at ? formatDate(e.paid_at, timezone, true) : null], ["Rejection reason", e.rejection_reason],
          ]} />
          {e.notes && <p className="mt-4 whitespace-pre-line text-sm text-ink-600">{e.notes}</p>}
        </Card>
        <div className="space-y-6">
          <Card title="Animal split" bodyClassName="p-0">
            {d.splits.length === 0 ? <p className="p-5 text-sm text-ink-500">Not linked to specific animals.</p> : (
              <ul className="divide-y divide-forest/5">{d.splits.map((s) => (
                <li key={s.id} className="flex justify-between px-5 py-2 text-sm"><Link href={`/management/animals/${s.id}`} className="text-forest hover:underline">{s.code}</Link><Money value={s.amount} /></li>))}</ul>
            )}
          </Card>
          {d.ledger.length > 0 && (
            <Card title="Charged to investor ledger">
              {d.ledger.map((l) => <p key={l.code} className="flex justify-between text-sm"><span>{l.code}</span><span className="flex gap-2"><Money value={l.amount} /><StatusBadge status={l.status} /></span></p>)}
            </Card>
          )}
        </div>
      </div>
      <Attachments user={user} entityType="expense" entityId={id} path={`/management/expenses/${id}`} timeZone={timezone} defaultCategory="expense_receipt" title="Receipts & invoices" />
      <History user={user} ids={[id]} timeZone={timezone} />
    </div>
  );
}
