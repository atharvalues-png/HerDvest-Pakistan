"use client";

import { useId, useMemo, useState } from "react";
import { Lock, RotateCcw, TriangleAlert } from "lucide-react";
import {
  holdingPeriodOptions,
  illustrativeDefaults,
  ILLUSTRATIVE_LABEL,
  MODEL,
  purchasePriceCategories,
} from "@/config/business";
import { calculate, MAX_EXACT_TOTAL } from "@/lib/calculator";
import { cn, formatPKR, formatPercent } from "@/lib/format";

const pkrNumber = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function Row({
  n,
  label,
  value,
  note,
  tone,
  strong,
}: {
  n: number;
  label: string;
  value: string;
  note?: string;
  tone?: "negative" | "fee" | "muted";
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex gap-3">
        <span className="w-5 shrink-0 pt-0.5 text-right text-[0.7rem] font-bold tabular-nums text-gold-600">{n}</span>
        <div>
          <dt className={cn("text-sm", strong ? "font-semibold text-forest" : "text-charcoal")}>{label}</dt>
          {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
        </div>
      </div>
      <dd
        className={cn(
          "whitespace-nowrap text-right tabular-nums",
          strong ? "text-base font-bold" : "text-sm font-semibold",
          tone === "negative" ? "text-alert" : tone === "fee" ? "text-gold-600" : tone === "muted" ? "text-ink-500" : "text-forest",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  error,
  step = 1,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: React.ReactNode;
  error?: string;
  step?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-forest">
        {label}
      </label>
      <div
        className={cn(
          "mt-2 flex items-center rounded-xl border bg-white px-4 py-3 focus-within:border-emerald focus-within:ring-4 focus-within:ring-emerald/15",
          error ? "border-alert" : "border-forest/15",
        )}
      >
        {prefix && <span className="mr-2 text-xs font-semibold text-ink-500">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className="w-full bg-transparent text-base font-semibold tabular-nums text-charcoal outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && <span className="ml-2 text-xs font-semibold text-ink-500">{suffix}</span>}
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs font-medium text-alert" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-ink-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const pillClass = (active: boolean) =>
  cn(
    "rounded-xl border px-3 py-3 text-sm font-semibold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-emerald/20",
    active ? "border-forest bg-forest text-ivory" : "border-forest/15 bg-white text-charcoal hover:border-forest/40",
  );

export function Calculator() {
  const uid = useId();
  const [price, setPrice] = useState<number>(illustrativeDefaults.pricePerAnimal);
  const [qty, setQty] = useState(String(illustrativeDefaults.quantity));
  const [sale, setSale] = useState(String(illustrativeDefaults.salePricePerAnimal));
  const [period, setPeriod] = useState<string>(String(illustrativeDefaults.holdingYears)); // "1" | "2" | "3" | "custom"
  const [customYears, setCustomYears] = useState("4");

  const errors: Record<string, string> = {};
  const qtyN = Number(qty);
  const saleN = Number(sale);
  const yearsN = period === "custom" ? Number(customYears) : Number(period);
  if (qty.trim() === "" || !Number.isInteger(qtyN) || qtyN < 1) errors.qty = "Enter a whole number of animals (1 or more).";
  if (sale.trim() === "" || !Number.isFinite(saleN) || saleN < 0) errors.sale = "Enter an estimated sale price of zero or more.";
  if (period === "custom" && (!Number.isFinite(yearsN) || yearsN <= 0 || yearsN > 50))
    errors.years = "Enter a holding period greater than 0 years (up to 50).";
  if (!errors.qty && !errors.sale && (price * qtyN > MAX_EXACT_TOTAL || saleN * qtyN > MAX_EXACT_TOTAL))
    errors.qty = "These totals are too large to calculate exactly. Please use smaller values.";
  const valid = Object.keys(errors).length === 0;

  const r = useMemo(
    () => (valid ? calculate({ pricePerAnimal: price, quantity: qtyN, salePricePerAnimal: saleN, holdingYears: yearsN }) : null),
    [valid, price, qtyN, saleN, yearsN],
  );
  const yearsLabel = `${yearsN} ${yearsN === 1 ? "year" : "years"}`;

  const isDefault =
    price === illustrativeDefaults.pricePerAnimal &&
    qty === String(illustrativeDefaults.quantity) &&
    sale === String(illustrativeDefaults.salePricePerAnimal) &&
    period === String(illustrativeDefaults.holdingYears);

  function reset() {
    setPrice(illustrativeDefaults.pricePerAnimal);
    setQty(String(illustrativeDefaults.quantity));
    setSale(String(illustrativeDefaults.salePricePerAnimal));
    setPeriod(String(illustrativeDefaults.holdingYears));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
      {/* Inputs */}
      <div className="rounded-3xl border border-forest/10 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-forest">Your assumptions</h3>
          <button
            type="button"
            onClick={reset}
            disabled={isDefault}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-emerald hover:bg-emerald-50 disabled:cursor-default disabled:opacity-40"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            Reset to example
          </button>
        </div>

        <div className="mt-7 space-y-7">
          <fieldset>
            <legend className="text-sm font-semibold text-forest">Initial Purchase Price Per Animal</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {purchasePriceCategories.map((p) => (
                <label key={p} className={cn(pillClass(price === p), "cursor-pointer text-center")}>
                  <input
                    type="radio"
                    name={`${uid}-price`}
                    value={p}
                    checked={price === p}
                    onChange={() => setPrice(p)}
                    className="sr-only"
                  />
                  <span className="block text-[0.65rem] font-medium uppercase tracking-wider opacity-70">PKR</span>
                  {pkrNumber.format(p)}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              Modelling categories only — not a claim that animals of every type or quality are available at these prices.
            </p>
          </fieldset>

          <NumberField
            id={`${uid}-qty`}
            label="Number of Animals"
            value={qty}
            onChange={setQty}
            suffix={qtyN === 1 ? "animal" : "animals"}
            error={errors.qty}
            hint={!errors.qty && valid && r ? <>Total initial investment: <strong className="text-forest">{formatPKR(r.totalInvestment)}</strong></> : undefined}
          />

          <NumberField
            id={`${uid}-sale`}
            label="Estimated Future Sale Price Per Animal"
            value={sale}
            onChange={setSale}
            prefix="PKR"
            step={5000}
            error={errors.sale}
            hint="PKR 600,000 is a hypothetical input — not a guaranteed or independently verified valuation. Try a price below the purchase price to see how a loss is shown."
          />

          <fieldset>
            <legend className="text-sm font-semibold text-forest">Estimated Holding Period</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[...holdingPeriodOptions.map(String), "custom"].map((opt) => (
                <label key={opt} className={cn(pillClass(period === opt), "cursor-pointer text-center")}>
                  <input
                    type="radio"
                    name={`${uid}-period`}
                    value={opt}
                    checked={period === opt}
                    onChange={() => setPeriod(opt)}
                    className="sr-only"
                  />
                  {opt === "custom" ? "Custom" : `${opt} ${opt === "1" ? "year" : "years"}`}
                </label>
              ))}
            </div>
            {period === "custom" && (
              <div className="mt-3">
                <NumberField
                  id={`${uid}-years`}
                  label="Custom holding period"
                  value={customYears}
                  onChange={setCustomYears}
                  suffix="years"
                  step={0.5}
                  error={errors.years}
                />
              </div>
            )}
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              An estimate only — animals are sold when agreed conditions and the market support a sale, which may be earlier or later.
            </p>
          </fieldset>

          <div className="rounded-xl border border-forest/10 bg-ivory/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-forest">
              <Lock aria-hidden className="h-4 w-4 text-gold-600" /> Fixed model terms
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <dt className="text-ink-500">Investor share</dt>
                <dd className="mt-0.5 text-sm font-semibold text-charcoal">{MODEL.investorSharePct}%</dd>
              </div>
              <div>
                <dt className="text-ink-500">Farmer share</dt>
                <dd className="mt-0.5 text-sm font-semibold text-charcoal">{MODEL.farmerSharePct}%</dd>
              </div>
              <div>
                <dt className="text-ink-500">Herdvest fee</dt>
                <dd className="mt-0.5 text-sm font-semibold text-charcoal">{MODEL.serviceFeePct}%</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              Herdvest&apos;s management fee is {MODEL.serviceFeePct}% of the investor&apos;s gross profit share,
              charged once per completed animal sale — not once per year.
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-forest p-6 text-ivory shadow-lift sm:p-8" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Estimated total investor proceeds</p>
          {r ? (
            <>
              <p className="mt-3 text-4xl font-bold tabular-nums sm:text-5xl">{formatPKR(r.investorTotal)}</p>
              <p className="mt-2 text-sm text-ivory/70">
                {r.isLoss
                  ? `Capital shortfall of ${formatPKR(r.capitalShortfall)} — no profit to share.`
                  : `${formatPKR(r.capitalReturned)} capital returned + ${formatPKR(r.investorNet)} net profit, over an estimated ${yearsLabel}.`}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ivory/80">Please correct the highlighted assumptions.</p>
          )}
        </div>

        {r && (
          <div className="rounded-3xl border border-forest/10 bg-white p-6 shadow-soft sm:p-8">
            <dl className="divide-y divide-forest/10">
              <Row n={1} label="Purchase price per animal" value={formatPKR(price)} />
              <Row n={2} label="Number of animals" value={pkrNumber.format(qtyN)} />
              <Row n={3} label="Total initial investment" value={formatPKR(r.totalInvestment)} strong />
              <Row n={4} label="Estimated sale price per animal" value={formatPKR(saleN)} note="Hypothetical input" />
              <Row n={5} label="Estimated total sale proceeds" value={formatPKR(r.totalSaleProceeds)} />
              <Row
                n={6}
                label={r.isLoss ? "Loss before sharing" : "Profit before sharing"}
                value={formatPKR(r.profitPool)}
                note="Total sale proceeds − total initial investment (capital is returned first)"
                tone={r.isLoss ? "negative" : undefined}
                strong
              />
              {r.isLoss ? (
                <>
                  <Row n={7} label="Investor's gross profit share" value={formatPKR(0)} tone="muted" note="No profit is shared on a loss" />
                  <Row n={8} label="Farmer's profit share" value={formatPKR(0)} tone="muted" />
                  <Row n={9} label={`Herdvest's ${MODEL.serviceFeePct}% management fee`} value={formatPKR(0)} tone="muted" note="No fee in the illustrative model when there is no profit" />
                  <Row
                    n={10}
                    label="Investor's net loss (capital shortfall)"
                    value={formatPKR(-r.capitalShortfall)}
                    tone="negative"
                    strong
                    note="How losses are allocated between parties depends on the signed agreement."
                  />
                  <Row n={11} label="Investor's total proceeds" value={formatPKR(r.investorTotal)} note="Limited to the actual sale proceeds available; subject to the signed agreement" />
                </>
              ) : (
                <>
                  <Row n={7} label={`Investor's gross profit share (${MODEL.investorSharePct}%)`} value={formatPKR(r.investorGross)} />
                  <Row n={8} label={`Farmer's profit share (${MODEL.farmerSharePct}%)`} value={formatPKR(r.farmerShare)} />
                  <Row
                    n={9}
                    label={`Herdvest's ${MODEL.serviceFeePct}% management fee`}
                    value={`−${formatPKR(r.serviceFee)}`}
                    tone="fee"
                    note="Fixed: 20% of investor gross share, charged once per completed sale"
                  />
                  <Row n={10} label="Investor's net profit" value={formatPKR(r.investorNet)} strong />
                  <Row n={11} label="Investor's total proceeds" value={formatPKR(r.investorTotal)} note="Capital returned + net profit, subject to actual sale proceeds and the signed agreement" />
                </>
              )}
              <Row
                n={12}
                label="Estimated holding-period return"
                value={r.holdingPeriodReturn === null ? "—" : formatPercent(r.holdingPeriodReturn)}
                tone={r.holdingPeriodReturn !== null && r.holdingPeriodReturn < 0 ? "negative" : undefined}
                note={`Total investor proceeds ÷ initial investment − 1, over the whole ${yearsLabel}`}
              />
              <Row
                n={13}
                label="Annualised return"
                value={r.annualisedReturn === null ? "Not applicable" : `${formatPercent(r.annualisedReturn)} p.a.`}
                tone={r.annualisedReturn === null ? "muted" : r.annualisedReturn < 0 ? "negative" : undefined}
                note={
                  r.annualisedReturn === null
                    ? "Not meaningful when total proceeds are zero."
                    : `Compound rate over ${yearsLabel}, assuming no interim cash flows. Changing the period changes this rate only — the fee is not charged again. Not a yield or a promise.`
                }
              />
            </dl>
          </div>
        )}

        <div className="rounded-2xl border border-gold/50 bg-gold-50 p-5 text-xs leading-relaxed text-charcoal">
          <p className="flex items-start gap-2 font-semibold text-forest">
            <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            {ILLUSTRATIVE_LABEL}
          </p>
          <p className="mt-2">
            This calculator is a simplified illustration, not a forecast, quote or guaranteed return.
            It assumes initial capital is returned before the remaining profit is divided, that the
            purchase price is the only deduction before sharing, and it excludes any unmodelled
            expenses, taxes and contractual adjustments. Actual outcomes depend on purchase price,
            animal health, holding period, market conditions, sale price and the signed agreement.
          </p>
        </div>
      </div>
    </div>
  );
}
