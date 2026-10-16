/**
 * Business assumptions used for the illustrative example and calculator.
 *
 * These figures are ILLUSTRATIVE ONLY. They are not a forecast, offer or
 * promise of returns. The final terms are set by the signed agreement.
 */

export const illustrativeDefaults = {
  purchasePrice: 100_000,
  salePrice: 600_000,
  holdingYears: 3,
  investorSharePct: 50, // farmer share is always 100 - investorSharePct
  serviceFeePct: 20, // applied to the investor's gross profit share
} as const;

export const calculatorLimits = {
  purchasePrice: { min: 1_000, max: 50_000_000, step: 5_000 },
  salePrice: { min: 0, max: 100_000_000, step: 5_000 },
  holdingYears: { min: 0.5, max: 10, step: 0.5 },
  investorSharePct: { min: 0, max: 100, step: 5 },
  serviceFeePct: { min: 0, max: 100, step: 1 },
} as const;

/** Enquiry preferences only — NOT minimum investment requirements. */
export const budgetOptions = [
  { value: "100000", label: "PKR 100,000" },
  { value: "250000", label: "PKR 250,000" },
  { value: "500000", label: "PKR 500,000" },
  { value: "1000000", label: "PKR 1,000,000" },
  { value: "other", label: "Other / not sure yet" },
] as const;

export const horizonOptions = [
  { value: "1-2", label: "1–2 years" },
  { value: "2-3", label: "2–3 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "flexible", label: "Flexible / would like advice" },
] as const;

export const livestockTypes = [
  "Cattle",
  "Buffalo",
  "Goats",
  "Sheep",
  "Mixed",
  "Other",
] as const;

export const ILLUSTRATIVE_LABEL =
  "Illustrative example only. Actual outcomes may be higher or lower, and losses are possible.";
