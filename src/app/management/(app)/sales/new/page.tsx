import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { param, type SearchParams } from "@/lib/erp/list";
import { animalOptions, employeeOptions } from "@/lib/erp/options";
import { Alert, Card, PageHeader } from "@/components/erp/ui";
import { SaleForm } from "./SaleForm";

export const metadata = { title: "Record sale" };

export default async function NewSale({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("sales.write");
  const sp = await searchParams;
  const o = await withUser(user.id, async (db) => ({
    animals: await animalOptions(db, "status not in ('sold','deceased','other','sourcing') and exists (select 1 from hv.purchase_lines pl where pl.animal_id = hv.animals.id)"),
    employees: await employeeOptions(db),
  }));
  return (
    <div className="max-w-2xl">
      <PageHeader title="Record a sale" crumbs={[{ href: "/management/sales", label: "Sales" }]} />
      <div className="mb-4">
        <Alert tone="info">
          Recording the sale marks the animal as sold, ends its allocation and calculates the settlement once (one 20% fee per sale). Until the buyer&apos;s
          payment is recorded in full and reviewed, the settlement stays under review — nothing is paid automatically.
        </Alert>
      </div>
      <Card><SaleForm animals={o.animals} employees={o.employees} defaultAnimal={param(sp, "animal")} idem={randomUUID()} /></Card>
    </div>
  );
}
