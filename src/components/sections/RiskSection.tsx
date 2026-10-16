import {
  CalendarClock,
  FileSignature,
  HeartPulse,
  ShieldOff,
  Tag,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";
import { risks } from "@/content/model";
import { Container, IconBadge, Section, SectionHeading, TextLink } from "@/components/ui/primitives";

const icons = [HeartPulse, TriangleAlert, TrendingDown, CalendarClock, Tag, FileSignature, ShieldOff];

export function RiskSection({ id = "risks" }: { id?: string }) {
  return (
    <Section id={id} tone="forest" className="grain overflow-hidden">
      <div aria-hidden className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-emerald/20 blur-3xl" />
      <Container className="relative">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              dark
              eyebrow="Risk & responsibility"
              title="Livestock is a living asset. Please read this first."
              lead="We would rather you understand the risks before you enquire. Herdvest works to reduce avoidable risk through verification, veterinary coordination and monitoring — but no one can eliminate it."
            />
            <div className="mt-8 flex flex-wrap gap-6">
              <TextLink href="/legal/risk-disclosure" className="text-gold">
                Full risk disclosure
              </TextLink>
              <TextLink href="/how-it-works#loss" className="text-gold">
                How losses are handled
              </TextLink>
            </div>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {risks.map((risk, i) => {
              const Icon = icons[i] ?? TriangleAlert;
              const emphasis = i === risks.length - 1;
              return (
                <li
                  key={risk.title}
                  className={`rounded-2xl border p-6 ${
                    emphasis
                      ? "border-gold/40 bg-gold/10 sm:col-span-2"
                      : "border-ivory/10 bg-ivory/[0.04]"
                  }`}
                >
                  <IconBadge tone="light">
                    <Icon />
                  </IconBadge>
                  <h3 className="mt-4 text-lg font-semibold text-ivory">{risk.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ivory/70">{risk.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
