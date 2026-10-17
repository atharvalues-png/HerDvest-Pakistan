import type { Metadata } from "next";
import { TokenPage } from "../activate/TokenPage";

export const metadata: Metadata = { title: { absolute: "Reset password — Herdvest Investor Portal" }, robots: { index: false, follow: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <TokenPage token={token} purpose="reset" />;
}
