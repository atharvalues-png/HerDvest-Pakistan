import { TriangleAlert } from "lucide-react";
import { ILLUSTRATIVE_LABEL, illustrativeDefaults as d } from "@/config/business";
import { calculate } from "@/lib/calculator";
import { formatPKR } from "@/lib/format";
import { ButtonLink, Container, Section, SectionHeading } from "@/components/ui/primitives";

export function IllustrativeExample({ tone = "sand" as "sand" | "ivory" | "white" }) {
  const r = calculate(d);

  const segments = [
    { label: "Investor capital returned", value: r.capitalReturned, color: "bg-ivory" },
    { label: "Investor net profit", value: r.investorNet, color: "bg-[#3d9c6b]" },
    { label: "Herdvest service fee", value: r.serviceFee, color: "bg-gold" },
    { label: "Farmer profit share", value: r.farmerShare, color: "bg-[#9db8a6]" },
  ];

  const steps = [
    { n: "1", label: "Animal purchased", value: formatPKR(d.purchasePrice), note: "Investor capital" },
    { n: "2", label: `Sold after ${d.holdingYears} years`, value: formatPKR(d.salePrice), note: "Illustrative sale price" },
    { n: "3", label: "Capital returned to investor", value: `− ${formatPKR(r.capitalReturned)}`, note: "Returned first, if proceeds allow" },
    { n: "4", label: "Profit pool", value: formatPKR(r.profitPool), note: "Sale − purchase price", strong: true },
    { n: "5", label: `Farmer share (${r.farmerSharePct}%)`, value: formatPKR(r.farmerShare), note: "For daily care and husbandry" },
    { n: "6", label: `Investor gross share (${d.investorSharePct}%)`, value: formatPKR(r.investorGross), note: "Before Herdvest's fee" },
    { n: "7", label: `Herdvest fee (${d.serviceFeePct}% of investor share)`, value: `− ${formatPKR(r.serviceFee)}`, note: "Shown separately, never hidden" },
    { n: "8", label: "Investor net profit", value: formatPKR(r.investorNet), note: "After the service fee", strong: true },
  ];

  return (
    <Section id="example" tone={tone}>
      <Container>
        <SectionHeading
          eyebrow="An illustrative example"
          title="How a sale could be shared — step by step."
          lead="A simple walk-through using round numbers, so the arithmetic is easy to follow. Real figures depend on the purchase price, the animal's health, the holding period, market conditions and the signed agreement."
        />

        <p className="mt-8 inline-flex items-start gap-2.5 rounded-xl border border-gold/60 bg-gold-50 px-4 py-3 text-sm font-semibold text-forest">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          {ILLUSTRATIVE_LABEL}
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Step-by-step ledger */}
          <div className="overflow-hidden rounded-3xl border border-forest/10 bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Illustrative calculation of a PKR 600,000 sale</caption>
              <thead className="bg-forest text-ivory">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold sm:px-6">Step</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold sm:px-6">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {steps.map((s) => (
                  <tr key={s.n} className={s.strong ? "bg-emerald-50/70" : undefined}>
                    <td className="px-5 py-4 sm:px-6">
                      <div className="flex gap-3">
                        <span className="mt-0.5 text-xs font-bold text-gold-600">{s.n}</span>
                        <div>
                          <p className={s.strong ? "font-semibold text-forest" : "font-medium text-charcoal"}>
                            {s.label}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-500">{s.note}</p>
                        </div>
                      </div>
                    </td>
                    <td
                      className={`whitespace-nowrap px-5 py-4 text-right tabular-nums sm:px-6 ${
                        s.strong ? "font-bold text-forest" : "font-medium text-charcoal"
                      }`}
                    >
                      {s.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Outcome */}
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl bg-forest p-7 text-ivory shadow-lift">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                Where the {formatPKR(d.salePrice)} goes
              </p>
              <div
                className="mt-5 flex h-4 w-full gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={segments.map((s) => `${s.label} ${formatPKR(s.value)}`).join(", ")}
              >
                {segments.map((s) => (
                  <span key={s.label} className={s.color} style={{ width: `${(s.value / d.salePrice) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                {segments.map((s) => (
                  <li key={s.label} className="flex items-start gap-2.5">
                    <span aria-hidden className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${s.color}`} />
                    <span>
                      <span className="block text-ivory/70">{s.label}</span>
                      <span className="font-semibold tabular-nums">{formatPKR(s.value)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { who: "Investor receives", amount: r.investorTotal, sub: `${formatPKR(r.capitalReturned)} capital + ${formatPKR(r.investorNet)} profit` },
                { who: "Farmer receives", amount: r.farmerShare, sub: "Profit share for care" },
                { who: "Herdvest receives", amount: r.serviceFee, sub: "Service fee" },
              ].map((o) => (
                <div key={o.who} className="rounded-2xl border border-forest/10 bg-white p-5 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{o.who}</p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-forest">{formatPKR(o.amount)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">{o.sub}</p>
                </div>
              ))}
            </div>

            <p className="text-xs leading-relaxed text-ink-500">
              Assumes the purchase price is the only amount deducted before sharing, with no other
              costs, losses, taxes or contractual adjustments. If the animal were sold for less
              than {formatPKR(d.purchasePrice)}, there would be no profit to share and the investor
              would not recover their full capital.
            </p>
            <div>
              <ButtonLink href="/calculator" variant="primary" arrow>
                Try your own assumptions
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
