import {
  ClipboardList,
  Eye,
  Handshake,
  MessagesSquare,
  Search,
  Stethoscope,
  UserCheck,
  Video,
} from "lucide-react";
import { services } from "@/content/model";
import { Container, IconBadge, Section, SectionHeading, TextLink } from "@/components/ui/primitives";

export const serviceIcons = {
  search: Search,
  userCheck: UserCheck,
  stethoscope: Stethoscope,
  eye: Eye,
  video: Video,
  clipboard: ClipboardList,
  handshake: Handshake,
  message: MessagesSquare,
} as const;

export function ServicesGrid() {
  return (
    <Section id="services" tone="ivory">
      <Container>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="What Herdvest manages"
            title="The work between capital and the farm gate."
            lead="Our service fee is intended to cover these agreed management services. The signed agreement defines exactly what is included."
          />
          <TextLink href="/services">Explore our services</TextLink>
        </div>
        <ul className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-forest/10 bg-forest/10 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => {
            const Icon = serviceIcons[s.icon];
            return (
              <li key={s.title} className="bg-white p-7 transition-colors hover:bg-ivory/60">
                <IconBadge>
                  <Icon />
                </IconBadge>
                <h3 className="mt-5 text-base font-semibold text-forest">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
