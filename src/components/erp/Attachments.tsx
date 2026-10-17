import { Eye, FileText, Film, Lock } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { attachmentCategories } from "@/lib/server/storage";
import { formatDate, label } from "@/lib/erp/format";
import { removeAttachment } from "@/app/management/(app)/_shared/actions";
import { setFilePublication } from "@/app/management/(app)/portal/actions";
import { Badge, Card } from "./ui";
import { Uploader } from "./Uploader";
import { ConfirmAction, Input } from "./form";

/** Record types whose files may be shared with the investor they belong to (never farmers, staff, incidents…). */
const SHAREABLE = new Set(["investor", "account", "ledger_entry", "animal", "purchase", "allocation", "vet_record", "sale", "settlement", "animal_weight", "payment_request", "expense"]);

/** Lists a record's files (as the user, through RLS) and offers upload/remove. */
export async function Attachments({
  user,
  entityType,
  entityId,
  path,
  timeZone,
  defaultCategory,
  title = "Documents & photos",
}: {
  user: SessionUser;
  entityType: string;
  entityId: string;
  path: string;
  timeZone: string;
  defaultCategory?: string;
  title?: string;
}) {
  const files = await withUser(user.id, async (db) =>
    (await db.query(
      `select a.id, a.original_name, a.mime_type, a.size_bytes, a.category, a.caption, a.sensitive, a.investor_visible, a.uploaded_at, u.full_name uploader
         from hv.attachments a left join hv.users u on u.id = a.uploaded_by
        where a.entity_type = $1 and a.entity_id = $2 and a.deleted_at is null order by a.uploaded_at desc`,
      [entityType, entityId],
    )).rows,
  );
  const canUpload = user.permissions.has("files.upload");
  const canPublish = user.permissions.has("portal.publish") && SHAREABLE.has(entityType);
  const share = (f: { id: string; sensitive: boolean; investor_visible: boolean }) =>
    f.sensitive || !SHAREABLE.has(entityType) ? null : (
      <span className="inline-flex items-center gap-1.5">
        {f.investor_visible && <Badge tone="green"><Eye aria-hidden className="mr-0.5 h-3 w-3" />Investor can see</Badge>}
        {canPublish && (
          <ConfirmAction action={setFilePublication.bind(null, f.id, !f.investor_visible, path)} trigger={f.investor_visible ? "Unshare" : "Share with investor"}
            triggerVariant="ghost" title={f.investor_visible ? "Stop sharing this file?" : "Share this file with the investor?"}
            description={f.investor_visible ? "The investor will no longer see it in their portal." : "Only share genuine, reviewed material about this investor's own records. The investor is notified."}
            confirmLabel={f.investor_visible ? "Unshare" : "Share"} />
        )}
      </span>
    );
  const canDelete = user.permissions.has("files.delete");
  const images = files.filter((f) => f.mime_type.startsWith("image/") && f.mime_type !== "image/heic");
  const others = files.filter((f) => !images.includes(f));

  return (
    <Card title={`${title} (${files.length})`}>
      {files.length === 0 && <p className="mb-3 text-sm text-ink-500">No files attached yet.</p>}
      {images.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((f) => (
            <li key={f.id} className="group overflow-hidden rounded-xl border border-forest/10 bg-ivory">
              <a href={`/management/files/${f.id}`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/management/files/${f.id}`} alt={f.caption ?? f.original_name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              </a>
              <div className="px-2 py-1.5 text-[0.7rem] text-ink-500">
                <p className="truncate font-medium text-charcoal">{f.caption ?? label(f.category)}</p>
                <p>{formatDate(f.uploaded_at, timeZone)} · {f.uploader ?? "—"}</p>
                <div className="mt-1">{share(f)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="mb-4 divide-y divide-forest/5 rounded-xl border border-forest/10">
          {others.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <a href={`/management/files/${f.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 text-forest hover:underline">
                {f.mime_type.startsWith("video/") ? <Film aria-hidden className="h-4 w-4 shrink-0" /> : <FileText aria-hidden className="h-4 w-4 shrink-0" />}
                <span className="truncate">{f.caption ?? f.original_name}</span>
                {f.sensitive && <Lock aria-label="Sensitive" className="h-3.5 w-3.5 shrink-0 text-gold-600" />}
              </a>
              <span className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
                {share(f)}
                {label(f.category)} · {(f.size_bytes / 1024 / 1024).toFixed(1)} MB
                {canDelete && (
                  <ConfirmAction action={removeAttachment.bind(null, f.id, path)} trigger="Remove" triggerVariant="ghost" title="Remove this file?"
                    description="The file is hidden from the record but kept in storage and the audit history." confirmLabel="Remove" variant="danger">
                    <Input name="reason" label="Reason" required />
                  </ConfirmAction>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canDelete && images.length > 0 && (
        <details className="mb-4 text-xs text-ink-500">
          <summary className="cursor-pointer">Remove a photo</summary>
          <ul className="mt-2 space-y-1">
            {images.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{f.caption ?? f.original_name}</span>
                <ConfirmAction action={removeAttachment.bind(null, f.id, path)} trigger="Remove" triggerVariant="ghost" title="Remove this photo?" confirmLabel="Remove" variant="danger">
                  <Input name="reason" label="Reason" required />
                </ConfirmAction>
              </li>
            ))}
          </ul>
        </details>
      )}
      {canUpload && (
        <Uploader entityType={entityType} entityId={entityId} categories={attachmentCategories} defaultCategory={defaultCategory}
          allowSensitive={user.permissions.has("files.sensitive")} />
      )}
    </Card>
  );
}
