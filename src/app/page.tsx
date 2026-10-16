import Image from "next/image";
import { FileText, ShieldCheck, Stethoscope, Video } from "lucide-react";
import { Hero } from "@/components/sections/Hero";
import { StakeholderModel } from "@/components/sections/StakeholderModel";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { ServicesGrid } from "@/components/sections/ServicesGrid";
import { Transparency } from "@/components/sections/Transparency";
import { IllustrativeExample } from "@/components/sections/IllustrativeExample";
import { RiskSection } from "@/components/sections/RiskSection";
import { FinalCta } from "@/components/sections/FinalCta";
import { Accent, ButtonLink, CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";

const principles = [
  { icon: FileText, title: "Documented purchases", body: "Price and animal details recorded" },
  { icon: ShieldCheck, title: "Verified farmers", body: "Screened before any allocation" },
  { icon: Stethoscope, title: "Coordinated vet care", body: "Examinations and vaccinations" },
  { icon: Video, title: "Monthly updates", body: "Video, photos and condition notes" },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Principles band */}
      <div className="border-b border-forest/10 bg-white">
        <Container>
          <ul className="grid grid-cols-2 divide-forest/10 lg:grid-cols-4 lg:divide-x">
            {principles.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4 py-7 lg:px-8 lg:first:pl-0">
                <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
                <div>
                  <p className="text-sm font-semibold text-forest">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500 sm:text-sm">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </div>

      <StakeholderModel />
      <ProcessTimeline />
      <ServicesGrid />
      <Transparency />
      <IllustrativeExample />
      <RiskSection />

      {/* Two journeys */}
      <Section tone="ivory">
        <Container>
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              {
                eyebrow: "For investors",
                title: <>Put capital to work in <Accent>real agriculture.</Accent></>,
                body: "Understand the model, the fees and the risks, then speak with our team. No payment is requested to explore.",
                points: ["Documented purchase and records", "Monthly progress updates", "Clear fee and settlement calculation"],
                href: "/investors",
                cta: "Explore Livestock Investment",
                image: "/images/herd-grass.jpg",
                alt: "A herd of cattle grazing on lush grass",
              },
              {
                eyebrow: "For farmers",
                title: <>Grow with a <Accent>better partnership.</Accent></>,
                body: "Raise livestock with coordinated veterinary support and earn a defined share of the profit for your skill and care.",
                points: ["Veterinary coordination", "Clear written responsibilities", "Agreed profit share at sale"],
                href: "/farmers",
                cta: "Become a Partner Farmer",
                image: "/images/goats.jpg",
                alt: "Goats gathered in a well-kept farm enclosure",
              },
            ].map((j) => (
              <article
                key={j.href}
                className="group relative isolate flex min-h-[30rem] flex-col justify-end overflow-hidden rounded-3xl p-8 text-ivory sm:p-10"
              >
                <Image
                  src={j.image}
                  alt={j.alt}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="-z-20 object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-forest-950 via-forest-950/80 to-forest-950/45" />
                <Eyebrow dark>{j.eyebrow}</Eyebrow>
                <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{j.title}</h2>
                <p className="mt-4 max-w-md text-ivory/75">{j.body}</p>
                <CheckList dark items={j.points} className="mt-6" />
                <div className="mt-8">
                  <ButtonLink href={j.href} variant="gold" arrow>
                    {j.cta}
                  </ButtonLink>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}
