import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/layout/Logo";
import { getSessionUser } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/server/db";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: { absolute: "Sign in — Herdvest Management System" }, robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const configured = isDatabaseConfigured();
  if (configured && (await getSessionUser())) redirect("/management");
  const { next } = await searchParams;

  return (
    <div className="grain relative flex min-h-dvh items-center justify-center bg-forest-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-4 text-xl font-semibold text-ivory">Herdvest Management System</h1>
          <p className="mt-1 text-sm text-ivory/60">Authorised staff only</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          {configured ? (
            <LoginForm next={next ?? ""} />
          ) : (
            <p className="text-sm text-alert">
              The management database is not configured on this server (DATABASE_URL). See the setup guide.
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-ivory/40">
          Access is logged. Contact your administrator if you need an account.
        </p>
      </div>
    </div>
  );
}
