import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Badge, LinkButton, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const all = can(user, "tasks.read_all");
  const status = param(sp, "status") || "active";
  const mine = param(sp, "mine") === "1" || !all;
  const lp = listParams(sp, { due: "t.due_date", code: "t.code", title: "t.title", status: "t.status", assignee: "e.full_name" }, "due", "asc");
  const { rows, total } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select t.*, e.full_name assignee, a.code animal_code, f.full_name farmer, count(*) over() total
         from hv.tasks t left join hv.employees e on e.id = t.assigned_to left join hv.animals a on a.id = t.animal_id left join hv.farmers f on f.id = t.farmer_id
        where ($1 = '' or t.code ilike $2 or t.title ilike $2 or a.code ilike $2 or f.full_name ilike $2)
          and ($3 = 'all' or ($3 = 'active' and t.status in ('open','in_progress')) or t.status = $3)
          and (not $4 or t.assigned_to = $5)
        order by ${lp.orderBy} limit $6 offset $7`, [lp.q, lp.like, status, mine, user.employeeId, lp.pageSize, lp.offset]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0 };
  });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader title={mine ? "My tasks" : "All tasks"} subtitle="Field tasks can be completed from a phone: open a task, record findings and add photos."
        actions={can(user, "tasks.write") && <LinkButton href="/management/tasks/new">New task</LinkButton>} />
      {!user.employeeId && !all && <p className="mb-4 text-sm text-alert">Your user account is not linked to an employee record, so no tasks can be assigned to you.</p>}
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/tasks/${r.id}`} searchPlaceholder="Task, animal ID, farmer"
        filters={<>
          <FilterSelect name="status" value={status === "active" ? "" : status} allLabel="Open & in progress" options={[["all", "All"], ["open", "Open"], ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]]} />
          {all && <FilterSelect name="mine" value={mine ? "1" : ""} allLabel="Everyone's tasks" options={[["1", "Only mine"]]} />}
        </>}
        emptyTitle="No tasks" emptyBody="Tasks assigned to you will appear here."
        columns={[
          { key: "title", label: "Task", sortable: true, render: (r) => r.title },
          { key: "type", label: "Type", render: (r) => label(r.task_type) },
          { key: "due", label: "Due", sortable: true, render: (r) => <span className="inline-flex items-center gap-1.5">{formatDate(r.due_date, timezone)}{r.due_date && r.due_date < today && ["open", "in_progress"].includes(r.status) && <Badge tone="red">Overdue</Badge>}</span> },
          { key: "related", label: "Related", render: (r) => <span className="text-xs">{[r.animal_code, r.farmer].filter(Boolean).join(" · ") || "—"}</span> },
          { key: "assignee", label: "Assigned to", sortable: true, render: (r) => r.assignee ?? "—" },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
