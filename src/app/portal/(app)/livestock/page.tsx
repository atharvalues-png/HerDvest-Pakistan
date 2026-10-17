import Link from "next/link";
import { PawPrint } from "lucide-react";
import { formatDate, label } from "@/lib/erp/format";
import { animalStatusLabel, portalQuery, portalTimezone } from "@/lib/portal/data";
import { Empty, Money, StatusBadge } from "@/components/erp/ui";
import { InspectionBadge, PortalHeading } from "@/components/portal/ui";

export const metadata = { title: "My Livestock" };

export default async function LivestockPage() {
  const tz = await portalTimezone();
  const animals = await portalQuery(async (db) => (await db.query("select * from hv.portal_animals()")).rows);

  return (
    <div>
      <PortalHeading title="My Livestock" subtitle={`${animals.length} animal${animals.length === 1 ? "" : "s"} purchased with your funds`} />
      {animals.length === 0 ? (
        <Empty title="No animals recorded yet">Animals appear here once Herdvest records a purchase made with your verified funds.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {animals.map((a) => (
            <li key={a.id}>
              <Link href={`/portal/livestock/${a.id}`} className="block h-full overflow-hidden rounded-2xl border border-forest/10 bg-white transition-colors hover:border-emerald/40">
                {a.cover_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/portal/files/${a.cover_photo}`} alt={`Photograph of ${a.code}`} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-ivory-200 text-ink-500">
                    <PawPrint aria-hidden className="h-8 w-8" />
                    <span className="text-xs">No photograph published yet</span>
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-semibold text-forest">{a.code}</p>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-sm text-ink-600">{label(a.species)}{a.breed ? ` · ${a.breed}` : ""}</p>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-ink-500">Purchase price</dt><dd className="font-medium text-charcoal"><Money value={a.purchase_price} /></dd></div>
                    <div><dt className="text-ink-500">Latest weight</dt><dd className="font-medium text-charcoal">{a.latest_weight ? `${Number(a.latest_weight)} kg` : "Not yet recorded"}</dd></div>
                    <div><dt className="text-ink-500">Health</dt><dd className="font-medium text-charcoal">{a.latest_condition ? label(a.latest_condition) : "No published assessment"}</dd></div>
                    <div><dt className="text-ink-500">Next inspection</dt><dd className="font-medium text-charcoal">{a.next_inspection_due ? formatDate(a.next_inspection_due, tz) : "—"}</dd></div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-ink-500">
                    <InspectionBadge state={a.inspection_state} />
                    <span>{animalStatusLabel[a.status] ?? label(a.status)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
