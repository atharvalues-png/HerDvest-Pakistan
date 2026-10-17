import "server-only";
import type { Report } from "@/lib/erp/reports";

/** Column layout shared by the portal transactions page and the investor's own PDF statement. */
export const portalStatementReport: Report = {
  slug: "my-statement",
  title: "Investor statement",
  description: "",
  perms: [],
  filters: [],
  columns: [
    { key: "occurred_at", label: "Date", type: "datetime" },
    { key: "reference", label: "Reference" },
    { key: "description", label: "Description" },
    { key: "animal_codes", label: "Animal" },
    { key: "money_in", label: "Received from you", type: "money" },
    { key: "money_out", label: "Used / paid out", type: "money" },
    { key: "figure", label: "Statement figure", type: "money" },
    { key: "status", label: "Status", type: "status" },
  ],
  totals: ["money_in", "money_out"],
  totalStatuses: ["verified", "paid"],
  sql: "",
};

export type TxRow = Record<string, unknown> & { direction: string; amount: string; status: string; category: string };

/** Splits each transaction's amount into the column that matches what actually happened. */
export function statementRows(rows: TxRow[]) {
  return rows.map((r) => ({
    ...r,
    money_in: r.direction === "in" ? r.amount : null,
    money_out: r.direction === "out" ? r.amount : null,
    figure: r.direction === "info" || r.direction === "request" ? r.amount : null,
  }));
}
