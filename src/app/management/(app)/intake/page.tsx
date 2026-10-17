import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Alert, Badge, Card, PageHeader, StatusBadge } from "@/components/erp/ui";
import { ManualIntakeForm } from "./ManualIntakeForm";

export const metadata = { title: "Intake queue" };

export default async function IntakePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("intake.review");
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const status = param(sp, "status") || "open";
  const lp = listParams(sp, { received: "i.received_at", source: "i.source", status: "i.status" }, "received");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select i.*, a.code animal_code, cardinality(i.issues) issue_count,
              (select count(*) from hv.attachments x where x.entity_type = 'intake_item' and x.entity_id = i.id) files, count(*) over() total
         from hv.intake_items i left join hv.animals a on a.id = i.matched_animal_id
        where ($1 = '' or i.body ilike $2 or i.sender ilike $2 or a.code ilike $2)
          and ($3 = 'all' or ($3 = 'open' and i.status in ('pending_review','unmatched')) or i.status = $3)
        order by ${lp.orderBy} limit $4 offset $5`, [lp.q, lp.like, status, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  const configured = {
    email: Boolean(process.env.INTAKE_WEBHOOK_SECRET),
    whatsapp: Boolean(process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET),
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Intake review queue" subtitle="Messages and files from email, WhatsApp or manual entry become draft records only after a reviewer checks them." />
      <Alert tone="warn" title="Automated channels">
        Email webhook: <strong>{configured.email ? "secret configured" : "not configured"}</strong> · WhatsApp webhook: <strong>{configured.whatsapp ? "secrets configured" : "not configured"}</strong>.
        Neither channel has been connected to a live mailbox or WhatsApp number in this environment, so no messages arrive automatically yet.
        Use manual intake below to process forwarded messages today.
      </Alert>
      <Card title="Manual intake — paste a message (and attach receipts or photos)">
        <ManualIntakeForm />
      </Card>
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/intake/${r.id}`} searchPlaceholder="Message text, sender, animal ID"
        filters={<FilterSelect name="status" value={status === "open" ? "" : status} allLabel="Awaiting review" options={[["all", "All"], ["unmatched", "Unmatched"], ["pending_review", "Pending review"], ["approved", "Approved"], ["rejected", "Rejected"], ["duplicate", "Duplicate"]]} />}
        emptyTitle="Nothing waiting for review"
        columns={[
          { key: "received", label: "Received", sortable: true, render: (r) => formatDate(r.received_at, timezone, true) },
          { key: "source", label: "Source", sortable: true, render: (r) => `${label(r.source)}${r.sender ? ` · ${r.sender}` : ""}` },
          { key: "body", label: "Message", render: (r) => <span className="line-clamp-2 max-w-md text-xs">{r.body}</span> },
          { key: "detected", label: "Detected", render: (r) => <span className="flex flex-wrap gap-1">{(r.detected_types ?? []).map((t: string) => <Badge key={t} tone="blue">{label(t)}</Badge>)}</span> },
          { key: "animal", label: "Animal", render: (r) => r.animal_code ?? <Badge tone="red">Unmatched</Badge> },
          { key: "issues", label: "Issues", align: "right", render: (r) => r.issue_count },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
