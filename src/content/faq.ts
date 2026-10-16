export type FaqItem = { q: string; a: string; tags: Array<"general" | "investor" | "farmer" | "risk"> };

const AGREEMENT =
  "The final position will be specified in the signed agreement, which should be reviewed before you commit.";

export const faqs: FaqItem[] = [
  {
    q: "What is Herdvest Pakistan?",
    a: "Herdvest Pakistan is a managed livestock service. We connect investors who provide capital with verified farmers who provide daily care, and we coordinate the process in between — sourcing, veterinary care, monitoring, reporting, sale facilitation and settlement.",
    tags: ["general"],
  },
  {
    q: "How does the livestock investment model work?",
    a: "An investor funds the purchase of an animal. Herdvest documents the purchase and allocates the animal to a verified farmer, who raises it. Herdvest coordinates veterinary care and shares monthly updates. When the animal is sold, the investor's capital is returned first if the sale proceeds allow, and any remaining profit is shared between investor and farmer as agreed. Herdvest's service fee is a percentage of the investor's gross profit share.",
    tags: ["general", "investor"],
  },
  {
    q: "Who owns the animal?",
    a: `Ownership is a legal question that depends on how the arrangement is structured. The intended model is that the animal is purchased with the investor's capital, but ownership, title and any rights of the farmer or Herdvest must be set out clearly in writing. ${AGREEMENT}`,
    tags: ["investor", "farmer"],
  },
  {
    q: "How is the purchase price determined?",
    a: "Herdvest aims to source animals at fair market prices by comparing local market rates and assessing the animal's age, breed, weight and condition. The agreed purchase price and supporting documents are shared with the investor. Herdvest does not claim independent certification of valuations.",
    tags: ["investor"],
  },
  {
    q: "How are farmers selected?",
    a: "Our proposed screening includes identity verification, address and farm verification, local references, lawful and consented background checks where appropriate, a farm suitability assessment, and agreement to monitoring and animal-welfare requirements. Procedures will be confirmed as operations launch.",
    tags: ["investor", "farmer"],
  },
  {
    q: "Who pays for veterinary care and vaccinations?",
    a: `The Herdvest service fee is intended to cover agreed management services, including coordinated veterinary visits, vaccinations, monthly monitoring and reporting. Whether any treatment, feed or other costs can be charged separately must be stated explicitly. ${AGREEMENT}`,
    tags: ["investor", "farmer"],
  },
  {
    q: "How often will investors receive updates?",
    a: "The intended standard is a monthly video update, with photographs, condition notes and any veterinary records. Significant health events should be communicated promptly rather than waiting for the monthly update.",
    tags: ["investor"],
  },
  {
    q: "How is the profit calculated?",
    a: "In the illustrative model, profit pool = sale proceeds − initial purchase price. The pool is then shared between investor and farmer (for example 50/50). If the sale price is below the purchase price there is no profit to share. Any other deductible costs must be defined in the agreement.",
    tags: ["investor", "farmer"],
  },
  {
    q: "How is Herdvest's service fee calculated?",
    a: "In the illustrative model, Herdvest's fee is a percentage (for example 20%) of the investor's gross profit share — not of the capital and not of the farmer's share. If there is no profit, the illustrative model calculates no fee. The exact fee basis will be stated in the agreement.",
    tags: ["investor"],
  },
  {
    q: "Is there a guaranteed return?",
    a: "No. Livestock is a living asset with health, mortality and market risks. There is no fixed or guaranteed return and no guaranteed recovery of capital. Any examples on this website are illustrations only.",
    tags: ["investor", "risk"],
  },
  {
    q: "What happens if an animal dies?",
    a: `If an animal dies or suffers a major loss, Herdvest will document the circumstances (including veterinary findings where available) and inform the investor. The intended arrangement is that stakeholders bear the loss according to their agreed contractual responsibilities — for example, a farmer may be responsible where negligence is established. Herdvest does not promise automatic reimbursement, insurance or capital protection. ${AGREEMENT}`,
    tags: ["investor", "farmer", "risk"],
  },
  {
    q: "Can the animal be sold earlier than expected?",
    a: `Yes, it may be. A sale could be brought forward because of the animal's health, a strong buyer offer, seasonal demand (for example around Eid al-Adha) or other agreed reasons. How early-sale decisions are made and who must consent should be defined in the agreement.`,
    tags: ["investor"],
  },
  {
    q: "What happens if the sale price is lower than expected?",
    a: "The profit pool is smaller, and every party's share falls. If the sale price is below the purchase price, there is no profit to share and the investor may not recover the full capital. Herdvest does not guarantee a minimum sale price.",
    tags: ["investor", "risk"],
  },
  {
    q: "How is the final settlement calculated?",
    a: "Herdvest prepares a written settlement statement showing sale proceeds, capital returned, the profit pool, the investor and farmer shares, the Herdvest service fee and the net amounts payable, supported by the sale documentation.",
    tags: ["investor", "farmer"],
  },
  {
    q: "Are investment agreements Shariah-compliant?",
    a: "The model is designed with profit-and-loss sharing in mind, but Herdvest has not yet obtained a Shariah review or certification. We do not claim Shariah compliance. Any future claim will only be made after review by a qualified Shariah adviser or recognised authority, and details will be published here.",
    tags: ["general", "investor"],
  },
  {
    q: "How can I become a farmer partner?",
    a: "Complete the farmer application form on the For Farmers page. Our team will contact you to discuss your experience, farm and capacity, and to explain the verification process. Submitting an application does not guarantee allocation of livestock.",
    tags: ["farmer"],
  },
];
