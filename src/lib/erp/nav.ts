/** Sidebar navigation. Items show only when the user holds one of `perms`. */
export type NavItem = { href: string; label: string; icon: string; perms?: string[]; employeeOnly?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const erpNav: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/management", label: "Dashboard", icon: "dashboard", perms: ["dashboard.view"] },
      { href: "/management/tasks", label: "Tasks", icon: "tasks", perms: ["tasks.read_all", "tasks.write"], employeeOnly: true },
    ],
  },
  {
    label: "Investors",
    items: [
      { href: "/management/enquiries", label: "Enquiries", icon: "inbox", perms: ["enquiries.read"] },
      { href: "/management/investors", label: "Investors", icon: "investors", perms: ["investors.read"] },
      { href: "/management/ledger", label: "Funding ledger", icon: "ledger", perms: ["finance.read"] },
    ],
  },
  {
    label: "Livestock",
    items: [
      { href: "/management/animals", label: "Animals", icon: "animals", perms: ["livestock.read"], employeeOnly: true },
      { href: "/management/purchases", label: "Purchases", icon: "purchases", perms: ["purchases.read", "finance.read"] },
      { href: "/management/farmers", label: "Farmers", icon: "farmers", perms: ["farmers.read"] },
      { href: "/management/veterinary", label: "Veterinary & inspections", icon: "vet", perms: ["vet.read", "vet.write"] },
      { href: "/management/incidents", label: "Incidents", icon: "incidents", perms: ["incidents.read", "incidents.write"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/management/expenses", label: "Expenses", icon: "expenses", perms: ["expenses.read", "expenses.submit"] },
      { href: "/management/sales", label: "Sales & settlements", icon: "sales", perms: ["sales.read", "finance.read"] },
      { href: "/management/reports", label: "Reports", icon: "reports", perms: ["reports.operational", "reports.financial"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/management/intake", label: "Intake queue", icon: "intake", perms: ["intake.review"] },
      { href: "/management/employees", label: "Employees", icon: "employees", perms: ["employees.read"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/management/users", label: "Users & roles", icon: "users", perms: ["users.manage"] },
      { href: "/management/audit", label: "Audit log", icon: "audit", perms: ["audit.read"] },
      { href: "/management/settings", label: "Settings", icon: "settings", perms: ["settings.manage"] },
    ],
  },
];

export function visibleNav(perms: Set<string>, hasEmployee: boolean) {
  return erpNav
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => (i.perms ?? []).some((p) => perms.has(p)) || (i.employeeOnly && hasEmployee)),
    }))
    .filter((g) => g.items.length > 0);
}
