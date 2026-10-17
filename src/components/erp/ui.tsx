import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/format";
import { formatMoney, isNegative, label } from "@/lib/erp/format";

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: Array<{ href: string; label: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-500">
            {crumbs.map((c) => (
              <span key={c.href} className="inline-flex items-center gap-1">
                <Link href={c.href} className="hover:text-forest hover:underline">
                  {c.label}
                </Link>
                <ChevronRight aria-hidden className="h-3 w-3" />
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-forest">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones: Record<string, string> = {
  green: "bg-emerald-50 text-emerald ring-emerald/20",
  gold: "bg-gold-50 text-gold-600 ring-gold/30",
  red: "bg-alert-50 text-alert ring-alert/20",
  grey: "bg-ivory-200 text-ink-600 ring-forest/10",
  blue: "bg-sky-50 text-sky-800 ring-sky-700/15",
  dark: "bg-forest text-ivory ring-forest",
};

const statusTone: Record<string, keyof typeof tones> = {
  // generic
  active: "green", verified: "green", approved: "green", paid: "green", completed: "green", converted: "green", open: "blue",
  calculated: "blue", allocated: "green", sold: "dark", closed: "grey", decided: "green", signed: "green", clear: "green",
  pending: "gold", submitted: "gold", scheduled: "blue", in_progress: "blue", new: "gold", contacted: "blue", qualified: "blue",
  review_required: "red", partially_paid: "gold", pending_review: "gold", unmatched: "red", disputed: "red",
  rejected: "red", reversed: "grey", voided: "grey", cancelled: "grey", ended: "grey", missed: "red", duplicate: "grey",
  deceased: "red", under_treatment: "red", sale_preparation: "gold", awaiting_allocation: "gold", purchased: "blue", sourcing: "grey",
  application_received: "gold", documents_pending: "gold", verification_in_progress: "blue", farm_inspection_pending: "blue",
  suspended: "red", reported: "red", investigating: "gold", under_review: "gold", prospective: "blue", dormant: "grey", exited: "grey",
};

export function Badge({ children, tone = "grey", className }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-ink-500">—</span>;
  return <Badge tone={statusTone[status] ?? "grey"}>{label(status)}</Badge>;
}

export function Money({ value, className, strong }: { value: string | number | null | undefined; className?: string; strong?: boolean }) {
  return (
    <span className={cn("whitespace-nowrap tabular-nums", isNegative(value) && "text-alert", strong && "font-semibold", className)}>
      {formatMoney(value)}
    </span>
  );
}

export function Card({ title, actions, children, className, bodyClassName }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-forest/10 bg-white shadow-[0_1px_2px_rgb(18_59_42/0.04)]", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-forest/10 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold text-forest">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label: l,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "warn" | "dark";
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-2xl border p-4 transition-colors",
        tone === "dark" ? "border-forest bg-forest text-ivory" : tone === "warn" ? "border-gold/40 bg-gold-50" : "border-forest/10 bg-white",
        href && "hover:border-emerald/40",
      )}
    >
      <p className={cn("text-xs font-medium", tone === "dark" ? "text-ivory/70" : "text-ink-500")}>{l}</p>
      <p className={cn("mt-1.5 text-xl font-semibold tabular-nums", tone === "dark" ? "text-ivory" : "text-forest")}>{value}</p>
      {hint && <p className={cn("mt-1 text-[0.7rem] leading-snug", tone === "dark" ? "text-ivory/60" : "text-ink-500")}>{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function DL({ items, cols = 2 }: { items: Array<[string, ReactNode]>; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 text-sm", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium text-ink-500">{k}</dt>
          <dd className="mt-0.5 break-words text-charcoal">{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-forest/20 bg-white/60 px-6 py-10 text-center">
      <Inbox aria-hidden className="h-8 w-8 text-ink-500/60" />
      <p className="mt-3 text-sm font-semibold text-forest">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
        variant === "primary" && "bg-forest text-ivory hover:bg-forest-700",
        variant === "secondary" && "border border-forest/15 bg-white text-forest hover:border-forest/40",
        variant === "ghost" && "text-emerald hover:bg-emerald-50",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warn" | "error" | "success"; title?: string; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "note"}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        tone === "info" && "border-emerald/20 bg-emerald-50",
        tone === "warn" && "border-gold/50 bg-gold-50",
        tone === "error" && "border-alert/30 bg-alert-50",
        tone === "success" && "border-emerald/30 bg-emerald-50",
      )}
    >
      {title && <p className="font-semibold text-forest">{title}</p>}
      <div className={cn(title && "mt-0.5", "text-charcoal")}>{children}</div>
    </div>
  );
}

export function Timeline({ items, timeZone }: { items: Array<{ at: string | Date; title: ReactNode; body?: ReactNode; who?: string | null }>; timeZone: string }) {
  if (!items.length) return <p className="text-sm text-ink-500">No history yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-forest/15 pl-5">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span aria-hidden className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-emerald ring-4 ring-white" />
          <p className="text-sm font-medium text-charcoal">{it.title}</p>
          {it.body && <div className="mt-0.5 text-sm text-ink-600">{it.body}</div>}
          <p className="mt-0.5 text-xs text-ink-500">
            {new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(it.at))}
            {it.who ? ` · ${it.who}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
