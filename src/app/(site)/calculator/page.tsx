import type { Metadata } from "next";
import { Calculator } from "@/components/calculator/Calculator";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink, Container, Section, SectionHeading } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Illustrative Investment Calculator",
  description:
    "An illustrative calculator showing how a livestock sale could be shared between investor, farmer and Herdvest. Not a forecast or a guaranteed return.",
};

const formulas = [
  ["Total initial investment", "Purchase price per animal × number of animals"],
  ["Total sale proceeds", "Sale price per animal × number of animals"],
  ["Profit pool", "Total sale proceeds − total initial investment"],
  ["Investor gross share", "Profit pool × 50%"],
  ["Farmer share", "Profit pool × 50%"],
  ["Herdvest fee (once per sale)", "Investor gross share × 20%"],
  ["Investor net profit", "Investor gross share − Herdvest fee"],
  ["Investor total proceeds", "Capital returned (subject to sale proceeds) + investor net profit"],
  ["Holding-period return", "Total proceeds ÷ initial investment − 1"],
  ["Annualised return", "(Total proceeds ÷ initial investment)^(1 ÷ years) − 1"],
];

export default function CalculatorPage() {
  return (
    <>
      <PageHero
        eyebrow="Illustrative calculator"
        title="See how the numbers work."
        lead="Choose a price category, number of animals, sale price and holding period. Herdvest's fixed 20% fee is shown separately. This is a teaching tool — not a forecast, quote or promise."
        image="/images/buffalo-bathing.jpg"
        imageAlt="A herd of buffaloes cooling off in a river"
      />
      <Section tone="sand">
        <Container>
          <Calculator />
        </Container>
      </Section>
      <Section tone="white">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <SectionHeading
              eyebrow="Method"
              title="The formulas behind the calculator."
              lead="Simple, transparent arithmetic. If sale proceeds are below the purchase price, no profit is shared and the shortfall is shown separately."
            />
            <div className="overflow-hidden rounded-3xl border border-forest/10">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Calculator formulas</caption>
                <tbody className="divide-y divide-forest/10">
                  {formulas.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row" className="w-2/5 bg-ivory/60 px-5 py-4 font-semibold text-forest">{k}</th>
                      <td className="px-5 py-4 font-mono text-[0.82rem] text-charcoal">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-14 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/investors#enquiry" arrow>
              Discuss an Investment
            </ButtonLink>
            <ButtonLink href="/legal/risk-disclosure" variant="outline">
              Read the risk disclosure
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
