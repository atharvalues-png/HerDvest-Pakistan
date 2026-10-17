import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { LinkButton, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Employees" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("employees.read");
  const sp = await searchParams;
  const status = param(sp, "status");
  const lp = listParams(sp, { name: "e.full_name", code: "e.code", title: "e.job_title", status: "e.status" }, "name", "asc");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select e.*, (select count(*) from hv.tasks t where t.assigned_to = e.id and t.status in ('open','in_progress')) open_tasks,
              (select r.name from hv.users u join hv.roles r on r.id = u.role_id where u.employee_id = e.id) access_role, count(*) over() total
         from hv.employees e
        where ($1 = '' or e.full_name ilike $2 or e.code ilike $2 or e.phone ilike $2 or e.job_title ilike $2) and ($3 = '' or e.status = $3)
        order by ${lp.orderBy} limit $4 offset $5`, [lp.q, lp.like, status, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  return (
    <div>
      <PageHeader title="Employees" subtitle="Staff records, assigned areas and open field tasks."
        actions={can(user, "employees.manage") && <LinkButton href="/management/employees/new">New employee</LinkButton>} />
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/employees/${r.id}`} searchPlaceholder="Name, ID, phone, role"
        filters={<FilterSelect name="status" value={status} allLabel="All statuses" options={[["active", "Active"], ["on_leave", "On leave"], ["inactive", "Inactive"], ["terminated", "Terminated"]]} />}
        emptyTitle="No employees"
        columns={[
          { key: "name", label: "Name", sortable: true, render: (r) => r.full_name },
          { key: "code", label: "ID", sortable: true, render: (r) => r.code },
          { key: "title", label: "Job role", sortable: true, render: (r) => [r.job_title, r.department].filter(Boolean).join(" · ") || "—" },
          { key: "access", label: "System access", render: (r) => r.access_role ?? <span className="text-ink-500">{can(user, "users.manage") ? "No login" : "—"}</span> },
          { key: "tasks", label: "Open tasks", align: "right", render: (r) => r.open_tasks },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
