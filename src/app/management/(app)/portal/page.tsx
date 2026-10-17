import Link from "next/link";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { isEmailConfigured } from "@/lib/server/email";
import { Alert, Badge, Card, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Investor portal" };

export default async function PortalAdminPage() {
  const user = await requireUser(["portal.manage", "portal.publish", "investors.read"]);
  const { timezone } = await getSettings();
  const pub = can(user, "portal.publish");
  const d = await withUser(user.id, async (db) => ({
    accounts: (await db.query(
      `select p.id, p.email, p.status, p.activated_at, p.last_login_at, p.mfa_enabled, i.code investor_code, i.full_legal_name, i.id investor_id from hv.portal_accounts p join hv.investors i on i.id = p.investor_id order by p.status, i.full_legal_name`)).rows,
    without: (await db.query(
      `select i.id, i.code, i.full_legal_name, i.status from hv.investors i
        where not exists (select 1 from hv.portal_accounts p where p.investor_id = i.id) and i.status in ('active','prospective') order by i.code limit 50`)).rows,
    requests: (await db.query(
      `select r.*, i.code, i.full_legal_name from hv.portal_change_requests r join hv.investors i on i.id = r.investor_id where r.status = 'open' order by r.created_at`)).rows,
    vet: pub ? (await db.query(
      `select v.id, v.code, v.visit_type, v.visit_date, a.code animal from hv.vet_records v join hv.animals a on a.id = v.animal_id
        where v.status = 'completed' and not v.investor_visible and a.investor_id is not null order by v.visit_date desc nulls last limit 50`)).rows : [],
    weights: pub ? (await db.query(
      `select w.id, w.code, w.weight, w.measured_on, a.code animal, a.id animal_id from hv.animal_weights w join hv.animals a on a.id = w.animal_id
        where not w.investor_visible and w.voided_at is null and a.investor_id is not null order by w.measured_on desc limit 50`)).rows : [],
    forecasts: pub ? (await db.query(
      `select f.id, f.expected_sale_price, f.created_at, a.code animal, a.id animal_id from hv.animal_forecasts f join hv.animals a on a.id = f.animal_id
        where f.status = 'draft' order by f.created_at limit 50`)).rows : [],
    email: can(user, "portal.manage") ? (await db.query(
      "select email_status, count(*)::int n from hv.portal_notifications group by 1 order by 1")).rows : [],
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Investor portal" subtitle="Investor logins, what is waiting to be published, and investors' correction requests." />

      {!isEmailConfigured() && (
        <Alert tone="warn" title="Email is not configured">
          Invitations and reset links are shown on screen for you to share; notifications appear inside the portal only. Set RESEND_API_KEY and
          PORTAL_FROM_EMAIL (a verified sender) and test delivery before relying on email.
          {d.email.length > 0 && <span className="mt-1 block text-xs">Notifications so far: {d.email.map((e) => `${label(e.email_status)} ${e.n}`).join(" · ")}</span>}
        </Alert>
      )}

      {pub && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={`Reports awaiting publication (${d.vet.length})`} bodyClassName="p-0">
            {d.vet.length === 0 ? <p className="p-5 text-sm text-ink-500">Nothing waiting.</p> : (
              <ul className="divide-y divide-forest/5">{d.vet.map((v) => (
                <li key={v.id} className="px-5 py-2.5 text-sm">
                  <Link href={`/management/veterinary/${v.id}`} className="font-semibold text-forest hover:underline">{v.code}</Link>{" "}
                  <span className="text-ink-500">· {v.animal} · {label(v.visit_type)} · {formatDate(v.visit_date, timezone)}</span>
                </li>))}</ul>
            )}
          </Card>
          <Card title={`Weights not published (${d.weights.length})`} bodyClassName="p-0">
            {d.weights.length === 0 ? <p className="p-5 text-sm text-ink-500">Nothing waiting.</p> : (
              <ul className="divide-y divide-forest/5">{d.weights.map((w) => (
                <li key={w.id} className="px-5 py-2.5 text-sm">
                  <Link href={`/management/animals/${w.animal_id}`} className="font-semibold text-forest hover:underline">{w.animal}</Link>{" "}
                  <span className="text-ink-500">· {Number(w.weight)} kg · {formatDate(w.measured_on, timezone)}</span>
                </li>))}</ul>
            )}
          </Card>
          <Card title={`Draft forecasts (${d.forecasts.length})`} bodyClassName="p-0">
            {d.forecasts.length === 0 ? <p className="p-5 text-sm text-ink-500">Nothing waiting.</p> : (
              <ul className="divide-y divide-forest/5">{d.forecasts.map((f) => (
                <li key={f.id} className="px-5 py-2.5 text-sm">
                  <Link href={`/management/animals/${f.animal_id}`} className="font-semibold text-forest hover:underline">{f.animal}</Link>{" "}
                  <span className="text-ink-500">· PKR {Number(f.expected_sale_price).toLocaleString("en-PK")} · {formatDate(f.created_at, timezone)}</span>
                </li>))}</ul>
            )}
          </Card>
        </div>
      )}

      <Card title={`Open correction requests (${d.requests.length})`} bodyClassName="p-0">
        {d.requests.length === 0 ? <p className="p-5 text-sm text-ink-500">None.</p> : (
          <ul className="divide-y divide-forest/5">{d.requests.map((r) => (
            <li key={r.id} className="px-5 py-2.5 text-sm">
              <Link href={`/management/investors/${r.investor_id}`} className="font-semibold text-forest hover:underline">{r.full_legal_name} ({r.code})</Link>{" "}
              <span className="text-ink-500">· {label(r.field)}{r.requested_value ? `: ${r.requested_value}` : ""} · {formatDate(r.created_at, timezone)}</span>
            </li>))}</ul>
        )}
      </Card>

      <Card title={`Portal accounts (${d.accounts.length})`} bodyClassName="p-0">
        {d.accounts.length === 0 ? (
          <div className="p-5 text-sm text-ink-500">
            No investor accounts have been provisioned yet. To invite the first investor: open an investor record (Investors → choose investor), then
            “Investor portal access” → <strong>Invite to portal</strong>. The investor receives a one-time activation link and sets their own password.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-ivory/70 text-left text-xs text-ink-600"><tr><th className="px-5 py-2">Investor</th><th className="px-3 py-2">Sign-in email</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Activated</th><th className="px-3 py-2">Last sign-in</th><th className="px-3 py-2">Two-step</th></tr></thead>
              <tbody className="divide-y divide-forest/5">
                {d.accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-2.5"><Link href={`/management/investors/${a.investor_id}`} className="font-semibold text-forest hover:underline">{a.full_legal_name}</Link> <span className="text-xs text-ink-500">{a.investor_code}</span></td>
                    <td className="px-3 py-2.5">{a.email}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-2.5">{a.activated_at ? formatDate(a.activated_at, timezone) : "—"}</td>
                    <td className="px-3 py-2.5">{a.last_login_at ? formatDate(a.last_login_at, timezone, true) : "Never"}</td>
                    <td className="px-3 py-2.5">{a.mfa_enabled ? <Badge tone="green">On</Badge> : "Off"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {d.without.length > 0 && (
        <Card title={`Investors without portal access (${d.without.length})`} bodyClassName="p-0">
          <ul className="divide-y divide-forest/5">{d.without.map((i) => (
            <li key={i.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <Link href={`/management/investors/${i.id}`} className="font-semibold text-forest hover:underline">{i.full_legal_name} <span className="font-normal text-ink-500">{i.code}</span></Link>
              <StatusBadge status={i.status} />
            </li>))}</ul>
        </Card>
      )}
    </div>
  );
}
