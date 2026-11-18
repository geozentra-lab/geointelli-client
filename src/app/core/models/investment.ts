/**
 * POST /calculations/investment and the saved scenarios of property-service master. Inputs are the
 * user's own; missing inputs are never filled in, so the figures that need them come back null with
 * a note. Nothing here is a market estimate.
 */
export interface InvestmentOperatingRequest {
  /** Required. */
  monthlyRent: number;
  vacancyRatePercent?: number;
  maintenanceRatePercent?: number;
  managementRatePercent?: number;
  annualPropertyTax?: number;
  annualHomeInsurance?: number;
  monthlyHoaFees?: number;
  monthlyOtherExpenses?: number;
}
export interface InvestmentFinancingRequest {
  purchasePrice?: number;
  downPayment?: number;
  annualInterestRate?: number;
  loanTermYears?: number;
  closingCosts?: number;
}
export interface InvestmentProjectionRequest {
  /** 1 to 30. */
  horizonYears: number;
  /** -50 to 50; without it the projection keeps today's value. */
  annualAppreciationRatePercent?: number;
}
export interface InvestmentAnalysisRequest {
  operating: InvestmentOperatingRequest;
  financing?: InvestmentFinancingRequest;
  projection?: InvestmentProjectionRequest;
}
export interface InvestmentOperatingResult {
  monthlyGrossRent: number | null;
  annualGrossRent: number | null;
  monthlyVacancyLoss: number | null;
  annualVacancyLoss: number | null;
  monthlyEffectiveIncome: number | null;
  annualEffectiveIncome: number | null;
  annualMaintenance: number | null;
  annualManagement: number | null;
  annualPropertyTax: number | null;
  annualInsurance: number | null;
  annualHoaFees: number | null;
  annualOtherExpenses: number | null;
  monthlyOperatingExpenses: number | null;
  annualOperatingExpenses: number | null;
  monthlyNetOperatingIncome: number | null;
  annualNetOperatingIncome: number | null;
  notes: string[];
}
export interface InvestmentFinancingResult {
  loanAmount: number | null;
  monthlyDebtService: number | null;
  annualDebtService: number | null;
  monthlyCashFlow: number | null;
  annualCashFlow: number | null;
  capRatePercent: number | null;
  cashInvested: number | null;
  cashOnCashPercent: number | null;
  notes: string[];
}
export interface InvestmentProjectionResult {
  horizonYears: number | null;
  annualAppreciationRatePercent: number | null;
  projectedPropertyValue: number | null;
  remainingLoanBalance: number | null;
  equityFromDownPayment: number | null;
  equityFromLoanPaydown: number | null;
  equityFromAppreciation: number | null;
  totalEquity: number | null;
  cumulativeCashFlow: number | null;
  assumptions: string[];
  notes: string[];
}
export interface InvestmentAnalysisResponse {
  operating: InvestmentOperatingResult | null;
  financing: InvestmentFinancingResult | null;
  grossYieldPercent: number | null;
  projection: InvestmentProjectionResult | null;
  notes: string[];
}

export type ScenarioType = 'INVESTMENT';
/** A saved scenario stores the user's assumptions only, never property facts or results. */
export interface ScenarioDTO {
  id: number;
  name: string;
  scenarioType: ScenarioType;
  inputVersion: number;
  propertyId: number | null;
  /** For INVESTMENT: the body of POST /calculations/investment, as sent. */
  assumptions: InvestmentAnalysisRequest;
  createdAt: string;
  updatedAt: string;
}
export interface ScenarioCreateRequest {
  /** 1 to 120 characters. */
  name: string;
  scenarioType: ScenarioType;
  propertyId?: number;
  assumptions: InvestmentAnalysisRequest;
}
/** PATCH: only the fields sent change; assumptions replace the stored ones as a whole. */
export interface ScenarioUpdateRequest {
  name?: string;
  propertyId?: number;
  assumptions?: InvestmentAnalysisRequest;
}
