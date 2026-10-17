import { randomUUID } from "node:crypto";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { param, type SearchParams } from "@/lib/erp/list";
import { animalOptions, categoryOptions, chargeTypeOptions, farmerOptions } from "@/lib/erp/options";
import { Alert, Card, PageHeader } from "@/components/erp/ui";
import { ExpenseForm } from "../ExpenseForm";

export const metadata = { title: "Submit expense" };

export default async function NewExpense({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("expenses.submit");
  const sp = await searchParams;
  const o = await withUser(user.id, async (db) => ({
    categories: await categoryOptions(db),
    animals: await animalOptions(db, "true"),
    farmers: can(user, "farmers.read") ? await farmerOptions(db) : [],
  }));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Submit an expense" crumbs={[{ href: "/management/expenses", label: "Expenses" }]} />
      <div className="mb-4"><Alert tone="info">Submitted expenses wait for approval. Approval decides who bears the cost; only expenses chargeable under an investor&apos;s agreement reduce that investor&apos;s funds.</Alert></div>
      <Card>
        <ExpenseForm categories={o.categories} animals={o.animals} farmers={o.farmers} chargeTypes={chargeTypeOptions}
          canChooseCharge={can(user, "expenses.read")} idem={randomUUID()}
          defaults={{ animal: param(sp, "animal") || undefined, vet: param(sp, "vet") || undefined, sale: param(sp, "sale") || undefined }} />
      </Card>
    </div>
  );
}
