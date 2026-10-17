import type { Metadata } from "next";
import { requireInvestor } from "@/lib/auth/portal-session";
import { withInvestor } from "@/lib/server/db";
import { PortalShell } from "@/components/portal/PortalShell";
import { portalLogout } from "../auth-actions";

export const metadata: Metadata = {
  title: { default: "Investor Portal — Herdvest Pakistan", template: "%s · Herdvest Investor Portal" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInvestor();
  const unread = await withInvestor(user.sessionHash, async (db) =>
    (await db.query("select count(*)::int n from hv.portal_notifications_list(200) where read_at is null")).rows[0].n as number);
  return (
    <PortalShell user={{ name: user.investorName, code: user.investorCode }} unread={unread} signOut={portalLogout}>
      {children}
    </PortalShell>
  );
}
