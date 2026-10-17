import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { employeeOptions } from "@/lib/erp/options";
import { ActionForm, ConfirmAction, Select, Submit, Textarea } from "@/components/erp/form";
import { Card, DL, PageHeader, StatusBadge } from "@/components/erp/ui";
import { History } from "@/components/erp/History";
import { convertEnquiry, updateEnquiry } from "../actions";

export const metadata = { title: "Enquiry" };

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("enquiries.read");
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const e = (await db.query("select * from hv.enquiries where id = $1", [id])).rows[0];
    if (!e) return null;
    return { e, employees: can(user, "employees.read") ? await employeeOptions(db) : [] };
  });
  if (!d) notFound();
  const { e } = d;
  const details = Object.entries(e.details ?? {}).filter(([k]) => !["consent", "company_website"].includes(k));
  const kind = e.enquiry_type === "farmer" ? "farmer" : "investor";
  const canConvert = e.status !== "converted" && can(user, kind === "farmer" ? "farmers.write" : "investors.write");

  return (
    <div className="space-y-6">
      <PageHeader title={e.full_name} subtitle={<span className="flex items-center gap-2">{e.code} · {label(e.enquiry_type)} enquiry <StatusBadge status={e.status} /></span>}
        crumbs={[{ href: "/management/enquiries", label: "Enquiries" }]}
        actions={canConvert && (
          <ConfirmAction action={convertEnquiry.bind(null, id, kind)} trigger={`Create ${kind} record`} triggerVariant="primary"
            title={`Create ${kind === "investor" ? "an investor" : "a farmer"} record from this enquiry?`} confirmLabel="Create record"
            description={kind === "investor"
              ? "Creates a prospective investor with these contact details. No deposit, agreement or investment is recorded."
              : "Creates a farmer record with status 'Application received'. Verification still has to be completed."} />
        )} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Submission" className="lg:col-span-2">
          <DL items={[
            ["Received", formatDate(e.received_at, timezone, true)], ["Source", e.source],
            ["Phone", e.phone], ["Email", e.email], ["City / location", e.location],
            ...(e.enquiry_type === "investor" ? [["Indicative budget", e.budget], ["Preferred horizon", e.horizon]] as Array<[string, string]> : []),
            ...(e.subject ? [["Topic", e.subject]] as Array<[string, string]> : []),
            ...details.map(([k, v]) => [label(k.replace(/([A-Z])/g, "_$1").toLowerCase()), Array.isArray(v) ? v.join(", ") : String(v)] as [string, string]),
          ]} />
          {e.message && <p className="mt-4 whitespace-pre-line rounded-lg bg-ivory/60 p-3 text-sm">{e.message}</p>}
          {e.converted_investor_id && <p className="mt-4 text-sm">Converted to <Link className="font-semibold text-emerald underline" href={`/management/investors/${e.converted_investor_id}`}>investor record</Link>.</p>}
          {e.converted_farmer_id && <p className="mt-4 text-sm">Converted to <Link className="font-semibold text-emerald underline" href={`/management/farmers/${e.converted_farmer_id}`}>farmer record</Link>.</p>}
        </Card>
        <Card title="Follow-up">
          {can(user, "enquiries.write") && e.status !== "converted" ? (
            <ActionForm action={updateEnquiry.bind(null, id)}>
              <Select name="status" label="Status" placeholder={false} defaultValue={e.status} options={[["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["closed", "Closed"]]} />
              <Select name="assigned_to" label="Assigned employee" defaultValue={e.assigned_to} options={d.employees} placeholder="Unassigned" />
              <Textarea name="notes" label="Notes" defaultValue={e.notes} rows={5} />
              <Submit>Save</Submit>
            </ActionForm>
          ) : (
            <DL cols={1} items={[["Status", <StatusBadge key="s" status={e.status} />], ["Notes", e.notes]]} />
          )}
        </Card>
      </div>
      <History user={user} ids={[id]} timeZone={timezone} />
    </div>
  );
}
