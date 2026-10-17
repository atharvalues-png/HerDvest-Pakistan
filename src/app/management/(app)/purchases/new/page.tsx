import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { param, type SearchParams } from "@/lib/erp/list";
import { accountOptions, speciesOptions } from "@/lib/erp/options";
import { Alert, Card, PageHeader } from "@/components/erp/ui";
import { PurchaseForm } from "../PurchaseForm";

export const metadata = { title: "Record purchase" };

export default async function NewPurchase({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("purchases.write");
  const sp = await searchParams;
  const { accounts, species } = await withUser(user.id, async (db) => ({ accounts: await accountOptions(db), species: await speciesOptions(db) }));
  return (
    <div className="max-w-4xl">
      <PageHeader title="Record a livestock purchase" crumbs={[{ href: "/management/purchases", label: "Purchases" }]} />
      <div className="mb-4">
        <Alert tone="info">
          The purchase, its animal records and the funding allocation are saved together in one transaction. The allocation is checked against the
          account&apos;s verified, unallocated funds and is then reconciled by Finance.
          {!user.permissions.has("finance.read") && " (Available balances are shown only to Finance.)"}
        </Alert>
      </div>
      <Card><PurchaseForm accounts={accounts} species={species} defaultAccount={param(sp, "account")} idem={randomUUID()} /></Card>
    </div>
  );
}
