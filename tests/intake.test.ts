import { describe, expect, test } from "vitest";
import { parseMessage } from "@/lib/intake/parse";

const at = new Date("2026-10-16T09:00:00Z");

describe("intake message parser", () => {
  test("brief's example → inspection + vaccination + expense drafts for HV-001", () => {
    const r = parseMessage("Animal HV-001, farm inspection completed today. Animal healthy. Vaccination receipt attached. Expense PKR 2,500.", at);
    expect(r.extracted.animalRefs).toEqual(["HV-001"]);
    expect(r.detected).toEqual(expect.arrayContaining(["inspection", "vaccination", "expense"]));
    expect(r.extracted.date).toBe("2026-10-16");
    expect(r.extracted.inspection?.condition).toBe("good");
    expect(r.extracted.expense).toMatchObject({ amount: "2500", category: "vaccination" });
    expect(r.extracted.hasAttachmentMention).toBe(true);
    // never silently decides who bears the cost
    expect(r.issues.join(" ")).toMatch(/chargeable to the investor or a Herdvest operating cost/);
  });

  test("no animal ID → flagged for the unmatched queue", () => {
    const r = parseMessage("Paid Rs. 1200 for fuel to the farm", at);
    expect(r.extracted.animalRefs).toEqual([]);
    expect(r.issues[0]).toMatch(/No Herdvest animal ID/);
    expect(r.extracted.expense).toMatchObject({ amount: "1200", category: "transport" });
  });

  test("multiple animals and possible death are flagged, not acted on", () => {
    const r = parseMessage("HV 2 and HV-17 checked yesterday. HV-17 died overnight.", at);
    expect(r.extracted.animalRefs).toEqual(["HV-002", "HV-017"]);
    expect(r.extracted.date).toBe("2026-10-15");
    expect(r.issues.some((i) => /Several animal IDs/.test(i))).toBe(true);
    expect(r.issues.some((i) => /Possible death/.test(i))).toBe(true);
  });
});
