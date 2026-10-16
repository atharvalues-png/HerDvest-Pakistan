export type Party = "Investor" | "Farmer" | "Herdvest";

export const phases = [
  { key: "agree", name: "Agree", summary: "Understand the model and sign" },
  { key: "acquire", name: "Acquire", summary: "Source, document and allocate" },
  { key: "raise", name: "Raise", summary: "Care, monitor and report" },
  { key: "realise", name: "Realise", summary: "Sell and settle" },
] as const;

export const lifecycle: Array<{
  phase: (typeof phases)[number]["key"];
  title: string;
  body: string;
  parties: Party[];
  outputs: string[];
}> = [
  {
    phase: "agree",
    title: "Initial investor enquiry",
    body: "You submit an enquiry or contact our team. There is no obligation and no payment is requested at this stage.",
    parties: ["Investor", "Herdvest"],
    outputs: ["Enquiry acknowledged", "Introductory call arranged"],
  },
  {
    phase: "agree",
    title: "Investment discussion and suitability",
    body: "We explain the model, fees, reporting, risks and the proposed agreement, and discuss whether livestock suits your objectives and risk tolerance. You are encouraged to take independent advice before signing.",
    parties: ["Investor", "Herdvest"],
    outputs: ["Proposed agreement shared", "Questions answered in writing"],
  },
  {
    phase: "acquire",
    title: "Livestock selection",
    body: "Herdvest identifies suitable animals, considering breed, age, health, condition and expected care requirements.",
    parties: ["Herdvest"],
    outputs: ["Animal photographs and description"],
  },
  {
    phase: "acquire",
    title: "Purchase valuation and documentation",
    body: "The purchase price is compared against prevailing local market rates. The final price, date and supporting documents are recorded and shared with the investor.",
    parties: ["Investor", "Herdvest"],
    outputs: ["Purchase record and receipt", "Initial veterinary check, where arranged"],
  },
  {
    phase: "acquire",
    title: "Farmer verification",
    body: "Prospective farmer partners are screened for identity, farm location and suitability, references and willingness to accept monitoring and welfare standards.",
    parties: ["Farmer", "Herdvest"],
    outputs: ["Verification record (kept private)"],
  },
  {
    phase: "acquire",
    title: "Farmer and animal allocation",
    body: "The animal is allocated to a verified farmer with suitable capacity. The farmer signs an agreement setting out care duties and their profit share.",
    parties: ["Farmer", "Herdvest"],
    outputs: ["Allocation notice to investor", "Signed farmer agreement"],
  },
  {
    phase: "raise",
    title: "Veterinary care and vaccinations",
    body: "Herdvest coordinates veterinary examinations, vaccination schedules and preventive care, and arranges treatment if an animal falls ill.",
    parties: ["Farmer", "Herdvest"],
    outputs: ["Vaccination and treatment records"],
  },
  {
    phase: "raise",
    title: "Monthly monitoring and video reporting",
    body: "The animal's condition, welfare and growth are checked regularly. Investors receive a monthly video update with notes; significant issues are reported promptly.",
    parties: ["Investor", "Farmer", "Herdvest"],
    outputs: ["Monthly video and photographs", "Condition and growth notes"],
  },
  {
    phase: "realise",
    title: "Sale planning",
    body: "When the agreed conditions and market considerations support a sale, Herdvest prepares the animal, engages buyers and evaluates offers. Timing can be earlier or later than first discussed.",
    parties: ["Investor", "Herdvest"],
    outputs: ["Sale recommendation", "Offers evaluated"],
  },
  {
    phase: "realise",
    title: "Sale proceeds and profit-sharing settlement",
    body: "The sale is documented. Capital is returned first where proceeds allow, the profit pool is shared as agreed, and Herdvest's fee is deducted from the investor's share — all shown on a written settlement statement.",
    parties: ["Investor", "Farmer", "Herdvest"],
    outputs: ["Sale documents", "Settlement statement", "Payments per agreement"],
  },
];

export const lossProcess = [
  {
    title: "Immediate reporting",
    body: "The farmer reports illness, injury or death to Herdvest straight away. Herdvest informs the investor promptly.",
  },
  {
    title: "Veterinary assessment",
    body: "Where possible, a veterinarian examines the animal and records the likely cause.",
  },
  {
    title: "Documentation",
    body: "Photographs, veterinary notes and the circumstances are documented and shared with the investor.",
  },
  {
    title: "Responsibility review",
    body: "The facts are reviewed against the agreement — for example, whether the farmer met their care obligations.",
  },
  {
    title: "Loss allocation",
    body: "The loss is borne by the stakeholders according to their agreed contractual responsibilities. Any salvage value is documented and treated as the agreement specifies.",
  },
];
