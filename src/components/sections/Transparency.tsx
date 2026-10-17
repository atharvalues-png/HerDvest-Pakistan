import Image from "next/image";
import { FileCheck2 } from "lucide-react";
import { transparencyItems } from "@/content/model";
import { Container, Section, SectionHeading } from "@/components/ui/primitives";

export function Transparency() {
  return (
    <Section id="transparency" tone="white">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="Transparency"
              title="What you can expect to see."
              lead="Trust comes from records, not promises. These are the documents and updates Herdvest intends to share with investors throughout each partnership."
            />
            <div className="relative mt-10 aspect-[4/3] overflow-hidden rounded-3xl shadow-lift">
              <Image
                src="/images/buffalo-calf.jpg"
                alt="A young buffalo standing in a village farmyard"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
            <p className="mt-5 text-sm leading-relaxed text-ink-500">
              Herdvest does not currently operate an online investor dashboard. Records and updates
              are shared directly with each investor through agreed channels.
            </p>
          </div>

          <ol className="divide-y divide-forest/10 self-center rounded-3xl border border-forest/10 bg-ivory/50">
            {transparencyItems.map((item, i) => (
              <li key={item.title} className="flex gap-5 p-6 sm:p-7">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald shadow-soft">
                  <FileCheck2 aria-hidden className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="font-semibold text-forest">
                    <span className="sr-only">{i + 1}. </span>
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
