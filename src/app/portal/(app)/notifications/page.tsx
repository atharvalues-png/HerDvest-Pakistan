import { formatDate } from "@/lib/erp/format";
import { portalQuery, portalTimezone } from "@/lib/portal/data";
import { Card, Empty } from "@/components/erp/ui";
import { PortalHeading } from "@/components/portal/ui";
import { openNotification } from "../../auth-actions";
import { MarkAllRead } from "./MarkAllRead";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const tz = await portalTimezone();
  const list = await portalQuery(async (db) => (await db.query("select * from hv.portal_notifications_list(100)")).rows);
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      <PortalHeading title="Notifications" subtitle="Sent only when Herdvest publishes a verified record to your account." actions={unread > 0 && <MarkAllRead />} />
      {list.length === 0 ? (
        <Empty title="No notifications yet">You&apos;ll see new inspection reports, photographs, weights, forecasts and statements here.</Empty>
      ) : (
        <Card bodyClassName="p-0">
          <ul className="divide-y divide-forest/5">
            {list.map((n) => (
              <li key={n.id}>
                <form action={openNotification.bind(null, n.id, n.link ?? "/portal")}>
                  <button type="submit" className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-ivory/60">
                    <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-emerald"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read_at ? "text-charcoal" : "font-semibold text-forest"}`}>{n.title}</span>
                      {n.body && <span className="block text-sm text-ink-600">{n.body}</span>}
                      <span className="block text-xs text-ink-500">{formatDate(n.created_at, tz, true)}{!n.read_at && <span className="sr-only"> · unread</span>}</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
