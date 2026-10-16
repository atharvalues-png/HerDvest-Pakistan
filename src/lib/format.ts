const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** Formats a number as Pakistani rupees, e.g. "PKR 1,250,000" or "−PKR 40,000". */
export function formatPKR(value: number) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "−" : "";
  return `${sign}PKR ${pkr.format(Math.abs(rounded))}`;
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
