import type { Metadata } from "next";
import { TokenPage } from "./TokenPage";

export const metadata: Metadata = { title: { absolute: "Activate account — Herdvest Investor Portal" }, robots: { index: false, follow: false } };

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <TokenPage token={token} purpose="activation" />;
}
