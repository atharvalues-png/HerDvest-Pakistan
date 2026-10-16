/**
 * Detailed service descriptions.
 *
 * `status` marks whether a procedure is confirmed as operational or is still a
 * proposed procedure. Change an item to "operational" only once it is
 * genuinely in place.
 */
export type ProcedureStatus = "proposed" | "operational";

export const serviceDetails: Array<{
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  image: string;
  imageAlt: string;
  procedures: Array<{ label: string; status: ProcedureStatus }>;
  caveat: string;
}> = [
  {
    id: "sourcing",
    eyebrow: "Livestock sourcing",
    title: "Selecting suitable animals at a documented price.",
    intro:
      "Herdvest aims to identify healthy, suitable animals from reputable sellers and markets, and to record exactly what was bought and for how much.",
    image: "/images/zebu.jpg",
    imageAlt: "A white zebu cow photographed in a farm enclosure",
    procedures: [
      { label: "Assessment of breed, age, condition and visible health", status: "proposed" },
      { label: "Comparison against prevailing local market prices", status: "proposed" },
      { label: "Pre-purchase veterinary check, where practical", status: "proposed" },
      { label: "Purchase record: price, date, seller, photographs and receipt", status: "proposed" },
      { label: "Identification tag or record for each animal, where available", status: "proposed" },
    ],
    caveat:
      "Valuations are Herdvest's own assessment. Herdvest does not claim independent certification of livestock quality or price.",
  },
  {
    id: "verification",
    eyebrow: "Farmer verification",
    title: "Partnering only with farmers we have checked.",
    intro:
      "A farmer's skill and integrity matter as much as the animal. Our proposed screening is designed to confirm who a farmer is, where they farm and whether their farm is suitable.",
    image: "/images/farmer.jpg",
    imageAlt: "A farmer standing with his cow on a rural road",
    procedures: [
      { label: "Identity verification", status: "proposed" },
      { label: "Address and farm location verification, including a site visit", status: "proposed" },
      { label: "References and local reputation checks", status: "proposed" },
      { label: "Relevant background checks, only where lawful and consented to", status: "proposed" },
      { label: "Farm suitability assessment: shelter, water, fodder, space", status: "proposed" },
      { label: "Written agreement to monitoring and animal-welfare requirements", status: "proposed" },
    ],
    caveat:
      "Screening reduces but cannot eliminate the risk of poor care or misconduct. Verification records are kept confidential.",
  },
  {
    id: "veterinary",
    eyebrow: "Veterinary coordination",
    title: "Preventive care, vaccinations and treatment.",
    intro:
      "Herdvest coordinates qualified veterinary professionals to examine animals, keep vaccinations on schedule and respond when an animal needs treatment.",
    image: "/images/cattle-white.jpg",
    imageAlt: "A white cow standing in a farm yard",
    procedures: [
      { label: "Initial examination after purchase", status: "proposed" },
      { label: "Vaccination schedule appropriate to species and region", status: "proposed" },
      { label: "Deworming and preventive care", status: "proposed" },
      { label: "Treatment coordination when illness is reported", status: "proposed" },
      { label: "Veterinary and vaccination records shared with investors", status: "proposed" },
    ],
    caveat:
      "Veterinary care improves the odds of good outcomes but cannot guarantee them. Which veterinary costs are covered by the service fee is set out in the agreement.",
  },
  {
    id: "monitoring",
    eyebrow: "Monitoring & reporting",
    title: "Monthly updates you can actually see.",
    intro:
      "Investors receive regular, human updates — not a simulated live feed. Each month we aim to share video and photographs alongside notes on condition and welfare.",
    image: "/images/feeding.jpg",
    imageAlt: "Cattle feeding in a clean barn",
    procedures: [
      { label: "Monthly video update of the animal", status: "proposed" },
      { label: "Relevant photographs and condition notes", status: "proposed" },
      { label: "Growth or weight records, where measured", status: "proposed" },
      { label: "Prompt notice of significant health events", status: "proposed" },
      { label: "Periodic farm visits by the Herdvest team", status: "proposed" },
    ],
    caveat:
      "Herdvest does not offer live GPS or camera tracking, and does not currently operate an online investor dashboard.",
  },
  {
    id: "sale",
    eyebrow: "Sale facilitation",
    title: "Preparing, selling and settling — on the record.",
    intro:
      "When agreed conditions and market considerations support a sale, Herdvest coordinates the process and documents every figure used in settlement.",
    image: "/images/sunset.jpg",
    imageAlt: "Cattle grazing in a field at sunset",
    procedures: [
      { label: "Sale preparation and timing review (including seasonal demand)", status: "proposed" },
      { label: "Buyer discussions and offer evaluation", status: "proposed" },
      { label: "Price assessment against market conditions", status: "proposed" },
      { label: "Sale documentation: buyer, price, date, receipts", status: "proposed" },
      { label: "Written settlement statement and distribution per agreement", status: "proposed" },
    ],
    caveat:
      "Herdvest does not promise a specific sale price or sale date. Prices can be lower than expected or lower than the purchase price.",
  },
];
