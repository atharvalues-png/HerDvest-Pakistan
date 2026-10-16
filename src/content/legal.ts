/**
 * Legal page outlines. These are PLACEHOLDERS that describe what each document
 * must cover. Final text must be drafted and reviewed by qualified
 * professionals in Pakistan before launch.
 */
export const legalPages: Record<
  string,
  { title: string; description: string; intro: string; sections: Array<{ heading: string; body: string }> }
> = {
  privacy: {
    title: "Privacy Policy",
    description: "How Herdvest Pakistan collects, uses and protects personal information.",
    intro:
      "This page is a placeholder. A full privacy policy must be drafted and reviewed by legal counsel before the website collects personal information in production.",
    sections: [
      { heading: "Information we collect", body: "[Describe data collected through enquiry, farmer application and contact forms: names, contact details, location, budget preferences, farm details.]" },
      { heading: "How we use information", body: "[Responding to enquiries, assessing farmer applications, verification with consent, and legal or regulatory obligations.]" },
      { heading: "Verification checks", body: "[Describe identity, address, reference and background checks for farmers — performed only where lawful and with consent.]" },
      { heading: "Sharing and disclosure", body: "[Third parties such as form/CRM providers, veterinarians and professional advisers; privacy safeguards applied to farmer information shared with investors.]" },
      { heading: "Retention and security", body: "[Retention periods and security measures.]" },
      { heading: "Your rights and contact", body: "[How individuals can access, correct or delete their information, and who to contact.]" },
    ],
  },
  terms: {
    title: "Terms of Service",
    description: "Terms governing use of the Herdvest Pakistan website.",
    intro:
      "This page is a placeholder. Website terms of use must be drafted and reviewed by legal counsel before launch.",
    sections: [
      { heading: "Informational purpose", body: "This website is for general information only. It is not an offer, solicitation, financial advice or a binding agreement. Enquiries do not create any contractual relationship." },
      { heading: "No guarantee", body: "Content, examples and calculators are illustrative and do not guarantee any outcome." },
      { heading: "Acceptable use", body: "[Acceptable-use terms.]" },
      { heading: "Liability", body: "[Limitation of liability — to be drafted by counsel.]" },
      { heading: "Governing law", body: "[Governing law and jurisdiction — to be confirmed by counsel.]" },
    ],
  },
  "risk-disclosure": {
    title: "Risk Disclosure",
    description: "The principal risks of livestock investment through Herdvest Pakistan.",
    intro:
      "Livestock investment involves significant risk. You may lose some or all of the capital you commit. Please read this disclosure in full before making an enquiry. A formal risk disclosure will be finalised with legal counsel.",
    sections: [
      { heading: "Biological risk", body: "Animals can become ill, injured or die despite good husbandry and veterinary care. Treatment may not succeed." },
      { heading: "Mortality and loss", body: "If an animal dies or suffers a major loss, the stakeholders bear the loss according to their agreed contractual responsibilities. Herdvest does not provide insurance, a compensation fund, guaranteed buy-backs, automatic reimbursement or capital protection." },
      { heading: "Market-price risk", body: "Livestock prices fluctuate with demand, season, feed costs, disease outbreaks and economic conditions. Sale prices may be lower than expected or lower than the purchase price." },
      { heading: "Holding-period risk", body: "The time to a suitable sale is uncertain. Capital may be tied up for longer than anticipated, and early exit may not be possible." },
      { heading: "Counterparty and operational risk", body: "Outcomes depend on the conduct of farmers, buyers, veterinarians and Herdvest. Verification and monitoring reduce, but cannot eliminate, the risk of poor care, misconduct or error." },
      { heading: "Legal, tax and Shariah", body: "The legal structure, tax treatment and any Shariah position of the arrangement must be reviewed by qualified professionals. Herdvest does not currently claim Shariah compliance or certification." },
      { heading: "No guaranteed return", body: "There is no fixed or guaranteed return. Illustrative examples and calculator results are not forecasts." },
    ],
  },
  agreement: {
    title: "Investment & Livestock Management Agreement",
    description: "Information about the agreement that governs each Herdvest livestock partnership.",
    intro:
      "This page is a placeholder. The agreement is not yet published. Displaying information on this website does not make any agreement valid or binding; only a properly executed agreement does.",
    sections: [
      { heading: "Parties and ownership", body: "[Who owns the animal; rights of investor, farmer and Herdvest.]" },
      { heading: "Purchase and documentation", body: "[How purchase price is agreed and documented.]" },
      { heading: "Costs and service fee", body: "[Exactly which costs are covered by the Herdvest service fee and whether additional charges may apply.]" },
      { heading: "Farmer obligations and welfare standards", body: "[Care duties, monitoring, reporting.]" },
      { heading: "Mortality, illness and loss", body: "[How losses are allocated, including negligence and salvage value.]" },
      { heading: "Sale decisions and timing", body: "[Who decides when and how to sell; early sale rules.]" },
      { heading: "Profit sharing and settlement", body: "[Profit pool definition, sharing percentages, fee calculation, payment timelines.]" },
      { heading: "Disputes", body: "[Dispute resolution process.]" },
    ],
  },
  shariah: {
    title: "Shariah Review",
    description: "The Shariah review status of the Herdvest model.",
    intro:
      "Herdvest has not yet obtained a Shariah review or certification. We make no claim that our arrangements are Shariah-compliant.",
    sections: [
      { heading: "Current status", body: "[Not yet reviewed.]" },
      { heading: "Review details", body: "[If a review is obtained: name of qualified adviser or recognised authority, scope, date and a copy or summary of the opinion.]" },
    ],
  },
};
