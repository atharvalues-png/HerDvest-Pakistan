import { can, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { listParams, param, type SearchParams } from "@/lib/erp/list";
import { getSettings } from "@/lib/erp/settings";
import { formatDate, label } from "@/lib/erp/format";
import { DataTable, FilterSelect } from "@/components/erp/DataTable";
import { Alert, LinkButton, Money, PageHeader, StatusBadge } from "@/components/erp/ui";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["expenses.read", "expenses.submit"]);
  const sp = await searchParams;
  const { timezone } = await getSettings();
  const status = param(sp, "status");
  const category = param(sp, "category");
  const charge = param(sp, "charge");
  const lp = listParams(sp, { date: "e.expense_date", code: "e.code", amount: "e.amount", status: "e.status", category: "c.label" }, "date");
  const { rows, total, cats } = await withUser(user.id, async (db) => {
    const r = await db.query(
      `select e.*, c.label category, u.full_name submitter, i.full_legal_name investor,
              (select string_agg(a.code, ', ') from hv.expense_allocations ea join hv.animals a on a.id = ea.animal_id where ea.expense_id = e.id) animals,
              count(*) over() total
         from hv.expenses e join hv.expense_categories c on c.id = e.category_id left join hv.users u on u.id = e.submitted_by
         left join hv.investors i on i.id = e.investor_id
        where ($1 = '' or e.code ilike $2 or e.description ilike $2 or e.vendor ilike $2 or e.payment_reference ilike $2)
          and ($3 = '' or e.status = $3) and ($4 = '' or e.category_id = $4) and ($5 = '' or e.charge_type = $5)
        order by ${lp.orderBy} limit $6 offset $7`, [lp.q, lp.like, status, category, charge, lp.pageSize, lp.offset]);
    const cats = (await db.query("select id, label from hv.expense_categories order by label")).rows.map((x) => [x.id, x.label] as [string, string]);
    return { rows: r.rows, total: r.rows[0]?.total ?? 0, cats };
  });
  return (
    <div>
      <PageHeader title="Expenses" subtitle={can(user, "expenses.read") ? "All expense claims and their approval and payment status." : "Your submitted expense claims."}
        actions={can(user, "expenses.submit") && <LinkButton href="/management/expenses/new">Submit expense</LinkButton>} />
      <div className="mb-4"><Alert tone="info">Status shows the difference between a submitted claim, an approved expense and an actually paid expense. Herdvest&apos;s 20% management fee is charged once per sale and is never added here as an annual fee.</Alert></div>
      <DataTable sp={sp} meta={{ ...lp, total }} rows={rows} rowHref={(r) => `/management/expenses/${r.id}`} searchPlaceholder="Expense ID, description, vendor, reference"
        filters={<>
          <FilterSelect name="status" value={status} allLabel="All statuses" options={[["submitted", "Submitted (awaiting approval)"], ["approved", "Approved (unpaid)"], ["paid", "Paid"], ["rejected", "Rejected"], ["disputed", "Disputed"], ["voided", "Voided"]]} />
          <FilterSelect name="category" value={category} allLabel="All categories" options={cats} />
          <FilterSelect name="charge" value={charge} allLabel="Any treatment" options={[["chargeable_to_investment", "Chargeable to investment"], ["herdvest_operating", "Herdvest operating"], ["covered_by_service_fee", "Covered by service fee"], ["paid_by_farmer", "Paid by farmer"], ["reimbursement_required", "Reimbursement required"], ["to_be_determined", "Not yet decided"]]} />
        </>}
        emptyTitle="No expenses" emptyBody="Submit expense claims with receipts from the field."
        columns={[
          { key: "code", label: "Expense", sortable: true, render: (r) => r.code },
          { key: "date", label: "Date", sortable: true, render: (r) => formatDate(r.expense_date, timezone) },
          { key: "category", label: "Category", sortable: true, render: (r) => r.category },
          { key: "desc", label: "Description", render: (r) => <span className="line-clamp-1">{r.description}</span> },
          { key: "animals", label: "Animals", render: (r) => <span className="text-xs">{r.animals ?? "—"}</span> },
          { key: "charge", label: "Borne by", render: (r) => <span className="text-xs">{label(r.charge_type)}{r.investor ? ` · ${r.investor}` : ""}</span> },
          { key: "amount", label: "Amount", sortable: true, align: "right", render: (r) => <Money value={r.amount} /> },
          { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
        ]} />
    </div>
  );
}
