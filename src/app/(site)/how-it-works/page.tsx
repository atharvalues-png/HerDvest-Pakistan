import type { Metadata } from "next";
import { lifecycle, lossProcess, phases } from "@/content/lifecycle";
import { PageHero } from "@/components/layout/PageHero";
import { ResponsibilityMatrix } from "@/components/sections/ResponsibilityMatrix";
import { FinalCta } from "@/components/sections/FinalCta";
import {
  ButtonLink,
  Container,
  Notice,
  Section,
  SectionHeading,
  TextLink,
} from "@/components/ui/primitives";
import { cn } from "@/lib/format";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "The full Herdvest livestock lifecycle — from enquiry and agreement to sourcing, farmer allocation, veterinary care, monthly reporting, sale and settlement.",
};

const partyStyles = {
  Investor: "bg-forest text-ivory",
  Farmer: "bg-[#dfeadf] text-forest",
  Herdvest: "bg-gold-50 text-gold-600 ring-1 ring-gold/40",
} as const;

export default function HowItWorksPage() {
  let n = 0;
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="The full livestock lifecycle, step by step."
        lead="Ten documented stages across four phases. Each one shows who is involved and what records are produced — so you always know where things stand."
        image="/images/buffalo-herd.jpg"
        imageAlt="A group of black buffaloes resting together on a farm"
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="#lifecycle" variant="gold" arrow>
            View the lifecycle
          </ButtonLink>
          <ButtonLink href="#loss" variant="outline-light">
            How losses are handled
          </ButtonLink>
        </div>
      </PageHero>

      {/* Process diagram */}
      <Section tone="white" aria-labelledby="diagram-heading">
        <Container>
          <SectionHeading
            eyebrow="Process overview"
            title={<span id="diagram-heading">Four phases. Ten stages.</span>}
            lead="Capital and agreement come first; livestock is only purchased after terms are understood and signed."
          />
          <ol className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Process diagram">
            {phases.map((phase, pi) => {
              const stages = lifecycle
                .map((s, i) => ({ ...s, i }))
                .filter((s) => s.phase === phase.key);
              return (
                <li key={phase.key} className="relative rounded-3xl border border-forest/10 bg-ivory/60 p-6">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">Phase {pi + 1}</p>
                    {pi < phases.length - 1 && (
                      <span aria-hidden className="hidden text-gold xl:block">→</span>
                    )}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-forest">{phase.name}</h3>
                  <p className="mt-1 text-sm text-ink-500">{phase.summary}</p>
                  <ol className="mt-6 space-y-2.5">
                    {stages.map((s) => (
                      <li key={s.title}>
                        <a
                          href={`#stage-${s.i + 1}`}
                          className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-sm font-medium text-charcoal shadow-soft transition hover:text-emerald"
                        >
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald text-[0.7rem] font-bold text-ivory">
                            {s.i + 1}
                          </span>
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            <span className="font-semibold text-forest">Who&apos;s involved:</span>
            {(Object.keys(partyStyles) as Array<keyof typeof partyStyles>).map((p) => (
              <span key={p} className={cn("rounded-full px-2.5 py-1 font-semibold", partyStyles[p])}>
                {p}
              </span>
            ))}
          </div>
        </Container>
      </Section>

      {/* Detailed lifecycle */}
      <Section id="lifecycle" tone="ivory">
        <Container>
          <SectionHeading eyebrow="In detail" title="What happens at each stage." />
          <div className="mt-14 space-y-16">
            {phases.map((phase, pi) => (
              <div key={phase.key} className="grid gap-8 lg:grid-cols-[14rem_1fr]">
                <div className="lg:sticky lg:top-28 lg:self-start">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">Phase {pi + 1}</p>
                  <h3 className="mt-1 text-3xl font-semibold text-forest">{phase.name}</h3>
                  <p className="mt-1 text-sm text-ink-500">{phase.summary}</p>
                </div>
                <ol className="space-y-4">
                  {lifecycle
                    .filter((s) => s.phase === phase.key)
                    .map((s) => {
                      n += 1;
                      return (
                        <li
                          key={s.title}
                          id={`stage-${n}`}
                          className="scroll-mt-28 rounded-2xl border border-forest/10 bg-white p-6 shadow-soft sm:p-7"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex gap-4">
                              <span className="text-3xl font-semibold tabular-nums text-gold">{String(n).padStart(2, "0")}</span>
                              <div>
                                <h4 className="text-lg font-semibold text-forest">{s.title}</h4>
                                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-600">{s.body}</p>
                              </div>
                            </div>
                            <ul className="flex shrink-0 flex-wrap gap-1.5 sm:max-w-[13rem] sm:justify-end" aria-label="Parties involved">
                              {s.parties.map((p) => (
                                <li key={p} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", partyStyles[p])}>
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="mt-5 flex flex-wrap gap-2 border-t border-forest/10 pt-4 sm:pl-12">
                            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Records:</span>
                            {s.outputs.map((o) => (
                              <span key={o} className="rounded-md bg-ivory px-2 py-0.5 text-xs text-charcoal">
                                {o}
                              </span>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                </ol>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Responsibilities */}
      <Section id="responsibilities" tone="white">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.7fr]">
            <SectionHeading
              eyebrow="Responsibilities"
              title="Who does what."
              lead="Clear roles are the foundation of a fair partnership. This table shows the intended allocation; the signed agreement is always the final reference."
            />
            <ResponsibilityMatrix />
          </div>
        </Container>
      </Section>

      {/* Loss process */}
      <Section id="loss" tone="sand">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <SectionHeading
                eyebrow="Illness, mortality & loss"
                title="If something goes wrong, here is what happens."
                lead="Animals can fall ill or die even with good care. We would rather explain the process plainly than hide it."
              />
              <Notice tone="warning" className="mt-8" title="No automatic reimbursement">
                Herdvest does not provide insurance, a compensation fund, guaranteed buy-backs or
                capital protection. Losses are borne according to each party&apos;s agreed
                contractual responsibilities.
              </Notice>
              <div className="mt-6">
                <TextLink href="/faq">Read related FAQs</TextLink>
              </div>
            </div>
            <ol className="relative space-y-4">
              {lossProcess.map((step, i) => (
                <li key={step.title} className="flex gap-5 rounded-2xl border border-forest/10 bg-white p-6 shadow-soft">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-forest/15 text-sm font-bold text-forest">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-forest">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}
