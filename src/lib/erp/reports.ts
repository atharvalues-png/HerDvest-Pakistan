import "server-only";

/**
 * Report definitions. Every query runs as the signed-in user, so RLS still
 * applies on top of the permission listed here. Filters are bound parameters
 * exposed through the `f` CTE (never string-concatenated).
 */

export type ColType = "text" | "money" | "date" | "datetime" | "status" | "number";
export type ReportCol = { key: string; label: string; type?: ColType };
export type Filter = "dates" | "investor" | "animal" | "farmer" | "employee" | "category" | "status" | "account_status";

export type Report = {
  slug: string;
  title: string;
  description: string;
  perms: string[];
  filters: Filter[];
  statusOptions?: Array<[string, string]>;
  requires?: Filter;
  columns: ReportCol[];
  sql: string; // must select from ... cross join f
  totals?: string[];
  /** when set, totals include only rows whose status is in this list */
  totalStatuses?: string[];
  sensitive?: boolean;
};

const F = `with f as (select $1::text dfrom, $2::text dto, $3::text investor, $4::text animal, $5::text farmer, $6::text employee, $7::text category, $8::text status, $9::text account_status)`;
const inRange = (col: string) => `(f.dfrom = '' or ${col} >= f.dfrom::date) and (f.dto = '' or ${col} < f.dto::date + 1)`;
const eq = (col: string, key: string) => `(f.${key} = '' or ${col}::text = f.${key})`;

export const reports: Report[] = [
  {
    slug: "investor-statement", title: "Investor statement", sensitive: true,
    description: "Every funding movement and settlement payment for one investor, in date order.",
    perms: ["finance.read"], filters: ["investor", "dates"], requires: "investor",
    columns: [{ key: "date", label: "Date", type: "datetime" }, { key: "reference", label: "Reference" }, { key: "description", label: "Description" },
      { key: "money_in", label: "In", type: "money" }, { key: "money_out", label: "Out", type: "money" }, { key: "status", label: "Status", type: "status" }],
    totals: ["money_in", "money_out"],
    totalStatuses: ["verified", "paid"],
    sql: `${F}
      select * from (
        select l.occurred_at date, l.code reference, initcap(replace(l.entry_type,'_',' ')) || coalesce(' · ' || l.reference, '') description,
               case when l.entry_type in ('deposit','adjustment_in') then l.amount end money_in,
               case when l.entry_type not in ('deposit','adjustment_in','reversal') then l.amount end money_out, l.status
          from hv.ledger_entries l cross join f where l.investor_id::text = f.investor and ${inRange("l.occurred_at")}
        union all
        select p.paid_at, st.code, 'Settlement payment (sale ' || s.code || ')', p.amount, null, 'paid'
          from hv.settlement_payments p join hv.settlements st on st.id = p.settlement_id join hv.sales s on s.id = st.sale_id cross join f
         where p.payee = 'investor' and s.investor_id::text = f.investor and ${inRange("p.paid_at")}
      ) x order by date`,
  },
  {
    slug: "funding-allocation", title: "Investor funding & allocation",
    description: "Per account: funds received, allocated to livestock, expenses charged, returned, unallocated and awaiting reconciliation.",
    perms: ["finance.read"], filters: ["investor", "account_status"],
    columns: [{ key: "investor", label: "Investor" }, { key: "account", label: "Account" }, { key: "account_status", label: "Account status", type: "status" }, { key: "funds_received", label: "Received", type: "money" },
      { key: "purchases_allocated", label: "Allocated to livestock", type: "money" }, { key: "expenses_charged", label: "Expenses charged", type: "money" },
      { key: "returned_to_investor", label: "Returned", type: "money" }, { key: "unallocated", label: "Unallocated", type: "money" },
      { key: "awaiting_reconciliation", label: "Awaiting reconciliation", type: "money" }],
    totals: ["funds_received", "purchases_allocated", "expenses_charged", "returned_to_investor", "unallocated", "awaiting_reconciliation"],
    sql: `${F} select i.full_legal_name investor, b.code account, b.status account_status, b.funds_received, b.purchases_allocated, b.expenses_charged, b.returned_to_investor,
            b.unallocated, b.awaiting_reconciliation
          from hv.account_balances b join hv.investors i on i.id = b.investor_id cross join f where ${eq("b.investor_id", "investor")} and ${eq("b.status", "account_status")} order by i.full_legal_name`,
  },
  {
    slug: "animal-inventory", title: "Animal inventory",
    description: "All animals with type, status, farmer, investor and purchase cost.",
    perms: ["livestock.read"], filters: ["status", "investor", "farmer"],
    statusOptions: [["awaiting_allocation", "Awaiting allocation"], ["allocated", "Allocated"], ["active", "Active"], ["under_treatment", "Under treatment"], ["sale_preparation", "Sale preparation"], ["sold", "Sold"], ["deceased", "Deceased"]],
    columns: [{ key: "code", label: "Animal" }, { key: "species", label: "Type" }, { key: "breed", label: "Breed" }, { key: "tag", label: "Tag" },
      { key: "status", label: "Status", type: "status" }, { key: "farmer", label: "Farmer" }, { key: "investor", label: "Investor" }, { key: "price", label: "Purchase price", type: "money" }],
    totals: ["price"],
    sql: `${F} select a.code, a.species, a.breed, a.tag_number tag, a.status, fr.full_name farmer, i.full_legal_name investor, pl.price
          from hv.animals a left join hv.farmers fr on fr.id = a.current_farmer_id left join hv.investors i on i.id = a.investor_id
          left join hv.purchase_lines pl on pl.animal_id = a.id cross join f
          where ${eq("a.status", "status")} and ${eq("a.investor_id", "investor")} and ${eq("a.current_farmer_id", "farmer")} order by a.code`,
  },
  {
    slug: "farmer-allocations", title: "Farmer allocation report",
    description: "Every allocation and transfer, including ended ones.",
    perms: ["livestock.read"], filters: ["farmer", "dates", "status"], statusOptions: [["active", "Active"], ["ended", "Ended"]],
    columns: [{ key: "farmer", label: "Farmer" }, { key: "animal", label: "Animal" }, { key: "start_date", label: "From", type: "date" }, { key: "end_date", label: "To", type: "date" },
      { key: "reason", label: "Reason" }, { key: "end_reason", label: "End reason" }, { key: "status", label: "Status", type: "status" }],
    sql: `${F} select fr.full_name farmer, a.code animal, al.start_date, al.end_date, al.reason, al.end_reason, al.status
          from hv.allocations al join hv.farmers fr on fr.id = al.farmer_id join hv.animals a on a.id = al.animal_id cross join f
          where ${eq("al.farmer_id", "farmer")} and ${eq("al.status", "status")} and ${inRange("al.start_date")} order by fr.full_name, al.start_date`,
  },
  {
    slug: "vaccinations", title: "Veterinary & vaccination report",
    description: "Vaccinations, treatments and veterinary visits with next due dates.",
    perms: ["vet.read"], filters: ["dates", "animal", "farmer", "status"], statusOptions: [["scheduled", "Scheduled"], ["completed", "Completed"], ["missed", "Missed"]],
    columns: [{ key: "code", label: "Record" }, { key: "animal", label: "Animal" }, { key: "visit_type", label: "Type" }, { key: "date", label: "Date", type: "date" },
      { key: "vaccine_name", label: "Vaccine" }, { key: "treatment", label: "Treatment" }, { key: "next_due_date", label: "Next due", type: "date" },
      { key: "cost", label: "Cost", type: "money" }, { key: "status", label: "Status", type: "status" }],
    totals: ["cost"],
    sql: `${F} select v.code, a.code animal, v.visit_type, coalesce(v.visit_date, v.scheduled_date) date, v.vaccine_name, v.treatment, v.next_due_date, v.cost, v.status
          from hv.vet_records v join hv.animals a on a.id = v.animal_id cross join f
          where v.visit_type in ('vaccination','treatment','health_check','follow_up','purchase_assessment')
            and ${eq("v.animal_id", "animal")} and ${eq("v.farmer_id", "farmer")} and ${eq("v.status", "status")} and ${inRange("coalesce(v.visit_date, v.scheduled_date)")}
          order by date desc`,
  },
  {
    slug: "inspections", title: "Inspection report",
    description: "Farm inspections with findings, condition and weight.",
    perms: ["vet.read"], filters: ["dates", "animal", "farmer", "employee"],
    columns: [{ key: "code", label: "Record" }, { key: "date", label: "Date", type: "date" }, { key: "animal", label: "Animal" }, { key: "farmer", label: "Farmer" },
      { key: "inspector", label: "Inspector" }, { key: "condition", label: "Condition" }, { key: "weight_kg", label: "Weight (kg)", type: "number" }, { key: "findings", label: "Findings" }],
    sql: `${F} select v.code, coalesce(v.visit_date, v.scheduled_date) date, a.code animal, fr.full_name farmer, coalesce(e.full_name, v.performed_by) inspector,
            v.condition, v.weight_kg, v.findings
          from hv.vet_records v join hv.animals a on a.id = v.animal_id left join hv.farmers fr on fr.id = v.farmer_id left join hv.employees e on e.id = v.employee_id cross join f
          where v.visit_type = 'inspection' and ${eq("v.animal_id", "animal")} and ${eq("v.farmer_id", "farmer")} and ${eq("v.employee_id", "employee")}
            and ${inRange("coalesce(v.visit_date, v.scheduled_date)")} order by date desc`,
  },
  {
    slug: "expenses", title: "Expense report",
    description: "Expenses by category, who bears them, approval and payment status.",
    perms: ["expenses.read"], filters: ["dates", "category", "status", "investor"],
    statusOptions: [["submitted", "Submitted"], ["approved", "Approved"], ["paid", "Paid"], ["rejected", "Rejected"], ["disputed", "Disputed"], ["voided", "Voided"]],
    columns: [{ key: "code", label: "Expense" }, { key: "expense_date", label: "Date", type: "date" }, { key: "category", label: "Category" }, { key: "description", label: "Description" },
      { key: "charge_type", label: "Borne by" }, { key: "investor", label: "Investor" }, { key: "amount", label: "Amount", type: "money" }, { key: "status", label: "Status", type: "status" }],
    totals: ["amount"],
    sql: `${F} select e.code, e.expense_date, c.label category, e.description, replace(e.charge_type,'_',' ') charge_type, i.full_legal_name investor, e.amount, e.status
          from hv.expenses e join hv.expense_categories c on c.id = e.category_id left join hv.investors i on i.id = e.investor_id cross join f
          where ${eq("e.category_id", "category")} and ${eq("e.status", "status")} and ${eq("e.investor_id", "investor")} and ${inRange("e.expense_date")}
          order by e.expense_date desc`,
  },
  {
    slug: "purchases", title: "Purchase register",
    description: "Every livestock purchase with funding account and cost.",
    perms: ["purchases.read", "finance.read"], filters: ["dates", "investor", "status", "account_status"],
    statusOptions: [["completed", "Completed"], ["voided", "Voided"]],
    columns: [{ key: "code", label: "Purchase" }, { key: "purchase_date", label: "Date", type: "date" }, { key: "investor", label: "Investor" }, { key: "account", label: "Account" },
      { key: "seller", label: "Seller" }, { key: "animals", label: "Animals", type: "number" }, { key: "total_cost", label: "Total cost", type: "money" }, { key: "status", label: "Status", type: "status" }],
    totals: ["total_cost", "animals"],
    sql: `${F} select p.code, p.purchase_date, i.full_legal_name investor, a.code account, p.seller_name seller,
            (select count(*) from hv.purchase_lines pl where pl.purchase_id = p.id) animals, p.total_cost, p.status
          from hv.purchases p join hv.investors i on i.id = p.investor_id join hv.investment_accounts a on a.id = p.account_id cross join f
          where ${eq("p.investor_id", "investor")} and ${eq("p.status", "status")} and ${eq("a.status", "account_status")} and ${inRange("p.purchase_date")}
          order by p.purchase_date desc`,
  },
  {
    slug: "sales", title: "Sales register",
    description: "Every sale with price, money received and settlement status.",
    perms: ["sales.read", "finance.read"], filters: ["dates", "investor", "farmer", "status", "account_status"],
    statusOptions: [["calculated", "Calculated"], ["review_required", "Review required"], ["approved", "Approved"], ["partially_paid", "Partially paid"], ["paid", "Paid"]],
    columns: [{ key: "code", label: "Sale" }, { key: "sale_date", label: "Date", type: "date" }, { key: "animal", label: "Animal" }, { key: "investor", label: "Investor" },
      { key: "buyer", label: "Buyer" }, { key: "sale_price", label: "Sale price", type: "money" }, { key: "received", label: "Received", type: "money" }, { key: "settlement", label: "Settlement", type: "status" }],
    totals: ["sale_price", "received"],
    sql: `${F} select s.code, s.sale_date, a.code animal, i.full_legal_name investor, s.buyer_name buyer, s.sale_price,
            (select coalesce(sum(amount),0) from hv.sale_receipts r where r.sale_id = s.id) received, st.status settlement
          from hv.sales s join hv.animals a on a.id = s.animal_id left join hv.investors i on i.id = s.investor_id left join hv.settlements st on st.sale_id = s.id
          left join hv.investment_accounts ac on ac.id = s.account_id cross join f
          where ${eq("s.investor_id", "investor")} and ${eq("s.farmer_id", "farmer")} and ${eq("st.status", "status")} and ${eq("ac.status", "account_status")}
            and ${inRange("s.sale_date")} order by s.sale_date desc`,
  },
  {
    slug: "investor-settlements", title: "Investor settlement report",
    description: "Capital returned, profit or loss, fee and investor payable / paid / outstanding per sale.",
    perms: ["sales.read", "finance.read"], filters: ["dates", "investor", "status", "account_status"],
    statusOptions: [["calculated", "Calculated"], ["review_required", "Review required"], ["approved", "Approved"], ["partially_paid", "Partially paid"], ["paid", "Paid"]],
    columns: [{ key: "code", label: "Settlement" }, { key: "investor", label: "Investor" }, { key: "animal", label: "Animal" }, { key: "capital_returned", label: "Capital returned", type: "money" },
      { key: "profit_pool", label: "Profit / loss", type: "money" }, { key: "herdvest_fee", label: "Herdvest fee", type: "money" }, { key: "investor_net", label: "Investor net", type: "money" },
      { key: "payable", label: "Payable", type: "money" }, { key: "paid", label: "Paid", type: "money" }, { key: "status", label: "Status", type: "status" }],
    totals: ["capital_returned", "profit_pool", "herdvest_fee", "investor_net", "payable", "paid"],
    sql: `${F} select st.code, i.full_legal_name investor, a.code animal, st.capital_returned, st.profit_pool, st.herdvest_fee, st.investor_net, st.investor_payable payable,
            (select coalesce(sum(amount),0) from hv.settlement_payments p where p.settlement_id = st.id and p.payee = 'investor') paid, st.status
          from hv.settlements st join hv.sales s on s.id = st.sale_id join hv.animals a on a.id = s.animal_id left join hv.investors i on i.id = s.investor_id
          left join hv.investment_accounts ac on ac.id = s.account_id cross join f
          where ${eq("s.investor_id", "investor")} and ${eq("st.status", "status")} and ${eq("ac.status", "account_status")} and ${inRange("s.sale_date")}
          order by s.sale_date desc`,
  },
  {
    slug: "farmer-payments", title: "Farmer payment report",
    description: "Farmer profit shares payable, paid and outstanding.",
    perms: ["sales.read", "finance.read"], filters: ["dates", "farmer"],
    columns: [{ key: "farmer", label: "Farmer" }, { key: "code", label: "Settlement" }, { key: "animal", label: "Animal" }, { key: "farmer_share", label: "Calculated share", type: "money" },
      { key: "payable", label: "Payable", type: "money" }, { key: "paid", label: "Paid", type: "money" }, { key: "status", label: "Status", type: "status" }],
    totals: ["farmer_share", "payable", "paid"],
    sql: `${F} select fr.full_name farmer, st.code, a.code animal, st.farmer_share, st.farmer_payable payable,
            (select coalesce(sum(amount),0) from hv.settlement_payments p where p.settlement_id = st.id and p.payee = 'farmer') paid, st.status
          from hv.settlements st join hv.sales s on s.id = st.sale_id join hv.animals a on a.id = s.animal_id left join hv.farmers fr on fr.id = s.farmer_id cross join f
          where ${eq("s.farmer_id", "farmer")} and ${inRange("s.sale_date")} order by fr.full_name, s.sale_date`,
  },
  {
    slug: "management-fees", title: "Herdvest management-fee report",
    description: "The 20% fee per completed sale (charged once, never annually): calculated, approved and received.",
    perms: ["sales.read", "finance.read"], filters: ["dates", "investor"],
    columns: [{ key: "code", label: "Settlement" }, { key: "sale_date", label: "Sale date", type: "date" }, { key: "investor", label: "Investor" }, { key: "investor_gross", label: "Investor gross share", type: "money" },
      { key: "herdvest_fee", label: "Fee calculated", type: "money" }, { key: "herdvest_payable", label: "Fee approved", type: "money" }, { key: "received", label: "Fee received", type: "money" }, { key: "status", label: "Status", type: "status" }],
    totals: ["investor_gross", "herdvest_fee", "herdvest_payable", "received"],
    sql: `${F} select st.code, s.sale_date, i.full_legal_name investor, st.investor_gross, st.herdvest_fee,
            case when st.status in ('approved','partially_paid','paid') then st.herdvest_payable end herdvest_payable,
            (select coalesce(sum(amount),0) from hv.settlement_payments p where p.settlement_id = st.id and p.payee = 'herdvest') received, st.status
          from hv.settlements st join hv.sales s on s.id = st.sale_id left join hv.investors i on i.id = s.investor_id cross join f
          where ${eq("s.investor_id", "investor")} and ${inRange("s.sale_date")} order by s.sale_date desc`,
  },
  {
    slug: "incidents", title: "Mortality & incident report",
    description: "Incidents, investigation status and approved loss allocations.",
    perms: ["incidents.read"], filters: ["dates", "status", "farmer"],
    statusOptions: [["reported", "Reported"], ["investigating", "Investigating"], ["under_review", "Under review"], ["decided", "Decided"], ["closed", "Closed"]],
    columns: [{ key: "code", label: "Incident" }, { key: "occurred_at", label: "Occurred", type: "datetime" }, { key: "animal", label: "Animal" }, { key: "incident_type", label: "Type" },
      { key: "farmer", label: "Farmer" }, { key: "estimated_loss", label: "Est. loss", type: "money" }, { key: "investor_loss", label: "Investor bears", type: "money" },
      { key: "farmer_loss", label: "Farmer bears", type: "money" }, { key: "herdvest_loss", label: "Herdvest bears", type: "money" }, { key: "status", label: "Status", type: "status" }],
    totals: ["estimated_loss", "investor_loss", "farmer_loss", "herdvest_loss"],
    sql: `${F} select x.code, x.occurred_at, a.code animal, x.incident_type, fr.full_name farmer, x.estimated_loss, x.investor_loss, x.farmer_loss, x.herdvest_loss, x.status
          from hv.incidents x join hv.animals a on a.id = x.animal_id left join hv.farmers fr on fr.id = x.farmer_id cross join f
          where ${eq("x.status", "status")} and ${eq("x.farmer_id", "farmer")} and ${inRange("x.occurred_at")} order by x.occurred_at desc`,
  },
  {
    slug: "outstanding-balances", title: "Outstanding balances",
    description: "Receivables (buyer payments due) and payables (settlement payments, approved unpaid expenses, pending refunds).",
    perms: ["finance.read"], filters: [],
    columns: [{ key: "kind", label: "Type" }, { key: "reference", label: "Reference" }, { key: "party", label: "Party" }, { key: "receivable", label: "Receivable", type: "money" }, { key: "payable", label: "Payable", type: "money" }],
    totals: ["receivable", "payable"],
    sql: `${F} select * from (
        select 'Buyer payment due' kind, s.code reference, s.buyer_name party, s.sale_price - coalesce((select sum(amount) from hv.sale_receipts r where r.sale_id = s.id),0) receivable, null::numeric payable
          from hv.sales s where s.status = 'recorded' and s.sale_price > coalesce((select sum(amount) from hv.sale_receipts r where r.sale_id = s.id),0)
        union all
        select 'Settlement payment due (' || o.payee || ')', st.code, case o.payee when 'investor' then i.full_legal_name when 'farmer' then fr.full_name else 'Herdvest' end, null, o.outstanding
          from hv.settlements st join hv.sales s on s.id = st.sale_id left join hv.investors i on i.id = s.investor_id left join hv.farmers fr on fr.id = s.farmer_id
          cross join lateral hv.settlement_outstanding(st.id) o where st.status in ('approved','partially_paid') and o.outstanding > 0
        union all
        select 'Approved expense unpaid', e.code, e.vendor, null, e.amount from hv.expenses e where e.status = 'approved'
        union all
        select 'Pending refund to investor', l.code, i.full_legal_name, null, l.amount from hv.ledger_entries l join hv.investors i on i.id = l.investor_id
          where l.entry_type = 'refund_to_investor' and l.status = 'pending'
      ) x cross join f order by kind, reference`,
  },
  {
    slug: "employee-tasks", title: "Employee task report",
    description: "Tasks by employee with due and completion dates.",
    perms: ["tasks.read_all"], filters: ["employee", "status", "dates"],
    statusOptions: [["open", "Open"], ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]],
    columns: [{ key: "employee", label: "Employee" }, { key: "code", label: "Task" }, { key: "title", label: "Title" }, { key: "task_type", label: "Type" },
      { key: "due_date", label: "Due", type: "date" }, { key: "completed_at", label: "Completed", type: "datetime" }, { key: "status", label: "Status", type: "status" }],
    sql: `${F} select e.full_name employee, t.code, t.title, t.task_type, t.due_date, t.completed_at, t.status
          from hv.tasks t left join hv.employees e on e.id = t.assigned_to cross join f
          where ${eq("t.assigned_to", "employee")} and ${eq("t.status", "status")} and ${inRange("coalesce(t.due_date, t.created_at::date)")}
          order by e.full_name, t.due_date nulls last`,
  },
];

export const reportBySlug = (slug: string) => reports.find((r) => r.slug === slug);

export function readFilters(sp: Record<string, string | string[] | undefined>) {
  const g = (k: string) => {
    const v = sp[k];
    return ((Array.isArray(v) ? v[0] : v) ?? "").slice(0, 60);
  };
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(g(k)) ? g(k) : "");
  const uuid = (k: string) => (/^[0-9a-f-]{36}$/i.test(g(k)) ? g(k) : "");
  return {
    from: date("from"), to: date("to"), investor: uuid("investor"), animal: uuid("animal"), farmer: uuid("farmer"),
    employee: uuid("employee"), category: g("category").replace(/[^a-z_]/g, ""), status: g("status").replace(/[^a-z_]/g, ""),
    account_status: ["open", "closed", "suspended"].includes(g("account_status")) ? g("account_status") : "",
  };
}

export const filterParams = (f: ReturnType<typeof readFilters>) => [f.from, f.to, f.investor, f.animal, f.farmer, f.employee, f.category, f.status, f.account_status];

/** Rows that count toward totals, plus the label for the totals row. */
export function totalRows(report: Report, rows: Array<Record<string, unknown>>) {
  const counted = report.totalStatuses ? rows.filter((r) => report.totalStatuses!.includes(String(r.status))) : rows;
  const label = report.totalStatuses ? `Total — ${report.totalStatuses.join(" & ")} only (${counted.length})` : `Total (${rows.length})`;
  return { counted, label };
}
