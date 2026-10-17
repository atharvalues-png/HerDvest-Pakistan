import type { Metadata } from "next";
import Image from "next/image";
import {
  Camera,
  FileSignature,
  HeartHandshake,
  House,
  Stethoscope,
  Wheat,
  Droplets,
  ShieldAlert,
} from "lucide-react";
import { illustrativeDefaults as d, ILLUSTRATIVE_LABEL, MODEL } from "@/config/business";
import { calculate } from "@/lib/calculator";
import { formatPKR } from "@/lib/format";
import { faqs } from "@/content/faq";
import { PageHero } from "@/components/layout/PageHero";
import { Accordion } from "@/components/ui/Accordion";
import { FarmerApplicationForm } from "@/components/forms/FarmerApplicationForm";
import {
  Accent,
  ButtonLink,
  CheckList,
  Container,
  IconBadge,
  Notice,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "For Farmers",
  description:
    "Become a Herdvest partner farmer. Raise livestock with veterinary coordination and earn an agreed profit share. Learn about responsibilities, welfare, reporting and how to apply.",
};

const dailyDuties = [
  { icon: Wheat, title: "Feeding", body: "Daily fodder, feed and supplements suited to the animal." },
  { icon: Droplets, title: "Clean water", body: "Reliable access to clean drinking water at all times." },
  { icon: House, title: "Shelter", body: "Safe, clean, ventilated shelter with protection from heat and cold." },
  { icon: HeartHandshake, title: "Welfare", body: "Humane handling, cleanliness and attention to the animal's comfort." },
  { icon: ShieldAlert, title: "Report concerns", body: "Tell Herdvest promptly about illness, injury or unusual behaviour." },
  { icon: Stethoscope, title: "Vet cooperation", body: "Make the animal available for examinations and vaccinations." },
  { icon: Camera, title: "Monthly updates", body: "Help record short videos and photos for the monthly report." },
  { icon: FileSignature, title: "Follow the agreement", body: "Keep the animal on your farm and do not sell or transfer it." },
];

export default function FarmersPage() {
  const r = calculate(d);
  const farmerFaqs = faqs.filter((f) => f.tags.includes("farmer"));

  return (
    <>
      <PageHero
        eyebrow="For farmers"
        title={
          <>
            Grow With a Better <Accent className="text-gold">Livestock Partnership.</Accent>
          </>
        }
        lead="Your skill and care are what make livestock grow. Herdvest partners with experienced farmers, supports them with veterinary coordination, and shares the profit fairly under a clear written agreement."
        image="/images/farmer-care.jpg"
        imageAlt="A farmer caring for his buffalo at a village farm"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="#apply" variant="gold" arrow>
            Become a Partner Farmer
          </ButtonLink>
          <ButtonLink href="#profit" variant="outline-light">
            How farmers are paid
          </ButtonLink>
        </div>
      </PageHero>

      {/* Partnership intro */}
      <Section tone="white">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lift">
              <Image src="/images/farmer-milking.jpg" alt="A farmer tending his black buffalo" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
            <div>
              <SectionHeading
                eyebrow="A partnership, not a job"
                title="Farmers are partners in every Herdvest arrangement."
                lead="You provide the daily husbandry that no investor or manager can replace. In return you receive livestock to raise without buying it yourself, coordinated veterinary support, and an agreed share of the profit when the animal is sold."
              />
              <h3 className="mt-10 text-lg font-semibold text-forest">How we identify partner farmers</h3>
              <CheckList
                className="mt-4"
                items={[
                  "Practical experience raising cattle, buffalo, goats or sheep",
                  "Suitable shelter, water, fodder access and space",
                  "Identity, address and farm verification, with your consent",
                  "References and good standing in the local community",
                  "Willingness to accept monitoring and welfare standards",
                ]}
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* Daily responsibilities */}
      <Section id="responsibilities" tone="ivory">
        <Container>
          <SectionHeading
            eyebrow="Responsibilities & welfare"
            title="What we ask of our farmer partners."
            lead="Good welfare is good farming. These expectations will be written into your agreement so that everyone knows what is required."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dailyDuties.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-2xl border border-forest/10 bg-white p-6 shadow-soft">
                <IconBadge tone="gold">
                  <Icon />
                </IconBadge>
                <h3 className="mt-4 font-semibold text-forest">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-forest/10 bg-white p-7 shadow-soft">
              <IconBadge>
                <Stethoscope />
              </IconBadge>
              <h3 className="mt-5 text-lg font-semibold text-forest">Veterinary coordination</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                Herdvest arranges veterinary examinations, vaccinations and preventive care, and
                coordinates treatment when you report a problem. Which veterinary costs are covered
                is stated in the agreement — you should not have to guess.
              </p>
            </div>
            <div className="rounded-3xl border border-forest/10 bg-white p-7 shadow-soft">
              <IconBadge>
                <Camera />
              </IconBadge>
              <h3 className="mt-5 text-lg font-semibold text-forest">Reporting expectations</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                Each month, a short video and a few photographs of the animal are recorded — by you
                or by our team during a visit — with simple notes on feeding and condition. Herdvest
                staff may also visit periodically.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Profit sharing */}
      <Section id="profit" tone="forest" className="grain overflow-hidden">
        <Container className="relative">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                dark
                eyebrow="Profit sharing & settlement"
                title="An agreed share of the profit, paid on the record."
                lead="When the animal is sold, the investor's purchase price is returned first if the proceeds allow. Whatever remains is the profit pool, shared between investor and farmer as agreed. Herdvest's fee comes out of the investor's share — not yours."
              />
              <CheckList
                dark
                className="mt-8"
                items={[
                  "Your profit share is written into your signed agreement",
                  "The sale price and buyer are documented and shared with you",
                  "You receive a written settlement statement showing every figure",
                  "Payment is made as the agreement specifies after the sale is completed",
                ]}
              />
            </div>
            <div className="self-center rounded-3xl border border-ivory/15 bg-ivory/[0.05] p-7 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Illustrative example</p>
              <dl className="mt-6 divide-y divide-ivory/10 text-sm">
                {[
                  ["Animal purchased for", formatPKR(d.pricePerAnimal)],
                  [`Sold after ${d.holdingYears} years for`, formatPKR(d.salePricePerAnimal)],
                  ["Profit pool", formatPKR(r.profitPool)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-3">
                    <dt className="text-ivory/70">{k}</dt>
                    <dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 py-4">
                  <dt className="font-semibold text-gold">Farmer share ({MODEL.farmerSharePct}%)</dt>
                  <dd className="text-2xl font-bold tabular-nums text-gold">{formatPKR(r.farmerShare)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-ivory/60">
                {ILLUSTRATIVE_LABEL} If the animal sells for less than its purchase price, there is
                no profit to share. Herdvest does not guarantee any income to farmers.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Illness / death */}
      <Section tone="sand">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
            <SectionHeading
              eyebrow="If an animal becomes ill or dies"
              title="Report early. We'll work through it together."
            />
            <div className="space-y-5 text-[0.95rem] leading-relaxed text-ink-600">
              <p>
                If an animal is sick or injured, contact Herdvest immediately. We will coordinate a
                veterinary assessment and treatment. Early reporting protects the animal — and it
                protects you.
              </p>
              <p>
                If an animal dies, the circumstances are documented with veterinary input where
                possible. Losses are borne according to each party&apos;s responsibilities in the
                signed agreement — for example, the agreement may make a farmer responsible where
                negligence or a breach of the agreement is established.
              </p>
              <Notice tone="warning">
                The exact rules for illness, mortality and loss will be set out in your agreement.
                Please read them carefully, and ask us anything you are unsure about before signing.
              </Notice>
            </div>
          </div>
        </Container>
      </Section>

      {/* FAQ + Apply */}
      <Section id="apply" tone="ivory">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div>
              <SectionHeading
                eyebrow="Farmer application"
                title="Apply to become a partner farmer."
                lead="Tell us about your farm and experience. Our team will contact you to talk it through. You can apply in English or Roman Urdu."
              />
              <Accordion className="mt-8" items={farmerFaqs.slice(0, 5).map((f) => ({ q: f.q, a: f.a }))} />
            </div>
            <div className="rounded-3xl border border-forest/10 bg-white p-6 shadow-soft sm:p-10">
              <FarmerApplicationForm />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
