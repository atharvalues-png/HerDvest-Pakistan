"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ArrowRight, LogIn } from "lucide-react";
import { mainNav } from "@/config/site";
import { cn } from "@/lib/format";
import { Logo } from "./Logo";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const solid = scrolled || open;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300",
        solid
          ? "border-b border-forest/10 bg-ivory/90 shadow-[0_1px_0_rgb(18_59_42/0.04)] backdrop-blur-md"
          : "border-b border-transparent bg-gradient-to-b from-forest-950/50 to-transparent",
      )}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-10">
        <Link href="/" aria-label="Herdvest Pakistan — home" className="shrink-0">
          <Logo light={!solid} />
        </Link>

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative rounded-full px-3.5 py-2 text-[0.84rem] font-medium transition-colors",
                    solid
                      ? "text-ink-600 hover:text-forest"
                      : "text-ivory/80 hover:text-ivory",
                    isActive(item.href) && (solid ? "text-forest" : "text-ivory"),
                  )}
                >
                  {item.label}
                  {isActive(item.href) && (
                    <span
                      aria-hidden
                      className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-gold"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/portal/login"
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors md:inline-flex",
              solid ? "text-forest hover:bg-forest/5" : "text-ivory hover:bg-ivory/10",
            )}
          >
            <LogIn aria-hidden className="h-4 w-4" />
            Investor Login
          </Link>
          <Link
            href="/investors#enquiry"
            className={cn(
              "hidden items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors sm:inline-flex",
              solid
                ? "bg-forest text-ivory hover:bg-forest-700"
                : "bg-gold text-forest-950 hover:bg-[#d2b26c]",
            )}
          >
            Get Started
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-full xl:hidden",
              solid ? "text-forest hover:bg-forest/5" : "text-ivory hover:bg-ivory/10",
            )}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet menu */}
      <div
        id="mobile-menu"
        ref={panelRef}
        hidden={!open}
        className="h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-forest/10 bg-ivory xl:hidden"
      >
        <nav aria-label="Mobile" className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <ul className="divide-y divide-forest/10">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between py-4 text-lg font-medium",
                    isActive(item.href) ? "text-emerald" : "text-forest",
                  )}
                >
                  {item.label}
                  <ArrowRight aria-hidden className="h-4 w-4 opacity-40" />
                </Link>
              </li>
            ))}
            <li>
              <Link href="/faq" className="flex items-center justify-between py-4 text-lg font-medium text-forest">
                FAQ
                <ArrowRight aria-hidden className="h-4 w-4 opacity-40" />
              </Link>
            </li>
          </ul>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/investors#enquiry"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-forest px-6 py-3.5 text-sm font-semibold text-ivory"
            >
              Explore Livestock Investment
            </Link>
            <Link
              href="/farmers#apply"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-forest/25 px-6 py-3.5 text-sm font-semibold text-forest"
            >
              Become a Partner Farmer
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-forest/10 pt-6 text-sm">
            <Link href="/portal/login" className="inline-flex items-center gap-2 font-semibold text-forest">
              <LogIn aria-hidden className="h-4 w-4" />
              Investor Login
            </Link>
            <Link href="/management/login" className="text-ink-500 hover:text-forest">
              Staff Login
            </Link>
          </div>
          <p className="mt-8 text-xs leading-relaxed text-ink-500">
            Livestock investment involves risk, including the possible loss of capital. Returns are not guaranteed.
          </p>
        </nav>
      </div>
    </header>
  );
}
