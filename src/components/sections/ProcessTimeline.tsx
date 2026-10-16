import { processSteps } from "@/content/model";
import { Container, Section, SectionHeading, TextLink } from "@/components/ui/primitives";

/** Six-step process: vertical on mobile, horizontal on large screens. */
export function ProcessTimeline({ showLink = true }: { showLink?: boolean }) {
  return (
    <Section id="how-it-works" tone="white">
      <Container>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="How it works"
            title="From first conversation to final settlement."
            lead="Six clear stages, each documented. You can explore the model and ask questions without committing any money."
          />
          {showLink && <TextLink href="/how-it-works">See the full lifecycle</TextLink>}
        </div>

        <ol className="relative mt-16 grid gap-0 lg:grid-cols-6 lg:gap-6">
          {/* Horizontal connector (desktop) */}
          <span
            aria-hidden
            className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-emerald/0 via-emerald/40 to-emerald/0 lg:block"
          />
          {processSteps.map((step, i) => (
            <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0 lg:flex-col lg:gap-0 lg:pb-0">
              {/* Vertical connector (mobile) */}
              {i < processSteps.length - 1 && (
                <span aria-hidden className="absolute bottom-0 left-5 top-10 w-px bg-emerald/25 lg:hidden" />
              )}
              <span className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald/30 bg-white text-sm font-bold text-emerald shadow-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="lg:mt-7">
                <h3 className="text-lg font-semibold leading-snug text-forest">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
