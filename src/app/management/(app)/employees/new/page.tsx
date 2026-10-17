import { requireUser } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/erp/ui";
import { createEmployee } from "../actions";
import { EmployeeForm } from "../EmployeeForm";

export const metadata = { title: "New employee" };

export default async function NewEmployee() {
  await requireUser("employees.manage");
  return (
    <div className="max-w-3xl">
      <PageHeader title="New employee" crumbs={[{ href: "/management/employees", label: "Employees" }]} subtitle="To give system access, create a user account linked to this employee under Users & roles." />
      <Card><EmployeeForm action={createEmployee} /></Card>
    </div>
  );
}
