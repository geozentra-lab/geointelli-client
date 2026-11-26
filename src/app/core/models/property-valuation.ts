import { ComparableResponse } from './api';

/**
 * GET /api/properties/id/{id}/valuation (property-service): stored monthly model output, explained.
 * All amounts are USD and shown as sent; nothing here is recalculated. Sections the server omits
 * (always for "unsupported") are unavailable, never zero.
 */
export type ValuationStatus = 'supported' | 'limited' | 'unsupported';

export interface ValuationReason {
  code: string;
  message: string;
}
export interface ValuationRange {
  low?: number | null;
  high?: number | null;
}
export interface ValuationEstimate {
  value?: number | null;
  /** 80% and 90% coverage ranges of the current estimate. */
  range80?: ValuationRange | null;
  range90?: ValuationRange | null;
  confidence?: string | null;
}
/** A projected value; low/high are illustrative bounds, not 80%/90% ranges. */
export interface ValuationProjection {
  value?: number | null;
  low?: number | null;
  high?: number | null;
}
export interface ValuationForecasts {
  oneYear?: ValuationProjection | null;
  /** Three- and five-year values are trend scenarios. */
  threeYears?: ValuationProjection | null;
  fiveYears?: ValuationProjection | null;
  /**
   * The 7-year forecast the 5-year one replaced: only on valuations scored before the change, which
   * then have no fiveYears. Shown as seven years, never as five.
   */
  sevenYears?: ValuationProjection | null;
}
/** One model contribution. Factors overlap: their amounts must never be added up. */
export interface ValuationFactor {
  code: string;
  label: string;
  pct?: number | null;
  usd?: number | null;
  text: string;
}
export interface ValuationExplanation {
  baseline?: number | null;
  summary?: string | null;
  factors?: ValuationFactor[] | null;
  note?: string | null;
}
export interface ValuationEvidence {
  lastSale?: {
    hasSaleHistory?: boolean | null;
    price?: number | null;
    date?: string | null;
  } | null;
  /** Selected separately as supporting evidence; not the transactions behind the estimate. */
  comparables?: {
    label?: string | null;
    /** COMPARABLES_FOUND, UNAVAILABLE (data is then null), or another ComparableResponse status. */
    status?: string | null;
    data?: ComparableResponse | null;
  } | null;
}
export interface ValuationMethod {
  valuationMethod?: string | null;
  modelVersion?: string | null;
  /** The date the model scored this property; forecast years count from here. */
  predictionDate?: string | null;
  /** The last sale date in the model's training data, not the refresh date. */
  dataThrough?: string | null;
  createdAt?: string | null;
}
export interface PropertyValuation {
  status: ValuationStatus | string;
  reasons?: ValuationReason[] | null;
  estimate?: ValuationEstimate | null;
  forecasts?: ValuationForecasts | null;
  explanation?: ValuationExplanation | null;
  evidence?: ValuationEvidence | null;
  method?: ValuationMethod | null;
  reproducibility?: { runId?: string | null; inputHash?: string | null } | null;
  notes?: string[] | null;
}

/** A finite number, or null when the value is missing (missing never means zero). */
export function amount(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Anything the server does not call supported or limited is treated as unsupported. */
export function valuationShowsEstimate(v: PropertyValuation | null | undefined): boolean {
  return v?.status === 'supported' || v?.status === 'limited';
}

export interface ValuationPoint {
  years: number;
  label: string;
  value: number;
  low: number | null;
  high: number | null;
  /** Trend scenarios (3 and 5 years; 7 on older valuations) are labelled as such. */
  scenario: boolean;
}

/**
 * "five", or "seven" when the forecasts end at the 7-year value of a valuation scored before the
 * 5-year forecast replaced it: for "Three- and five-year values are trend scenarios."
 */
export function longestScenarioWord(points: readonly { years: number }[]): 'five' | 'seven' {
  return points.some((p) => p.years === 7) && !points.some((p) => p.years === 5) ? 'seven' : 'five';
}

/** Year 0 (the estimate) and each forecast that has a value, in order. */
export function valuationPoints(v: PropertyValuation | null | undefined): ValuationPoint[] {
  if (!valuationShowsEstimate(v)) return [];
  const points: ValuationPoint[] = [];
  const now = amount(v?.estimate?.value);
  if (now !== null)
    points.push({
      years: 0,
      label: 'Estimate now',
      value: now,
      low: null,
      high: null,
      scenario: false,
    });
  const horizons: [number, string, ValuationProjection | null | undefined, boolean][] = [
    [1, 'In 1 year', v?.forecasts?.oneYear, false],
    [3, 'In 3 years', v?.forecasts?.threeYears, true],
    [5, 'In 5 years', v?.forecasts?.fiveYears, true],
    // Only on a valuation scored before the 5-year forecast replaced it (no 5-year value then).
    [7, 'In 7 years', amount(v?.forecasts?.fiveYears?.value) === null ? v?.forecasts?.sevenYears : null, true],
  ];
  for (const [years, label, f, scenario] of horizons) {
    const value = amount(f?.value);
    if (value === null) continue;
    const low = amount(f?.low),
      high = amount(f?.high);
    const bounded = low !== null && high !== null;
    points.push({
      years,
      label,
      value,
      low: bounded ? low : null,
      high: bounded ? high : null,
      scenario,
    });
  }
  return points;
}

/** The model run a published valuation version came from. */
export interface ValuationRun {
  runId: string | null;
  runKind: string | null;
  asOf: string | null;
  sourceSnapshotAt: string | null;
  referenceRunId: string | null;
  scoredAt: string | null;
  publishedAt: string | null;
  contentSha256: string | null;
  manifestSha256: string | null;
  inputsSha256: string | null;
}
/** Frozen inputs of a model run: the last sale and nearby sales it saw, not today's comparables. */
export interface ValuationModelEvidence {
  /** RECORDED, or NOT_RECORDED for versions archived without their inputs. */
  status: string;
  label: string | null;
  lastSale: { price: number | null; date: string | null } | null;
  nearbySales: {
    medianPrice: number | null;
    count: number | null;
    pricePerSqft: number | null;
    radiusDegrees: number | null;
    lookbackDays: number | null;
    windowEnd: string | null;
  } | null;
}
/**
 * GET /properties/id/{id}/valuations: archived versions, newest first. Each version keeps its
 * original model dates; nothing current is substituted for a historical value.
 */
export interface ValuationHistoryEntry {
  id: number;
  runId: string | null;
  inputHash: string | null;
  archivedAt: string | null;
  scoredAt: string | null;
  loadedAt: string | null;
  /** PUBLISHED, or SEEDED_CURRENT for versions recorded before history was kept. */
  provenance: 'PUBLISHED' | 'SEEDED_CURRENT' | string;
  provenanceLabel: string | null;
  rowSha256: string | null;
  valuation: PropertyValuation;
  modelEvidence: ValuationModelEvidence | null;
  run: ValuationRun | null;
}
