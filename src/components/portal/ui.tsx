import Link from "next/link";
import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/erp/format";
import { cn } from "@/lib/format";
import { ESTIMATE_NOTICE, inspectionStateLabel } from "@/lib/portal/data";
import { Badge } from "@/components/erp/ui";

export function PortalHeading({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-forest sm:text-[1.7rem]">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A figure from verified records. Missing values say so instead of showing zero. */
export function Figure({ label, value, hint, money = true, tone = "default", href, missing = "Not yet available" }: {
  label: string;
  value: string | number | null | undefined;
  hint?: ReactNode;
  money?: boolean;
  tone?: "default" | "dark" | "warn" | "estimate";
  href?: string;
  missing?: string;
}) {
  const empty = value === null || value === undefined || value === "";
  const body = (
    <div className={cn(
      "h-full rounded-2xl border p-4",
      tone === "dark" && "border-forest bg-forest text-ivory",
      tone === "warn" && "border-gold/40 bg-gold-50",
      tone === "estimate" && "border-dashed border-gold/60 bg-white",
      tone === "default" && "border-forest/10 bg-white",
      href && "transition-colors hover:border-emerald/40",
    )}>
      <p className={cn("flex items-center gap-1.5 text-xs font-medium", tone === "dark" ? "text-ivory/70" : "text-ink-500")}>
        {label}
        {tone === "estimate" && <Badge tone="gold">Estimate</Badge>}
      </p>
      <p className={cn("mt-1.5 font-semibold tabular-nums", empty ? "text-base text-ink-500" : "text-xl", !empty && (tone === "dark" ? "text-ivory" : "text-forest"))}>
        {empty ? missing : money ? formatMoney(value) : value}
      </p>
      {hint && <p className={cn("mt-1 text-[0.72rem] leading-snug", tone === "dark" ? "text-ivory/60" : "text-ink-500")}>{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full rounded-2xl">{body}</Link> : body;
}

export function EstimateNotice({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-xl border border-gold/40 bg-gold-50 px-3 py-2 text-xs leading-relaxed text-charcoal", className)}>
      <TrendingUp aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
      {ESTIMATE_NOTICE}
    </p>
  );
}

const stateTone: Record<string, "green" | "gold" | "red" | "blue" | "grey"> = {
  completed: "green", awaiting_review: "gold", scheduled: "blue", pending: "gold", overdue: "red", not_planned: "grey", closed: "grey",
};

export function InspectionBadge({ state }: { state: string | null | undefined }) {
  if (!state) return null;
  return <Badge tone={stateTone[state] ?? "grey"}>{inspectionStateLabel[state] ?? state}</Badge>;
}

export function Section({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-forest">{title}</h2>
          {description && <p className="text-xs text-ink-500">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
