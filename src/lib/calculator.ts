/**
 * Illustrative profit-sharing calculation for the public website.
 *
 * Agreed simplified model (the same rules are implemented in the database
 * function hv.calculate_settlement used by the management system):
 *
 *   Total initial investment = purchase price per animal × number of animals
 *   Total sale proceeds      = sale price per animal × number of animals
 *   Profit pool              = total sale proceeds − total initial investment
 *   Investor gross share     = profit pool × 50%
 *   Farmer share             = profit pool × 50%
 *   Herdvest fee             = investor gross share × 20%   (once per completed sale)
 *   Investor net profit      = investor gross share − Herdvest fee
 *   Investor total proceeds  = capital returned + investor net profit
 *
 * Initial capital is returned before the remaining profit is divided. If sale
 * proceeds are below the investment, no profit is shared: the proceeds go
 * toward capital and the remainder is shown as a capital shortfall. Actual
 * loss allocation is set by the signed agreement.
 *
 * Arithmetic is done in integer paisa so results are exact.
 */
import { MODEL } from "@/config/business";

export type CalculatorInput = {
  pricePerAnimal: number; // PKR
  quantity: number; // whole animals
  salePricePerAnimal: number; // PKR
  holdingYears: number;
};

export type CalculatorResult = {
  isLoss: boolean;
  totalInvestment: number;
  totalSaleProceeds: number;
  profitPool: number; // negative on a loss
  capitalReturned: number;
  capitalShortfall: number;
  investorGross: number;
  farmerShare: number;
  serviceFee: number;
  investorNet: number; // negative (−shortfall) on a loss
  investorTotal: number;
  /** Total proceeds ÷ investment − 1, over the whole holding period. */
  holdingPeriodReturn: number | null;
  /** Compound annual rate; null when not mathematically meaningful. */
  annualisedReturn: number | null;
};

const toPaisa = (rupees: number) => Math.round(rupees * 100);
const toRupees = (paisa: number) => paisa / 100;

/** Largest total (in PKR) that can be calculated exactly. */
export const MAX_EXACT_TOTAL = Math.floor(Number.MAX_SAFE_INTEGER / 100);

export function calculate(input: CalculatorInput): CalculatorResult {
  const qty = Math.max(0, Math.floor(input.quantity));
  const investment = toPaisa(Math.max(0, input.pricePerAnimal)) * qty;
  const proceeds = toPaisa(Math.max(0, input.salePricePerAnimal)) * qty;
  const years = Math.max(0, input.holdingYears);
  const pool = proceeds - investment;

  if (pool < 0) {
    const shortfall = investment - proceeds;
    return {
      isLoss: true,
      totalInvestment: toRupees(investment),
      totalSaleProceeds: toRupees(proceeds),
      profitPool: toRupees(pool),
      capitalReturned: toRupees(proceeds),
      capitalShortfall: toRupees(shortfall),
      investorGross: 0,
      farmerShare: 0,
      serviceFee: 0,
      investorNet: toRupees(-shortfall),
      investorTotal: toRupees(proceeds),
      holdingPeriodReturn: investment > 0 ? proceeds / investment - 1 : null,
      annualisedReturn:
        investment > 0 && proceeds > 0 && years > 0 ? Math.pow(proceeds / investment, 1 / years) - 1 : null,
    };
  }

  // Integer division in paisa; any odd paisa from rounding goes to the farmer
  // share so that investor + farmer always equals the pool exactly.
  const investorGross = Math.floor((pool * MODEL.investorSharePct) / 100);
  const farmerShare = pool - investorGross;
  const fee = Math.round((investorGross * MODEL.serviceFeePct) / 100);
  const investorNet = investorGross - fee;
  const total = investment + investorNet;

  return {
    isLoss: false,
    totalInvestment: toRupees(investment),
    totalSaleProceeds: toRupees(proceeds),
    profitPool: toRupees(pool),
    capitalReturned: toRupees(investment),
    capitalShortfall: 0,
    investorGross: toRupees(investorGross),
    farmerShare: toRupees(farmerShare),
    serviceFee: toRupees(fee),
    investorNet: toRupees(investorNet),
    investorTotal: toRupees(total),
    holdingPeriodReturn: investment > 0 ? total / investment - 1 : null,
    annualisedReturn: investment > 0 && years > 0 ? Math.pow(total / investment, 1 / years) - 1 : null,
  };
}
