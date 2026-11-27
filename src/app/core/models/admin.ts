import { Page } from './api';

/** Administrator tools of property-service master; every endpoint needs the admin realm role. */

export type DataQualityCategory = 'MISSING' | 'STALE' | 'CONFLICTING' | 'OUTLIER' | 'DUPLICATE';
export type DataQualityRule =
  | 'PROPERTY_MISSING_ADDRESS'
  | 'PROPERTY_MISSING_PARCEL'
  | 'ASSESSMENT_STALE'
  | 'LOT_SIZE_CONFLICT'
  | 'SALE_PRICE_OUTLIER'
  | 'SALE_DUPLICATE'
  | 'ASSESSMENT_DUPLICATE';
export interface DataQualityRuleSummary {
  rule: DataQualityRule;
  category: DataQualityCategory;
  /** PROPERTY, SALE or ASSESSMENT. */
  entityType: string;
  /** The table(s) the rule reads. */
  source: string;
  description: string;
  /** Null before the first count ends, or when the rule could not be counted: never a guessed 0. */
  issueCount: number | null;
  /** Why issueCount is null; absent when the rule has a count. */
  unavailableReason?: string;
}
export interface DataQualityIssue {
  /** Reproducible reference RULE:entityType:entityId. */
  reference: string;
  rule: DataQualityRule;
  category: DataQualityCategory;
  entityType: string;
  entityId: number;
  propertyId: number | null;
  folio: string | null;
  detail: string;
  sourceCounty: string | null;
  sourceState: string | null;
  sourcePropertyId: number | null;
}
/**
 * GET /admin/data-quality/issues: every rule with its count (counted in the background and reused
 * for a few minutes, see generatedAt) and, with a rule, one page of its issues. The server answers
 * at once and never waits for a count (SCRUM-206). Read-only: nothing is changed.
 */
export interface DataQualityReportDTO {
  /** When the returned counts were calculated; null before the first count ends. */
  generatedAt: string | null;
  /** True while the counts are being recalculated in the background. */
  calculating: boolean;
  summary: DataQualityRuleSummary[];
  rule?: DataQualityRule;
  issues?: Page<DataQualityIssue>;
  note: string | null;
}

export type ValuationRefreshStatus = 'PENDING' | 'LEASED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export const VALUATION_REFRESH_STATUSES: ValuationRefreshStatus[] = [
  'PENDING',
  'LEASED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];
/** A queued request to revalue after a sale or property change (or a model publication). */
export interface ValuationRefreshRequestDTO {
  requestId: string;
  eventKey: string;
  /** SALE_CHANGE, PROPERTY_CHANGE or MODEL_PUBLICATION. */
  triggerType: string;
  /** PROPERTY or FULL_MARKET. */
  scopeType: string;
  propertyId: number | null;
  saleId: number | null;
  sourceVersion: string | null;
  sourceChangedAt: string | null;
  status: ValuationRefreshStatus | string;
  outcome: string | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  runId: string | null;
  lastErrorCode: string | null;
  leaseExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
/** Only pending or failed requests can be cancelled. */
export const canCancelRefresh = (r: ValuationRefreshRequestDTO) =>
  r.status === 'PENDING' || r.status === 'FAILED';
/** Failed source changes can be retried; model publications are retried by the Python worker. */
export const canRetryRefresh = (r: ValuationRefreshRequestDTO) =>
  r.status === 'FAILED' && r.triggerType !== 'MODEL_PUBLICATION';
