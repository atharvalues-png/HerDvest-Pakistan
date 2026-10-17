import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { animalOptions, categoryOptions, chargeTypeOptions } from "@/lib/erp/options";
import type { Extracted } from "@/lib/intake/parse";
import { Attachments } from "@/components/erp/Attachments";
import { ConfirmAction, Textarea } from "@/components/erp/form";
import { Alert, Badge, Card, DL, PageHeader, StatusBadge } from "@/components/erp/ui";
import { closeIntake } from "../actions";
import { ReviewForm } from "./ReviewForm";

export const metadata = { title: "Review intake" };

const hrefFor: Record<string, string> = { vet_record: "/management/veterinary/", expense: "/management/expenses/" };

export default async function IntakeItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("intake.review");
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const i = (await db.query(
      `select i.*, a.code animal_code, a.id animal_id, f.full_name farmer, inv.full_legal_name investor, u.full_name reviewer
         from hv.intake_items i left join hv.animals a on a.id = i.matched_animal_id left join hv.farmers f on f.id = a.current_farmer_id
         left join hv.investors inv on inv.id = a.investor_id left join hv.users u on u.id = i.reviewed_by where i.id = $1`, [id])).rows[0];
    if (!i) return null;
    return { i, animals: await animalOptions(db, "true"), categories: await categoryOptions(db) };
  });
  if (!d) notFound();
  const { i } = d;
  const x = (i.extracted ?? {}) as Extracted;
  const open = ["pending_review", "unmatched"].includes(i.status);

  return (
    <div className="space-y-6">
      <PageHeader title={`Intake from ${i.sender ?? label(i.source)}`} subtitle={<span className="flex items-center gap-2">{label(i.source)} · {formatDate(i.received_at, timezone, true)} <StatusBadge status={i.status} /></span>}
        crumbs={[{ href: "/management/intake", label: "Intake queue" }]}
        actions={open && <>
          <ConfirmAction action={closeIntake.bind(null, id, "duplicate")} trigger="Mark duplicate" title="Mark as duplicate"><Textarea name="note" label="Duplicate of / reason" required rows={2} /></ConfirmAction>
          <ConfirmAction action={closeIntake.bind(null, id, "rejected")} trigger="Reject" triggerVariant="danger" variant="danger" confirmLabel="Reject" title="Reject intake item"><Textarea name="note" label="Reason" required rows={2} /></ConfirmAction>
        </>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Source message">
          {i.subject && <p className="mb-2 text-sm font-semibold">{i.subject}</p>}
          <p className="whitespace-pre-line rounded-lg bg-ivory/60 p-3 text-sm">{i.body}</p>
          <div className="mt-4"><DL cols={2} items={[
            ["Sender", i.sender], ["Received", formatDate(i.received_at, timezone, true)], ["Provider message ID", i.external_id],
            ["Detected", <span key="d" className="flex flex-wrap gap-1">{(i.detected_types ?? []).map((t: string) => <Badge key={t} tone="blue">{label(t)}</Badge>)}</span>],
            ["Matched animal", i.animal_code ? <Link key="a" href={`/management/animals/${i.animal_id}`} className="text-emerald underline">{i.animal_code}</Link> : "Unmatched"],
            ["Farmer / investor", [i.farmer, i.investor].filter(Boolean).join(" · ")],
          ]} /></div>
        </Card>
        <Card title="Issues to resolve">
          {(i.issues ?? []).length === 0 ? <p className="text-sm text-ink-500">No issues detected — still verify every field.</p> : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-charcoal">{i.issues.map((s: string) => <li key={s}>{s}</li>)}</ul>
          )}
        </Card>
      </div>
      <Attachments user={user} entityType="intake_item" entityId={id} path={`/management/intake/${id}`} timeZone={timezone} title="Received files" />
      {open ? (
        <Card title="Verify and create records">
          <Alert tone="info">Correct anything that is wrong. Approving creates a completed veterinary/inspection record and, if selected, an expense claim that still needs normal approval before any investor balance is affected.</Alert>
          <div className="mt-4">
            <ReviewForm id={id} animals={d.animals} categories={d.categories} chargeTypes={chargeTypeOptions}
              defaults={{
                animal: i.matched_animal_id, date: x.date, createVet: Boolean(x.inspection || x.vaccination),
                visitType: x.vaccination ? "vaccination" : "inspection", condition: x.inspection?.condition, findings: x.inspection?.findings ?? i.body,
                vaccine: x.vaccination?.vaccine, weight: x.inspection?.weightKg, createExpense: Boolean(x.expense),
                amount: x.expense?.amount, category: x.expense?.category, description: x.expense?.description,
              }} />
          </div>
        </Card>
      ) : (
        <Card title="Review outcome">
          <DL items={[["Outcome", <StatusBadge key="s" status={i.status} />], ["Reviewed by", i.reviewer ? `${i.reviewer}, ${formatDate(i.reviewed_at, timezone, true)}` : null], ["Note", i.review_note]]} />
          {(i.created_records ?? []).length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">{i.created_records.map((r: { type: string; id: string }) => (
              <li key={r.id}><Link href={`${hrefFor[r.type]}${r.id}`} className="text-emerald underline">{label(r.type)} created</Link></li>))}</ul>
          )}
        </Card>
      )}
    </div>
  );
}
