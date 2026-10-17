import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { farmerOptions } from "@/lib/erp/options";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { ConfirmAction, FileField, Input, Select, Textarea } from "@/components/erp/form";
import { Alert, Badge, Card, DL, LinkButton, Money, PageHeader, StatusBadge, Timeline } from "@/components/erp/ui";
import { allocateAnimal, setAnimalStatus, updateAnimal } from "../actions";
import { AnimalPortalPanels } from "./PortalPanels";

export const metadata = { title: "Animal" };

export default async function AnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const a = (await db.query(
      `select a.*, f.full_name farmer, f.code farmer_code, f.phone farmer_phone, i.full_legal_name investor, i.code investor_code, ac.code account_code
         from hv.animals a left join hv.farmers f on f.id = a.current_farmer_id left join hv.investors i on i.id = a.investor_id
         left join hv.investment_accounts ac on ac.id = a.account_id where a.id = $1`, [id])).rows[0];
    if (!a) return null;
    const purchase = (await db.query(
      `select p.id, p.code, p.purchase_date, p.seller_name, p.location, pl.price, l.code txn_code, l.status txn_status, l.account_id txn_account
         from hv.purchase_lines pl join hv.purchases p on p.id = pl.purchase_id
         left join lateral (select code, status, account_id from hv.ledger_entries x
                             where x.purchase_id = p.id and x.entry_type = 'purchase_allocation' order by x.created_at limit 1) l on true
        where pl.animal_id = $1`, [id])).rows[0];
    const allocations = (await db.query(
      `select al.*, f.full_name farmer, f.code farmer_code, u.full_name by_name,
              (select json_agg(json_build_object('id', at.id, 'name', coalesce(at.caption, at.original_name)) order by at.uploaded_at)
                 from hv.attachments at where at.entity_type = 'allocation' and at.entity_id = al.id and at.deleted_at is null) files
         from hv.allocations al join hv.farmers f on f.id = al.farmer_id
         left join hv.users u on u.id = al.created_by where al.animal_id = $1 order by al.start_date desc, al.created_at desc`, [id])).rows;
    const statusHistory = (await db.query(
      `select h.*, u.full_name who from hv.animal_status_history h left join hv.users u on u.id = h.changed_by where h.animal_id = $1 order by h.changed_at desc`, [id])).rows;
    const vet = (await db.query(
      `select id, code, visit_type, status, coalesce(visit_date, scheduled_date) d, condition, weight_kg, vaccine_name, next_due_date, findings, investor_visible
         from hv.vet_records where animal_id = $1 order by coalesce(visit_date, scheduled_date) desc nulls last`, [id])).rows;
    const expenses = (await db.query(
      `select e.id, e.code, e.description, e.status, e.charge_type, coalesce(ea.amount, e.amount) amount
         from hv.expenses e left join hv.expense_allocations ea on ea.expense_id = e.id and ea.animal_id = $1
        where ea.animal_id = $1 order by e.expense_date desc`, [id])).rows;
    const incidents = (await db.query(`select id, code, incident_type, status, occurred_at from hv.incidents where animal_id = $1 order by occurred_at desc`, [id])).rows;
    const sale = (await db.query(
      `select s.id, s.code, s.sale_date, s.sale_price, st.status settlement from hv.sales s left join hv.settlements st on st.sale_id = s.id where s.animal_id = $1`, [id])).rows[0];
    const farmers = can(user, "allocations.write") ? await farmerOptions(db, true) : [];
    return { a, purchase, allocations, statusHistory, vet, expenses, incidents, sale, farmers };
  });
  if (!d) notFound();
  const { a } = d;
  const closed = ["sold", "deceased"].includes(a.status);
  const path = `/management/animals/${id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${a.code} · ${label(a.species)}${a.breed ? ` (${a.breed})` : ""}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={a.status} />{a.tag_number && <span>Tag {a.tag_number}</span>}{a.status_note && <span className="text-xs">· {a.status_note}</span>}</span>}
        crumbs={[{ href: "/management/animals", label: "Animals" }]}
        actions={
          <>
            {can(user, "vet.write") && !closed && <LinkButton href={`/management/veterinary/new?animal=${id}`} variant="secondary">Record visit</LinkButton>}
            {can(user, "expenses.submit") && <LinkButton href={`/management/expenses/new?animal=${id}`} variant="secondary">Submit expense</LinkButton>}
            {can(user, "incidents.write") && !closed && <LinkButton href={`/management/incidents/new?animal=${id}`} variant="secondary">Report incident</LinkButton>}
            {can(user, "sales.write") && !closed && <LinkButton href={`/management/sales/new?animal=${id}`}>Record sale</LinkButton>}
          </>
        }
      />

      {a.status === "deceased" && <Alert tone="error" title="This animal is recorded as deceased">All records are retained. See the incident record for investigation and the approved loss allocation.</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Animal" className="lg:col-span-2"
          actions={can(user, "livestock.write") && (
            <ConfirmAction action={updateAnimal.bind(null, id)} trigger="Edit details" triggerVariant="ghost" title="Edit animal details"
              description="Investor, purchase price and farmer are changed only through their workflows.">
              <div className="grid grid-cols-2 gap-3">
                <Input name="breed" label="Breed" defaultValue={a.breed} />
                <Select name="sex" label="Sex" defaultValue={a.sex} options={[["female", "Female"], ["male", "Male"], ["unknown", "Unknown"]]} />
                <Input name="color" label="Colour" defaultValue={a.color} />
                <Input name="tag_number" label="Ear tag / ID" defaultValue={a.tag_number} />
                <Input name="birth_date_estimate" label="Approx. date of birth" type="date" defaultValue={a.birth_date_estimate} />
                <Input name="age_months_estimate" label="Estimated age (months)" defaultValue={a.age_months_estimate} inputMode="numeric" />
              </div>
              <Input name="farm_location" label="Current farm location" defaultValue={a.farm_location} />
              <Textarea name="notes" label="Notes" defaultValue={a.notes} />
            </ConfirmAction>
          )}>
          <DL cols={3} items={[
            ["Herdvest ID", a.code], ["Type", label(a.species)], ["Breed", a.breed], ["Sex", label(a.sex)], ["Colour", a.color],
            ["Age / DOB (est.)", a.age_months_estimate ? `${a.age_months_estimate} months` : formatDate(a.birth_date_estimate, timezone)],
            ["Current farmer", a.current_farmer_id ? <Link key="f" href={`/management/farmers/${a.current_farmer_id}`} className="text-emerald hover:underline">{a.farmer} ({a.farmer_code})</Link> : "Not allocated"],
            ["Farm location", a.farm_location],
            ...(a.investor ? [["Investor", <Link key="i" href={`/management/investors/${a.investor_id}`} className="text-emerald hover:underline">{a.investor} ({a.investor_code})</Link>], ["Funding account", a.account_code]] as Array<[string, React.ReactNode]> : []),
            ["Condition at purchase", a.condition_at_purchase], ["Vet assessment at purchase", a.vet_assessment_at_purchase],
          ]} />
          {a.notes && <p className="mt-4 whitespace-pre-line text-sm text-ink-600">{a.notes}</p>}
        </Card>
        <div className="space-y-6">
          {d.purchase && (
            <Card title="Purchase">
              <DL cols={1} items={[
                ["Purchase", <Link key="p" href={`/management/purchases/${d.purchase.id}`} className="text-emerald hover:underline">{d.purchase.code}</Link>],
                ["Date", formatDate(d.purchase.purchase_date, timezone)], ["Price", <Money key="m" value={d.purchase.price} strong />],
                ["Funding transaction", d.purchase.txn_code
                  ? <span key="t" className="inline-flex items-center gap-2"><Link href={`/management/accounts/${d.purchase.txn_account}`} className="text-emerald hover:underline">{d.purchase.txn_code}</Link><StatusBadge status={d.purchase.txn_status} /></span>
                  : can(user, "finance.read") ? "—" : "Visible to Finance"],
                ["Seller", d.purchase.seller_name], ["Location", d.purchase.location],
              ]} />
            </Card>
          )}
          {d.sale && (
            <Card title="Sale">
              <DL cols={1} items={[
                ["Sale", <Link key="s" href={`/management/sales/${d.sale.id}`} className="text-emerald hover:underline">{d.sale.code}</Link>],
                ["Date", formatDate(d.sale.sale_date, timezone)], ["Price", <Money key="m" value={d.sale.sale_price} />], ["Settlement", <StatusBadge key="b" status={d.sale.settlement} />],
              ]} />
            </Card>
          )}
          {can(user, "livestock.write") && (
            <Card title="Status">
              <ConfirmAction action={setAnimalStatus.bind(null, id)} trigger="Change status" title="Change animal status"
                description="Sales and deaths are recorded through their own workflows. Every change is kept in the history.">
                <Select name="status" label="New status" required defaultValue={a.status} options={[
                  ["sourcing", "Sourcing"], ["purchased", "Purchased"], ["awaiting_allocation", "Awaiting allocation"], ["allocated", "Allocated to farmer"],
                  ["active", "Active & under care"], ["under_treatment", "Under veterinary treatment"], ["sale_preparation", "Sale preparation"], ["other", "Other documented status"]]} />
                <Textarea name="reason" label="Reason" required rows={2} />
              </ConfirmAction>
            </Card>
          )}
        </div>
      </div>

      <Card title="Farmer allocation history"
        actions={can(user, "allocations.write") && !closed && (
          <ConfirmAction action={allocateAnimal.bind(null, id)} trigger={a.current_farmer_id ? "Transfer to another farmer" : "Allocate to farmer"} triggerVariant="primary"
            title={a.current_farmer_id ? "Transfer animal" : "Allocate animal"}
            description="Only verified farmers can be selected. The current allocation is closed and kept in history.">
            <Select name="farmer_id" label="Verified farmer" required options={d.farmers} />
            <div className="grid grid-cols-2 gap-3">
              <Input name="start_date" label="Allocation / transfer date" type="date" required />
              <Input name="review_date" label="Expected review date" type="date" />
            </div>
            <Input name="farm_location" label="Farm location" />
            <Input name="agreement_ref" label="Allocation agreement reference" />
            <Textarea name="responsibilities" label="Responsibilities" rows={2} />
            <Input name="condition" label="Animal condition at transfer" />
            <Textarea name="reason" label={a.current_farmer_id ? "Reason for transfer" : "Notes"} rows={2} />
            <Select name="care_type" label="Care arrangement" placeholder={false} options={[["primary", "Primary care"], ["shared", "Shared / secondary care (does not replace primary)"]]} />
            {can(user, "files.upload") && <FileField name="file" label="Photo or report at transfer" accept="image/*,video/*,application/pdf" capture="environment" />}
          </ConfirmAction>
        )}
        bodyClassName="p-0">
        {d.allocations.length === 0 ? <p className="p-5 text-sm text-ink-500">Not yet allocated to a farmer.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-ivory/70 text-left text-xs text-ink-600"><tr><th className="px-5 py-2">Farmer</th><th className="px-3 py-2">From → to</th><th className="px-3 py-2">Reason / condition</th><th className="px-3 py-2">Agreement</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-forest/5">
                {d.allocations.map((al) => (
                  <tr key={al.id}>
                    <td className="px-5 py-2.5"><Link href={`/management/farmers/${al.farmer_id}`} className="font-semibold text-forest hover:underline">{al.farmer}</Link> <span className="text-xs text-ink-500">{al.care_type === "shared" ? "shared care" : ""}</span></td>
                    <td className="px-3 py-2.5">{formatDate(al.start_date, timezone)} → {al.end_date ? formatDate(al.end_date, timezone) : "present"}</td>
                    <td className="px-3 py-2.5 text-xs">{[al.reason, al.condition_at_start && `start: ${al.condition_at_start}`, al.end_reason && `ended: ${al.end_reason}`, al.condition_at_end && `end: ${al.condition_at_end}`].filter(Boolean).join(" · ") || "—"}<span className="block text-ink-500">Responsible: {al.by_name ?? "—"}</span>
                      {(al.files ?? []).map((f: { id: string; name: string }) => (
                        <a key={f.id} href={`/management/files/${f.id}`} target="_blank" rel="noopener" className="mr-2 text-emerald hover:underline">📎 {f.name}</a>
                      ))}</td>
                    <td className="px-3 py-2.5">{al.agreement_ref ?? "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={al.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AnimalPortalPanels user={user} animalId={id} hasInvestor={!!a.investor_id} closed={closed} timeZone={timezone} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Veterinary, vaccination & inspection records" bodyClassName="p-0">
          {d.vet.length === 0 ? <p className="p-5 text-sm text-ink-500">No records yet.</p> : (
            <ul className="divide-y divide-forest/5">
              {d.vet.map((v) => (
                <li key={v.id} className="px-5 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/management/veterinary/${v.id}`} className="font-semibold text-forest hover:underline">{v.code} · {label(v.visit_type)}</Link>
                    <span className="flex items-center gap-2 text-xs text-ink-500">{formatDate(v.d, timezone)}<StatusBadge status={v.status} />{v.status === "completed" && (v.investor_visible ? <Badge tone="green">Published</Badge> : a.investor_id ? <Badge>Not published</Badge> : null)}</span>
                  </div>
                  <p className="text-xs text-ink-500">{[v.condition && `Condition: ${v.condition}`, v.weight_kg && `${v.weight_kg} kg`, v.vaccine_name, v.next_due_date && `next due ${formatDate(v.next_due_date, timezone)}`].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Status history">
          <Timeline timeZone={timezone} items={d.statusHistory.map((h) => ({ at: h.changed_at, who: h.who, title: `${h.from_status ? label(h.from_status) + " → " : ""}${label(h.to_status)}`, body: h.reason }))} />
        </Card>
      </div>

      {(d.expenses.length > 0 || d.incidents.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Expenses linked to this animal" bodyClassName="p-0">
            {d.expenses.length === 0 ? <p className="p-5 text-sm text-ink-500">None.</p> : (
              <ul className="divide-y divide-forest/5">{d.expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <Link href={`/management/expenses/${e.id}`} className="min-w-0 truncate hover:underline"><span className="font-semibold text-forest">{e.code}</span> {e.description}</Link>
                  <span className="flex items-center gap-2"><Money value={e.amount} /><StatusBadge status={e.status} /></span>
                </li>))}</ul>
            )}
          </Card>
          <Card title="Incidents" bodyClassName="p-0">
            {d.incidents.length === 0 ? <p className="p-5 text-sm text-ink-500">None.</p> : (
              <ul className="divide-y divide-forest/5">{d.incidents.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <Link href={`/management/incidents/${i.id}`} className="font-semibold text-forest hover:underline">{i.code} · {label(i.incident_type)}</Link>
                  <StatusBadge status={i.status} />
                </li>))}</ul>
            )}
          </Card>
        </div>
      )}

      <Attachments user={user} entityType="animal" entityId={id} path={path} timeZone={timezone} defaultCategory="animal_photo" title="Photos, receipts & veterinary documents" />
      <History user={user} ids={[id, ...d.allocations.map((x) => x.id)]} timeZone={timezone} />
    </div>
  );
}
