/**
 * Illustrative profit-sharing calculation.
 *
 *   Profit pool              = sale proceeds − initial purchase price
 *   Investor gross share     = profit pool × investor share %
 *   Farmer share             = profit pool × farmer share % (100 − investor %)
 *   Herdvest service fee     = investor gross share × service fee %
 *   Investor net profit      = investor gross share − Herdvest service fee
 *   Investor total proceeds  = capital returned + investor net profit
 *
 * If the sale proceeds are below the purchase price, no profit is shared.
 * In this simplified illustration the available proceeds go toward the
 * investor's capital and the remainder is shown as a capital shortfall.
 * Real loss allocation is defined by the signed agreement.
 */

export type CalculatorInput = {
  purchasePrice: number;
  salePrice: number;
  holdingYears: number;
  investorSharePct: number;
  serviceFeePct: number;
};

export type CalculatorResult = {
  isLoss: boolean;
  profitPool: number; // negative when there is a loss
  capitalReturned: number;
  capitalShortfall: number;
  investorGross: number;
  serviceFee: number;
  investorNet: number; // negative (= −shortfall) when there is a loss
  farmerShare: number;
  investorTotal: number;
  farmerSharePct: number;
  /** Compound annualised rate; null when not meaningful. */
  annualisedRate: number | null;
  /** Total investor proceeds ÷ initial capital. */
  proceedsMultiple: number;
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

export function calculate(input: CalculatorInput): CalculatorResult {
  const purchase = Math.max(0, input.purchasePrice);
  const sale = Math.max(0, input.salePrice);
  const years = Math.max(0, input.holdingYears);
  const investorPct = clamp(input.investorSharePct, 0, 100) / 100;
  const feePct = clamp(input.serviceFeePct, 0, 100) / 100;
  const farmerSharePct = 100 - investorPct * 100;

  const profitPool = sale - purchase;

  if (profitPool < 0) {
    const capitalReturned = sale;
    const capitalShortfall = purchase - sale;
    return {
      isLoss: true,
      profitPool,
      capitalReturned,
      capitalShortfall,
      investorGross: 0,
      serviceFee: 0,
      investorNet: -capitalShortfall,
      farmerShare: 0,
      investorTotal: capitalReturned,
      farmerSharePct,
      annualisedRate: null,
      proceedsMultiple: purchase > 0 ? capitalReturned / purchase : 0,
    };
  }

  const investorGross = profitPool * investorPct;
  const farmerShare = profitPool - investorGross;
  const serviceFee = investorGross * feePct;
  const investorNet = investorGross - serviceFee;
  const investorTotal = purchase + investorNet;

  const annualisedRate =
    purchase > 0 && years > 0 && investorTotal > purchase
      ? Math.pow(investorTotal / purchase, 1 / years) - 1
      : null;

  return {
    isLoss: false,
    profitPool,
    capitalReturned: purchase,
    capitalShortfall: 0,
    investorGross,
    serviceFee,
    investorNet,
    farmerShare,
    investorTotal,
    farmerSharePct,
    annualisedRate,
    proceedsMultiple: purchase > 0 ? investorTotal / purchase : 0,
  };
}
