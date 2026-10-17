import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { ConfirmAction, MoneyInput, Select, Textarea } from "@/components/erp/form";
import { Alert, Card, DL, Money, PageHeader, StatusBadge, Timeline } from "@/components/erp/ui";
import { updateIncident, updateVetFindings } from "../actions";

export const metadata = { title: "Incident" };

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["incidents.read", "incidents.write"]);
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const x = (await db.query(
      `select x.*, a.code animal_code, a.status animal_status, f.full_name farmer, i.full_legal_name investor, u.full_name decider,
              (select pl.price from hv.purchase_lines pl where pl.animal_id = x.animal_id) purchase_cost
         from hv.incidents x join hv.animals a on a.id = x.animal_id left join hv.farmers f on f.id = x.farmer_id
         left join hv.investors i on i.id = x.investor_id left join hv.users u on u.id = x.decided_by where x.id = $1`, [id])).rows[0];
    if (!x) return null;
    const events = (await db.query(`select e.*, u.full_name who from hv.incident_events e left join hv.users u on u.id = e.changed_by where e.incident_id = $1 order by e.changed_at desc`, [id])).rows;
    const allocation = (await db.query(
      `select al.agreement_ref, al.responsibilities from hv.allocations al where al.animal_id = $1 order by al.start_date desc limit 1`, [x.animal_id])).rows[0];
    return { x, events, allocation };
  });
  if (!d) notFound();
  const { x } = d;
  const open = x.status !== "closed";
  const approver = can(user, "incidents.approve");

  return (
    <div className="space-y-6">
      <PageHeader title={`${x.code} · ${label(x.incident_type)}`} subtitle={<span className="flex items-center gap-2"><Link href={`/management/animals/${x.animal_id}`} className="hover:underline">{x.animal_code}</Link> <StatusBadge status={x.status} /></span>}
        crumbs={[{ href: "/management/incidents", label: "Incidents" }]}
        actions={can(user, "incidents.write") && open && (
          <ConfirmAction action={updateIncident.bind(null, id)} trigger="Update investigation" triggerVariant="primary" title="Update incident"
            description={approver ? "Recording a decision documents the approved loss allocation. It does not create any payment." : "Only authorised approvers can record a decision or close the incident."}>
            <Select name="status" label="Status" required defaultValue={x.status} options={[
              ["reported", "Reported"], ["investigating", "Investigating"], ["under_review", "Under review"],
              ...(approver ? [["decided", "Decided"], ["closed", "Closed"]] as Array<[string, string]> : [])]} />
            <Textarea name="note" label="Note for the history" required rows={2} />
            <Textarea name="contractual_notes" label="Relevant contractual responsibilities" defaultValue={x.contractual_notes} rows={2} />
            <MoneyInput name="estimated_loss" label="Estimated loss" defaultValue={x.estimated_loss} />
            {approver && (
              <>
                <Textarea name="decision" label="Approved loss allocation decision" defaultValue={x.decision} rows={3} hint="Required to mark as decided or closed." />
                <div className="grid grid-cols-3 gap-2">
                  <MoneyInput name="investor_loss" label="Investor bears" defaultValue={x.investor_loss} hint=" " />
                  <MoneyInput name="farmer_loss" label="Farmer bears" defaultValue={x.farmer_loss} hint=" " />
                  <MoneyInput name="herdvest_loss" label="Herdvest bears" defaultValue={x.herdvest_loss} hint=" " />
                </div>
              </>
            )}
          </ConfirmAction>
        )} />
      <Alert tone="info">No compensation, insurance payout or repayment is created automatically. Any agreed payment must be recorded through the normal finance workflows.</Alert>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Incident" className="lg:col-span-2"
          actions={can(user, "incidents.write") && open && (
            <ConfirmAction action={updateVetFindings.bind(null, id)} trigger="Edit findings" triggerVariant="ghost" title="Veterinary findings & outstanding items">
              <Textarea name="vet_findings" label="Veterinary findings" defaultValue={x.vet_findings} rows={4} />
              <Textarea name="outstanding_items" label="Expenses / outstanding payments" defaultValue={x.outstanding_items} rows={2} />
            </ConfirmAction>
          )}>
          <DL cols={3} items={[
            ["Occurred", formatDate(x.occurred_at, timezone, true)], ["Reported by", x.reported_by_name], ["Animal status", <StatusBadge key="s" status={x.animal_status} />],
            ["Investor", x.investor], ["Farmer", x.farmer], ["Purchase cost", x.purchase_cost ? <Money key="c" value={x.purchase_cost} /> : null],
            ["Allocation agreement", d.allocation?.agreement_ref], ["Estimated loss", x.estimated_loss ? <Money key="e" value={x.estimated_loss} /> : null],
          ]} />
          <div className="mt-4 space-y-2 text-sm text-ink-600">
            <p><strong className="text-forest">Description:</strong> {x.description}</p>
            {x.vet_findings && <p><strong className="text-forest">Veterinary findings:</strong> {x.vet_findings}</p>}
            {x.contractual_notes && <p><strong className="text-forest">Contractual responsibilities:</strong> {x.contractual_notes}</p>}
            {x.outstanding_items && <p><strong className="text-forest">Outstanding items:</strong> {x.outstanding_items}</p>}
            {d.allocation?.responsibilities && <p><strong className="text-forest">Farmer responsibilities (allocation):</strong> {d.allocation.responsibilities}</p>}
          </div>
        </Card>
        <Card title="Decision">
          {x.decision ? (
            <DL cols={1} items={[
              ["Approved allocation", x.decision], ["Investor bears", <Money key="i" value={x.investor_loss} />], ["Farmer bears", <Money key="f" value={x.farmer_loss} />],
              ["Herdvest bears", <Money key="h" value={x.herdvest_loss} />], ["Decided by", x.decider ? `${x.decider}, ${formatDate(x.decided_at, timezone)}` : null],
            ]} />
          ) : <p className="text-sm text-ink-500">No decision recorded yet.</p>}
        </Card>
      </div>
      <Card title="Review & approval history">
        <Timeline timeZone={timezone} items={d.events.map((e) => ({ at: e.changed_at, who: e.who, title: `${e.from_status ? label(e.from_status) + " → " : ""}${label(e.to_status)}`, body: e.note }))} />
      </Card>
      <Attachments user={user} entityType="incident" entityId={id} path={`/management/incidents/${id}`} timeZone={timezone} defaultCategory="incident_document" title="Incident documentation" />
      <History user={user} ids={[id]} timeZone={timezone} />
    </div>
  );
}
