import { requireUser } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/erp/ui";
import { createInvestor } from "../actions";
import { InvestorForm } from "../InvestorForm";

export const metadata = { title: "New investor" };

export default async function NewInvestor() {
  await requireUser("investors.write");
  return (
    <div className="max-w-3xl">
      <PageHeader title="New investor" crumbs={[{ href: "/management/investors", label: "Investors" }]}
        subtitle="An investment account is opened automatically. Recording an investor does not record any deposit." />
      <Card><InvestorForm action={createInvestor} /></Card>
    </div>
  );
}
