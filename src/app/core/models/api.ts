/** Backend master 0f60963. Nullable values stay unknown; never substitute assessment or purchase price for market value. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first?: boolean;
  last?: boolean;
}
export type BackendPersona = 'USER' | 'RESIDENTIAL_INVESTOR' | 'REALTOR' | 'BANK_LENDER';
export interface UserDTO {
  id: number;
  keycloakUserId: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  persona: BackendPersona;
  /** Newest realtor license submission (independent of persona); null when none was submitted. */
  realtorLicenseStatus?: RealtorLicenseStatus | null;
}
export type RealtorLicenseStatus = 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  persona?: BackendPersona;
}
export interface UserPreferencesDTO {
  minBudget: number | null;
  maxBudget: number | null;
  targetLocations: {
    countyId: number;
    countyName?: string;
    stateCode?: string;
    stateName?: string;
  }[];
  investmentGoals: string[];
}
export interface PropertySearchRequest {
  countyId?: number;
  state?: string;
  city?: string;
  zip?: string;
  address?: string;
  neighborhood?: string;
  propertyType?: string;
  dorCode?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minLivingAreaSqft?: number;
  maxLivingAreaSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minLotSize?: number;
  maxLotSize?: number;
  minLon?: number;
  minLat?: number;
  maxLon?: number;
  maxLat?: number;
  page?: number;
  size?: number;
  sortBy?: 'id' | 'bedrooms' | 'bathrooms' | 'livingAreaSqft' | 'lotSize' | 'yearBuilt';
  direction?: 'asc' | 'desc';
}
export interface PropertySearchItem {
  id: number;
  folio: string;
  countyId: number;
  countyName: string | null;
  stateCode: string | null;
  stateName: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  dorCode: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaSqft: number | null;
  lotSize: number | null;
  yearBuilt: string | null;
  neighborhood: string | null;
  neighborhoodDescription: string | null;
}
export interface FavoriteDTO {
  propertyId: number;
  favorite: boolean;
  createdAt: string;
}
export type Cadence = 'DAILY' | 'WEEKLY';
export interface SavedSearchDTO {
  id: number;
  name: string;
  filters: Omit<PropertySearchRequest, 'page' | 'size'>;
  filtersVersion: number;
  cadence: Cadence;
  paused: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SavedSearchRequest {
  name?: string;
  filters?: Omit<PropertySearchRequest, 'page' | 'size'>;
  cadence?: Cadence;
  paused?: boolean;
}
export type AlertEventType = 'NEW_MATCH' | 'LISTING_PRICE_CHANGED' | 'VALUATION_CHANGED';
/** VALUATION_CHANGED only: which way the published estimate has to move to notify. */
export type ValuationChangeDirection = 'ANY' | 'INCREASE' | 'DECREASE';
export interface AlertRuleDTO {
  id: number;
  name: string;
  eventType: AlertEventType;
  propertyId: number | null;
  savedSearchId: number | null;
  cadence: Cadence;
  paused: boolean;
  effectivePaused: boolean;
  createdAt: string;
  updatedAt: string;
  /** VALUATION_CHANGED only (null otherwise): smallest change, in percent, that notifies. */
  minimumChangePercent?: number | null;
  changeDirection?: ValuationChangeDirection | null;
}
export interface AlertRuleRequest {
  name?: string;
  eventType?: AlertEventType;
  propertyId?: number;
  savedSearchId?: number;
  cadence?: Cadence;
  paused?: boolean;
  /** VALUATION_CHANGED only: 0 to 100000, inclusive; 0 (the default) means any nonzero change. */
  minimumChangePercent?: number;
  changeDirection?: ValuationChangeDirection;
}
/** The fields PATCH /alert-rules/{id} accepts; target and event type are fixed after creation. */
export type AlertRuleUpdate = Pick<
  AlertRuleRequest,
  'name' | 'cadence' | 'paused' | 'minimumChangePercent' | 'changeDirection'
>;
export interface AlertMonitoringDTO {
  alertRuleId: number;
  monitoringEnabled: boolean;
  publisherEnabled: boolean;
  effectivePaused: boolean;
  status: string;
  baselineEstablished: boolean;
  generation: number;
  scannedMatches: number;
  lastEvaluatedAt: string | null;
  nextEvaluationAt: string | null;
  lastErrorCode: string | null;
  pendingEvents: number;
  sentEvents: number;
  failedEvents: number;
}
export interface PortfolioDTO {
  id: number;
  name: string;
  description: string | null;
  currency: string;
  holdingCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface PortfolioRequest {
  name?: string;
  description?: string | null;
}
export interface HoldingFinancingDTO {
  type: 'UNKNOWN' | 'CASH' | 'FINANCED';
  loanAmount?: number | null;
  outstandingBalance?: number | null;
  balanceAsOfDate?: string | null;
  interestRatePercent?: number | null;
  loanTermMonths?: number | null;
  monthlyPayment?: number | null;
}
export type HoldingOccupancy = 'UNKNOWN' | 'OWNER_OCCUPIED' | 'RENTED' | 'VACANT';
export interface HoldingOccupancyDTO {
  status: HoldingOccupancy;
  monthlyRent?: number | null;
  leaseStartDate?: string | null;
  leaseEndDate?: string | null;
}
export interface HoldingRequest {
  propertyId?: number;
  acquisitionDate?: string | null;
  purchasePrice?: number | null;
  acquisitionCosts?: number | null;
  ownershipSharePercent?: number;
  financing?: HoldingFinancingDTO | null;
  occupancy?: HoldingOccupancyDTO | null;
}
export interface HoldingDTO extends HoldingRequest {
  id: number;
  portfolioId: number;
  propertyId: number;
  folio: string;
  countyId: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}
export interface PortfolioMetric {
  status: string;
  total: number | null;
  knownTotal: number;
  coveredHoldings: number;
  totalHoldings: number;
}
export interface PortfolioGeography {
  stateId: number | null;
  stateCode: string | null;
  stateName: string | null;
  countyId: number | null;
  countyName: string | null;
  unknown: boolean;
  holdingCount: number;
  holdingPercent: number;
  ownershipEquivalentHoldings: number;
}
export interface PortfolioSummaryDTO {
  portfolioId: number;
  portfolioName: string;
  status: string;
  generatedAt: string;
  asOfDate: string;
  fromDate: string;
  toDate: string;
  valuationAndDebt: {
    currency: string;
    asOfDate: string;
    value: PortfolioMetric;
    debt: PortfolioMetric;
    equity: PortfolioMetric;
    note: string;
    valuationSources: string[];
    valuationSource: string;
    debtSource: string;
  } | null;
  financials: {
    status: string;
    basis: string;
    currency: string;
    fromDate: string;
    toDate: string;
    income: number;
    expenses: number;
    cashFlow: number;
    recordCount: number;
    holdingsWithRecords: number;
    totalHoldings: number;
    note: string;
    categories: {
      category: FinancialCategory;
      type: 'INCOME' | 'EXPENSE';
      amount: number;
      recordCount: number;
    }[];
  } | null;
  occupancyAndExposure: {
    status: string;
    asOfDate: string;
    totalHoldings: number;
    knownOccupancyHoldings: number;
    rentalHoldings: number;
    rentalOccupancyPercent: number | null;
    occupancyCounts: Record<string, number>;
    states: PortfolioGeography[];
    counties: PortfolioGeography[];
    note: string;
  } | null;
  errors: { section: string; code: string }[];
}
export type FinancialCategory =
  | 'RENT'
  | 'OTHER_INCOME'
  | 'REPAIRS'
  | 'MAINTENANCE'
  | 'INSURANCE'
  | 'PROPERTY_TAX'
  | 'HOA'
  | 'UTILITIES'
  | 'MANAGEMENT_FEE'
  | 'MORTGAGE_PAYMENT'
  | 'OTHER_EXPENSE';
export interface FinancialRecordRequest {
  category?: FinancialCategory;
  amount?: number;
  currency?: 'USD';
  transactionDate?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  description?: string | null;
}
export interface FinancialRecordDTO extends FinancialRecordRequest {
  id: number;
  portfolioId: number;
  holdingId: number;
  category: FinancialCategory;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  transactionDate: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}
export interface MortgageRequest {
  price: number;
  downPayment: number;
  annualInterestRate: number;
  loanTermYears: number;
  annualPropertyTax?: number;
  annualHomeInsurance?: number;
  monthlyHoaFees?: number;
}
export interface MortgageResponse {
  loanAmount: number;
  monthlyPrincipalAndInterest: number;
  monthlyPropertyTax: number | null;
  monthlyInsurance: number | null;
  monthlyHoaFees: number | null;
  totalMonthlyKnownCosts: number;
}
export interface ComparableRequest {
  months?: number;
  radiusMeters?: number;
  areaTolerancePercent?: number;
  bedroomTolerance?: number;
  limit?: number;
}
export interface ComparableCandidate {
  propertyId: number;
  folio: string;
  countyId: number;
  address: string | null;
  city: string | null;
  zip: string | null;
  dorCode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaSqft: number | null;
  yearBuilt: string | null;
  saleId: number;
  saleDate: string;
  salePrice: number;
  qualifiedFlag: string | null;
  qualificationDescription: string | null;
  instrumentNumber: string | null;
  matchLevel: string;
  distanceMeters: number | null;
}
export interface ComparableDTO {
  rank: number;
  candidate: ComparableCandidate;
  similarityScore: number;
  evidenceCoveragePercent: number;
  selectionReasons: string[];
  missingData: string[];
  scoreBreakdown: Record<string, unknown>;
}
export interface ComparableResponse {
  propertyId: number;
  subject: {
    propertyId: number;
    countyId: number;
    dorCode: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    livingAreaSqft: number | null;
    yearBuilt: string | null;
  };
  asOfDate: string;
  saleDateFrom: string;
  search: ComparableRequest;
  selectionVersion: string;
  rankingVersion: string;
  candidatePoolLimit: number;
  consideredCandidates: number;
  candidatePoolLimitReached: boolean;
  minimumCandidates: number;
  returnedCount: number;
  status: string;
  warnings: string[];
  comparables: ComparableDTO[];
  scoringWeights: Record<string, number>;
}
/**
 * GET /api/properties/id/{id}/comparables/candidates: every recent qualified sale that passes the
 * search filters, nearest first. Not ranked or adjusted; the ranked list is ComparableResponse.
 */
export interface ComparableCandidateResponse {
  propertyId: number;
  asOfDate: string;
  saleDateFrom: string;
  radiusMeters: number;
  areaTolerancePercent: number;
  bedroomTolerance: number;
  limit: number;
  minimumCandidates: number;
  returnedCount: number;
  /** CANDIDATES_FOUND, or INSUFFICIENT_DATA when fewer than minimumCandidates were found. */
  status: string;
  selectionVersion: string;
  warnings: string[];
  candidates: ComparableCandidate[];
}
export interface SchoolAnalysisDTO {
  id: number;
  propertyId: number;
  distPublicSchool: number | null;
  distCharterSchool: number | null;
  schoolsWithin1km: number | null;
  publicSchoolDistanceScore: number | null;
  charterSchoolDistanceScore: number | null;
  schoolDensityScore: number | null;
  schoolScore: number | null;
}
export interface TransportationAnalysisDTO {
  id: number;
  propertyId: number;
  distMetroRail: number | null;
  distMetroMover: number | null;
  distBusStop: number | null;
  distHighway: number | null;
  busStopsWithin500m: number | null;
  metroRailScore: number | null;
  metroMoverScore: number | null;
  busStopDistanceScore: number | null;
  busStopDensityScore: number | null;
  highwayScore: number | null;
  transportationScore: number | null;
}
export type RecommendationStatus =
  | 'NO_PREFERENCES'
  | 'LOCATION_REQUIRED'
  | 'NO_MATCHES'
  | 'PARTIAL'
  | 'READY';
export interface RecommendationItem {
  rank: number;
  property: PropertySearchItem;
  reasons: string[];
  budgetMatch: string | null;
  goalMatch: string | null;
  listingStatus: string | null;
}
/** Research suggestions from saved preferences; not an active-listing feed or an opportunity score. */
export interface RecommendationResponse {
  status: RecommendationStatus;
  generatedAt: string;
  source: string | null;
  sourceAsOf: string | null;
  rankingMethod: string | null;
  limit: number;
  appliedCountyIds: number[];
  minBudget: number | null;
  maxBudget: number | null;
  investmentGoals: string[];
  limitations: string[];
  content: RecommendationItem[];
}
export interface PropertyComparison {
  propertyId: number;
  folio: string | null;
  address: string | null;
  countyName: string | null;
  stateCode: string | null;
  facts: {
    bedrooms: number | null;
    bathrooms: number | null;
    livingAreaSqft: number | null;
    lotSizeSqft: number | null;
    yearBuilt: string | null;
    propertyType: string | null;
    floors: number | null;
    units: number | null;
  } | null;
  assessment: {
    year: number | null;
    totalValue: number | null;
    landValue: number | null;
    buildingValue: number | null;
    assessedValue: number | null;
  } | null;
  lastSale: { date: string | null; price: number | null } | null;
  valuation: {
    predictedPrice: number | null;
    low: number | null;
    high: number | null;
    growthPercentage: number | null;
    confidenceScore: number | null;
    predictionDate: string | null;
  } | null;
  scores: { schoolScore: number | null; transportationScore: number | null } | null;
  missingFields: string[];
}
export interface PropertyCompareResponse {
  requestedIds: number[];
  comparedCount: number;
  units: Record<string, string>;
  assessmentYear: number | null;
  warnings: string[];
  properties: PropertyComparison[];
}
export interface AffordabilityRequest {
  annualGrossIncome: number;
  monthlyDebtPayments: number;
  downPayment: number;
  annualInterestRate: number;
  loanTermYears: number;
  annualPropertyTax?: number;
  annualHomeInsurance?: number;
  monthlyHoaFees?: number;
}
export interface AffordabilityResponse {
  monthlyGrossIncome: number;
  maxMonthlyHousingPayment: number;
  maxMonthlyPrincipalAndInterest: number;
  maxLoanAmount: number;
  maxHomePrice: number;
  assumptions: {
    frontEndRatioPercent: number;
    backEndRatioPercent: number;
    annualInterestRate: number;
    loanTermYears: number;
    rateSource: string;
  };
  notes: string[];
  disclaimer: string;
}
interface DashboardCard {
  scope: string;
  generatedAt: string;
  status: 'OK' | 'ERROR';
  error: string | null;
  count: number;
  limit: number;
}
export interface FavoritesCard extends DashboardCard {
  recent: {
    propertyId: number;
    folio: string | null;
    address: string | null;
    countyName: string | null;
    stateCode: string | null;
    favoritedAt: string;
  }[];
}
export interface SavedSearchesCard extends DashboardCard {
  recent: {
    id: number;
    name: string;
    cadence: Cadence;
    paused: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
}
export interface AlertsCard extends DashboardCard {
  activeCount: number;
  pausedCount: number;
  recent: (Omit<AlertRuleDTO, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  })[];
}
/**
 * GET /api/dashboards/user/affordability: the affordability calculator on the inputs the caller
 * supplies. Nothing is assumed: without the required inputs the card is INCOMPLETE.
 */
export interface AffordabilityCardDTO {
  scope: string;
  generatedAt: string;
  status: 'OK' | 'INCOMPLETE' | 'ERROR' | string;
  error: string | null;
  missingInputs: string[];
  affordability: AffordabilityResponse | null;
}
/**
 * GET /api/dashboards/lender/mortgage-context: the mortgage calculator on supplied inputs, with the
 * rate source disclosed. UNAVAILABLE when no input is supplied; no live rate feed is used.
 */
export interface MortgageContextCardDTO {
  scope: string;
  generatedAt: string;
  status: 'OK' | 'UNAVAILABLE' | 'ERROR' | string;
  error: string | null;
  assumptions: { annualInterestRate: number; loanTermYears: number; rateSource: string } | null;
  mortgage: MortgageResponse | null;
}
export interface SchoolContextDTO {
  propertyId: number;
  status: 'AVAILABLE' | 'NO_NEARBY_RESULTS' | 'NO_COVERAGE';
  distanceUnit: string;
  nearestPublicSchoolDistance: number | null;
  nearestCharterSchoolDistance: number | null;
  schoolsWithin1km: number | null;
  schoolScore: number | null;
  schoolScoreLabel: string | null;
  publicSchoolDistanceScore: number | null;
  charterSchoolDistanceScore: number | null;
  schoolDensityScore: number | null;
  source: string;
  note: string | null;
}
export type TransportCategory = 'RAIL' | 'PEOPLE_MOVER' | 'BUS' | 'HIGHWAY';
export interface TransportContextDTO {
  propertyId: number;
  status: 'AVAILABLE' | 'NO_COVERAGE' | 'UNAVAILABLE';
  distanceUnit: string;
  transport: { category: TransportCategory; nearestDistance: number }[];
  busStopsWithin500m: number | null;
  transportationScore: number | null;
  transportationScoreLabel: string | null;
  source: string;
  error: string | null;
  note: string | null;
}
export type EmailCadence = 'IMMEDIATE' | 'DAILY' | 'WEEKLY';
export interface NotificationPreferencesDTO {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  enabledEventTypes: string[];
  emailCadence: EmailCadence;
  emailAddress: string | null;
  nextEmailAt: string | null;
  updatedAt: string | null;
  emailDeliveryEnabled: boolean;
}
export type NotificationPreferencesRequest = Pick<
  NotificationPreferencesDTO,
  'inAppEnabled' | 'emailEnabled' | 'enabledEventTypes' | 'emailCadence'
>;
