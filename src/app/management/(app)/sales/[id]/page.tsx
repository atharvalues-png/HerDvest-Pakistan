import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, formatMoney, label } from "@/lib/erp/format";
import { paymentMethods } from "@/lib/erp/options";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { Checkbox, ConfirmAction, FileField, Hidden, Input, MoneyInput, Select, Textarea } from "@/components/erp/form";
import { Alert, Card, DL, LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";
import { addReceipt, approveSettlement, recalculate, recordPayment, setDispute } from "../actions";

export const metadata = { title: "Sale" };

const reasonText: Record<string, string> = {
  loss_or_capital_shortfall: "Sale proceeds are below the purchase cost — no profit split; loss allocation must follow the signed agreement.",
  buyer_payment_outstanding: "The buyer has not paid the full sale price yet.",
  dispute_recorded: "A dispute is recorded on this sale.",
  disputed_expense: "An expense linked to this animal or sale is disputed.",
  unapproved_sale_expenses: "Sale expenses are still awaiting approval.",
  open_incident: "An incident on this animal is still open.",
};

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["sales.read", "finance.read"]);
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const s = (await db.query(
      `select s.*, a.code animal_code, i.full_legal_name investor, ac.code account_code, f.full_name farmer, e.full_name employee
         from hv.sales s join hv.animals a on a.id = s.animal_id left join hv.investors i on i.id = s.investor_id
         left join hv.investment_accounts ac on ac.id = s.account_id left join hv.farmers f on f.id = s.farmer_id
         left join hv.employees e on e.id = s.responsible_employee_id where s.id = $1`, [id])).rows[0];
    if (!s) return null;
    const st = (await db.query(`select st.*, u.full_name approver from hv.settlements st left join hv.users u on u.id = st.approved_by where st.sale_id = $1`, [id])).rows[0];
    const receipts = (await db.query(`select r.*, u.full_name who from hv.sale_receipts r left join hv.users u on u.id = r.recorded_by where r.sale_id = $1 order by r.received_at`, [id])).rows;
    const outstanding = st ? (await db.query("select * from hv.settlement_outstanding($1)", [st.id])).rows : [];
    const payments = st ? (await db.query(`select p.*, u.full_name who from hv.settlement_payments p left join hv.users u on u.id = p.recorded_by where p.settlement_id = $1 order by p.paid_at`, [st.id])).rows : [];
    const purchaseDate = (await db.query("select p.purchase_date from hv.purchase_lines pl join hv.purchases p on p.id = pl.purchase_id where pl.animal_id = $1", [s.animal_id])).rows[0]?.purchase_date;
    const received = (await db.query("select coalesce(sum(amount),0) v from hv.sale_receipts where sale_id = $1", [id])).rows[0].v;
    return { s, st, receipts, outstanding, payments, purchaseDate, received };
  });
  if (!d) notFound();
  const { s, st } = d;
  const editable = st && ["calculated", "review_required"].includes(st.status);
  const isLoss = st && Number(st.profit_pool) < 0;

  return (
    <div className="space-y-6">
      <PageHeader title={`Sale ${s.code} · ${s.animal_code}`} subtitle={<span className="flex items-center gap-2">{formatDate(s.sale_date, timezone)} · settlement <StatusBadge status={st?.status} /></span>}
        crumbs={[{ href: "/management/sales", label: "Sales" }]}
        actions={<>
          {can(user, "sales.write", "finance.write") && Number(d.received) < Number(s.sale_price) && (
            <ConfirmAction action={addReceipt.bind(null, id)} trigger="Record buyer payment" triggerVariant="primary" title="Record money received from the buyer"
              description={`Sale price ${formatMoney(s.sale_price)} · received so far ${formatMoney(d.received)}.`}>
              <MoneyInput name="amount" label="Amount received" required />
              <Input name="received_at" label="Received on" type="datetime-local" required />
              <Select name="method" label="Method" required options={paymentMethods} />
              <Input name="reference" label="Reference" required />
              {can(user, "files.upload") && <FileField name="receipt" label="Receipt" />}
            </ConfirmAction>
          )}
          {can(user, "sales.write") && editable && (
            <ConfirmAction action={setDispute.bind(null, id)} trigger={s.has_dispute ? "Update dispute" : "Record dispute"} title="Sale dispute">
              <Checkbox name="has_dispute" label="There is an unresolved dispute on this sale" defaultChecked={s.has_dispute} />
              <Textarea name="dispute_note" label="Note" defaultValue={s.dispute_note} rows={2} />
            </ConfirmAction>
          )}
          {can(user, "sales.write", "finance.write") && editable && (
            <ConfirmAction action={recalculate.bind(null, id)} trigger="Recalculate" triggerVariant="ghost" title="Recalculate settlement?"
              description="Recomputes the settlement from the current purchase, sale, receipts, expenses and agreement terms." />
          )}
          {can(user, "expenses.submit") && <LinkButton href={`/management/expenses/new?sale=${id}&animal=${s.animal_id}`} variant="secondary">Add sale expense</LinkButton>}
        </>} />

      {st && st.review_reasons?.length > 0 && editable && (
        <Alert tone={isLoss ? "error" : "warn"} title="Authorised review required — this is not a normal profit settlement yet">
          <ul className="list-disc pl-5">{st.review_reasons.map((r: string) => <li key={r}>{reasonText[r] ?? label(r)}</li>)}</ul>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Sale">
          <DL cols={1} items={[
            ["Animal", <Link key="a" href={`/management/animals/${s.animal_id}`} className="text-emerald hover:underline">{s.animal_code}</Link>],
            ["Investor / account", s.investor ? `${s.investor} · ${s.account_code}` : null], ["Farmer", s.farmer],
            ["Purchased", formatDate(d.purchaseDate, timezone)], ["Sold", formatDate(s.sale_date, timezone)],
            ["Buyer", [s.buyer_name, s.buyer_contact].filter(Boolean).join(" · ")], ["Sale price", <Money key="p" value={s.sale_price} strong />],
            ["Received from buyer", <Money key="r" value={d.received} />], ["Responsible employee", s.employee],
            ["Dispute", s.has_dispute ? s.dispute_note ?? "Yes" : "None"],
          ]} />
        </Card>

        {st && (
          <Card title={`Settlement ${st.code} — calculated`} className="lg:col-span-2" bodyClassName="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-forest/5">
                {[
                  ["1. Gross sale proceeds", st.gross_proceeds],
                  ...(Number(st.deducted_sale_expenses) > 0 ? [["   less approved sale expenses (per agreement)", `-${st.deducted_sale_expenses}`]] : []),
                  ["2. Initial capital (purchase cost)", st.purchase_cost],
                  ["3. Capital returned to investor", st.capital_returned],
                  ...(Number(st.capital_shortfall) > 0 ? [["   Capital shortfall", `-${st.capital_shortfall}`]] : []),
                  [isLoss ? "4. Loss before sharing" : "4. Profit pool", st.profit_pool],
                  [`5. Investor gross share (${Number(st.investor_share_pct)}%)`, st.investor_gross],
                  [`6. Farmer share (${100 - Number(st.investor_share_pct)}%)`, st.farmer_share],
                  [`7. Herdvest fee (${Number(st.service_fee_pct)}% of investor share, once per sale)`, st.herdvest_fee],
                  ["8. Investor net profit / (loss)", st.investor_net],
                ].map(([k, v]) => (
                  <tr key={k as string}><td className="px-5 py-2 text-charcoal">{k}</td><td className="px-5 py-2 text-right"><Money value={v as string} /></td></tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-forest/10 px-5 py-3 text-xs text-ink-500">
              Calculated {formatDate(st.calculated_at, timezone, true)}. A calculated amount is not a payment.
              {st.approver && ` Approved by ${st.approver} on ${formatDate(st.approved_at, timezone, true)}.`}
              {st.review_note && ` Review note: ${st.review_note}`}
            </p>
          </Card>
        )}
      </div>

      {st && (
        <Card title="Payable, paid and outstanding"
          actions={<>
            {can(user, "settlements.approve") && editable && (
              <ConfirmAction action={approveSettlement.bind(null, id, st.id)} trigger="Approve settlement" triggerVariant="primary" title="Approve settlement"
                description={st.status === "review_required"
                  ? "This settlement needs review. Record the basis for your decision. Payables may be adjusted only with a note, and cannot exceed money actually received."
                  : "Confirms the payable amounts. Payments are then recorded separately."}>
                <div className="grid grid-cols-3 gap-2">
                  <MoneyInput name="investor_payable" label="Investor" defaultValue={st.investor_payable} hint=" " />
                  <MoneyInput name="farmer_payable" label="Farmer" defaultValue={st.farmer_payable} hint=" " />
                  <MoneyInput name="herdvest_payable" label="Herdvest fee" defaultValue={st.herdvest_payable} hint=" " />
                </div>
                <Textarea name="note" label="Review note / agreement basis" rows={3} />
              </ConfirmAction>
            )}
            {can(user, "finance.write") && ["approved", "partially_paid"].includes(st.status) && (
              <ConfirmAction action={recordPayment.bind(null, id, st.id)} trigger="Record payment" triggerVariant="primary" title="Record an actual payment">
                <Select name="payee" label="Paid to" required options={[["investor", "Investor"], ["farmer", "Farmer"], ["herdvest", "Herdvest (fee)"]]} />
                <MoneyInput name="amount" label="Amount paid" required />
                <Input name="paid_at" label="Paid on" type="datetime-local" required />
                <Select name="method" label="Method" required options={paymentMethods} />
                <Input name="reference" label="Payment reference" required />
                <Hidden name="idempotency_key" value={randomUUID()} />
              </ConfirmAction>
            )}
          </>}
          bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="bg-ivory/70 text-left text-xs text-ink-600"><tr><th className="px-5 py-2">Payee</th><th className="px-3 py-2 text-right">Payable</th><th className="px-3 py-2 text-right">Paid</th><th className="px-5 py-2 text-right">Outstanding</th></tr></thead>
            <tbody className="divide-y divide-forest/5">
              {d.outstanding.map((o) => (
                <tr key={o.payee}><td className="px-5 py-2">{label(o.payee)}</td><td className="px-3 py-2 text-right"><Money value={o.payable} /></td><td className="px-3 py-2 text-right"><Money value={o.paid} /></td><td className="px-5 py-2 text-right"><Money value={o.outstanding} strong /></td></tr>
              ))}
            </tbody>
          </table>
          {!["approved", "partially_paid", "paid"].includes(st.status) && <p className="border-t border-forest/10 px-5 py-3 text-xs text-ink-500">Payables are proposals until the settlement is approved.</p>}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Buyer payments received" bodyClassName="p-0">
          {d.receipts.length === 0 ? <p className="p-5 text-sm text-ink-500">No money received from the buyer recorded yet.</p> : (
            <ul className="divide-y divide-forest/5">{d.receipts.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 px-5 py-2 text-sm"><span>{formatDate(r.received_at, timezone)} · {label(r.method)} · {r.reference}</span><Money value={r.amount} /></li>))}</ul>
          )}
        </Card>
        <Card title="Settlement payments made" bodyClassName="p-0">
          {d.payments.length === 0 ? <p className="p-5 text-sm text-ink-500">No payments recorded.</p> : (
            <ul className="divide-y divide-forest/5">{d.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 px-5 py-2 text-sm"><span>{label(p.payee)} · {formatDate(p.paid_at, timezone)} · {p.reference}</span><Money value={p.amount} /></li>))}</ul>
          )}
        </Card>
      </div>
      <Attachments user={user} entityType="sale" entityId={id} path={`/management/sales/${id}`} timeZone={timezone} defaultCategory="sale_receipt" title="Sale agreement, receipts & documents" />
      <History user={user} ids={[id, ...(st ? [st.id] : [])]} timeZone={timezone} />
    </div>
  );
}
