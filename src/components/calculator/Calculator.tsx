"use client";

import { useId, useMemo, useState } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { calculatorLimits as L, illustrativeDefaults, ILLUSTRATIVE_LABEL } from "@/config/business";
import { calculate, type CalculatorInput } from "@/lib/calculator";
import { cn, formatPKR, formatPercent } from "@/lib/format";

type Key = keyof CalculatorInput;

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  hint,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const fill = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  // Keep the slider usable for large typed values by capping its visual range.
  const sliderMax = Math.max(max, value);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={`${id}-num`} className="text-sm font-semibold text-forest">
          {label}
        </label>
        <div
          className={cn(
            "flex items-center rounded-lg border bg-white px-3 py-1.5 focus-within:border-emerald focus-within:ring-4 focus-within:ring-emerald/15",
            error ? "border-alert" : "border-forest/15",
          )}
        >
          {prefix && <span className="mr-1.5 text-xs font-semibold text-ink-500">{prefix}</span>}
          <input
            id={`${id}-num`}
            type="number"
            inputMode="decimal"
            min={min}
            step={step}
            value={draft ?? String(value)}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(n)) onChange(n);
            }}
            onBlur={() => setDraft(null)}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
            className="w-28 bg-transparent text-right text-sm font-semibold tabular-nums text-charcoal outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          {suffix && <span className="ml-1.5 text-xs font-semibold text-ink-500">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={sliderMax}
        step={step}
        value={value}
        onChange={(e) => {
          setDraft(null);
          onChange(Number(e.target.value));
        }}
        className="range mt-4"
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
      {error ? (
        <p id={`${id}-err`} className="mt-2 text-xs font-medium text-alert" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-2 text-xs text-ink-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function Row({
  label,
  value,
  note,
  tone,
  strong,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "negative" | "fee" | "muted";
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <dt className={cn("text-sm", strong ? "font-semibold text-forest" : "text-charcoal")}>{label}</dt>
        {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
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

export function Calculator() {
  const [input, setInput] = useState<CalculatorInput>({ ...illustrativeDefaults });
  const set = (k: Key) => (v: number) => setInput((s) => ({ ...s, [k]: v }));

  const errors: Partial<Record<Key, string>> = {};
  if (!(input.purchasePrice > 0)) errors.purchasePrice = "Enter a purchase price above zero.";
  if (input.salePrice < 0) errors.salePrice = "Sale price cannot be negative.";
  if (!(input.holdingYears > 0) || input.holdingYears > 20) errors.holdingYears = "Enter a holding period between 0.5 and 20 years.";
  if (input.investorSharePct < 0 || input.investorSharePct > 100) errors.investorSharePct = "Enter a percentage between 0 and 100.";
  if (input.serviceFeePct < 0 || input.serviceFeePct > 100) errors.serviceFeePct = "Enter a percentage between 0 and 100.";
  const valid = Object.keys(errors).length === 0;

  const r = useMemo(() => calculate(input), [input]);
  const isDefault = (Object.keys(illustrativeDefaults) as Key[]).every((k) => input[k] === illustrativeDefaults[k]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
      {/* Inputs */}
      <div className="rounded-3xl border border-forest/10 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-forest">Your assumptions</h3>
          <button
            type="button"
            onClick={() => setInput({ ...illustrativeDefaults })}
            disabled={isDefault}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-emerald hover:bg-emerald-50 disabled:cursor-default disabled:opacity-40"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            Reset to example
          </button>
        </div>
        <div className="mt-8 space-y-8">
          <SliderField label="Initial purchase price" prefix="PKR" value={input.purchasePrice} onChange={set("purchasePrice")} {...L.purchasePrice} error={errors.purchasePrice} />
          <SliderField label="Estimated future sale price" prefix="PKR" value={input.salePrice} onChange={set("salePrice")} {...L.salePrice} max={5_000_000} error={errors.salePrice} hint="Try a price below the purchase price to see how a loss is shown." />
          <SliderField label="Estimated holding period" suffix="years" value={input.holdingYears} onChange={set("holdingYears")} {...L.holdingYears} error={errors.holdingYears} />
          <SliderField
            label="Investor profit share"
            suffix="%"
            value={input.investorSharePct}
            onChange={set("investorSharePct")}
            {...L.investorSharePct}
            error={errors.investorSharePct}
            hint={`Farmer share is set automatically to ${Math.max(0, Math.min(100, 100 - input.investorSharePct))}% so the two always total 100%.`}
          />
          <SliderField
            label="Herdvest service fee"
            suffix="%"
            value={input.serviceFeePct}
            onChange={set("serviceFeePct")}
            {...L.serviceFeePct}
            max={50}
            error={errors.serviceFeePct}
            hint="Applied to the investor's gross profit share only."
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-forest p-6 text-ivory shadow-lift sm:p-8" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Estimated total investor proceeds</p>
          {valid ? (
            <>
              <p className="mt-3 text-4xl font-bold tabular-nums sm:text-5xl">{formatPKR(r.investorTotal)}</p>
              <p className="mt-2 text-sm text-ivory/70">
                {r.isLoss
                  ? `Capital shortfall of ${formatPKR(r.capitalShortfall)} — no profit to share.`
                  : `${formatPKR(r.capitalReturned)} capital returned + ${formatPKR(r.investorNet)} net profit, over ${input.holdingYears} ${input.holdingYears === 1 ? "year" : "years"}.`}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ivory/80">Please correct the highlighted assumptions.</p>
          )}
        </div>

        {valid && (
          <div className="rounded-3xl border border-forest/10 bg-white p-6 shadow-soft sm:p-8">
            <dl className="divide-y divide-forest/10">
              <Row label="Initial capital" value={formatPKR(input.purchasePrice)} />
              <Row label="Estimated sale proceeds" value={formatPKR(input.salePrice)} />
              <Row
                label={r.isLoss ? "Loss before sharing" : "Profit pool before sharing"}
                value={formatPKR(r.profitPool)}
                note="Sale proceeds − initial purchase price"
                tone={r.isLoss ? "negative" : undefined}
                strong
              />
              {r.isLoss ? (
                <>
                  <Row label="Capital returned to investor" value={formatPKR(r.capitalReturned)} note="Limited to the available sale proceeds" />
                  <Row label="Capital shortfall" value={formatPKR(-r.capitalShortfall)} tone="negative" strong />
                  <Row label="Investor gross profit share" value={formatPKR(0)} tone="muted" note="No profit is shared on a loss" />
                  <Row label="Herdvest service fee" value={formatPKR(0)} tone="muted" />
                  <Row label="Farmer profit share" value={formatPKR(0)} tone="muted" />
                </>
              ) : (
                <>
                  <Row label={`Investor gross profit share (${input.investorSharePct}%)`} value={formatPKR(r.investorGross)} />
                  <Row label={`Herdvest service fee (${input.serviceFeePct}% of investor share)`} value={`−${formatPKR(r.serviceFee)}`} tone="fee" />
                  <Row label="Investor net profit" value={formatPKR(r.investorNet)} strong />
                  <Row label={`Farmer profit share (${r.farmerSharePct}%)`} value={formatPKR(r.farmerShare)} />
                </>
              )}
              <Row label="Estimated holding period" value={`${input.holdingYears} ${input.holdingYears === 1 ? "year" : "years"}`} />
              <Row
                label="Illustrative annualised rate"
                value={r.annualisedRate === null ? "Not applicable" : `${formatPercent(r.annualisedRate)} p.a.`}
                tone={r.annualisedRate === null ? "muted" : undefined}
                note={
                  r.annualisedRate === null
                    ? "Only shown when total proceeds exceed initial capital."
                    : `Compound rate turning ${formatPKR(input.purchasePrice)} into ${formatPKR(r.investorTotal)} over the full period, with no interim cash flows. Not a yield or a promise.`
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
            It excludes any unmodelled expenses, taxes and contractual adjustments, and assumes the
            purchase price is the only deduction before sharing. In a loss, this illustration
            applies all sale proceeds to the investor&apos;s capital; actual loss allocation is set
            by the signed agreement.
          </p>
        </div>
      </div>
    </div>
  );
}
