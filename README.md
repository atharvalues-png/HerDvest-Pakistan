# Herdvest Pakistan — website

Marketing and information website for Herdvest Pakistan, a managed livestock service connecting investors, verified farmers and livestock expertise.

Built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 and Lucide icons.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Home: hero, three-partner model, 6-step process, services, transparency, illustrative example, risks, journeys, CTA |
| `/how-it-works` | 10-stage lifecycle, process diagram, responsibility matrix, illness/mortality/loss process |
| `/services` | Sourcing, farmer verification, veterinary coordination, monitoring, sale facilitation (with proposed/operational status) |
| `/investors` | Overview, responsibilities, fees, embedded calculator, risks, FAQ, enquiry form |
| `/calculator` | Full-page illustrative calculator and formulas |
| `/farmers` | Farmer partnership, duties, welfare, profit share, loss handling, application form |
| `/about` | Mission, vision, approach, values, company information placeholders |
| `/faq` | Filterable, searchable FAQ (with FAQPage structured data) |
| `/contact` | Contact form and contact-detail placeholders |
| `/legal/*` | Privacy, terms, risk disclosure, agreement, Shariah review — outline placeholders |

## Where things live

```
src/config/site.ts        Company details, contact info, social links, navigation  ← placeholders
src/config/business.ts    Illustrative defaults (PKR 100k → 600k, 50/50, 20% fee), form options
src/lib/calculator.ts     Profit-sharing formulas (profit, loss/shortfall, annualised rate)
src/lib/forms.ts          Shared client + server validation
src/app/api/enquiry       Form submission endpoint (forwards to FORM_WEBHOOK_URL)
src/content/              All page copy: model, lifecycle, services, FAQ, legal outlines
src/components/           layout/, sections/, forms/, calculator/, ui/
```

Content is kept in `src/content` and `src/config` (not hard-coded in components) so an Urdu translation can be added later.

## Before launch — configuration checklist

1. **Form delivery.** Set `FORM_WEBHOOK_URL` (and optionally `FORM_WEBHOOK_SECRET`) — see `.env.example`. Until then, forms validate fully but tell visitors honestly that online submission isn't connected, and nothing is sent.
2. **Company details** in `src/config/site.ts`: legal entity name, registration, regulatory disclosures, email, phone, WhatsApp (and `whatsappLink`), address, hours, social profile URLs. Values in `[square brackets]` render with a dashed underline on the site.
3. **Legal documents** in `src/content/legal.ts`: privacy policy, terms, risk disclosure, management agreement — to be drafted and reviewed by qualified Pakistani legal counsel.
4. **Shariah status.** Do not claim compliance until reviewed by a qualified adviser or recognised authority; then update `site.company.shariahStatus` and `/legal/shariah`.
5. **Procedures.** In `src/content/services.ts`, switch a procedure's `status` from `"proposed"` to `"operational"` only once it is actually in place.
6. **Leadership/about details** — add only verified information.
7. Set `NEXT_PUBLIC_SITE_URL` for correct Open Graph and sitemap URLs.
8. Have the business model, agreements, fee terms, tax treatment and regulatory position reviewed by qualified professionals in Pakistan.

## Images

Photographs in `public/images` are from [Unsplash](https://unsplash.com) and used under the Unsplash License (free for commercial use; attribution appreciated). Replace with Herdvest's own farm and livestock photography when available.

| File | Unsplash photo |
| --- | --- |
| hero.jpg | photo-1540561852629-2655ee1eaee1 |
| zebu.jpg | photo-1608671071793-db93efcf33df |
| farmer.jpg | photo-1720968247393-ce5637e4bea9 |
| cattle-white.jpg | photo-1592174868460-904a3aaafb21 |
| calves-shelter.jpg | photo-1769466100846-86239ba740aa |
| feeding.jpg | photo-1771962152057-4c3015841488 |
| goats.jpg | photo-1593750187970-84858a2aaf5e |
| pasture.jpg | photo-1635192644034-c088f0545e4b |
| herd-grass.jpg | photo-1653233531882-a227852fd736 |
| herd-front.jpg | photo-1783185571997-447ff47a3a74 |
| sunset.jpg | photo-1500595046743-cd271d694d30 |
