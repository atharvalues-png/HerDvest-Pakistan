import type { Metadata } from "next";
import Image from "next/image";
import { Eye, HeartHandshake, Leaf, Scale, ShieldCheck, Users } from "lucide-react";
import { site } from "@/config/site";
import { PageHero } from "@/components/layout/PageHero";
import { FinalCta } from "@/components/sections/FinalCta";
import {
  Accent,
  Container,
  Eyebrow,
  IconBadge,
  Notice,
  Section,
  SectionHeading,
  Value,
} from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "About Herdvest",
  description:
    "Herdvest Pakistan's mission, approach and values: transparency, accountability, animal welfare, fair dealing, farmer partnership and responsible risk management.",
};

const values = [
  { icon: Eye, title: "Transparency", body: "Documented prices, records and calculations — shared, not summarised away." },
  { icon: ShieldCheck, title: "Accountability", body: "Clear roles in writing, and a consistent point of contact when something goes wrong." },
  { icon: Leaf, title: "Animal welfare", body: "Healthy, well-treated animals are both the right thing and the foundation of value." },
  { icon: Scale, title: "Fair dealing", body: "Fees stated upfront and calculations every party can check." },
  { icon: Users, title: "Farmer partnership", body: "Farmers are partners whose skill deserves respect and a fair share." },
  { icon: HeartHandshake, title: "Responsible risk management", body: "Reducing avoidable risks — and being honest about the ones that remain." },
];

const companyDetails = [
  ["Legal entity", site.company.legalEntityName],
  ["Registration", site.company.registration],
  ["Licences / regulatory disclosures", site.company.regulatoryDisclosure],
  ["Shariah review", site.company.shariahStatus],
  ["Office address", site.contact.address],
  ["Leadership team", "[Founder and leadership profiles — to be added with verified details]"],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Herdvest"
        title="Bringing structure and transparency to livestock partnerships."
        lead="Livestock has long been a store of value for Pakistani families. Herdvest is building a more professional, documented way for investors and farmers to work together."
        image="/images/buffalo-farm.jpg"
        imageAlt="A black buffalo standing in a farm yard"
      />

      <Section tone="white">
        <Container>
          <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
            <div>
              <Eyebrow>Our mission</Eyebrow>
              <p className="mt-6 text-2xl font-medium leading-snug text-forest sm:text-3xl">
                To make livestock partnerships more transparent, professionally managed, and
                accessible by connecting investors, farmers, and livestock expertise through a{" "}
                <Accent className="text-emerald">structured service model.</Accent>
              </p>
            </div>
            <div>
              <Eyebrow>Our vision</Eyebrow>
              <p className="mt-6 text-2xl font-medium leading-snug text-forest sm:text-3xl">
                To contribute to a stronger livestock ecosystem in Pakistan by supporting responsible
                farming, clearer investment processes, and{" "}
                <Accent className="text-emerald">better collaboration</Accent> between capital and
                agricultural expertise.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="ivory">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lift">
              <Image src="/images/buffalo-calf.jpg" alt="A young buffalo standing in a village farmyard" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
            <div>
              <SectionHeading
                eyebrow="Our approach"
                title="A managed service, not a marketplace."
                lead="Informal livestock arrangements often rely on trust alone, with little documentation and unclear responsibilities. Herdvest's approach is to put each step on the record: what was bought and for how much, who is caring for it, what veterinary care it received, how it was sold, and how the proceeds were shared."
              />
              <p className="mt-5 text-base leading-relaxed text-ink-600">
                We earn a service fee for that coordination. We do not promise returns, and we are
                open about the fact that livestock carries real risk.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="white">
        <Container>
          <SectionHeading eyebrow="Our values" title="What guides how we work." align="center" className="mx-auto" />
          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-3xl border border-forest/10 bg-ivory/50 p-7">
                <IconBadge>
                  <Icon />
                </IconBadge>
                <h3 className="mt-5 text-lg font-semibold text-forest">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tone="sand">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <SectionHeading
              eyebrow="Company information"
              title="Who we are, on the record."
              lead="These details will be completed with verified information before launch."
            />
            <div>
              <dl className="divide-y divide-forest/10 overflow-hidden rounded-3xl border border-forest/10 bg-white">
                {companyDetails.map(([k, v]) => (
                  <div key={k} className="grid gap-1 px-6 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
                    <dt className="text-sm font-semibold text-forest">{k}</dt>
                    <dd className="text-sm text-ink-600">
                      <Value value={v} />
                    </dd>
                  </div>
                ))}
              </dl>
              <Notice className="mt-6">
                Herdvest does not claim any regulatory approval, licence, certification, award or
                partnership unless it is listed here with verifiable details.
              </Notice>
            </div>
          </div>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}
