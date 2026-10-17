import Link from "next/link";
import { formatDate, sumMoney } from "@/lib/erp/format";
import { portalQuery, portalTimezone } from "@/lib/portal/data";
import { Card, Empty, Money } from "@/components/erp/ui";
import { EstimateNotice, Figure, PortalHeading } from "@/components/portal/ui";

export const metadata = { title: "Investment Outlook" };

export default async function OutlookPage() {
  const tz = await portalTimezone();
  const d = await portalQuery(async (db) => ({
    f: (await db.query("select * from hv.portal_forecasts()")).rows,
    active: (await db.query("select count(*)::int n from hv.portal_animals() where status not in ('sold','deceased')")).rows[0].n as number,
  }));
  const total = (k: string) => sumMoney(d.f.map((r) => r[k]));

  return (
    <div className="space-y-6">
      <PortalHeading title="Investment Outlook" subtitle="Herdvest's published estimates for your active animals, based on your agreement and the actual purchase prices." />
      <EstimateNotice />

      {d.f.length === 0 ? (
        <Empty title="Forecast not yet available">Herdvest has not published a sale forecast for your animals yet. Forecasts are only shown after review.</Empty>
      ) : (
        <>
          <p className="text-sm text-ink-500">Forecasts cover {d.f.length} of your {d.active} active animal(s).{d.f.length < d.active && " Animals without a published forecast are not included in these totals."}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure tone="estimate" label="Estimated sale proceeds" value={total("expected_sale_price")} />
            <Figure tone="estimate" label="Estimated profit pool" value={total("profit_pool")} />
            <Figure tone="estimate" label="Your estimated gross share" value={total("investor_gross")} />
            <Figure tone="estimate" label="Estimated Herdvest fee" value={total("herdvest_fee")} hint="20% of your share, once per sale (per your agreement)" />
            <Figure tone="estimate" label="Your estimated net profit" value={total("investor_net")} />
            <Figure tone="estimate" label="Estimated total back to you" value={total("investor_total")} hint="Capital returned plus net profit" />
            <Figure label="Purchase prices (actual)" value={total("purchase_price")} />
          </div>
          <Card title="By animal" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-ivory/70 text-left text-xs text-ink-600">
                  <tr>
                    <th className="px-5 py-2">Animal</th><th className="px-3 py-2 text-right">Purchase price</th><th className="px-3 py-2 text-right">Expected sale price</th>
                    <th className="px-3 py-2">Expected sale</th><th className="px-3 py-2 text-right">Your est. net profit</th><th className="px-3 py-2 text-right">Est. total to you</th><th className="px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/5">
                  {d.f.map((r) => (
                    <tr key={r.animal_id} className="align-top">
                      <td className="px-5 py-2.5"><Link href={`/portal/livestock/${r.animal_id}`} className="font-semibold text-forest hover:underline">{r.animal_code}</Link></td>
                      <td className="px-3 py-2.5 text-right"><Money value={r.purchase_price} /></td>
                      <td className="px-3 py-2.5 text-right"><Money value={r.expected_sale_price} /></td>
                      <td className="px-3 py-2.5">{r.expected_sale_date ? formatDate(r.expected_sale_date, tz) : r.expected_sale_period}</td>
                      <td className="px-3 py-2.5 text-right"><Money value={r.investor_net} /></td>
                      <td className="px-3 py-2.5 text-right"><Money value={r.investor_total} /></td>
                      <td className="px-3 py-2.5 text-xs text-ink-500">{formatDate(r.published_at, tz)}{r.published_by_role ? ` · ${r.published_by_role}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Assumptions">
            <ul className="space-y-2 text-sm text-ink-600">
              {d.f.map((r) => <li key={r.animal_id}><span className="font-semibold text-forest">{r.animal_code}:</span> {r.assumptions}</li>)}
            </ul>
            <p className="mt-4 text-xs text-ink-500">
              Model: capital is returned first; a positive profit pool is shared {Number(d.f[0].investor_share_pct)}% to you and the rest to the partner farmer;
              Herdvest&apos;s fee is {Number(d.f[0].service_fee_pct)}% of your gross share, charged once when the animal is sold. If the sale price is below
              the purchase price there is no profit share and no fee, and you would bear the shortfall.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
