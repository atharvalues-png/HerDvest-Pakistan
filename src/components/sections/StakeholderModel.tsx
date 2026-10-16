import Image from "next/image";
import { stakeholders } from "@/content/model";
import { Container, Section, SectionHeading } from "@/components/ui/primitives";

export function StakeholderModel() {
  return (
    <Section id="model" tone="ivory">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="The Herdvest model"
            title="Three partners. One documented process."
            lead="Herdvest is not a cattle marketplace. It is a managed service that brings capital, husbandry and livestock expertise together — with each party's role written down."
          />
        </div>

        <ol className="mt-14 grid gap-6 lg:grid-cols-3">
          {stakeholders.map((s, i) => (
            <li
              key={s.key}
              className="group relative overflow-hidden rounded-3xl border border-forest/10 bg-white shadow-soft transition-shadow duration-300 hover:shadow-lift"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={s.image}
                  alt={s.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest-950/70 via-transparent" />
                <span className="absolute left-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ivory/95 text-sm font-bold text-forest">
                  {i + 1}
                </span>
                <p className="absolute bottom-4 left-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  {s.contributes}
                </p>
              </div>
              <div className="p-7">
                <h3 className="text-2xl font-semibold text-forest">{s.role}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600">{s.summary}</p>
                <ul className="mt-5 space-y-2 border-t border-forest/10 pt-5">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm text-charcoal">
                      <span aria-hidden className="mt-2 h-1 w-3 shrink-0 rounded-full bg-gold" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-4 rounded-2xl border border-forest/10 bg-ivory-200/50 p-6 text-sm leading-relaxed text-ink-600 sm:grid-cols-3 sm:p-7">
          <p>
            <strong className="text-forest">Capital</strong> from the investor buys a documented animal.
          </p>
          <p>
            <strong className="text-forest">Care</strong> from the farmer raises it day to day.
          </p>
          <p>
            <strong className="text-forest">Coordination</strong> from Herdvest ties it together, through to
            sale and settlement.
          </p>
        </div>
      </Container>
    </Section>
  );
}
