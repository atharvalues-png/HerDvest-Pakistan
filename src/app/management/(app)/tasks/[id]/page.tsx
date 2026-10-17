import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { Attachments } from "@/components/erp/Attachments";
import { History } from "@/components/erp/History";
import { Card, DL, LinkButton, PageHeader, StatusBadge } from "@/components/erp/ui";
import { TaskProgress } from "./TaskProgress";

export const metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { timezone } = await getSettings();
  const t = await withUser(user.id, async (db) => (await db.query(
    `select t.*, e.full_name assignee, a.code animal_code, f.full_name farmer, i.full_legal_name investor, x.code expense_code, u.full_name creator
       from hv.tasks t left join hv.employees e on e.id = t.assigned_to left join hv.animals a on a.id = t.animal_id
       left join hv.farmers f on f.id = t.farmer_id left join hv.investors i on i.id = t.investor_id left join hv.expenses x on x.id = t.expense_id
       left join hv.users u on u.id = t.created_by where t.id = $1`, [id])).rows[0]);
  if (!t) notFound();
  const mine = t.assigned_to && t.assigned_to === user.employeeId;
  const canUpdate = can(user, "tasks.write") || mine;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={t.title} subtitle={<span className="flex items-center gap-2">{t.code} · {label(t.task_type)} <StatusBadge status={t.status} /></span>}
        crumbs={[{ href: "/management/tasks", label: "Tasks" }]} />
      <Card>
        <DL items={[
          ["Assigned to", t.assignee], ["Due", formatDate(t.due_date, timezone)],
          ["Animal", t.animal_id ? <Link key="a" href={`/management/animals/${t.animal_id}`} className="text-emerald underline">{t.animal_code}</Link> : null],
          ["Farmer", t.farmer_id ? <Link key="f" href={`/management/farmers/${t.farmer_id}`} className="text-emerald underline">{t.farmer}</Link> : null],
          ...(t.investor ? [["Investor", t.investor]] as Array<[string, string]> : []),
          ["Expense", t.expense_code], ["Created by", t.creator], ["Completed", t.completed_at ? formatDate(t.completed_at, timezone, true) : null],
        ]} />
        {t.instructions && <p className="mt-4 whitespace-pre-line rounded-lg bg-ivory/60 p-3 text-sm">{t.instructions}</p>}
      </Card>
      {t.animal_id && (
        <div className="flex flex-wrap gap-2">
          {can(user, "vet.write") && <LinkButton href={`/management/veterinary/new?animal=${t.animal_id}`} variant="secondary">Record inspection / vet visit</LinkButton>}
          {can(user, "expenses.submit") && <LinkButton href={`/management/expenses/new?animal=${t.animal_id}`} variant="secondary">Submit expense</LinkButton>}
          {can(user, "incidents.write") && <LinkButton href={`/management/incidents/new?animal=${t.animal_id}`} variant="secondary">Report incident</LinkButton>}
        </div>
      )}
      {canUpdate && (
        <Card title="Progress & findings">
          <TaskProgress id={id} status={t.status} findings={t.findings} location={t.location_note} canAttach={can(user, "files.upload")} />
        </Card>
      )}
      <Attachments user={user} entityType="task" entityId={id} path={`/management/tasks/${id}`} timeZone={timezone} defaultCategory="animal_photo" title="Photos & files" />
      <History user={user} ids={[id]} timeZone={timezone} />
    </div>
  );
}
