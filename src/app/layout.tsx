import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";
import { site } from "@/config/site";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const serif = Instrument_Serif({
  variable: "--font-serif-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "livestock investment Pakistan",
    "managed livestock",
    "cattle farming partnership",
    "farmer partnership Pakistan",
    "agritech Pakistan",
  ],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    locale: "en_PK",
    images: [{ url: "/images/buffalo-hero.jpg", width: 2400, height: 1600, alt: "Black buffaloes resting outside a rural farmhouse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: ["/images/buffalo-hero.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#123B2A",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className={`${manrope.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
