import Link from "next/link";
import { formatDate, label } from "@/lib/erp/format";
import { portalQuery, portalTimezone } from "@/lib/portal/data";
import { Card, Empty } from "@/components/erp/ui";
import { InspectionBadge, PortalHeading } from "@/components/portal/ui";

export const metadata = { title: "Inspections" };

export default async function InspectionsPage() {
  const tz = await portalTimezone();
  const d = await portalQuery(async (db) => ({
    list: (await db.query("select * from hv.portal_inspections()")).rows,
    plan: (await db.query("select id, code, status, next_inspection_due, inspection_state, last_inspection from hv.portal_animals() where status not in ('sold','deceased')")).rows,
  }));

  return (
    <div className="space-y-6">
      <PortalHeading title="Inspections and veterinary reports"
        subtitle="Reports appear here after Herdvest has reviewed and published them. Planned visits are shown as scheduled until a report exists." />

      <Card title="Inspection plan" bodyClassName="p-0">
        {d.plan.length === 0 ? <p className="p-5 text-sm text-ink-500">No active animals.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-ivory/70 text-left text-xs text-ink-600"><tr><th className="px-5 py-2">Animal</th><th className="px-3 py-2">Last inspection</th><th className="px-3 py-2">Next due</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-forest/5">
                {d.plan.map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-2.5"><Link href={`/portal/livestock/${a.id}`} className="font-semibold text-forest hover:underline">{a.code}</Link></td>
                    <td className="px-3 py-2.5">{a.last_inspection ? formatDate(a.last_inspection, tz) : "None yet"}</td>
                    <td className="px-3 py-2.5">{a.next_inspection_due ? formatDate(a.next_inspection_due, tz) : "Not yet scheduled"}</td>
                    <td className="px-3 py-2.5"><InspectionBadge state={a.inspection_state} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {d.list.length === 0 ? (
        <Empty title="No inspections recorded yet">Inspection and veterinary reports will be listed here once completed and published.</Empty>
      ) : (
        <Card title="All visits and reports" bodyClassName="p-0">
          <ul className="divide-y divide-forest/5">
            {d.list.map((i) => (
              <li key={i.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/portal/livestock/${i.animal_id}`} className="font-semibold text-forest hover:underline">
                    {i.animal_code} · {label(i.visit_type)}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-ink-500">{formatDate(i.event_date, tz)}<InspectionBadge state={i.state} /></span>
                </div>
                {i.state === "completed" ? (
                  <p className="mt-1 text-ink-600">
                    {[i.summary ?? i.findings, i.condition && `Condition: ${i.condition}`, i.weight_kg && `${Number(i.weight_kg)} kg`, i.vaccine_name && `Vaccine: ${i.vaccine_name}`, i.performed_by && `By ${i.performed_by}`].filter(Boolean).join(" · ")}
                  </p>
                ) : i.state === "awaiting_review" ? (
                  <p className="mt-1 text-xs text-ink-500">Report submitted — awaiting Herdvest review before publication.</p>
                ) : i.state === "overdue" ? (
                  <p className="mt-1 text-xs text-ink-500">Inspection pending — the planned date has passed and no report has been submitted yet.</p>
                ) : (
                  <p className="mt-1 text-xs text-ink-500">Scheduled visit.</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
