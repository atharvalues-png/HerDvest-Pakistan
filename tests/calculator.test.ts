import { describe, expect, test } from "vitest";
import { calculate } from "@/lib/calculator";

const run = (pricePerAnimal: number, quantity: number, salePricePerAnimal: number, holdingYears = 3) =>
  calculate({ pricePerAnimal, quantity, salePricePerAnimal, holdingYears });

describe("public illustrative calculator", () => {
  test("PKR 100,000 → 600,000 example", () => {
    const r = run(100_000, 1, 600_000);
    expect([r.profitPool, r.investorGross, r.farmerShare, r.serviceFee, r.investorNet, r.investorTotal]).toEqual([
      500_000, 250_000, 250_000, 50_000, 200_000, 300_000,
    ]);
    expect(r.holdingPeriodReturn).toBeCloseTo(2, 10);
    expect(r.annualisedReturn).toBeCloseTo(Math.cbrt(3) - 1, 10);
  });

  test("PKR 250,000 → 600,000 sale scenario", () => {
    const r = run(250_000, 1, 600_000);
    expect([r.profitPool, r.investorGross, r.farmerShare, r.serviceFee, r.investorNet]).toEqual([
      350_000, 175_000, 175_000, 35_000, 140_000,
    ]);
  });

  test("fee is charged once per sale, not per year held", () => {
    const fees = [1, 2, 3, 7.5].map((y) => run(250_000, 1, 600_000, y).serviceFee);
    expect(new Set(fees)).toEqual(new Set([35_000]));
    expect(run(250_000, 1, 600_000, 1).annualisedReturn).not.toEqual(run(250_000, 1, 600_000, 3).annualisedReturn);
  });

  test("quantity multiplies totals with no arbitrary maximum", () => {
    const r = run(150_000, 37, 600_000, 2);
    expect(r.totalInvestment).toBe(5_550_000);
    expect(r.totalSaleProceeds).toBe(22_200_000);
    expect(r.serviceFee).toBe(1_665_000);
    expect(run(100_000, 5000, 600_000).totalInvestment).toBe(500_000_000);
  });

  test("loss: no profit split, shortfall shown, capital limited to proceeds", () => {
    const r = run(250_000, 2, 200_000, 2);
    expect(r.isLoss).toBe(true);
    expect(r.capitalReturned).toBe(400_000);
    expect(r.capitalShortfall).toBe(100_000);
    expect([r.investorGross, r.farmerShare, r.serviceFee]).toEqual([0, 0, 0]);
    expect(r.investorNet).toBe(-100_000);
  });

  test("odd amounts split exactly", () => {
    const r = run(100_000, 1, 100_001);
    expect(r.investorGross + r.farmerShare).toBe(r.profitPool);
  });
});
