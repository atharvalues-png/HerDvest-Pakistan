"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, LogOut } from "lucide-react";
import { LogoMark } from "@/components/layout/Logo";
import { cn } from "@/lib/format";

const nav = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/livestock", label: "My Livestock" },
  { href: "/portal/inspections", label: "Inspections" },
  { href: "/portal/outlook", label: "Investment Outlook" },
  { href: "/portal/transactions", label: "Transactions" },
  { href: "/portal/documents", label: "Documents" },
  { href: "/portal/profile", label: "Profile" },
];

export function PortalShell({ user, unread, signOut, children }: {
  user: { name: string; code: string };
  unread: number;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/portal" ? pathname === "/portal" : pathname.startsWith(href));
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="sticky top-0 z-40 border-b border-forest/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="h-8 w-8 shrink-0" />
            <span className="leading-tight">
              <span className="block text-sm font-bold text-forest">Herdvest</span>
              <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold-600">Investor Portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/portal/notifications" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
              className={cn("relative inline-flex h-10 w-10 items-center justify-center rounded-full text-forest hover:bg-forest/5", pathname.startsWith("/portal/notifications") && "bg-forest/5")}>
              <Bell aria-hidden className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[0.6rem] font-bold leading-4 text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <div className="hidden text-right leading-tight sm:block">
              <p className="max-w-48 truncate text-sm font-semibold text-charcoal">{user.name}</p>
              <p className="text-[0.7rem] text-ink-500">Investor · {user.code}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-600 hover:bg-forest/5 hover:text-forest">
                <LogOut aria-hidden className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Investor portal" className="mx-auto max-w-6xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex min-w-max gap-1 pb-2">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
                  className={cn("inline-flex rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active(n.href) ? "bg-forest text-ivory" : "text-ink-600 hover:bg-forest/5 hover:text-forest")}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-relaxed text-ink-500 sm:px-6">
        <p>
          Figures come from Herdvest&apos;s verified records. Estimates are labelled as estimates and are not guaranteed. Livestock
          investment involves risk, including the possible loss of capital.
        </p>
      </footer>
    </div>
  );
}
