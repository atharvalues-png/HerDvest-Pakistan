import Link from "next/link";
import { ArrowRight, Info, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";
import { isPlaceholder } from "@/config/site";

/* ---------- Layout ---------- */

export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10", className)}>
      {children}
    </div>
  );
}

type Tone = "ivory" | "white" | "forest" | "sand";

const toneClasses: Record<Tone, string> = {
  ivory: "bg-ivory text-charcoal",
  white: "bg-white text-charcoal",
  sand: "bg-ivory-200/60 text-charcoal",
  forest: "bg-forest text-ivory",
};

export function Section({
  id,
  tone = "ivory",
  className,
  children,
  ...rest
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"section">, "id" | "className" | "children">) {
  return (
    <section
      id={id}
      className={cn("relative py-20 sm:py-24 lg:py-28", toneClasses[tone], className)}
      {...rest}
    >
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  dark = false,
  className,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]",
        dark ? "text-gold" : "text-emerald",
        className,
      )}
    >
      <span aria-hidden className={cn("h-px w-6", dark ? "bg-gold" : "bg-emerald")} />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  dark = false,
  align = "left",
  className,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  dark?: boolean;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center [&_p.eyebrow]:justify-center",
        className,
      )}
    >
      {eyebrow && (
        <Eyebrow dark={dark} className={cn("eyebrow", align === "center" && "justify-center")}>
          {eyebrow}
        </Eyebrow>
      )}
      <Heading
        className={cn(
          "mt-4 text-3xl font-semibold leading-[1.1] sm:text-4xl lg:text-[2.75rem]",
          dark ? "text-ivory" : "text-forest",
        )}
      >
        {title}
      </Heading>
      {lead && (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed sm:text-lg",
            dark ? "text-ivory/75" : "text-ink-600",
          )}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/** Serif italic accent used sparingly inside headlines. */
export function Accent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-serif font-normal italic tracking-normal", className)}>
      {children}
    </span>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "gold" | "outline" | "outline-light" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-forest text-ivory hover:bg-forest-700 shadow-soft hover:shadow-lift",
  gold: "bg-gold text-forest-950 hover:bg-[#d2b26c] shadow-soft hover:shadow-lift",
  outline:
    "border border-forest/25 text-forest hover:border-forest hover:bg-forest hover:text-ivory",
  "outline-light":
    "border border-ivory/40 text-ivory hover:bg-ivory hover:text-forest backdrop-blur-sm",
  ghost: "text-forest hover:bg-forest/5",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60";

export function ButtonLink({
  href,
  variant = "primary",
  arrow = false,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonBase, buttonVariants[variant], "group", className)}>
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      )}
    </Link>
  );
}

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button className={cn(buttonBase, buttonVariants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 text-sm font-semibold text-emerald underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
      <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ---------- Content ---------- */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-forest/10 bg-white p-6 shadow-soft sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IconBadge({
  children,
  tone = "emerald",
  className,
}: {
  children: ReactNode;
  tone?: "emerald" | "gold" | "light";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5",
        tone === "emerald" && "bg-emerald-50 text-emerald",
        tone === "gold" && "bg-gold-50 text-gold-600",
        tone === "light" && "bg-ivory/10 text-gold",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  children,
  tone = "info",
  className,
  title,
}: {
  children: ReactNode;
  tone?: "info" | "warning";
  className?: string;
  title?: string;
}) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed",
        tone === "warning"
          ? "border-gold/50 bg-gold-50 text-charcoal"
          : "border-emerald/20 bg-emerald-50 text-charcoal",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "warning" ? "text-gold-600" : "text-emerald",
        )}
      />
      <div>
        {title && <p className="font-semibold text-forest">{title}</p>}
        <div className={cn(title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}

/** Renders a config value, marking unconfigured placeholders visually. */
export function Value({ value, className }: { value: string; className?: string }) {
  if (isPlaceholder(value)) {
    return (
      <span className={cn("placeholder-value", className)} title="Placeholder — to be configured before launch">
        {value}
      </span>
    );
  }
  return <span className={className}>{value}</span>;
}

export function CheckList({
  items,
  dark = false,
  className,
}: {
  items: ReactNode[];
  dark?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed">
          <span
            aria-hidden
            className={cn(
              "mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full",
              dark ? "bg-gold" : "bg-emerald",
            )}
          />
          <span className={dark ? "text-ivory/85" : "text-ink-600"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}
