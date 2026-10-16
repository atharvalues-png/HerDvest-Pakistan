import type { Metadata } from "next";
import Image from "next/image";
import { CircleCheck, CircleDashed, Info } from "lucide-react";
import { serviceDetails } from "@/content/services";
import { PageHero } from "@/components/layout/PageHero";
import { ServicesGrid } from "@/components/sections/ServicesGrid";
import { FinalCta } from "@/components/sections/FinalCta";
import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

export const metadata: Metadata = {
  title: "Our Services",
  description:
    "Livestock sourcing, farmer verification, veterinary coordination, monthly monitoring and sale facilitation — the management services Herdvest provides.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Our services"
        title="Professional management for every stage of the livestock journey."
        lead="Herdvest coordinates the people and processes between an investor's capital and a farmer's care — and documents each step."
        image="/images/feeding.jpg"
        imageAlt="Cattle feeding in a clean, organised barn"
      />

      <nav aria-label="Services on this page" className="sticky top-[4.5rem] z-30 border-b border-forest/10 bg-ivory/90 backdrop-blur-md">
        <Container>
          <ul className="flex gap-1 overflow-x-auto py-3 text-sm [scrollbar-width:none]">
            {serviceDetails.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={`#${s.id}`} className="rounded-full px-4 py-2 font-medium text-ink-600 hover:bg-white hover:text-forest">
                  {s.eyebrow}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <Section tone="ivory" className="!pt-14">
        <Container>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-forest/10 bg-white px-5 py-4 text-sm text-ink-600">
            <span className="inline-flex items-center gap-2 font-semibold text-forest">
              <Info aria-hidden className="h-4 w-4 text-emerald" /> Procedure status
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CircleDashed aria-hidden className="h-4 w-4 text-gold-600" /> Proposed — to be confirmed at launch
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck aria-hidden className="h-4 w-4 text-emerald" /> Operational
            </span>
          </div>

          <div className="mt-16 space-y-24 lg:space-y-32">
            {serviceDetails.map((s, i) => (
              <article key={s.id} id={s.id} className="scroll-mt-40 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={cn("relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lift", i % 2 === 1 && "lg:order-2")}>
                  <Image src={s.image} alt={s.imageAlt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                  <span className="absolute left-5 top-5 rounded-full bg-forest-950/70 px-3 py-1 text-xs font-semibold text-ivory backdrop-blur">
                    {String(i + 1).padStart(2, "0")} / {String(serviceDetails.length).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <Eyebrow>{s.eyebrow}</Eyebrow>
                  <h2 className="mt-4 text-3xl font-semibold leading-tight text-forest sm:text-4xl">{s.title}</h2>
                  <p className="mt-4 text-lg leading-relaxed text-ink-600">{s.intro}</p>
                  <ul className="mt-7 space-y-3">
                    {s.procedures.map((p) => (
                      <li key={p.label} className="flex items-start gap-3 text-[0.95rem] text-charcoal">
                        {p.status === "operational" ? (
                          <CircleCheck aria-label="Operational" className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
                        ) : (
                          <CircleDashed aria-label="Proposed" className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
                        )}
                        {p.label}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-7 border-l-2 border-gold pl-4 text-sm leading-relaxed text-ink-500">{s.caveat}</p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <ServicesGrid />
      <FinalCta />
    </>
  );
}
