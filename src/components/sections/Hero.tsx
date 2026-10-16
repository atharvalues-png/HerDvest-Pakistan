import Image from "next/image";
import { Check } from "lucide-react";
import { Accent, ButtonLink, Container } from "@/components/ui/primitives";

const includes = [
  "Documented livestock purchase",
  "Verified farmer allocation",
  "Coordinated veterinary & vaccination care",
  "Monthly video progress updates",
  "Documented sale & written settlement",
];

export function Hero() {
  return (
    <section className="grain relative isolate flex min-h-[100svh] items-end overflow-hidden bg-forest-950 text-ivory">
      <Image
        src="/images/hero.jpg"
        alt="A herd of cattle moving through warm, dusty evening light"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[60%_center]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(11_38_25/0.94)_0%,rgb(11_38_25/0.82)_38%,rgb(11_38_25/0.35)_70%,rgb(11_38_25/0.2)_100%)]"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-forest-950/80 to-transparent" />

      <Container className="pb-16 pt-32 sm:pb-20 lg:pb-24">
        <div className="grid items-end gap-12 lg:grid-cols-[1.35fr_1fr]">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-ivory/20 bg-ivory/5 px-4 py-1.5 text-xs font-medium tracking-wide text-ivory/85 backdrop-blur-sm">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
              Managed livestock partnerships · Pakistan
            </p>
            <h1 className="mt-7 text-[2.75rem] font-semibold leading-[1.02] sm:text-6xl lg:text-[5.25rem]">
              Livestock Investment,{" "}
              <Accent className="text-gold">Managed With Care.</Accent>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ivory/80 sm:text-xl">
              Herdvest connects investors with verified farmers and coordinates the livestock
              journey — from responsible sourcing and veterinary care to regular progress updates
              and sale facilitation.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/how-it-works" variant="gold" arrow>
                Explore How It Works
              </ButtonLink>
              <ButtonLink href="/farmers" variant="outline-light">
                Partner With Herdvest
              </ButtonLink>
            </div>
            <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ivory/65">
              <span>Transparent processes.</span>
              <span aria-hidden className="text-gold">·</span>
              <span>Professional livestock management.</span>
              <span aria-hidden className="text-gold">·</span>
              <span>Shared responsibility.</span>
            </p>
          </div>

          <div
            className="animate-rise rounded-2xl border border-ivory/15 bg-forest-950/55 p-6 shadow-lift backdrop-blur-md [animation-delay:200ms] sm:p-7"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Every partnership is built on
            </p>
            <ul className="mt-5 space-y-3.5">
              {includes.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[0.95rem] text-ivory/90">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald/80">
                    <Check aria-hidden className="h-3 w-3 text-ivory" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-ivory/10 pt-4 text-xs leading-relaxed text-ivory/55">
              Livestock carries real biological and market risk. Returns are not guaranteed and
              capital can be lost.{" "}
              <a href="#risks" className="font-semibold text-gold underline-offset-2 hover:underline">
                Read the risks
              </a>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
