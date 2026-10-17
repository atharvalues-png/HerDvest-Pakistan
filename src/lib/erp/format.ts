/**
 * Display helpers for the management system. Money arrives from PostgreSQL as
 * exact decimal strings and is formatted without converting to floating point.
 */

export function formatMoney(value: string | number | null | undefined, opts: { currency?: boolean; signed?: boolean } = {}) {
  if (value === null || value === undefined || value === "") return "—";
  const s = typeof value === "number" ? value.toFixed(2) : String(value);
  const neg = s.startsWith("-");
  const [intPart, frac = "00"] = s.replace("-", "").split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = frac.padEnd(2, "0").slice(0, 2);
  const body = decimals === "00" ? grouped : `${grouped}.${decimals}`;
  const sign = neg && !/^0+(\.0+)?$/.test(s.replace("-", "")) ? "−" : opts.signed ? "+" : "";
  return `${sign}${opts.currency === false ? "" : "PKR "}${body}`;
}

export const isNegative = (v: string | number | null | undefined) => v !== null && v !== undefined && String(v).trim().startsWith("-");

export function formatDate(value: Date | string | null | undefined, timeZone: string, withTime = false) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const dateOnly = typeof value === "string" && value.length === 10;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: dateOnly ? "UTC" : timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime && !dateOnly ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

/** YYYY-MM-DD for a Date (pg returns `date` columns as JS Date at local midnight). */
export function isoDate(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const label = (v: string | null | undefined) =>
  v ? v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—";

/** Exact decimal sum of money strings (parsed as integer paisa, no floats). */
export function sumMoney(values: Array<string | number | null | undefined>): string {
  let total = BigInt(0);
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    const s = String(v).trim();
    const neg = s.startsWith("-");
    const [i, f = ""] = s.replace("-", "").split(".");
    const p = BigInt(i || "0") * BigInt(100) + BigInt((f + "00").slice(0, 2));
    total += neg ? -p : p;
  }
  const neg = total < BigInt(0);
  const abs = neg ? -total : total;
  return `${neg ? "-" : ""}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`;
}
