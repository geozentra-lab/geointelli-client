import { Page } from './api';

/**
 * Opportunity scores of property-service master (SCRUM-76): versioned, explained scores built from
 * the stored ZentraValue valuation and forecasts. Evidence that is unavailable adds no points; it
 * is never filled in. A score is research input, not investment advice.
 */
export interface OpportunityFactor {
  code: string;
  label: string;
  category: string;
  weight: number;
  /** AVAILABLE, or why the evidence is missing. */
  status: string;
  signal: number | null;
  signalUnit: string | null;
  subscore: number | null;
  points: number | null;
  explanation: string;
}
/** GET /properties/id/{id}/opportunity-score: scored now, from the property's stored valuation. */
export interface OpportunityScoreDTO {
  propertyId: number;
  scoreVersion: string;
  /** SCORED, or UNAVAILABLE when essential evidence is missing (see reasons). */
  status: 'SCORED' | 'UNAVAILABLE' | string;
  score: number | null;
  maxScore: number;
  /** Sum of the weights of the factors whose evidence was available; the score never exceeds it. */
  coveragePercent: number;
  factors: OpportunityFactor[];
  reasons: { code: string; message: string }[];
  valuation: {
    estimatedValue: number | null;
    valuationStatus: string | null;
    confidence: string | null;
    modelVersion: string | null;
    dataThrough: string | null;
    runId: string | null;
  } | null;
  scoredAt: string;
  notes: string[];
}
export type OpportunitySort = 'SCORE_DESC' | 'FORECAST_GROWTH_1Y_DESC' | 'VALUE_ASC' | 'VALUE_DESC';
export const OPPORTUNITY_SORTS: [OpportunitySort, string][] = [
  ['SCORE_DESC', 'Highest score'],
  ['FORECAST_GROWTH_1Y_DESC', 'Highest 1-year forecast'],
  ['VALUE_ASC', 'Lowest value'],
  ['VALUE_DESC', 'Highest value'],
];
/** Filters of GET /opportunities; omitted ones are not applied. */
export interface OpportunityQuery {
  page: number;
  size: number;
  countyId?: number | null;
  stateId?: number | null;
  minScore?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  sort?: OpportunitySort;
}
export interface OpportunityItem {
  propertyId: number;
  folio: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  countyName: string | null;
  stateCode: string | null;
  score: number;
  maxScore: number;
  coveragePercent: number;
  estimatedValue: number | null;
  forecastGrowth1yPct: number | null;
  factors: OpportunityFactor[];
  valuationRunId: string | null;
  valuationDataThrough: string | null;
  scoredAt: string;
}
export type OpportunityPageStatus =
  | 'OK'
  | 'NO_MATCHES'
  | 'NO_ELIGIBLE_OPPORTUNITIES'
  | 'NOT_SCORED';
/** GET /opportunities: stored scores of the current scoring version (status SCORED only). */
export interface OpportunityPageDTO {
  scoreVersion: string;
  status: OpportunityPageStatus | string;
  filters: {
    countyId: number | null;
    stateId: number | null;
    minScore: number | null;
    minValue: number | null;
    maxValue: number | null;
  };
  sort: OpportunitySort | string;
  results: Page<OpportunityItem>;
  notes: string[];
}
/** POST /admin/opportunity-scores/refresh: a synchronous rescoring run. */
export type OpportunityRefreshMode = 'INCREMENTAL' | 'FULL';
export interface OpportunityRefreshResultDTO {
  mode: OpportunityRefreshMode;
  scoreVersion: string;
  processed: number;
  scored: number;
  unavailable: number;
  removed: number;
  startedAt: string;
  finishedAt: string;
  durationMillis: number;
}
