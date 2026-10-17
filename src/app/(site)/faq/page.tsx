import type { Metadata } from "next";
import { faqs } from "@/content/faq";
import { PageHero } from "@/components/layout/PageHero";
import { FaqBrowser } from "./FaqBrowser";
import { ButtonLink, Container, Section } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Clear answers about Herdvest's livestock model: ownership, pricing, farmer selection, veterinary costs, updates, profit and fee calculation, mortality, early sale and Shariah review.",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        eyebrow="FAQ"
        title="Straight answers to practical questions."
        lead="Where the legal arrangement has not yet been finalised, we say so. Ownership, costs, profit sharing, mortality and settlement rules will be specified in the signed agreement."
        image="/images/buffalo-herd.jpg"
        imageAlt="Black buffaloes resting together"
      />
      <Section tone="ivory">
        <Container className="max-w-4xl">
          <FaqBrowser />
          <div className="mt-14 rounded-3xl bg-forest p-8 text-center text-ivory sm:p-10">
            <h2 className="text-2xl font-semibold">Still have a question?</h2>
            <p className="mx-auto mt-3 max-w-md text-ivory/75">Our team is happy to explain anything — before you commit to anything.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/contact" variant="gold" arrow>
                Speak to Our Team
              </ButtonLink>
              <ButtonLink href="/how-it-works" variant="outline-light">
                How It Works
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
