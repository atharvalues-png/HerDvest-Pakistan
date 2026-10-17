import { FileText, Film, Image as ImageIcon } from "lucide-react";
import { formatDate, label } from "@/lib/erp/format";
import { portalQuery, portalTimezone } from "@/lib/portal/data";
import { Card, Empty } from "@/components/erp/ui";
import { PortalHeading } from "@/components/portal/ui";

export const metadata = { title: "My Documents" };

const groups: Array<[string, string[]]> = [
  ["Agreements", ["agreement"]],
  ["Purchase and identification records", ["purchase_receipt", "animal_photo", "farm_photo"]],
  ["Inspections, veterinary and vaccination records", ["veterinary_report", "vaccination_record", "inspection_video"]],
  ["Payments, expenses and receipts", ["payment_proof", "expense_receipt"]],
  ["Sales and settlements", ["sale_agreement", "sale_receipt"]],
  ["Other", ["other", "incident_document"]],
];

export default async function DocumentsPage() {
  const tz = await portalTimezone();
  const files = await portalQuery(async (db) => (await db.query("select * from hv.portal_files()")).rows);

  return (
    <div className="space-y-6">
      <PortalHeading title="My Documents" subtitle="Documents Herdvest has shared with you. Files are private and can only be opened while you are signed in." />
      {files.length === 0 ? (
        <Empty title="No documents shared yet">Agreements, receipts, inspection reports and statements will appear here once Herdvest publishes them to your account.</Empty>
      ) : (
        groups.map(([title, cats]) => {
          const list = files.filter((f) => cats.includes(f.category));
          if (list.length === 0) return null;
          return (
            <Card key={title} title={`${title} (${list.length})`} bodyClassName="p-0">
              <ul className="divide-y divide-forest/5">
                {list.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <a href={`/portal/files/${f.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 text-forest hover:underline">
                      {f.mime_type.startsWith("image/") ? <ImageIcon aria-hidden className="h-4 w-4 shrink-0" /> : f.mime_type.startsWith("video/") ? <Film aria-hidden className="h-4 w-4 shrink-0" /> : <FileText aria-hidden className="h-4 w-4 shrink-0" />}
                      <span className="truncate">{f.caption ?? f.original_name}</span>
                    </a>
                    <span className="text-xs text-ink-500">{f.entity_label} · {label(f.category)} · shared {formatDate(f.published_at, tz)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
      <p className="text-xs text-ink-500">
        Your statement can be downloaded at any time from <a href="/portal/transactions" className="text-emerald hover:underline">Transactions</a>.
        Identity documents are held securely by Herdvest and are not shown in the portal.
      </p>
    </div>
  );
}
