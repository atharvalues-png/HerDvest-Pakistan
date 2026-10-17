/**
 * Rule-based extraction of candidate record details from an operational
 * message (email body, WhatsApp text, pasted report). It never posts
 * anything: results are DRAFTS shown to a reviewer, with every uncertainty
 * listed in `issues`.
 *
 * This is deliberately conservative and deterministic. An AI/OCR extractor can
 * be added behind the same interface later; its output must still go through
 * the same review queue.
 */

export type Extracted = {
  animalRefs: string[];
  date?: string; // YYYY-MM-DD
  inspection?: { condition?: string; findings: string; weightKg?: string };
  vaccination?: { vaccine?: string };
  expense?: { amount?: string; category: string; description: string };
  healthConcern?: boolean;
  purchaseReport?: boolean;
  hasAttachmentMention?: boolean;
};

export type ParseResult = { detected: string[]; extracted: Extracted; issues: string[] };

const VACCINES = ["HS", "FMD", "BQ", "LSD", "PPR", "Brucella", "Anthrax"];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function parseMessage(text: string, receivedAt: Date = new Date()): ParseResult {
  const body = (text ?? "").replace(/\s+/g, " ").trim();
  const lower = body.toLowerCase();
  const detected: string[] = [];
  const issues: string[] = [];
  const extracted: Extracted = { animalRefs: [] };

  // animal IDs: HV-001, HV 12, hv-0007
  const refs = [...body.matchAll(/\bHV[-\s]?(\d{1,6})\b/gi)].map((m) => `HV-${m[1].padStart(3, "0")}`);
  extracted.animalRefs = [...new Set(refs)];
  if (extracted.animalRefs.length === 0) issues.push("No Herdvest animal ID (e.g. HV-001) found.");
  if (extracted.animalRefs.length > 1) issues.push(`Several animal IDs mentioned (${extracted.animalRefs.join(", ")}); confirm which record each detail belongs to.`);

  // date
  if (/\byesterday\b/.test(lower)) extracted.date = isoDate(new Date(receivedAt.getTime() - 86_400_000));
  else if (/\btoday\b/.test(lower)) extracted.date = isoDate(receivedAt);
  const dm = body.match(/\b(\d{4})-(\d{2})-(\d{2})\b/) ?? null;
  const dmy = body.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
  if (dm) extracted.date = `${dm[1]}-${dm[2]}-${dm[3]}`;
  else if (dmy) extracted.date = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (!extracted.date) {
    extracted.date = isoDate(receivedAt);
    issues.push("No date stated; the date the message was received has been assumed.");
  }

  // money: "PKR 2,500", "Rs. 2500", "2500 rupees"
  const money = body.match(/(?:pkr|rs\.?|rupees)\s*([\d,]+(?:\.\d{1,2})?)/i) ?? body.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:pkr|rs\b|rupees)/i);
  const amount = money ? money[1].replace(/,/g, "") : undefined;

  // inspection / condition
  const condition = /\bcritical\b/.test(lower) ? "critical"
    : /\b(sick|ill|weak|not eating|fever|lame)\b/.test(lower) ? "poor"
    : /\b(excellent)\b/.test(lower) ? "excellent"
    : /\b(healthy|good condition|fine|normal)\b/.test(lower) ? "good" : undefined;
  const weight = body.match(/(\d{2,4}(?:\.\d)?)\s*kg\b/i)?.[1];
  if (/\b(inspect\w*|farm visit|visited|check(ed)? up|health check)\b/.test(lower)) {
    detected.push("inspection");
    extracted.inspection = { condition, findings: body.slice(0, 1000), weightKg: weight };
    if (!condition) issues.push("Inspection result/condition is not clear from the message.");
  }

  // vaccination
  const vaccine = VACCINES.find((v) => new RegExp(`\\b${v}\\b`, "i").test(body));
  if (/\bvaccin\w*\b/.test(lower) || vaccine) {
    detected.push("vaccination");
    extracted.vaccination = { vaccine };
    if (!vaccine) issues.push("Vaccination mentioned but the vaccine name was not recognised.");
  }

  // expense
  if (amount || /\b(expense|paid|cost|bill|invoice|fee)\b/.test(lower)) {
    detected.push("expense");
    const category = /\bvaccin/.test(lower) ? "vaccination"
      : /\b(medicine|medication|treatment|injection)\b/.test(lower) ? "medicine"
      : /\b(transport|fuel|petrol|diesel|travel)\b/.test(lower) ? "transport"
      : /\b(vet|veterinar)/.test(lower) ? "veterinary_fee"
      : /\b(feed|fodder|wanda|silage)\b/.test(lower) ? "feed_husbandry" : "other";
    extracted.expense = { amount, category, description: body.slice(0, 200) };
    if (!amount) issues.push("Expense mentioned but no amount (e.g. PKR 2,500) was found.");
    issues.push("Decide whether the expense is chargeable to the investor or a Herdvest operating cost when approving it.");
  }

  if (/\b(sick|ill|injur\w*|died|dead|death|not eating|fever)\b/.test(lower)) {
    extracted.healthConcern = true;
    detected.push("health_update");
    if (/\b(died|dead|death)\b/.test(lower)) issues.push("Possible death reported — create an incident record manually after confirming.");
  }
  if (/\b(bought|purchased|new animal|purchase)\b/.test(lower)) {
    extracted.purchaseReport = true;
    detected.push("purchase_report");
    issues.push("Purchase reports must be recorded through the purchase workflow (funding checks apply).");
  }
  if (/\b(attached|attachment|receipt|photo|picture|video)\b/.test(lower)) extracted.hasAttachmentMention = true;
  if (detected.length === 0) issues.push("Could not identify the type of record. Review manually.");

  return { detected: [...new Set(detected)], extracted, issues };
}
