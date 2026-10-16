import type { Metadata } from "next";
import Image from "next/image";
import { ClipboardCheck, Percent, Search, UserCheck, Video } from "lucide-react";
import { faqs } from "@/content/faq";
import { illustrativeDefaults as d } from "@/config/business";
import { PageHero } from "@/components/layout/PageHero";
import { Calculator } from "@/components/calculator/Calculator";
import { RiskSection } from "@/components/sections/RiskSection";
import { Accordion } from "@/components/ui/Accordion";
import { InvestorEnquiryForm } from "@/components/forms/InvestorEnquiryForm";
import {
  ButtonLink,
  CheckList,
  Container,
  IconBadge,
  Notice,
  Section,
  SectionHeading,
  TextLink,
} from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "For Investors",
  description:
    "How Herdvest's managed livestock model works for investors: selection, farmer allocation, reporting, fees, an illustrative calculator, risks and how to make an enquiry.",
};

const pillars = [
  {
    icon: Search,
    title: "How livestock is selected",
    body: "Animals are assessed for breed, age, condition and visible health, and priced against local market rates. You receive the purchase record, photographs and receipt.",
    href: "/services#sourcing",
  },
  {
    icon: UserCheck,
    title: "How farmers are allocated",
    body: "Each animal goes to a verified farmer with suitable shelter, fodder, water and capacity, who signs an agreement covering care, welfare and monitoring.",
    href: "/services#verification",
  },
  {
    icon: Video,
    title: "Reporting & monitoring",
    body: "Expect a monthly video update, photographs, condition notes and veterinary records — and prompt notice of any significant health event.",
    href: "/services#monitoring",
  },
];

export default function InvestorsPage() {
  const investorFaqs = faqs.filter((f) => f.tags.includes("investor")).slice(0, 8);

  return (
    <>
      <PageHero
        eyebrow="For investors"
        title="Real livestock. Real records. Clearly stated risks."
        lead="Herdvest lets you fund livestock raised by verified farmers, with sourcing, veterinary coordination, reporting and sale managed for you — under a written agreement and without promises of guaranteed returns."
        image="/images/herd-grass.jpg"
        imageAlt="A herd of cattle grazing on green pasture"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="#enquiry" variant="gold" arrow>
            Explore Livestock Investment
          </ButtonLink>
          <ButtonLink href="#calculator" variant="outline-light">
            Try the calculator
          </ButtonLink>
        </div>
      </PageHero>

      {/* Overview */}
      <Section tone="white">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                eyebrow="Overview"
                title="What you are — and aren't — investing in."
                lead="Your capital buys a specific, documented animal. A verified farmer raises it. Herdvest coordinates everything in between and administers the settlement when it is sold."
              />
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-forest">It is</p>
                  <CheckList
                    className="mt-3"
                    items={[
                      "A real, biological asset",
                      "A managed partnership with a farmer",
                      "Profit-sharing under a signed agreement",
                      "Documented from purchase to sale",
                    ]}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-alert">It is not</p>
                  <ul className="mt-3 space-y-3">
                    {["A bank deposit or fixed-income product", "Guaranteed or capital-protected", "Insured by Herdvest", "Instantly saleable"].map((t) => (
                      <li key={t} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink-600">
                        <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-alert" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-lift sm:aspect-[4/3] lg:aspect-[4/5]">
              <Image src="/images/sunset.jpg" alt="Cattle in a field at golden hour" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
          </div>
        </Container>
      </Section>

      {/* Selection, allocation, reporting */}
      <Section tone="ivory">
        <Container>
          <SectionHeading eyebrow="The process for investors" title="Selection, allocation and reporting." />
          <ul className="mt-12 grid gap-6 lg:grid-cols-3">
            {pillars.map(({ icon: Icon, title, body, href }) => (
              <li key={title} className="flex flex-col rounded-3xl border border-forest/10 bg-white p-7 shadow-soft">
                <IconBadge>
                  <Icon />
                </IconBadge>
                <h3 className="mt-5 text-lg font-semibold text-forest">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{body}</p>
                <TextLink href={href} className="mt-6">
                  Learn more
                </TextLink>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-forest/10 bg-white p-7 shadow-soft sm:p-8">
              <IconBadge tone="gold">
                <ClipboardCheck />
              </IconBadge>
              <h3 className="mt-5 text-lg font-semibold text-forest">Your responsibilities as an investor</h3>
              <CheckList
                className="mt-4"
                items={[
                  "Read the agreement, fees and risk disclosure carefully before signing",
                  "Take independent legal, tax and (if relevant) Shariah advice",
                  "Provide capital for the documented purchase as agreed",
                  "Review updates and raise questions or concerns promptly",
                  "Only commit money you can afford to have tied up — or lose",
                  "Bear losses as allocated under the signed agreement",
                ]}
              />
            </div>

            {/* Fee structure */}
            <div id="fees" className="scroll-mt-28 rounded-3xl bg-forest p-7 text-ivory shadow-lift sm:p-8">
              <IconBadge tone="light">
                <Percent />
              </IconBadge>
              <h3 className="mt-5 text-lg font-semibold">Fee structure — stated plainly</h3>
              <p className="mt-3 text-sm leading-relaxed text-ivory/75">
                In the illustrative model, Herdvest earns a service fee of{" "}
                <strong className="text-gold">{d.serviceFeePct}% of the investor&apos;s gross profit share</strong>.
                It is not charged on your capital or on the farmer&apos;s share, and in the
                illustrative model no fee is calculated if there is no profit.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ivory/10 pt-6 text-sm">
                <div>
                  <dt className="text-ivory/60">Profit pool</dt>
                  <dd className="mt-1 font-semibold">Sale − purchase price</dd>
                </div>
                <div>
                  <dt className="text-ivory/60">Illustrative split</dt>
                  <dd className="mt-1 font-semibold">
                    {d.investorSharePct}% investor / {100 - d.investorSharePct}% farmer
                  </dd>
                </div>
                <div>
                  <dt className="text-ivory/60">Herdvest fee</dt>
                  <dd className="mt-1 font-semibold">{d.serviceFeePct}% of investor share</dd>
                </div>
                <div>
                  <dt className="text-ivory/60">Intended to cover</dt>
                  <dd className="mt-1 font-semibold">Vet visits, vaccinations, monitoring, reporting</dd>
                </div>
              </dl>
              <p className="mt-6 text-xs leading-relaxed text-ivory/60">
                The final agreement will define exactly which costs are included and whether any
                additional charges may apply. Fees will never be hidden in the settlement statement.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Calculator */}
      <Section id="calculator" tone="sand">
        <Container>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading
              eyebrow="Illustrative calculator"
              title="Test your own assumptions."
              lead="Adjust the purchase price, sale price, holding period, profit share and fee to see how the arithmetic works — including what happens when a sale is below cost."
            />
            <TextLink href="/calculator">Open full-page calculator</TextLink>
          </div>
          <div className="mt-12">
            <Calculator />
          </div>
        </Container>
      </Section>

      <RiskSection id="risks" />

      {/* FAQ */}
      <Section tone="white">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <SectionHeading eyebrow="Investor FAQ" title="Questions investors ask." />
              <TextLink href="/faq" className="mt-8">
                View all FAQs
              </TextLink>
            </div>
            <Accordion items={investorFaqs.map((f) => ({ q: f.q, a: f.a }))} />
          </div>
        </Container>
      </Section>

      {/* Enquiry */}
      <Section id="enquiry" tone="ivory">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div>
              <SectionHeading
                eyebrow="Investor enquiry"
                title="Start a conversation."
                lead="Tell us a little about yourself and what you'd like to understand. A member of our team will explain the model, agreement and risks — with no obligation."
              />
              <Notice className="mt-8">
                Overseas Pakistanis are welcome to enquire. Please mention your preferred contact
                times and time zone in your message.
              </Notice>
            </div>
            <div className="rounded-3xl border border-forest/10 bg-white p-6 shadow-soft sm:p-10">
              <InvestorEnquiryForm />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
