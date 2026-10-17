import { formatDate, label } from "@/lib/erp/format";
import { otpauthUri } from "@/lib/auth/totp";
import { portalQuery, portalTimezone } from "@/lib/portal/data";
import { Badge, Card, DL, StatusBadge } from "@/components/erp/ui";
import { PortalHeading } from "@/components/portal/ui";
import { ChangePasswordForm, CorrectionForm, MfaConfirmForm, MfaDisableForm, MfaStartForm } from "./forms";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const tz = await portalTimezone();
  const d = await portalQuery(async (db) => {
    const p = (await db.query("select * from hv.portal_profile()")).rows[0];
    return {
      p,
      requests: (await db.query("select * from hv.portal_change_requests_list()")).rows,
      pendingSecret: p && !p.mfa_enabled ? (await db.query("select hv.portal_self_mfa_secret() s")).rows[0].s as string | null : null,
    };
  });
  const { p } = d;

  return (
    <div className="space-y-6">
      <PortalHeading title="Profile and security" subtitle="Your registered details. To change them, send a correction request — Herdvest verifies changes before updating your record." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Registered details" className="lg:col-span-2">
          <DL cols={2} items={[
            ["Full legal name", p.full_legal_name], ["Investor ID", p.investor_code],
            ["Email on record", p.email], ["Phone on record", p.phone],
            ["Address", p.address], ["City / country", [p.city, p.country].filter(Boolean).join(", ")],
            ["Preferred contact", label(p.contact_preference)], ["Registered since", formatDate(p.registered_on, tz)],
            ["National identity number", p.national_id_masked ?? "Not recorded"],
            ["Identity document", p.identity_document_on_file ? "On file with Herdvest (not shown online)" : "Not on file"],
          ]} />
        </Card>
        <Card title="Sign-in">
          <DL cols={1} items={[
            ["Sign-in email", p.login_email],
            ["Two-step verification", p.mfa_enabled ? <Badge key="m" tone="green">On</Badge> : <Badge key="m" tone="grey">Off</Badge>],
            ["Last sign-in", p.last_login_at ? formatDate(p.last_login_at, tz, true) : "—"],
          ]} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Request a correction">
          <div id="corrections" className="scroll-mt-28" />
          <CorrectionForm />
          {d.requests.length > 0 && (
            <ul className="mt-5 divide-y divide-forest/5 border-t border-forest/10 pt-3 text-sm">
              {d.requests.map((r) => (
                <li key={r.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-charcoal">{label(r.field)}{r.requested_value ? `: ${r.requested_value}` : ""}</span>
                    <StatusBadge status={r.status === "open" ? "pending" : r.status} />
                  </div>
                  <p className="text-xs text-ink-500">Sent {formatDate(r.created_at, tz)}{r.resolution_note ? ` · Herdvest: ${r.resolution_note}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Change password"><ChangePasswordForm /></Card>
          <Card title="Two-step verification">
            {p.mfa_enabled ? (
              <div className="space-y-3 text-sm text-ink-600">
                <p>A code from your authenticator app is required each time you sign in.</p>
                <MfaDisableForm />
              </div>
            ) : d.pendingSecret ? (
              <div className="space-y-3 text-sm text-ink-600">
                <p>1. In your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), add an account using this key:</p>
                <p className="break-all rounded-lg bg-ivory px-3 py-2 font-mono text-sm tracking-wider text-forest">{d.pendingSecret.replace(/(.{4})/g, "$1 ").trim()}</p>
                <p>On a phone you can also <a href={otpauthUri(d.pendingSecret, p.login_email)} className="font-semibold text-emerald underline">open it in your authenticator app</a>.</p>
                <p>2. Enter the 6-digit code the app shows:</p>
                <MfaConfirmForm />
              </div>
            ) : (
              <div className="space-y-3 text-sm text-ink-600">
                <p>Add a second step to sign-in using an authenticator app on your phone. Recommended.</p>
                <MfaStartForm />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
