import { cn } from "@/lib/format";

/** Herdvest brand mark: a horned crest over a growth line, inside a shield-like tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#123B2A" />
      <path
        d="M9 12.5c1.6 4.6 5.6 7 11 7s9.4-2.4 11-7"
        fill="none"
        stroke="#C6A35B"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M14 17.5v11M26 17.5v11M14 24h12"
        fill="none"
        stroke="#F8F6EF"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[1.15rem] font-bold tracking-[-0.02em]",
            light ? "text-ivory" : "text-forest",
          )}
        >
          Herdvest
        </span>
        <span
          className={cn(
            "mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.32em]",
            light ? "text-gold" : "text-gold-600",
          )}
        >
          Pakistan
        </span>
      </span>
    </span>
  );
}
