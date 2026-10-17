"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpenCheck, ClipboardList, Cog, FileBarChart, HandCoins, HeartPulse, Inbox, LayoutDashboard, LogOut, Menu,
  MessageSquareText, PawPrint, Receipt, Search, ShieldCheck, ShoppingCart, Siren, Tractor, UserCog, Users, Wallet, X,
} from "lucide-react";
import { LogoMark } from "@/components/layout/Logo";
import type { NavGroup } from "@/lib/erp/nav";
import { cn } from "@/lib/format";

const icons: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, tasks: ClipboardList, inbox: Inbox, investors: Users, ledger: Wallet, animals: PawPrint,
  purchases: ShoppingCart, farmers: Tractor, vet: HeartPulse, incidents: Siren, expenses: Receipt, sales: HandCoins,
  reports: FileBarChart, intake: MessageSquareText, employees: BookOpenCheck, users: UserCog, audit: ShieldCheck, settings: Cog,
};

export function Shell({
  nav,
  user,
  signOut,
  children,
}: {
  nav: NavGroup[];
  user: { name: string; role: string };
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) => (href === "/management" ? pathname === href : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-ivory/10 px-4">
        <LogoMark className="h-8 w-8" />
        <div className="leading-tight">
          <p className="text-sm font-bold text-ivory">Herdvest</p>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold">Management System</p>
        </div>
      </div>
      <form action="/management/search" className="px-3 pt-3">
        <label className="relative block">
          <span className="sr-only">Search records</span>
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory/50" />
          <input
            name="q"
            placeholder="Search ID, phone, ref…"
            className="w-full rounded-lg border border-ivory/10 bg-ivory/5 py-2 pl-8 pr-2 text-sm text-ivory placeholder:text-ivory/40 focus:border-gold/60 focus:outline-none"
          />
        </label>
      </form>
      <nav aria-label="Management" className="flex-1 overflow-y-auto px-3 py-3">
        {nav.map((g) => (
          <div key={g.label} className="mb-4">
            <p className="px-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ivory/40">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = icons[it.icon] ?? LayoutDashboard;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active(it.href) ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        active(it.href) ? "bg-ivory/10 font-semibold text-ivory" : "text-ivory/70 hover:bg-ivory/5 hover:text-ivory",
                      )}
                    >
                      <Icon aria-hidden className={cn("h-4 w-4", active(it.href) ? "text-gold" : "text-ivory/50")} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-ivory/10 p-3">
        <Link href="/management/account" className="block rounded-lg px-2 py-1.5 hover:bg-ivory/5">
          <p className="truncate text-sm font-semibold text-ivory">{user.name}</p>
          <p className="truncate text-xs text-ivory/50">{user.role}</p>
        </Link>
        <form action={signOut}>
          <button className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ivory/70 hover:bg-ivory/5 hover:text-ivory">
            <LogOut aria-hidden className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-ivory">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-forest-950 lg:block print:!hidden">{sidebar}</aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-forest/10 bg-forest-950 px-4 lg:hidden print:hidden">
        <Link href="/management" className="flex items-center gap-2 text-sm font-bold text-ivory">
          <LogoMark className="h-7 w-7" /> Herdvest
        </Link>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} className="rounded-lg p-2 text-ivory">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-forest-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-forest-950">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute right-2 top-3 rounded-lg p-2 text-ivory/70">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main id="main" className="lg:pl-60 print:pl-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
