import Link from "next/link";
import { ArrowRight, PawPrint } from "lucide-react";
import { requireInvestor } from "@/lib/auth/portal-session";
import { formatDate, formatMoney } from "@/lib/erp/format";
import { animalStatusLabel, portalQuery, portalTimezone } from "@/lib/portal/data";
import { Alert, Card, Empty } from "@/components/erp/ui";
import { EstimateNotice, Figure, InspectionBadge, PortalHeading, Section } from "@/components/portal/ui";

export const metadata = { title: { absolute: "Dashboard · Herdvest Investor Portal" } };

export default async function PortalDashboard() {
  const user = await requireInvestor();
  const tz = await portalTimezone();
  const d = await portalQuery(async (db) => ({
    s: (await db.query("select * from hv.portal_summary()")).rows[0],
    accounts: (await db.query("select code, status, agreement_ref from hv.portal_accounts_overview()")).rows,
    animals: (await db.query("select id, code, species, breed, status, inspection_state, next_inspection_due, cover_photo from hv.portal_animals()")).rows,
    notes: (await db.query("select id, title, created_at, read_at, link from hv.portal_notifications_list(5)")).rows,
  }));
  const s = d.s;
  const hasMoney = Number(s.funds_received) > 0 || Number(s.pending_deposits) > 0;

  return (
    <div className="space-y-8">
      <PortalHeading
        title={`Welcome, ${user.investorName}`}
        subtitle={<>Investor {user.investorCode}{d.accounts.length > 0 && <> · {d.accounts.map((a) => a.code).join(", ")}</>}</>}
      />

      {!hasMoney && d.animals.length === 0 && (
        <Alert tone="info" title="Your portal is set up">
          No verified transactions or livestock have been recorded on your account yet. Figures appear here as soon as Herdvest
          verifies your first payment and records your animals.
        </Alert>
      )}

      <Section title="Your money" description="Actual amounts from verified records. Pending items are shown separately and are not included in totals.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Figure label="Total funds received (verified)" value={s.funds_received} tone="dark" />
          <Figure label="Allocated to livestock purchases" value={s.purchases_allocated}
            hint={Number(s.purchases_unverified) > 0 ? `${formatMoney(s.purchases_unverified)} awaiting final reconciliation` : "Money spent buying your animals"} />
          <Figure label="Unallocated funds" value={s.unallocated} hint="Held for you — not profit" />
          <Figure label="Approved investment expenses" value={s.expenses_charged} hint="Only expenses chargeable under your agreement" />
          <Figure label="Returned to you" value={s.returned_to_investor} hint="Capital refunds" />
          <Figure label="Pending payments" value={Number(s.pending_deposits) > 0 ? s.pending_deposits : null} missing="None"
            tone={Number(s.pending_deposits) > 0 ? "warn" : "default"} hint={Number(s.pending_deposits) > 0 ? "Received, awaiting verification" : "No payments awaiting verification"} />
          <Figure label="Original investment budget" value={s.agreed_budget} missing="Not recorded" hint="As recorded from your agreement" />
          <Figure label="Settlement payments received" value={s.paid_to_investor} hint="Paid to you from completed sales" />
        </div>
      </Section>

      <Section title="Results and amounts due" description="Realised results come only from sales whose settlement Herdvest has approved.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Figure label="Active animals" value={s.active_animals} money={false} href="/portal/livestock" />
          <Figure label="Sold animals" value={s.sold_animals} money={false} hint={s.deceased_animals > 0 ? `${s.deceased_animals} recorded as deceased` : undefined} />
          <Figure label="Realised profit / loss" value={s.settled_sales > 0 ? s.realized_net : null} missing="No completed sales yet"
            hint={s.settled_sales > 0 ? `Net of Herdvest's fee, from ${s.settled_sales} approved settlement(s)` : "Shown once a sale is settled and approved"} />
          <Figure label="Amount due to you" value={Number(s.due_to_investor) > 0 ? s.due_to_investor : null} missing="Nothing outstanding"
            hint="Approved settlement amounts not yet paid" />
          <Figure label="Amount due from you" value={Number(s.due_from_investor) > 0 ? s.due_from_investor : null} missing="Nothing requested"
            tone={Number(s.due_from_investor) > 0 ? "warn" : "default"} hint="Only payment requests issued under your agreement" href="/portal/transactions" />
          {s.settlements_under_review > 0 && (
            <Figure label="Sales under review" value={s.settlements_under_review} money={false} tone="warn" hint="Settlement figures appear once approved" />
          )}
        </div>
      </Section>

      <Section title="Estimates" description="Forecasts prepared by Herdvest. These are not cash and may change.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Figure label="Estimated livestock value" tone="estimate" value={s.estimated_value} missing="Forecast not yet available" href="/portal/outlook"
            hint={s.estimated_value ? `Expected sale prices for ${s.estimated_value_animals} of ${s.active_animals} active animal(s)` : "Herdvest has not published a sale forecast for your animals yet"} />
          <EstimateNotice className="h-full" />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="My livestock" className="lg:col-span-2" bodyClassName="p-0"
          actions={<Link href="/portal/livestock" className="text-sm font-semibold text-emerald hover:underline">View all</Link>}>
          {d.animals.length === 0 ? (
            <div className="p-5"><Empty title="No animals recorded yet">Animals appear here once Herdvest records a purchase made with your funds.</Empty></div>
          ) : (
            <ul className="divide-y divide-forest/5">
              {d.animals.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link href={`/portal/livestock/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ivory/60">
                    {a.cover_photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/portal/files/${a.cover_photo}`} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ivory-200 text-ink-500"><PawPrint aria-hidden className="h-5 w-5" /></span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-forest">{a.code} <span className="font-normal text-ink-500">· {a.breed ?? a.species}</span></span>
                      <span className="block truncate text-xs text-ink-500">{animalStatusLabel[a.status] ?? a.status}</span>
                    </span>
                    <span className="hidden shrink-0 text-right text-xs text-ink-500 sm:block">
                      <InspectionBadge state={a.inspection_state} />
                      {a.next_inspection_due && <span className="mt-1 block">Next due {formatDate(a.next_inspection_due, tz)}</span>}
                    </span>
                    <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Latest updates" bodyClassName="p-0"
          actions={<Link href="/portal/notifications" className="text-sm font-semibold text-emerald hover:underline">All</Link>}>
          {d.notes.length === 0 ? <p className="p-5 text-sm text-ink-500">No updates yet. You&apos;ll be notified when Herdvest publishes reports, photos or statements.</p> : (
            <ul className="divide-y divide-forest/5">
              {d.notes.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <Link href={n.link ?? "/portal/notifications"} className="block text-sm hover:underline">
                    <span className={n.read_at ? "text-charcoal" : "font-semibold text-forest"}>{n.title}</span>
                  </Link>
                  <p className="text-xs text-ink-500">{formatDate(n.created_at, tz, true)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
