import { requireUser } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/erp/ui";
import { createFarmer } from "../actions";
import { FarmerForm } from "../FarmerForm";

export const metadata = { title: "New farmer" };

export default async function NewFarmer() {
  await requireUser("farmers.write");
  return (
    <div className="max-w-3xl">
      <PageHeader title="New farmer" crumbs={[{ href: "/management/farmers", label: "Farmers" }]} subtitle="New farmers start as 'Application received'." />
      <Card><FarmerForm action={createFarmer} /></Card>
    </div>
  );
}
