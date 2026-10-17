import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label, sumMoney } from "@/lib/erp/format";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { ConfirmAction, Checkbox, Input } from "@/components/erp/form";
import { Badge, Card, DL, LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";
import { createAccount } from "../actions";

export const metadata = { title: "Investor" };

export default async function InvestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("investors.read");
  const { timezone } = await getSettings();
  const fin = can(user, "finance.read");

  const d = await withUser(user.id, async (db) => {
    const inv = (await db.query("select i.*, e.code enquiry_code from hv.investors i left join hv.enquiries e on e.id = i.enquiry_id where i.id = $1", [id])).rows[0];
    if (!inv) return null;
    const accounts = (await db.query(
      `select a.*, b.funds_received, b.purchases_allocated, b.expenses_charged, b.returned_to_investor, b.unallocated, b.awaiting_reconciliation, b.decision_required
         from hv.investment_accounts a left join hv.account_balances b on b.account_id = a.id where a.investor_id = $1 order by a.opened_on`, [id])).rows;
    const animals = (await db.query(
      `select a.id, a.code, a.species, a.breed, a.status, f.full_name farmer, f.id farmer_id, pl.price
         from hv.animals a left join hv.farmers f on f.id = a.current_farmer_id left join hv.purchase_lines pl on pl.animal_id = a.id
        where a.investor_id = $1 order by a.code`, [id])).rows;
    const settlements = (await db.query(
      `select x.*,
              case when x.status in ('approved','partially_paid','paid') then x.investor_payable - x.paid else 0 end outstanding,
              case when x.status in ('approved','partially_paid','paid') then x.herdvest_payable else 0 end fee_approved
         from (select st.id, st.code, st.status, st.investor_payable, st.herdvest_payable, st.herdvest_fee, st.profit_pool, st.gross_proceeds,
                      s.id sale_id, a.code animal,
                      (select coalesce(sum(amount),0) from hv.settlement_payments p where p.settlement_id = st.id and p.payee = 'investor') paid,
                      (select coalesce(sum(amount),0) from hv.sale_receipts r where r.sale_id = s.id) received,
                      st.created_at
                 from hv.settlements st join hv.sales s on s.id = st.sale_id join hv.animals a on a.id = s.animal_id
                where s.investor_id = $1) x order by x.created_at desc`, [id])).rows;
    const purchases = (await db.query("select count(*)::int n, coalesce(sum(total_cost),0) total from hv.purchases where investor_id = $1 and status = 'completed'", [id])).rows[0];
    const expenses = (await db.query(
      `select coalesce(sum(amount) filter (where charge_type = 'chargeable_to_investment' and status in ('approved','paid')),0) charged
         from hv.expenses where investor_id = $1`, [id])).rows[0];
    return { inv, accounts, animals, settlements, expenses, purchases };
  });
  if (!d) notFound();
  const { inv } = d;
  const farmers = [...new Map(d.animals.filter((a) => a.farmer_id).map((a) => [a.farmer_id, a.farmer])).values()];

  return (
    <div className="space-y-6">
      <PageHeader
        title={inv.full_legal_name}
        subtitle={<span className="flex items-center gap-2">{inv.code} <StatusBadge status={inv.status} /></span>}
        crumbs={[{ href: "/management/investors", label: "Investors" }]}
        actions={can(user, "investors.write") && <LinkButton href={`/management/investors/${id}/edit`} variant="secondary">Edit</LinkButton>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profile" className="lg:col-span-2">
          <DL cols={3} items={[
            ["Contact number", inv.phone], ["Email", inv.email], ["Preferred contact", label(inv.contact_preference)],
            ["Address", inv.address], ["City / country", [inv.city, inv.country].filter(Boolean).join(", ")], ["Registered", formatDate(inv.registered_on, timezone)],
            ["Communication notes", inv.communication_notes], ["From enquiry", inv.enquiry_code], ["Associated farmers", farmers.join(", ") || "—"],
          ]} />
          {inv.notes && <p className="mt-4 whitespace-pre-line rounded-lg bg-ivory/60 p-3 text-sm text-ink-600">{inv.notes}</p>}
        </Card>
        {fin && (
          <Card title="Totals across accounts">
            <DL cols={1} items={[
              ["Total funds received (verified)", <Money key="r" value={sum(d.accounts, "funds_received")} strong />],
              ["Capital allocated to livestock (verified)", <Money key="a" value={sum(d.accounts, "purchases_allocated")} />],
              ["Expenses charged under agreement", <Money key="e" value={sum(d.accounts, "expenses_charged")} />],
              ["Returned to investor (refunds)", <Money key="ret" value={sum(d.accounts, "returned_to_investor")} />],
              ["Unallocated balance", <Money key="u" value={sum(d.accounts, "unallocated")} strong />],
              ["Purchases", <span key="pc">{d.purchases?.n ?? 0} · <Money value={d.purchases?.total ?? "0"} /></span>],
              ["Gross sale proceeds (agreed prices)", <Money key="g" value={sum(d.settlements, "gross_proceeds")} />],
              ["Sale money received from buyers", <Money key="br" value={sum(d.settlements, "received")} />],
              ["Herdvest fees — calculated / approved", <span key="f"><Money value={sum(d.settlements, "herdvest_fee")} /> / <Money value={sum(d.settlements, "fee_approved")} /></span>],
              ["Settlement payments received", <Money key="p" value={sum(d.settlements, "paid")} />],
              ["Outstanding settlement amounts", <Money key="o" value={sum(d.settlements, "outstanding")} strong />],
            ]} />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-forest/10 pt-4">
              <LinkButton href={`/management/reports/investor-statement?investor=${id}`} variant="secondary">Statement</LinkButton>
              <a href={`/management/reports/investor-statement/pdf?investor=${id}`} className="inline-flex items-center rounded-lg border border-forest/15 bg-white px-3.5 py-2 text-sm font-semibold text-forest hover:border-forest/40">Download PDF statement</a>
            </div>
          </Card>
        )}
      </div>

      <Card
        title="Investment accounts"
        actions={can(user, "investors.write") && (
          <ConfirmAction action={createAccount.bind(null, id)} trigger="Open account" title="Open another investment account"
            description="Use separate accounts for separate signed agreements.">
            <Input name="name" label="Account name" placeholder="Livestock investment account" />
            <Input name="agreement_ref" label="Signed agreement reference" />
            <div className="grid grid-cols-2 gap-3">
              <Input name="investor_share_pct" label="Investor share %" defaultValue="50" inputMode="decimal" />
              <Input name="service_fee_pct" label="Herdvest fee % of investor share" defaultValue="20" inputMode="decimal" />
            </div>
            <Checkbox name="deduct_sale_expenses" label="Agreement deducts approved sale expenses before profit sharing" />
          </ConfirmAction>
        )}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-ivory/70 text-left text-xs text-ink-600">
              <tr>
                <th className="px-5 py-2">Account</th><th className="px-3 py-2">Agreement</th><th className="px-3 py-2">Terms</th><th className="px-3 py-2">Status</th>
                {fin && <><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right">Unallocated</th></>}
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/5">
              {d.accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-2.5"><Link href={`/management/accounts/${a.id}`} className="font-semibold text-forest hover:underline">{a.code}</Link> <span className="text-ink-500">{a.name}</span></td>
                  <td className="px-3 py-2.5">{a.agreement_ref ?? <span className="text-gold-600">Not recorded</span>}</td>
                  <td className="px-3 py-2.5 text-xs">{Number(a.investor_share_pct)}% / {100 - Number(a.investor_share_pct)}% · fee {Number(a.service_fee_pct)}%</td>
                  <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                  {fin && <>
                    <td className="px-3 py-2.5 text-right"><Money value={a.funds_received} /></td>
                    <td className="px-3 py-2.5 text-right"><span className="inline-flex items-center gap-1.5"><Money value={a.unallocated} />{a.decision_required && <Badge tone="gold">Decide</Badge>}</span></td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Animals (${d.animals.length})`} bodyClassName="p-0">
          {d.animals.length === 0 ? <p className="p-5 text-sm text-ink-500">No animals purchased for this investor yet.</p> : (
            <ul className="divide-y divide-forest/5">
              {d.animals.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/management/animals/${a.id}`} className="min-w-0 truncate hover:underline">
                    <span className="font-semibold text-forest">{a.code}</span> <span className="text-ink-500">{label(a.species)} {a.breed ?? ""} · {a.farmer ?? "unallocated"}</span>
                  </Link>
                  <span className="flex items-center gap-2">{a.price && <Money value={a.price} className="text-xs" />}<StatusBadge status={a.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Sales settlements" bodyClassName="p-0">
          {d.settlements.length === 0 ? <p className="p-5 text-sm text-ink-500">No sales settled yet.</p> : (
            <ul className="divide-y divide-forest/5">
              {d.settlements.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/management/sales/${s.sale_id}`} className="hover:underline"><span className="font-semibold text-forest">{s.code}</span> <span className="text-ink-500">· {s.animal}</span></Link>
                  <span className="flex items-center gap-2 text-xs">payable <Money value={s.investor_payable} /> · paid <Money value={s.paid} /><StatusBadge status={s.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Attachments user={user} entityType="investor" entityId={id} path={`/management/investors/${id}`} timeZone={timezone} defaultCategory="agreement" title="Agreements & documents" />
      <History user={user} ids={[id, ...d.accounts.map((a) => a.id)]} timeZone={timezone} />
    </div>
  );
}

const sum = (rows: Array<Record<string, unknown>>, key: string) => sumMoney(rows.map((r) => r[key] as string));
