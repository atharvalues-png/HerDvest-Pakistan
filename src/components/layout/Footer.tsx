import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { footerNav, site } from "@/config/site";
import { Container, Value } from "@/components/ui/primitives";
import { Logo } from "./Logo";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-forest-950 text-ivory/80">
      <Container className="py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Logo light />
            <p className="mt-6 text-sm leading-relaxed text-ivory/65">
              A managed livestock service connecting investors, verified farmers, veterinary
              expertise and livestock buyers through documented processes.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Mail aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <Value value={site.contact.email} />
              </li>
              <li className="flex items-start gap-3">
                <Phone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <Value value={site.contact.phone} />
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <Value value={site.contact.whatsapp} />
              </li>
              <li className="flex items-start gap-3">
                <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <Value value={site.contact.address} />
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {Object.entries(footerNav).map(([group, links]) => (
              <nav key={group} aria-label={`${group} links`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{group}</p>
                <ul className="mt-5 space-y-3 text-sm">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-ivory/70 transition-colors hover:text-ivory">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 rounded-2xl border border-ivory/10 bg-ivory/[0.03] p-6 text-xs leading-relaxed text-ivory/60 sm:p-7">
          <p className="font-semibold uppercase tracking-[0.16em] text-gold/90">Important information</p>
          <p className="mt-3">
            This website is for general information only. It does not constitute an offer to sell,
            a solicitation to invest, financial advice, or a binding agreement. Submitting an
            enquiry does not create an investment or any contractual relationship. Livestock is a
            living asset exposed to health, mortality and market-price risks: returns are not
            guaranteed, holding periods and sale prices vary, and you may lose some or all of the
            capital committed. Herdvest does not provide insurance, guaranteed buy-backs or capital
            protection. Ownership, costs, profit-sharing, mortality and settlement terms apply only
            as set out in a signed agreement, which should be reviewed with independent legal, tax
            and, where relevant, Shariah advisers.
          </p>
          <p className="mt-3">
            <Value value={site.company.legalEntityName} /> · <Value value={site.company.registration} /> ·{" "}
            <Value value={site.company.regulatoryDisclosure} />
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-ivory/10 pt-8 text-xs text-ivory/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Social media">
            {site.social.map((s) => (
              <li key={s.label}>
                {s.href ? (
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-ivory">
                    {s.label}
                  </a>
                ) : (
                  <span title="Social profile not yet configured">{s.label} (coming soon)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
