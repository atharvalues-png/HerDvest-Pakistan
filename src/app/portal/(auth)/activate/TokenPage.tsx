import Link from "next/link";
import { anonymous, isDatabaseConfigured } from "@/lib/server/db";
import { hashToken } from "@/lib/auth/portal-session";
import { AuthFrame } from "@/components/portal/AuthFrame";
import { SetPasswordForm } from "./SetPasswordForm";

/** Shared by /portal/activate and /portal/reset: checks the one-time link, then asks for a password. */
export async function TokenPage({ token, purpose }: { token: string | undefined; purpose: "activation" | "reset" }) {
  const info = token && token.length <= 200 && isDatabaseConfigured()
    ? await anonymous(async (db) => (await db.query("select * from hv.portal_token_info($1)", [hashToken(token)])).rows[0])
    : null;
  const valid = info && info.valid && info.purpose === purpose;
  const title = purpose === "activation" ? "Activate your investor account" : "Choose a new password";
  return (
    <AuthFrame title={title} subtitle={valid ? `${info.investor_name} · ${info.email}` : undefined}
      footer={<p>Questions? Contact Herdvest Pakistan using the details on our <Link href="/contact" className="underline">contact page</Link>.</p>}>
      {valid ? (
        <SetPasswordForm token={token!} label={purpose === "activation" ? "Activate account" : "Save new password"} />
      ) : (
        <div className="space-y-3 text-sm text-ink-600">
          <p className="font-semibold text-alert">This link is invalid, has already been used, or has expired.</p>
          <p>{purpose === "activation"
            ? "Invitation links can be used once and expire after 7 days. Ask Herdvest to send you a new invitation."
            : <>Reset links can be used once and expire quickly. <Link href="/portal/forgot" className="text-emerald underline">Request a new one</Link> or contact Herdvest.</>}</p>
          <p><Link href="/portal/login" className="text-emerald underline">Back to sign in</Link></p>
        </div>
      )}
    </AuthFrame>
  );
}
