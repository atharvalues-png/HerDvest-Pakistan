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
  ["Profit pool", "Sale proceeds − initial purchase price"],
  ["Investor gross share", "Profit pool × investor share %"],
  ["Farmer share", "Profit pool × farmer share % (100 − investor %)"],
  ["Herdvest service fee", "Investor gross share × service fee %"],
  ["Investor net profit", "Investor gross share − Herdvest service fee"],
  ["Investor total proceeds", "Capital returned (subject to sale proceeds) + investor net profit"],
  ["Annualised rate", "(Total proceeds ÷ initial capital)^(1 ÷ years) − 1, shown only for gains"],
];

export default function CalculatorPage() {
  return (
    <>
      <PageHero
        eyebrow="Illustrative calculator"
        title="See how the numbers work."
        lead="Every assumption is editable, and Herdvest's fee is shown separately. This is a teaching tool — not a forecast, quote or promise."
        image="/images/pasture.jpg"
        imageAlt="Cattle grazing in open pasture under a blue sky"
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
