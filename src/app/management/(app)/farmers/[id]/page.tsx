import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { verificationOptions } from "@/lib/erp/options";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { ConfirmAction, Select, Textarea } from "@/components/erp/form";
import { Card, DL, LinkButton, Money, PageHeader, StatusBadge, Timeline } from "@/components/erp/ui";
import { setVerification } from "../actions";

export const metadata = { title: "Farmer" };

export default async function FarmerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const f = (await db.query(`select f.*, u.full_name verifier from hv.farmers f left join hv.users u on u.id = f.verified_by where f.id = $1`, [id])).rows[0];
    if (!f) return null;
    const events = (await db.query(
      `select e.*, u.full_name who from hv.farmer_verification_events e left join hv.users u on u.id = e.changed_by where e.farmer_id = $1 order by e.changed_at desc`, [id])).rows;
    const allocations = (await db.query(
      `select al.*, a.code animal_code, a.status animal_status from hv.allocations al join hv.animals a on a.id = al.animal_id
        where al.farmer_id = $1 order by al.status, al.start_date desc`, [id])).rows;
    const vet = (await db.query(
      `select v.id, v.code, v.visit_type, v.status, coalesce(v.visit_date, v.scheduled_date) d, a.code animal from hv.vet_records v join hv.animals a on a.id = v.animal_id
        where v.farmer_id = $1 order by coalesce(v.visit_date, v.scheduled_date) desc nulls last limit 20`, [id])).rows;
    const payments = (await db.query(
      `select st.code, st.farmer_payable, st.status, s.id sale_id, a.code animal,
              (select coalesce(sum(amount),0) from hv.settlement_payments p where p.settlement_id = st.id and p.payee = 'farmer') paid
         from hv.settlements st join hv.sales s on s.id = st.sale_id join hv.animals a on a.id = s.animal_id where s.farmer_id = $1 order by st.created_at desc`, [id])).rows;
    return { f, events, allocations, vet, payments };
  });
  if (!d) notFound();
  const { f } = d;
  const active = d.allocations.filter((a) => a.status === "active");

  return (
    <div className="space-y-6">
      <PageHeader title={f.full_name} subtitle={<span className="flex items-center gap-2">{f.code} <StatusBadge status={f.verification_status} /></span>}
        crumbs={[{ href: "/management/farmers", label: "Farmers" }]}
        actions={<>
          {can(user, "farmers.write") && <LinkButton href={`/management/farmers/${id}/edit`} variant="secondary">Edit</LinkButton>}
          {can(user, "farmers.write", "farmers.verify") && (
            <ConfirmAction action={setVerification.bind(null, id)} trigger="Update verification" triggerVariant="primary" title="Farmer verification"
              description={can(user, "farmers.verify") ? "Verified, rejected and suspended decisions require notes and are recorded with your name." : "Only authorised staff can mark a farmer verified, rejected or suspended."}>
              <Select name="status" label="Verification status" required defaultValue={f.verification_status}
                options={can(user, "farmers.verify") ? verificationOptions : verificationOptions.filter(([v]) => !["verified", "rejected", "suspended"].includes(v))} />
              <Textarea name="notes" label="Notes (what was checked)" rows={3} />
            </ConfirmAction>
          )}
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Farmer" className="lg:col-span-2">
          <DL cols={3} items={[
            ["Contact number", f.phone], ["Address", f.address], ["District / city", [f.district, f.city].filter(Boolean).join(", ")],
            ["Farm location", f.farm_location], ["Experience", f.experience_years ? `${Number(f.experience_years)} years` : null], ["Capacity", f.capacity],
            ["Livestock types", (f.livestock_types ?? []).join(", ")], ["Agreement", label(f.agreement_status)], ["Background check", label(f.background_check_status)],
            ["Verified by", f.verifier ? `${f.verifier}, ${formatDate(f.verified_at, timezone)}` : null], ["Current animals", active.length],
          ]} />
          {(f.references_text || f.verification_notes || f.notes) && (
            <div className="mt-4 space-y-2 text-sm text-ink-600">
              {f.references_text && <p><strong className="text-forest">References:</strong> {f.references_text}</p>}
              {f.verification_notes && <p><strong className="text-forest">Verification notes:</strong> {f.verification_notes}</p>}
              {f.notes && <p className="whitespace-pre-line">{f.notes}</p>}
            </div>
          )}
        </Card>
        <Card title="Verification workflow">
          <Timeline timeZone={timezone} items={d.events.map((e) => ({ at: e.changed_at, who: e.who, title: `${e.from_status ? label(e.from_status) + " → " : ""}${label(e.to_status)}`, body: e.notes }))} />
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Animals (current & past)" bodyClassName="p-0">
          {d.allocations.length === 0 ? <p className="p-5 text-sm text-ink-500">No animals allocated yet.</p> : (
            <ul className="divide-y divide-forest/5">{d.allocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <Link href={`/management/animals/${a.animal_id}`} className="hover:underline"><span className="font-semibold text-forest">{a.animal_code}</span> <span className="text-xs text-ink-500">{formatDate(a.start_date, timezone)} → {a.end_date ? formatDate(a.end_date, timezone) : "present"}</span></Link>
                <span className="flex gap-1.5"><StatusBadge status={a.status} /><StatusBadge status={a.animal_status} /></span>
              </li>))}</ul>
          )}
        </Card>
        <Card title="Inspections & veterinary care" bodyClassName="p-0">
          {d.vet.length === 0 ? <p className="p-5 text-sm text-ink-500">No records yet.</p> : (
            <ul className="divide-y divide-forest/5">{d.vet.map((v) => (
              <li key={v.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <Link href={`/management/veterinary/${v.id}`} className="hover:underline"><span className="font-semibold text-forest">{v.code}</span> {label(v.visit_type)} · {v.animal}</Link>
                <span className="flex items-center gap-2 text-xs">{formatDate(v.d, timezone)}<StatusBadge status={v.status} /></span>
              </li>))}</ul>
          )}
        </Card>
      </div>
      {d.payments.length > 0 && (
        <Card title="Settlements & payments" bodyClassName="p-0">
          <ul className="divide-y divide-forest/5">{d.payments.map((p) => (
            <li key={p.code} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
              <Link href={`/management/sales/${p.sale_id}`} className="hover:underline"><span className="font-semibold text-forest">{p.code}</span> · {p.animal}</Link>
              <span className="flex items-center gap-2 text-xs">payable <Money value={p.farmer_payable} /> · paid <Money value={p.paid} /><StatusBadge status={p.status} /></span>
            </li>))}</ul>
        </Card>
      )}
      <Attachments user={user} entityType="farmer" entityId={id} path={`/management/farmers/${id}`} timeZone={timezone} defaultCategory="farm_photo" title="Farm photos, agreements & verification documents" />
      <History user={user} ids={[id]} timeZone={timezone} />
    </div>
  );
}
