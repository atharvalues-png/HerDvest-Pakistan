import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { animalOptions, employeeOptions } from "@/lib/erp/options";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { Alert, Badge, Card, DL, LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";
import { ConfirmAction, Textarea } from "@/components/erp/form";
import { setVetPublication } from "../../portal/actions";
import { updateVetRecord } from "../actions";
import { VetForm } from "../VetForm";

export const metadata = { title: "Veterinary record" };

export default async function VetRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["vet.read", "vet.write"]);
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const v = (await db.query(
      `select v.*, a.code animal_code, a.investor_id animal_investor, pb.full_name publisher, f.full_name farmer, e.full_name employee, u.full_name created_by_name
         from hv.vet_records v join hv.animals a on a.id = v.animal_id left join hv.farmers f on f.id = v.farmer_id
         left join hv.employees e on e.id = v.employee_id left join hv.users u on u.id = v.created_by left join hv.users pb on pb.id = v.published_by where v.id = $1`, [id])).rows[0];
    if (!v) return null;
    const expenses = (await db.query("select id, code, description, amount, status from hv.expenses where vet_record_id = $1 order by created_at", [id])).rows;
    const editable = can(user, "vet.write") && (can(user, "vet.read") || v.created_by === user.id);
    return { v, expenses, editable, animals: editable ? await animalOptions(db, "true") : [], employees: editable ? await employeeOptions(db) : [] };
  });
  if (!d) notFound();
  const { v } = d;
  return (
    <div className="space-y-6">
      <PageHeader title={`${v.code} · ${label(v.visit_type)}`} subtitle={<span className="flex items-center gap-2"><Link href={`/management/animals/${v.animal_id}`} className="hover:underline">{v.animal_code}</Link><StatusBadge status={v.status} /></span>}
        crumbs={[{ href: "/management/veterinary", label: "Veterinary" }]}
        actions={can(user, "expenses.submit") && <LinkButton href={`/management/expenses/new?vet=${id}&animal=${v.animal_id}`} variant="secondary">Add expense line</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Record" className="lg:col-span-2">
          <DL cols={3} items={[
            ["Scheduled", formatDate(v.scheduled_date, timezone)], ["Visit date", formatDate(v.visit_date, timezone)], ["Veterinarian / inspector", v.performed_by],
            ["Employee", v.employee], ["Farmer", v.farmer], ["Location", v.location], ["Condition", label(v.condition)],
            ["Weight", v.weight_kg ? `${v.weight_kg} kg` : null], ["Vaccine", v.vaccine_name], ["Vaccinated on", formatDate(v.vaccination_date, timezone)],
            ["Next due", formatDate(v.next_due_date, timezone)], ["Cost", v.cost ? <Money key="c" value={v.cost} /> : null], ["Recorded by", v.created_by_name],
          ]} />
          <div className="mt-4 space-y-2 text-sm text-ink-600">
            {v.findings && <p><strong className="text-forest">Findings:</strong> {v.findings}</p>}
            {v.treatment && <p><strong className="text-forest">Treatment:</strong> {v.treatment}</p>}
            {v.follow_up && <p><strong className="text-forest">Follow-up:</strong> {v.follow_up}</p>}
            {v.notes && <p className="whitespace-pre-line">{v.notes}</p>}
          </div>
        </Card>
        <Card title="Expense lines" bodyClassName="p-0">
          {d.expenses.length === 0 ? <p className="p-5 text-sm text-ink-500">No expenses linked.</p> : (
            <ul className="divide-y divide-forest/5">{d.expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <Link href={`/management/expenses/${e.id}`} className="font-semibold text-forest hover:underline">{e.code}</Link>
                <span className="flex items-center gap-2"><Money value={e.amount} /><StatusBadge status={e.status} /></span>
              </li>))}</ul>
          )}
        </Card>
      </div>
      {v.animal_investor && (
        <Card title="Investor portal">
          {v.investor_visible ? (
            <Alert tone="success" title="Published to the investor">
              Since {formatDate(v.published_at, timezone, true)}{v.publisher ? ` by ${v.publisher}` : ""}. The investor sees the visit date, vet, condition, weight,
              findings, vaccination, treatment, recommendations and the summary below — never the internal notes or cost. Editing the record withdraws it until republished.
              {v.investor_summary && <span className="mt-2 block"><strong>Summary for the investor:</strong> {v.investor_summary}</span>}
            </Alert>
          ) : v.status === "completed" ? (
            <Alert tone="warn" title="Not published">The investor sees only that a report is awaiting review. Check the record, then publish it.</Alert>
          ) : (
            <p className="text-sm text-ink-500">The investor sees this visit as {v.status === "scheduled" ? "scheduled" : label(v.status)}. Reports can be published once completed.</p>
          )}
          {can(user, "portal.publish") && v.status === "completed" && (
            <div className="mt-3 flex gap-2">
              <ConfirmAction action={setVetPublication.bind(null, id, true)} trigger={v.investor_visible ? "Update summary" : "Review & publish"} triggerVariant="primary"
                title="Publish this report to the investor" confirmLabel="Publish"
                description="Confirm the findings are accurate and reviewed. Internal notes and cost are never shown. The investor is notified.">
                <Textarea name="investor_summary" label="Plain-language summary for the investor (optional)" rows={3} defaultValue={v.investor_summary ?? ""} />
              </ConfirmAction>
              {v.investor_visible && (
                <ConfirmAction action={setVetPublication.bind(null, id, false)} trigger="Unpublish" triggerVariant="danger" variant="danger" title="Withdraw from the investor portal?" confirmLabel="Unpublish" />
              )}
            </div>
          )}
          {v.investor_visible && <p className="mt-2"><Badge tone="green">Visible to investor</Badge></p>}
        </Card>
      )}
      <Attachments user={user} entityType="vet_record" entityId={id} path={`/management/veterinary/${id}`} timeZone={timezone} defaultCategory="veterinary_report" title="Reports, receipts, photos & videos" />
      {d.editable && (
        <details className="rounded-2xl border border-forest/10 bg-white">
          <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-forest">Edit or complete this record</summary>
          <div className="border-t border-forest/10 p-5"><VetForm action={updateVetRecord.bind(null, id)} animals={d.animals} employees={d.employees} record={v} /></div>
        </details>
      )}
      <History user={user} ids={[id]} timeZone={timezone} />
    </div>
  );
}
