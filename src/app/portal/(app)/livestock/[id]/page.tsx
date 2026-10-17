import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Film } from "lucide-react";
import { formatDate, formatMoney, label } from "@/lib/erp/format";
import { animalStatusLabel, isUuid, portalQuery, portalTimezone, weightSourceLabel } from "@/lib/portal/data";
import { Alert, Card, DL, Money, StatusBadge, Timeline } from "@/components/erp/ui";
import { EstimateNotice, InspectionBadge, PortalHeading } from "@/components/portal/ui";
import { WeightChart } from "@/components/portal/WeightChart";

export const metadata = { title: "Animal" };

export default async function AnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const tz = await portalTimezone();
  // Every function below checks that this animal belongs to the signed-in investor.
  const d = await portalQuery(async (db) => {
    const a = (await db.query("select * from hv.portal_animals() where id = $1", [id])).rows[0];
    if (!a) return null;
    return {
      a,
      inspections: (await db.query("select * from hv.portal_inspections($1)", [id])).rows,
      weights: (await db.query("select * from hv.portal_weights($1)", [id])).rows,
      forecast: (await db.query("select * from hv.portal_forecasts($1)", [id])).rows[0],
      updates: (await db.query("select * from hv.portal_updates($1)", [id])).rows,
      history: (await db.query("select * from hv.portal_status_history($1)", [id])).rows,
      settlement: (await db.query("select * from hv.portal_settlement($1)", [id])).rows[0],
      files: (await db.query("select * from hv.portal_files() where animal_id = $1", [id])).rows,
    };
  });
  if (!d) notFound();
  const { a } = d;

  const media = d.files.filter((f) => /^(image\/(jpeg|png|webp)|video\/)/.test(f.mime_type));
  const docs = d.files.filter((f) => !media.includes(f));
  const completed = d.inspections.filter((i) => i.state === "completed");
  const vaccinations = completed.filter((i) => i.vaccine_name);
  const upcoming = d.inspections.filter((i) => ["scheduled", "overdue", "awaiting_review"].includes(i.state));
  const points = d.weights.map((w) => ({ date: w.measured_on as string, kg: Number(w.weight) }));
  const first = points[0], last = points[points.length - 1];
  const spanDays = first && last ? (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000 : 0;
  const trend = points.length >= 2 && spanDays >= 14 ? (last.kg - first.kg) / spanDays : null;
  const estimate = d.forecast?.estimated_weight_kg && d.forecast?.estimated_weight_date
    ? { date: d.forecast.estimated_weight_date as string, kg: Number(d.forecast.estimated_weight_kg) } : null;

  return (
    <div className="space-y-6">
      <PortalHeading
        title={`${a.code} · ${label(a.species)}${a.breed ? ` (${a.breed})` : ""}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={a.status} />{animalStatusLabel[a.status] ?? ""}{a.tag_number && <span>· Tag {a.tag_number}</span>}</span>}
        actions={<Link href="/portal/livestock" className="text-sm font-semibold text-emerald hover:underline">← All livestock</Link>}
      />

      {a.status === "deceased" && (
        <Alert tone="error" title="This animal is recorded as deceased">
          Herdvest will contact you directly about this. Any decision on how the loss is handled under your agreement will be shared with you.
        </Alert>
      )}

      <Card title={`Photographs and videos (${media.length})`}>
        {media.length === 0 ? (
          <p className="text-sm text-ink-500">No photographs of this animal have been published yet. Only genuine photographs of {a.code} are shown here.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((f) => (
              <li key={f.id} className="overflow-hidden rounded-xl border border-forest/10 bg-ivory">
                {f.mime_type.startsWith("video/") ? (
                  <video src={`/portal/files/${f.id}`} controls preload="metadata" className="aspect-[4/3] w-full bg-black object-contain" />
                ) : (
                  <a href={`/portal/files/${f.id}`} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/portal/files/${f.id}`} alt={f.caption ?? `Photograph of ${a.code}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  </a>
                )}
                <p className="px-2 py-1.5 text-[0.7rem] text-ink-500">
                  <span className="block truncate font-medium text-charcoal">{f.caption ?? f.entity_label}</span>
                  Taken/uploaded {formatDate(f.uploaded_at, tz)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Animal details" className="lg:col-span-2">
          <DL cols={3} items={[
            ["Herdvest ID", a.code], ["Type", label(a.species)], ["Breed", a.breed ?? "Not recorded"], ["Sex", label(a.sex)], ["Colour", a.color],
            ["Age (estimated)", a.age_months_estimate ? `${a.age_months_estimate} months at record` : a.birth_date_estimate ? `Born about ${formatDate(a.birth_date_estimate, tz)}` : "Not recorded"],
            ["Purchase date", formatDate(a.purchase_date, tz)], ["Initial purchase price", <Money key="p" value={a.purchase_price} strong />], ["Investment account", a.account_code],
            ["Partner farmer", a.farmer_label ?? "Not yet placed"], ["Farm area", a.farm_area ?? "—"], ["With current farmer since", formatDate(a.allocated_since, tz)],
            ["Condition at purchase", a.condition_at_purchase ?? "—"], ["Assessment at purchase", a.vet_assessment_at_purchase ?? "—"],
          ]} />
          <p className="mt-4 text-xs text-ink-500">Farmer identity and exact farm addresses are kept private under Herdvest&apos;s privacy policy.</p>
        </Card>
        <Card title="Health and care">
          <DL cols={1} items={[
            ["Current health status", a.latest_condition ? <span key="c">{label(a.latest_condition)} <span className="text-xs text-ink-500">(assessed {formatDate(a.latest_condition_date, tz)})</span></span> : "No published assessment yet"],
            ["Latest recorded weight", a.latest_weight ? `${Number(a.latest_weight)} kg on ${formatDate(a.latest_weight_date, tz)}` : "Not yet recorded"],
            ["Latest inspection", a.last_inspection ? formatDate(a.last_inspection, tz) : "None completed yet"],
            ["Next scheduled inspection", <span key="n" className="flex flex-wrap items-center gap-2">{a.next_inspection_due ? formatDate(a.next_inspection_due, tz) : "Not yet scheduled"}<InspectionBadge state={a.inspection_state} /></span>],
            ["Inspection plan", a.inspection_interval_months ? `About every ${a.inspection_interval_months} months, following the animal's veterinary care plan` : "—"],
          ]} />
        </Card>
      </div>

      <Card title="Weight and growth">
        {points.length === 0 ? (
          <p className="text-sm text-ink-500">No weight measurements have been published yet.</p>
        ) : (
          <div className="space-y-4">
            <WeightChart points={points} estimate={estimate} />
            {trend === null ? (
              <p className="rounded-lg bg-ivory/70 px-3 py-2 text-sm text-ink-600">
                More measurements are needed to show a meaningful growth trend (at least two measurements, two weeks apart).
              </p>
            ) : (
              <p className="rounded-lg bg-ivory/70 px-3 py-2 text-sm text-ink-600">
                Recorded change: <strong>{(last.kg - first.kg).toFixed(1)} kg</strong> over {Math.round(spanDays)} days
                (about {(trend * 1000).toFixed(0)} g per day), from actual measurements only.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-ink-500"><tr><th className="py-1.5 pr-3">Date</th><th className="pr-3 text-right">Weight</th><th className="pr-3">Method</th><th className="pr-3">Recorded by</th><th>Notes</th></tr></thead>
                <tbody className="divide-y divide-forest/5">
                  {[...d.weights].reverse().map((w) => (
                    <tr key={w.id}>
                      <td className="py-2 pr-3">{formatDate(w.measured_on, tz)}</td>
                      <td className="pr-3 text-right font-medium tabular-nums">{Number(w.weight)} {w.unit}</td>
                      <td className="pr-3 text-xs">{weightSourceLabel[w.source] ?? label(w.source)}</td>
                      <td className="pr-3 text-xs">{w.measured_by ?? "—"}</td>
                      <td className="text-xs text-ink-600">{w.notes ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {estimate && (
          <p className="mt-3 text-xs text-ink-500">
            Estimated weight of {estimate.kg} kg by {formatDate(estimate.date, tz)} is a forecast, not a measurement. Assumptions: {d.forecast.assumptions}
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Inspections and veterinary reports" bodyClassName="p-0">
          {d.inspections.length === 0 ? <p className="p-5 text-sm text-ink-500">No inspections recorded yet.</p> : (
            <ul className="divide-y divide-forest/5">
              {d.inspections.map((i) => (
                <li key={i.id} className="space-y-1 px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-forest">{label(i.visit_type)} · {formatDate(i.event_date, tz)}</span>
                    <InspectionBadge state={i.state} />
                  </div>
                  {i.state === "completed" ? (
                    <>
                      <p className="text-xs text-ink-500">{[i.code, i.performed_by && `by ${i.performed_by}`, i.condition && `condition: ${i.condition}`, i.weight_kg && `${Number(i.weight_kg)} kg`].filter(Boolean).join(" · ")}</p>
                      {i.summary && <p className="text-charcoal">{i.summary}</p>}
                      {i.findings && <p className="text-ink-600"><span className="font-medium">Findings:</span> {i.findings}</p>}
                      {i.vaccine_name && <p className="text-ink-600"><span className="font-medium">Vaccination:</span> {i.vaccine_name}{i.vaccination_date ? ` (${formatDate(i.vaccination_date, tz)})` : ""}</p>}
                      {i.treatment && <p className="text-ink-600"><span className="font-medium">Treatment:</span> {i.treatment}</p>}
                      {i.follow_up && <p className="text-ink-600"><span className="font-medium">Recommendations:</span> {i.follow_up}</p>}
                      {i.next_due_date && <p className="text-xs text-ink-500">Follow-up due {formatDate(i.next_due_date, tz)}</p>}
                      {d.files.filter((f) => f.entity_type === "vet_record" && f.entity_id === i.id).map((f) => (
                        <a key={f.id} href={`/portal/files/${f.id}`} target="_blank" rel="noopener" className="mr-3 inline-flex items-center gap-1 text-xs text-emerald hover:underline">
                          <FileText aria-hidden className="h-3.5 w-3.5" />{f.caption ?? f.original_name}
                        </a>
                      ))}
                    </>
                  ) : i.state === "awaiting_review" ? (
                    <p className="text-xs text-ink-500">A report has been submitted and is awaiting review by Herdvest before it is published.</p>
                  ) : i.state === "overdue" ? (
                    <p className="text-xs text-ink-500">This visit was planned but no report has been submitted yet (inspection pending).</p>
                  ) : (
                    <p className="text-xs text-ink-500">Planned visit — no report yet.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Vaccination history">
            {vaccinations.length === 0 ? <p className="text-sm text-ink-500">No published vaccination records yet.</p> : (
              <ul className="space-y-2 text-sm">
                {vaccinations.map((v) => (
                  <li key={v.id} className="flex justify-between gap-3"><span>{v.vaccine_name}</span><span className="text-ink-500">{formatDate(v.vaccination_date ?? v.event_date, tz)}</span></li>
                ))}
              </ul>
            )}
            {upcoming.length > 0 && <p className="mt-3 text-xs text-ink-500">{upcoming.length} visit(s) scheduled, pending or awaiting review — see the list.</p>}
          </Card>
          <Card title="Investment outlook for this animal">
            {d.forecast ? (
              <div className="space-y-3">
                <DL cols={2} items={[
                  ["Expected sale price", formatMoney(d.forecast.expected_sale_price)],
                  ["Expected sale", d.forecast.expected_sale_date ? formatDate(d.forecast.expected_sale_date, tz) : d.forecast.expected_sale_period],
                  ["Purchase price (actual)", formatMoney(d.forecast.purchase_price)],
                  ["Estimated profit pool", formatMoney(d.forecast.profit_pool)],
                  ["Your estimated gross share", formatMoney(d.forecast.investor_gross)],
                  ["Estimated Herdvest fee", formatMoney(d.forecast.herdvest_fee)],
                  ["Your estimated net profit", formatMoney(d.forecast.investor_net)],
                  ["Estimated total back to you", formatMoney(d.forecast.investor_total)],
                ]} />
                <p className="text-xs text-ink-500">Assumptions: {d.forecast.assumptions}</p>
                <p className="text-xs text-ink-500">Last updated {formatDate(d.forecast.published_at, tz)}{d.forecast.published_by_role ? ` by ${d.forecast.published_by_role}` : ""}.</p>
                <EstimateNotice />
              </div>
            ) : a.status === "sold" ? (
              <p className="text-sm text-ink-500">This animal has been sold. See the settlement below.</p>
            ) : (
              <p className="text-sm text-ink-500">Forecast not yet available.</p>
            )}
          </Card>
        </div>
      </div>

      {(d.settlement || a.settlement_status === "under_review") && (
        <Card title="Sale and settlement">
          {d.settlement ? (
            <DL cols={3} items={[
              ["Sale date", formatDate(d.settlement.sale_date, tz)], ["Sale proceeds (gross)", <Money key="g" value={d.settlement.gross_proceeds} />],
              ["Purchase cost", <Money key="c" value={d.settlement.purchase_cost} />],
              ...(Number(d.settlement.deducted_sale_expenses) > 0 ? [["Sale expenses deducted (per agreement)", <Money key="e" value={d.settlement.deducted_sale_expenses} />]] as Array<[string, React.ReactNode]> : []),
              ["Capital returned", <Money key="r" value={d.settlement.capital_returned} />],
              ...(Number(d.settlement.capital_shortfall) > 0 ? [["Capital shortfall (loss)", <Money key="s" value={`-${d.settlement.capital_shortfall}`} />]] as Array<[string, React.ReactNode]> : []),
              ["Profit pool", <Money key="pp" value={d.settlement.profit_pool} />],
              [`Your gross share (${Number(d.settlement.investor_share_pct)}%)`, <Money key="ig" value={d.settlement.investor_gross} />],
              [`Herdvest fee (${Number(d.settlement.service_fee_pct)}% of your share, once)`, <Money key="f" value={d.settlement.herdvest_fee} />],
              ["Your net profit", <Money key="n" value={d.settlement.investor_net} strong />],
              ["Approved amount payable to you", <Money key="p" value={d.settlement.investor_payable} strong />],
              ["Paid to you so far", <Money key="pd" value={d.settlement.paid_to_investor} />],
              ["Outstanding", <Money key="o" value={d.settlement.outstanding} />],
              ["Status", <StatusBadge key="st" status={d.settlement.status} />],
            ]} />
          ) : (
            <p className="text-sm text-ink-500">A sale has been recorded. Settlement figures will appear here once Herdvest has reviewed and approved them.</p>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Updates from Herdvest">
          {d.updates.length === 0 ? <p className="text-sm text-ink-500">No updates published yet.</p> : (
            <Timeline timeZone={tz} items={d.updates.map((u) => ({ at: u.published_at, title: u.title, body: u.body }))} />
          )}
        </Card>
        <Card title="Status history">
          <Timeline timeZone={tz} items={d.history.map((h) => ({ at: h.changed_at, title: animalStatusLabel[h.to_status] ?? label(h.to_status) }))} />
        </Card>
      </div>

      {docs.length > 0 && (
        <Card title="Documents for this animal">
          <ul className="divide-y divide-forest/5">
            {docs.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a href={`/portal/files/${f.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 text-forest hover:underline">
                  {f.mime_type.startsWith("video/") ? <Film aria-hidden className="h-4 w-4 shrink-0" /> : <FileText aria-hidden className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{f.caption ?? f.original_name}</span>
                </a>
                <span className="shrink-0 text-xs text-ink-500">{label(f.category)} · {f.entity_label}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
