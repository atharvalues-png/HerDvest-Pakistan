/**
 * Site-wide configuration.
 *
 * Every value wrapped in [square brackets] is a PLACEHOLDER that must be
 * replaced with verified company information before launch. Placeholders are
 * rendered with a dashed underline on the site so they are easy to spot.
 * Do not replace them with invented details.
 */

export const site = {
  name: "Herdvest Pakistan",
  shortName: "Herdvest",
  tagline: "Livestock Investment, Managed With Care.",
  description:
    "Herdvest Pakistan connects investors with verified livestock farmers and coordinates sourcing, veterinary care, monitoring, reporting and sale facilitation through a transparent, managed service model.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  // Language support. English is live; Urdu ("ur", right-to-left) is planned.
  defaultLocale: "en",
  plannedLocales: ["ur"],

  company: {
    legalEntityName: "[Legal entity name]",
    registration: "[Company registration number / SECP details]",
    regulatoryDisclosure:
      "[Applicable licences or regulatory disclosures, if any — to be confirmed by legal counsel]",
    shariahStatus:
      "[Shariah review status — not yet reviewed. Update only after review by a qualified Shariah adviser]",
  },

  contact: {
    email: "[business@email — to be configured]",
    phone: "[Business phone — to be configured]",
    whatsapp: "[WhatsApp number — to be configured]",
    // Set to a full https://wa.me/<number> link once the number is confirmed.
    whatsappLink: "",
    address: "[Office address — to be confirmed]",
    hours: "[Business hours — to be confirmed]",
  },

  // Add full profile URLs once official accounts exist. Empty = shown as placeholder.
  social: [
    { label: "Facebook", href: "" },
    { label: "Instagram", href: "" },
    { label: "LinkedIn", href: "" },
    { label: "YouTube", href: "" },
  ],
} as const;

export const mainNav = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Our Services", href: "/services" },
  { label: "For Investors", href: "/investors" },
  { label: "For Farmers", href: "/farmers" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export const footerNav = {
  Explore: [
    { label: "How It Works", href: "/how-it-works" },
    { label: "Our Services", href: "/services" },
    { label: "About Herdvest", href: "/about" },
    { label: "FAQ", href: "/faq" },
  ],
  Investors: [
    { label: "For Investors", href: "/investors" },
    { label: "Illustrative Calculator", href: "/calculator" },
    { label: "Risk Disclosure", href: "/legal/risk-disclosure" },
    { label: "Make an Enquiry", href: "/investors#enquiry" },
  ],
  Farmers: [
    { label: "For Farmers", href: "/farmers" },
    { label: "Farmer Responsibilities", href: "/farmers#responsibilities" },
    { label: "Apply as a Partner", href: "/farmers#apply" },
    { label: "Contact Us", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/legal/privacy" },
    { label: "Terms of Service", href: "/legal/terms" },
    { label: "Risk Disclosure", href: "/legal/risk-disclosure" },
    { label: "Management Agreement", href: "/legal/agreement" },
    { label: "Shariah Review", href: "/legal/shariah" },
    { label: "Photo Credits", href: "/credits" },
  ],
} as const;

export function isPlaceholder(value: string) {
  return value.trim().startsWith("[");
}
