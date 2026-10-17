import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { History } from "@/components/erp/History";
import { Card, DL, LinkButton, PageHeader, StatusBadge } from "@/components/erp/ui";
import { updateEmployee } from "../actions";
import { EmployeeForm } from "../EmployeeForm";

export const metadata = { title: "Employee" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("employees.read");
  const { timezone } = await getSettings();
  const d = await withUser(user.id, async (db) => {
    const e = (await db.query("select * from hv.employees where id = $1", [id])).rows[0];
    if (!e) return null;
    const tasks = (await db.query("select id, code, title, status, due_date from hv.tasks where assigned_to = $1 order by status, due_date nulls last limit 30", [id])).rows;
    const account = (await db.query("select u.email, u.is_active, r.name role from hv.users u join hv.roles r on r.id = u.role_id where u.employee_id = $1", [id])).rows[0];
    return { e, tasks, account };
  });
  if (!d) notFound();
  const { e } = d;
  return (
    <div className="space-y-6">
      <PageHeader title={e.full_name} subtitle={<span className="flex items-center gap-2">{e.code} · {e.job_title ?? "—"} <StatusBadge status={e.status} /></span>}
        crumbs={[{ href: "/management/employees", label: "Employees" }]}
        actions={can(user, "tasks.write") && <LinkButton href="/management/tasks/new">Assign task</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <DL cols={3} items={[["Phone", e.phone], ["Email", e.email], ["Department", e.department], ["Joined", formatDate(e.joining_date, timezone)],
            ["Assigned areas", e.assigned_areas], ["System access", d.account ? `${d.account.role} (${d.account.email})${d.account.is_active ? "" : " — disabled"}` : can(user, "users.manage") ? "No login" : "—"]]} />
          {e.notes && <p className="mt-4 text-sm text-ink-600">{e.notes}</p>}
        </Card>
        <Card title="Tasks" bodyClassName="p-0">
          {d.tasks.length === 0 ? <p className="p-5 text-sm text-ink-500">No tasks.</p> : (
            <ul className="divide-y divide-forest/5">{d.tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                <Link href={`/management/tasks/${t.id}`} className="min-w-0 truncate text-forest hover:underline">{t.title}</Link><StatusBadge status={t.status} />
              </li>))}</ul>
          )}
        </Card>
      </div>
      {can(user, "employees.manage") && (
        <details className="rounded-2xl border border-forest/10 bg-white">
          <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-forest">Edit employee</summary>
          <div className="border-t border-forest/10 p-5"><EmployeeForm action={updateEmployee.bind(null, id)} employee={e} /></div>
        </details>
      )}
      <History user={user} ids={[id]} timeZone={timezone} />
      <p className="text-xs text-ink-500">{label(e.status)} record · created {formatDate(e.created_at, timezone)}</p>
    </div>
  );
}
