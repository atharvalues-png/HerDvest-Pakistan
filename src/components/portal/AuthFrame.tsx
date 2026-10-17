import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/layout/Logo";

/** Centered card used by the investor sign-in, activation and reset pages. */
export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grain relative flex min-h-dvh flex-col bg-forest-950 px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-2 self-start text-sm text-ivory/70 hover:text-ivory">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Herdvest Pakistan website
      </Link>
      <div className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <LogoMark className="h-12 w-12" />
            <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">Investor Portal</p>
            <h1 className="mt-1 text-xl font-semibold text-ivory">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ivory/60">{subtitle}</p>}
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-2xl">{children}</div>
          {footer && <div className="mt-6 space-y-2 text-center text-xs text-ivory/50">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
