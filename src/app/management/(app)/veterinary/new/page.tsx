import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { param, type SearchParams } from "@/lib/erp/list";
import { animalOptions, employeeOptions } from "@/lib/erp/options";
import { Card, Empty, PageHeader } from "@/components/erp/ui";
import { createVetRecord } from "../actions";
import { VetForm } from "../VetForm";

export const metadata = { title: "New veterinary record" };

export default async function NewVet({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("vet.write");
  const sp = await searchParams;
  const { animals, employees } = await withUser(user.id, async (db) => ({ animals: await animalOptions(db), employees: await employeeOptions(db) }));
  return (
    <div className="max-w-3xl">
      <PageHeader title="New veterinary / inspection record" crumbs={[{ href: "/management/veterinary", label: "Veterinary" }]} />
      {animals.length === 0 ? (
        <Empty title="No animals available">You can only record visits for animals you are allowed to see (for field staff: animals on your assigned tasks).</Empty>
      ) : (
        <Card><VetForm action={createVetRecord} animals={animals} employees={employees} defaultAnimal={param(sp, "animal")} isNew /></Card>
      )}
    </div>
  );
}
