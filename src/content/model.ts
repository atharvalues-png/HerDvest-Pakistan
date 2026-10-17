/**
 * Core explanatory content shared across pages.
 * Kept separate from components so it can be translated (e.g. Urdu) later.
 */

export const stakeholders = [
  {
    key: "investor",
    role: "Investor",
    contributes: "Provides capital",
    image: "/images/buffalo-pond.jpg",
    imageAlt: "A healthy black buffalo standing beside a pond",
    summary:
      "Supplies the capital used to purchase livestock and receives documented records, regular updates and a share of any profit under a signed agreement.",
    points: [
      "Funds the documented livestock purchase",
      "Receives purchase, health and sale records",
      "Shares profit — and bears agreed risks",
    ],
  },
  {
    key: "farmer",
    role: "Farmer Partner",
    contributes: "Provides daily care",
    image: "/images/farmer-milking.jpg",
    imageAlt: "A farmer tending his black buffalo",
    summary:
      "Raises the allocated animal with daily feeding, shelter and welfare, and earns an agreed share of the profit for their skill and labour.",
    points: [
      "Daily feeding, shelter and husbandry",
      "Reports health concerns promptly",
      "Earns a defined profit share",
    ],
  },
  {
    key: "herdvest",
    role: "Herdvest",
    contributes: "Coordinates & manages",
    image: "/images/buffalo-young.jpg",
    imageAlt: "Young buffaloes tethered at a farm beside a pond",
    summary:
      "Verifies farmers, coordinates sourcing, veterinary care and monitoring, reports progress, facilitates the sale and administers settlement.",
    points: [
      "Sourcing, allocation and veterinary coordination",
      "Monthly video updates and records",
      "Sale facilitation and settlement",
    ],
  },
] as const;

export const processSteps = [
  {
    title: "Submit an enquiry",
    body: "Tell us about your interests. An enquiry is not a commitment and no payment is requested.",
  },
  {
    title: "Discuss the agreement",
    body: "We discuss your objectives, the proposed agreement, fees and risks before anything is signed.",
  },
  {
    title: "Source & document",
    body: "Suitable livestock is sourced and the purchase price and animal details are documented.",
  },
  {
    title: "Allocate to a farmer",
    body: "A verified farmer partner is selected and the animal is allocated to their care.",
  },
  {
    title: "Care, monitor & report",
    body: "Herdvest coordinates veterinary care and vaccinations, and shares monthly progress updates.",
  },
  {
    title: "Sell & settle",
    body: "When agreed conditions and the market support a sale, proceeds are distributed per the signed agreement.",
  },
] as const;

export const services = [
  {
    icon: "search",
    title: "Livestock sourcing & purchase",
    body: "Identifying suitable animals and documenting the purchase price and relevant animal information.",
  },
  {
    icon: "userCheck",
    title: "Farmer screening & verification",
    body: "Checking identity, farm location, references and suitability before any allocation.",
  },
  {
    icon: "stethoscope",
    title: "Veterinary & vaccination coordination",
    body: "Arranging examinations, vaccination schedules, preventive care and treatment when needed.",
  },
  {
    icon: "eye",
    title: "Livestock monitoring",
    body: "Regular checks on animal condition, welfare and living conditions at the farm.",
  },
  {
    icon: "video",
    title: "Monthly video reports",
    body: "Short monthly videos and photographs so investors can see how their animal is doing.",
  },
  {
    icon: "clipboard",
    title: "Growth & condition records",
    body: "Keeping relevant records of weight or condition, health events and veterinary visits.",
  },
  {
    icon: "handshake",
    title: "Sale coordination",
    body: "Preparing the animal for sale, engaging buyers, evaluating offers and documenting the sale.",
  },
  {
    icon: "message",
    title: "Investor communication",
    body: "A consistent point of contact, clear reporting and a documented settlement statement.",
  },
] as const;

export const transparencyItems = [
  { title: "Purchase documentation", body: "Purchase price, date, seller details where appropriate, and supporting receipts." },
  { title: "Animal identification", body: "Photographs, descriptions and identification tags or records, where available." },
  { title: "Farmer allocation", body: "Which farmer partner cares for the animal, shared with appropriate privacy safeguards." },
  { title: "Veterinary records", body: "Examinations, vaccinations and any treatment coordinated during the holding period." },
  { title: "Monthly progress updates", body: "Video and photo updates with notes on condition and welfare." },
  { title: "Sale documentation", body: "Buyer, agreed price and date of sale, with supporting documents." },
  { title: "Profit-sharing statement", body: "A line-by-line calculation of capital, profit pool, shares and fees." },
] as const;

export const risks = [
  {
    title: "Animal health",
    body: "Livestock can fall ill despite good husbandry and veterinary care. Treatment may not succeed and can affect value.",
  },
  {
    title: "Mortality",
    body: "An animal may die. Herdvest does not provide automatic reimbursement, insurance or capital protection; losses are borne as set out in the agreement.",
  },
  {
    title: "Market prices",
    body: "Livestock prices move with demand, season, feed costs and the wider economy. Prices can fall as well as rise.",
  },
  {
    title: "Holding period",
    body: "The time before a suitable sale is uncertain. A sale may happen earlier or later than first discussed.",
  },
  {
    title: "Sale price",
    body: "The final price depends on the animal's condition and buyer demand at the time. It may be below expectations or below the purchase price.",
  },
  {
    title: "Signed agreements matter",
    body: "Ownership, costs, profit sharing, mortality and settlement are governed only by the signed agreement. Read it carefully and seek independent advice.",
  },
  {
    title: "No guaranteed return",
    body: "There is no fixed or guaranteed return and no guaranteed recovery of capital. Past or illustrative figures do not predict future outcomes.",
  },
] as const;

/** Who is responsible for what. Final allocation is set by the signed agreement. */
export const responsibilities = [
  { task: "Provide capital for the livestock purchase", investor: true, farmer: false, herdvest: false },
  { task: "Source livestock and document the purchase", investor: false, farmer: false, herdvest: true },
  { task: "Verify and select farmer partners", investor: false, farmer: false, herdvest: true },
  { task: "Daily feeding, shelter and husbandry", investor: false, farmer: true, herdvest: false },
  { task: "Report health concerns promptly", investor: false, farmer: true, herdvest: false },
  { task: "Coordinate veterinary visits and vaccinations", investor: false, farmer: false, herdvest: true },
  { task: "Cooperate with vet visits and monitoring", investor: false, farmer: true, herdvest: false },
  { task: "Monthly video updates and records", investor: false, farmer: true, herdvest: true },
  { task: "Review reports and raise questions", investor: true, farmer: false, herdvest: false },
  { task: "Coordinate the sale and documentation", investor: false, farmer: false, herdvest: true },
  { task: "Calculate and administer settlement", investor: false, farmer: false, herdvest: true },
  { task: "Bear losses as allocated in the agreement", investor: true, farmer: true, herdvest: true },
] as const;
