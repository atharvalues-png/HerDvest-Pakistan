import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/portal-session";
import { isDatabaseConfigured } from "@/lib/server/db";
import { AuthFrame } from "@/components/portal/AuthFrame";
import { Alert } from "@/components/erp/ui";
import { PortalLoginForm } from "./PortalLoginForm";

export const metadata: Metadata = { title: { absolute: "Investor Login — Herdvest Pakistan" }, robots: { index: false, follow: false } };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; done?: string; signed_out?: string }> }) {
  const configured = isDatabaseConfigured();
  const s = configured ? await getPortalSession() : null;
  if (s?.mfaPassed) redirect("/portal");
  const { next, done, signed_out } = await searchParams;

  return (
    <AuthFrame
      title="Sign in to your account"
      subtitle="For existing Herdvest investors"
      footer={
        <>
          <p>
            Not an investor yet? Access is created by Herdvest after your agreement is signed.{" "}
            <Link href="/investors#enquiry" className="font-semibold text-gold hover:underline">Make an enquiry</Link>
          </p>
          <p>
            Herdvest staff? <Link href="/management/login" className="text-ivory/70 underline hover:text-ivory">Staff sign-in</Link>
          </p>
        </>
      }
    >
      {done === "password" && <div className="mb-4"><Alert tone="success">Your password has been set. You can now sign in.</Alert></div>}
      {signed_out && <div className="mb-4"><Alert tone="info">You have been signed out.</Alert></div>}
      {configured ? (
        <PortalLoginForm next={next ?? ""} />
      ) : (
        <p className="text-sm text-alert">The investor portal is not configured on this server yet.</p>
      )}
      <p className="mt-4 text-center text-sm">
        <Link href="/portal/forgot" className="text-emerald hover:underline">Forgot your password?</Link>
      </p>
    </AuthFrame>
  );
}
