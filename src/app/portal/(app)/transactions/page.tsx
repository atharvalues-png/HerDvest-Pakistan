import Link from "next/link";
import { Download, Paperclip } from "lucide-react";
import { formatDate, label } from "@/lib/erp/format";
import { portalQuery, portalTimezone } from "@/lib/portal/data";
import { Badge, Card, DL, Empty, Money, StatusBadge } from "@/components/erp/ui";
import { PortalHeading } from "@/components/portal/ui";

export const metadata = { title: "Transactions" };

const categoryInfo: Record<string, { label: string; tone: "green" | "blue" | "gold" }> = {
  cash: { label: "Money movement", tone: "green" },
  settlement: { label: "Settlement figure", tone: "blue" },
  request: { label: "Payment request", tone: "gold" },
};

export default async function TransactionsPage() {
  const tz = await portalTimezone();
  const d = await portalQuery(async (db) => ({
    tx: (await db.query("select * from hv.portal_transactions()")).rows,
    accounts: (await db.query("select * from hv.portal_accounts_overview()")).rows,
  }));

  return (
    <div className="space-y-6">
      <PortalHeading
        title="Transactions and statements"
        subtitle="Every entry on your investment, with its status. Only verified or paid entries are counted in totals."
        actions={
          <a href="/portal/statement" className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3.5 py-2 text-sm font-semibold text-ivory hover:bg-forest-700">
            <Download aria-hidden className="h-4 w-4" /> Download statement (PDF)
          </a>
        }
      />

      {d.accounts.map((a) => (
        <Card key={a.account_id} title={<span>{a.code} · {a.name} <StatusBadge status={a.status} /></span>}>
          <DL cols={3} items={[
            ["Agreement reference", a.agreement_ref ?? "Not yet recorded"],
            ["Original investment budget", a.agreed_budget ? <Money key="b" value={a.agreed_budget} /> : "Not recorded"],
            ["Profit share / Herdvest fee", `${Number(a.investor_share_pct)}% to you · fee ${Number(a.service_fee_pct)}% of your share, once per sale`],
            ["Verified funds received", <Money key="r" value={a.funds_received} strong />],
            ["Allocated to animal purchases", <Money key="p" value={a.purchases_committed} />],
            ["Approved investment expenses", <Money key="e" value={a.expenses_charged} />],
            ["Returned to you", <Money key="ret" value={a.returned_to_investor} />],
            ["Unallocated available balance", <Money key="u" value={a.unallocated} strong />],
            ["Awaiting verification", Number(a.pending_deposits) > 0 ? <span key="pd">Deposits <Money value={a.pending_deposits} /></span> : "Nothing pending"],
          ]} />
        </Card>
      ))}

      <div className="flex flex-wrap gap-2 text-xs text-ink-500">
        {Object.entries(categoryInfo).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1.5"><Badge tone={v.tone}>{v.label}</Badge></span>)}
        <span>Settlement figures are approved calculations for a sale — the money moves when a settlement payment is recorded.</span>
      </div>

      {d.tx.length === 0 ? (
        <Empty title="No transactions yet">Your first entry appears when Herdvest records a payment from you.</Empty>
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-ivory/70 text-left text-xs text-ink-600">
                <tr><th className="px-5 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Animal</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {d.tx.map((t, i) => (
                  <tr key={`${t.reference}-${t.kind}-${i}`} className="align-top">
                    <td className="whitespace-nowrap px-5 py-2.5">{formatDate(t.occurred_at, tz)}<span className="block text-xs text-ink-500">{t.reference}</span></td>
                    <td className="px-3 py-2.5">
                      {t.description}
                      {(t.document_ids ?? []).map((id: string, n: number) => (
                        <a key={id} href={`/portal/files/${id}`} target="_blank" rel="noopener" className="ml-2 inline-flex items-center gap-0.5 text-xs text-emerald hover:underline">
                          <Paperclip aria-hidden className="h-3 w-3" />Receipt{(t.document_ids?.length ?? 0) > 1 ? ` ${n + 1}` : ""}
                        </a>
                      ))}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{t.animal_codes ?? "—"}</td>
                    <td className="px-3 py-2.5"><Badge tone={categoryInfo[t.category]?.tone ?? "grey"}>{t.direction === "in" ? "Received" : t.direction === "out" ? (t.kind === "settlement_payment" || t.kind === "refund_to_investor" ? "Paid to you" : "Used") : categoryInfo[t.category]?.label ?? label(t.category)}</Badge></td>
                    <td className="px-3 py-2.5 text-right"><Money value={t.amount} className={t.status !== "verified" && t.status !== "paid" ? "text-ink-500" : ""} /></td>
                    <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-ink-500">
        Questions about an entry? <Link href="/portal/profile#corrections" className="text-emerald hover:underline">Send Herdvest a request</Link>. Forecasts never appear in this ledger — see the <Link href="/portal/outlook" className="text-emerald hover:underline">Investment Outlook</Link>.
      </p>
    </div>
  );
}
