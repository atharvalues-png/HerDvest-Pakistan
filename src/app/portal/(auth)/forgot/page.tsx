import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/portal/AuthFrame";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: { absolute: "Forgot password — Herdvest Investor Portal" }, robots: { index: false, follow: false } };

export default function ForgotPage() {
  return (
    <AuthFrame title="Reset your password" subtitle="We'll send a one-time link to your registered email"
      footer={<p><Link href="/portal/login" className="underline">Back to sign in</Link></p>}>
      <ForgotForm />
    </AuthFrame>
  );
}
