import Image from "next/image";
import Link from "next/link";
import { Accent, ButtonLink, Container } from "@/components/ui/primitives";

export function FinalCta({
  title = (
    <>
      Build a More Transparent <Accent className="text-gold">Livestock Partnership.</Accent>
    </>
  ),
  lead = "Speak with our team about the model, the agreement and the risks — with no obligation and no payment requested.",
}: {
  title?: React.ReactNode;
  lead?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-forest-950 py-24 text-ivory sm:py-32">
      <Image
        src="/images/pasture.jpg"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover opacity-40"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-forest-950 via-forest-950/80 to-forest-950/60" />
      <Container className="text-center">
        <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
          {title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ivory/75">{lead}</p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/investors#enquiry" variant="gold" arrow>
            Discuss an Investment
          </ButtonLink>
          <ButtonLink href="/farmers#apply" variant="outline-light">
            Become a Farmer Partner
          </ButtonLink>
        </div>
        <p className="mt-8 text-sm text-ivory/55">
          Prefer to talk first?{" "}
          <Link href="/contact" className="font-semibold text-gold underline-offset-4 hover:underline">
            Speak to Our Team
          </Link>
        </p>
      </Container>
    </section>
  );
}
