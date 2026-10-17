import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { param, type SearchParams } from "@/lib/erp/list";
import { animalOptions, employeeOptions, farmerOptions, investorOptions } from "@/lib/erp/options";
import { Card, PageHeader } from "@/components/erp/ui";
import { TaskForm } from "./TaskForm";

export const metadata = { title: "New task" };

export default async function NewTask({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("tasks.write");
  const sp = await searchParams;
  const o = await withUser(user.id, async (db) => ({
    employees: await employeeOptions(db),
    animals: can(user, "livestock.read") ? await animalOptions(db) : [],
    farmers: can(user, "farmers.read") ? await farmerOptions(db) : [],
    investors: can(user, "investors.read") ? await investorOptions(db) : [],
  }));
  return (
    <div className="max-w-3xl">
      <PageHeader title="New task" crumbs={[{ href: "/management/tasks", label: "Tasks" }]}
        subtitle="Assigning a task on an animal or farmer gives the employee access to that record (and only that record) while the task is open." />
      <Card><TaskForm {...o} defaults={{ animal: param(sp, "animal"), farmer: param(sp, "farmer") }} /></Card>
    </div>
  );
}
