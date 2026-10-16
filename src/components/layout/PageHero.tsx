import Image from "next/image";
import type { ReactNode } from "react";
import { Container, Eyebrow } from "@/components/ui/primitives";

/** Dark, photographic header used at the top of every inner page. */
export function PageHero({
  eyebrow,
  title,
  lead,
  image,
  imageAlt,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  image: string;
  imageAlt: string;
  children?: ReactNode;
}) {
  return (
    <section className="grain relative isolate overflow-hidden bg-forest-950 pb-20 pt-36 text-ivory sm:pb-24 sm:pt-44">
      <Image
        src={image}
        alt={imageAlt}
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover opacity-45"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950 via-forest-950/85 to-forest-950/30"
      />
      <Container>
        <div className="max-w-3xl animate-rise">
          <Eyebrow dark>{eyebrow}</Eyebrow>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">{title}</h1>
          {lead && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ivory/75">{lead}</p>}
          {children && <div className="mt-9">{children}</div>}
        </div>
      </Container>
    </section>
  );
}
