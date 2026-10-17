import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone, Share2 } from "lucide-react";
import { site } from "@/config/site";
import { PageHero } from "@/components/layout/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";
import { Container, IconBadge, Notice, Section, SectionHeading, TextLink, Value } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Contact",
  description: "Speak to the Herdvest Pakistan team about livestock investment, farmer partnership or our services.",
};

export default function ContactPage() {
  const details = [
    { icon: Mail, label: "Email", value: site.contact.email },
    { icon: Phone, label: "Phone", value: site.contact.phone },
    { icon: MessageCircle, label: "WhatsApp", value: site.contact.whatsapp, href: site.contact.whatsappLink },
    { icon: MapPin, label: "Office", value: site.contact.address },
    { icon: Clock, label: "Hours", value: site.contact.hours },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Speak to Our Team."
        lead="Questions about the model, the agreement, fees or risks? Ask us anything — there is no obligation."
        image="/images/buffalo-village.jpg"
        imageAlt="Black buffaloes walking along a village road"
      />
      <Section tone="ivory">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div>
              <SectionHeading eyebrow="Get in touch" title="How to reach us." />
              <ul className="mt-10 space-y-4">
                {details.map(({ icon: Icon, label, value, href }) => (
                  <li key={label} className="flex items-start gap-4 rounded-2xl border border-forest/10 bg-white p-5">
                    <IconBadge>
                      <Icon />
                    </IconBadge>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</p>
                      <p className="mt-1 text-[0.95rem] font-medium text-forest">
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                            {value}
                          </a>
                        ) : (
                          <Value value={value} />
                        )}
                      </p>
                    </div>
                  </li>
                ))}
                <li className="flex items-start gap-4 rounded-2xl border border-forest/10 bg-white p-5">
                  <IconBadge>
                    <Share2 />
                  </IconBadge>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Social media</p>
                    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {site.social.map((s) => (
                        <li key={s.label}>
                          {s.href ? (
                            <a href={s.href} target="_blank" rel="noopener noreferrer" className="font-medium text-forest hover:underline">
                              {s.label}
                            </a>
                          ) : (
                            <span className="placeholder-value text-ink-600">[{s.label} — to be configured]</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              </ul>
              <Notice tone="warning" className="mt-6" title="Before launch">
                Contact details, social profiles and the form delivery service (FORM_WEBHOOK_URL)
                must be configured. Values shown with a dashed underline are placeholders.
              </Notice>
              <div className="mt-6 flex flex-col gap-3">
                <TextLink href="/investors#enquiry">Investor enquiry form</TextLink>
                <TextLink href="/farmers#apply">Farmer application form</TextLink>
              </div>
            </div>
            <div className="rounded-3xl border border-forest/10 bg-white p-6 shadow-soft sm:p-10">
              <h2 className="text-xl font-semibold text-forest">Send us a message</h2>
              <p className="mt-2 text-sm text-ink-600">
                Please don&apos;t include bank details, card numbers or identity documents.
              </p>
              <div className="mt-8">
                <ContactForm />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
