import { can, type SessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { formatDate, formatMoney, label } from "@/lib/erp/format";
import { Checkbox, ConfirmAction, FileField, Input, MoneyInput, Select, Textarea } from "@/components/erp/form";
import { Badge, Card, StatusBadge } from "@/components/erp/ui";
import {
  createForecast, publishForecast, publishUpdate, recordWeight, setCarePlan, setWeightPublication, voidWeight, withdrawForecast, withdrawUpdate,
} from "../../portal/actions";

const stateLabel: Record<string, string> = {
  awaiting_review: "Report awaiting review", scheduled: "Scheduled", pending: "Inspection pending", overdue: "Overdue",
  not_planned: "Not planned", closed: "Closed",
};

/** Monitoring and investor-portal publishing for one animal: inspection plan, weights, forecasts and updates. */
export async function AnimalPortalPanels({ user, animalId, hasInvestor, closed, timeZone }: {
  user: SessionUser; animalId: string; hasInvestor: boolean; closed: boolean; timeZone: string;
}) {
  const showForecasts = can(user, "forecasts.write", "portal.publish", "finance.read");
  const d = await withUser(user.id, async (db) => ({
    plan: (await db.query("select * from hv.inspection_status($1)", [animalId])).rows[0],
    care: (await db.query("select * from hv.animal_care_plans where animal_id = $1", [animalId])).rows[0],
    weights: (await db.query(
      `select w.*, u.full_name recorder,
              (select json_agg(json_build_object('id', a.id, 'name', coalesce(a.caption, a.original_name))) from hv.attachments a
                where a.entity_type = 'animal_weight' and a.entity_id = w.id and a.deleted_at is null) files
         from hv.animal_weights w left join hv.users u on u.id = w.created_by where w.animal_id = $1 order by w.measured_on desc, w.created_at desc`, [animalId])).rows,
    forecasts: showForecasts ? (await db.query(
      `select f.*, pu.full_name preparer, pb.full_name publisher, pl.price purchase_price
         from hv.animal_forecasts f left join hv.users pu on pu.id = f.prepared_by left join hv.users pb on pb.id = f.published_by
         left join hv.purchase_lines pl on pl.animal_id = f.animal_id
        where f.animal_id = $1 order by f.created_at desc`, [animalId])).rows : [],
    updates: (await db.query("select * from hv.animal_updates where animal_id = $1 order by published_at desc", [animalId])).rows,
  }));
  const publish = can(user, "portal.publish");

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Inspection plan"
          actions={can(user, "livestock.write", "vet.write") && (
            <ConfirmAction action={setCarePlan.bind(null, animalId)} trigger="Edit plan" triggerVariant="ghost" title="Inspection plan"
              description="Follow the animal's veterinary care plan. The default interval comes from Settings (6 months).">
              <Input name="interval" label="Inspection interval (months)" inputMode="numeric" defaultValue={d.care?.inspection_interval_months ?? ""} placeholder={String(d.plan?.interval_months ?? 6)} />
              <Input name="next_due" label="Next inspection due (overrides the interval)" type="date" defaultValue={d.care?.next_inspection_due ?? ""} />
              <Textarea name="notes" label="Care-plan notes (internal)" rows={2} defaultValue={d.care?.notes ?? ""} />
            </ConfirmAction>
          )}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-ink-500">Last completed inspection</dt><dd>{d.plan?.last_completed ? formatDate(d.plan.last_completed, timeZone) : "None"}</dd></div>
            <div><dt className="text-xs text-ink-500">Next due</dt><dd>{d.plan?.next_due ? formatDate(d.plan.next_due, timeZone) : "—"}</dd></div>
            <div><dt className="text-xs text-ink-500">Interval</dt><dd>{d.plan?.interval_months} months{d.care?.inspection_interval_months ? "" : " (default)"}</dd></div>
            <div><dt className="text-xs text-ink-500">Shown to investor as</dt><dd><Badge tone={d.plan?.state === "overdue" ? "red" : d.plan?.state === "scheduled" ? "blue" : "gold"}>{stateLabel[d.plan?.state] ?? d.plan?.state}</Badge></dd></div>
          </dl>
          {d.care?.notes && <p className="mt-3 text-xs text-ink-500">{d.care.notes}</p>}
        </Card>

        <Card title={`Weight measurements (${d.weights.filter((w) => !w.voided_at).length})`} bodyClassName="p-0"
          actions={can(user, "vet.write") && !closed && (
            <ConfirmAction action={recordWeight.bind(null, animalId)} trigger="Record weight" triggerVariant="primary" title="Record a weight measurement"
              description="Record actual measurements only. Estimates belong in a forecast.">
              <div className="grid grid-cols-2 gap-3">
                <Input name="measured_on" label="Measured on" type="date" required />
                <Input name="weight" label="Weight (kg)" inputMode="decimal" required />
              </div>
              <Select name="method" label="Method" required options={[["scale", "Weighing scale"], ["weigh_tape", "Weigh tape"], ["visual_estimate", "Visual estimate"], ["other", "Other"]]} />
              <Input name="measured_by" label="Measured by (person or vet)" />
              <Textarea name="notes" label="Notes (shown to the investor if published)" rows={2} />
              <FileField name="file" label="Photo of the scale / animal (optional)" accept="image/*,application/pdf" capture="environment" />
              {publish && hasInvestor && <Checkbox name="publish" label="Publish to the investor now" />}
            </ConfirmAction>
          )}>
          {d.weights.length === 0 ? <p className="p-5 text-sm text-ink-500">No measurements yet.</p> : (
            <ul className="divide-y divide-forest/5">
              {d.weights.map((w) => (
                <li key={w.id} className={`flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm ${w.voided_at ? "opacity-60" : ""}`}>
                  <span>
                    <span className={`font-semibold text-forest ${w.voided_at ? "line-through" : ""}`}>{Number(w.weight)} kg</span>{" "}
                    <span className="text-ink-500">· {formatDate(w.measured_on, timeZone)} · {label(w.method)}{w.measured_by ? ` · ${w.measured_by}` : ""}</span>
                    <span className="block text-xs text-ink-500">{w.code} · entered by {w.recorder ?? "—"}{w.voided_at ? ` · VOIDED: ${w.void_reason}` : ""}</span>
                    {(w.files ?? []).map((f: { id: string; name: string }) => (
                      <a key={f.id} href={`/management/files/${f.id}`} target="_blank" rel="noopener" className="mr-2 text-xs text-emerald hover:underline">📎 {f.name}</a>
                    ))}
                  </span>
                  {!w.voided_at && (
                    <span className="flex items-center gap-1">
                      {w.investor_visible ? <Badge tone="green">Published</Badge> : <Badge>Not published</Badge>}
                      {publish && hasInvestor && (
                        <ConfirmAction action={setWeightPublication.bind(null, w.id, animalId, !w.investor_visible)} trigger={w.investor_visible ? "Unpublish" : "Publish"} triggerVariant="ghost"
                          title={w.investor_visible ? "Withdraw this measurement from the portal?" : "Publish this measurement to the investor?"} confirmLabel={w.investor_visible ? "Unpublish" : "Publish"} />
                      )}
                      {can(user, "vet.write") && (
                        <ConfirmAction action={voidWeight.bind(null, w.id, animalId)} trigger="Void" triggerVariant="ghost" variant="danger" title="Void this measurement?"
                          description="Use this for a wrong entry. It stays in the history and disappears from the investor's chart." confirmLabel="Void">
                          <Textarea name="reason" label="Reason" required rows={2} />
                        </ConfirmAction>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {hasInvestor && (
        <div className="grid gap-6 lg:grid-cols-2">
          {showForecasts && (
            <Card title="Sale forecasts (investor outlook)" bodyClassName="p-0"
              actions={can(user, "forecasts.write") && !closed && (
                <ConfirmAction action={createForecast.bind(null, animalId)} trigger="New forecast" triggerVariant="primary" title="Prepare a sale forecast"
                  description="Saved as a draft. The investor sees it only after someone with publishing permission publishes it. Figures are calculated from the actual purchase price and the account's agreed split.">
                  <MoneyInput name="expected_sale_price" label="Expected sale price (PKR)" required />
                  <div className="grid grid-cols-2 gap-3">
                    <Input name="expected_sale_date" label="Expected sale date" type="date" />
                    <Input name="expected_sale_period" label="…or period" placeholder="e.g. Eid ul Adha 2027" />
                    <Input name="estimated_weight_kg" label="Estimated weight (kg)" inputMode="decimal" />
                    <Input name="estimated_weight_date" label="…by date" type="date" />
                  </div>
                  <Textarea name="assumptions" label="Assumptions (shown to the investor)" required rows={3}
                    hint="E.g. current weight trend, recent market prices in the district, expected demand. Avoid promises." />
                </ConfirmAction>
              )}>
              {d.forecasts.length === 0 ? <p className="p-5 text-sm text-ink-500">No forecasts. The investor sees “Forecast not yet available”.</p> : (
                <ul className="divide-y divide-forest/5">
                  {d.forecasts.map((f) => (
                    <li key={f.id} className="px-5 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-forest">{formatMoney(f.expected_sale_price)} · {f.expected_sale_date ? formatDate(f.expected_sale_date, timeZone) : f.expected_sale_period}</span>
                        <StatusBadge status={f.status} />
                      </div>
                      <p className="text-xs text-ink-500">Purchase {formatMoney(f.purchase_price)}{f.estimated_weight_kg ? ` · est. ${Number(f.estimated_weight_kg)} kg by ${formatDate(f.estimated_weight_date, timeZone)}` : ""} · prepared by {f.preparer ?? "—"} {formatDate(f.created_at, timeZone)}{f.publisher ? ` · published by ${f.publisher}` : ""}</p>
                      <p className="mt-1 text-ink-600">{f.assumptions}</p>
                      {f.withdrawn_reason && <p className="text-xs text-ink-500">Withdrawn: {f.withdrawn_reason}</p>}
                      <div className="mt-1 flex gap-1">
                        {f.status === "draft" && publish && (
                          <ConfirmAction action={publishForecast.bind(null, f.id, animalId)} trigger="Publish" triggerVariant="ghost" title="Publish this forecast to the investor?"
                            description="It will be clearly labelled as an estimate. The previous published forecast becomes superseded." confirmLabel="Publish" />
                        )}
                        {(f.status === "draft" || f.status === "published") && can(user, "forecasts.write", "portal.publish") && (
                          <ConfirmAction action={withdrawForecast.bind(null, f.id, animalId)} trigger="Withdraw" triggerVariant="ghost" variant="danger" title="Withdraw this forecast?" confirmLabel="Withdraw">
                            <Textarea name="reason" label="Reason" required rows={2} />
                          </ConfirmAction>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          <Card title="Updates published to the investor" bodyClassName="p-0"
            actions={publish && (
              <ConfirmAction action={publishUpdate.bind(null, animalId)} trigger="Publish update" triggerVariant="primary" title="Publish an update to the investor"
                description="Use for important health news, progress notes or an upcoming sale. It is published immediately and the investor is notified. Stick to verified facts.">
                <Select name="kind" label="Type" required options={[["health", "Health update"], ["progress", "Progress"], ["sale", "Upcoming sale"], ["general", "General"]]} />
                <Input name="title" label="Title" required />
                <Textarea name="body" label="Update" required rows={4} />
              </ConfirmAction>
            )}>
            {d.updates.length === 0 ? <p className="p-5 text-sm text-ink-500">No updates published.</p> : (
              <ul className="divide-y divide-forest/5">
                {d.updates.map((u) => (
                  <li key={u.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-forest">{u.title}</span>
                      <span className="flex items-center gap-1"><Badge tone={u.status === "published" ? "green" : "grey"}>{label(u.status)}</Badge>
                        {u.status === "published" && publish && (
                          <ConfirmAction action={withdrawUpdate.bind(null, u.id, animalId)} trigger="Withdraw" triggerVariant="ghost" variant="danger" title="Withdraw this update?" confirmLabel="Withdraw">
                            <Textarea name="reason" label="Reason" required rows={2} />
                          </ConfirmAction>
                        )}
                      </span>
                    </div>
                    <p className="text-ink-600">{u.body}</p>
                    <p className="text-xs text-ink-500">{label(u.kind)} · {formatDate(u.published_at, timeZone, true)}{u.withdrawn_reason ? ` · withdrawn: ${u.withdrawn_reason}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
