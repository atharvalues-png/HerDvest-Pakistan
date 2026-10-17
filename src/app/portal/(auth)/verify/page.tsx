import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/portal-session";
import { AuthFrame } from "@/components/portal/AuthFrame";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: { absolute: "Verify sign-in — Herdvest Investor Portal" }, robots: { index: false, follow: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await getPortalSession();
  if (!s) redirect("/portal/login");
  if (s.mfaPassed) redirect("/portal");
  const { next } = await searchParams;
  return (
    <AuthFrame title="Two-step verification" subtitle="Enter the 6-digit code from your authenticator app"
      footer={<p>Lost access to your phone? Contact Herdvest Pakistan to reset two-step verification. <Link href="/portal/login" className="underline">Start again</Link></p>}>
      <VerifyForm next={next ?? ""} />
    </AuthFrame>
  );
}
