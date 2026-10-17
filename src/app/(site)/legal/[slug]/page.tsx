import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { legalPages } from "@/content/legal";
import { site } from "@/config/site";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Notice, Section, Value } from "@/components/ui/primitives";

export function generateStaticParams() {
  return Object.keys(legalPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = legalPages[slug];
  return page ? { title: page.title, description: page.description } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = legalPages[slug];
  if (!page) notFound();

  return (
    <>
      <PageHero eyebrow="Legal" title={page.title} lead={page.description} image="/images/buffalo-bathing.jpg" imageAlt="" />
      <Section tone="ivory">
        <Container className="max-w-3xl">
          <Notice tone="warning" title="Draft placeholder — requires professional review">
            {page.intro}
          </Notice>
          <div className="mt-10 space-y-8">
            {page.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-xl font-semibold text-forest">{s.heading}</h2>
                <p className="mt-2 leading-relaxed text-ink-600">
                  <Value value={s.body} />
                </p>
              </section>
            ))}
          </div>
          <div className="mt-12 rounded-2xl border border-forest/10 bg-white p-6 text-sm text-ink-600">
            <p>
              <strong className="text-forest">Entity:</strong> <Value value={site.company.legalEntityName} />
            </p>
            <p className="mt-1">
              <strong className="text-forest">Registration:</strong> <Value value={site.company.registration} />
            </p>
            <p className="mt-4">
              Other legal documents:{" "}
              {Object.entries(legalPages)
                .filter(([k]) => k !== slug)
                .map(([k, v], i, arr) => (
                  <span key={k}>
                    <Link href={`/legal/${k}`} className="font-semibold text-emerald hover:underline">
                      {v.title}
                    </Link>
                    {i < arr.length - 1 ? " · " : ""}
                  </span>
                ))}
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
