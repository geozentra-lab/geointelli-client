import { OpportunityItem, OpportunitySort } from '../../core/models/opportunity';
import { Sort } from '../../shared/table';
import {
  formatConfidence,
  formatFolio,
  isLowConfidence,
  joinParts,
  placeLine,
} from '../../shared/data/format';

/**
 * Small, pure helpers for the Opportunities tables, kept apart from the components so the page,
 * the record pane and the specs write a fact the same way.
 */

/** The row's name: its street address, else its folio as the county prints it. */
export function opportunityTitle(o: Pick<OpportunityItem, 'address' | 'folio'>): string {
  const folio = formatFolio(o.folio);
  return o.address || (folio ? 'Folio ' + folio : 'Address unavailable');
}

/** "Miami, FL 33133 · Miami-Dade": city, state and ZIP, then the county. */
export function opportunityPlace(o: OpportunityItem): string {
  return joinParts(' · ', placeLine(o.city, o.stateCode, o.zip), o.countyName);
}

/**
 * "+4.2%", "−1.4%", and "0.0%" for anything that rounds to zero (never "−0.0%"); an empty string
 * when there is no figure (the cell is then Unavailable).
 */
export function signedPercent(pct: number | null | undefined, digits = 1): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '';
  const v = Math.abs(pct).toFixed(digits);
  if (Number(v) === 0) return v + '%';
  return (pct > 0 ? '+' : '−') + v + '%';
}

/**
 * The ZentraValue's confidence line in a table cell, in the one format (DESIGN.md §9): "Confidence
 * 78 of 100 · Medium". Opportunity rows carry no confidence field; the score's own "Valuation
 * confidence" factor carries the valuation's score out of 100 and, in its explanation, the band.
 */
export function confidenceText(o: Pick<OpportunityItem, 'factors'>): string {
  return formatConfidence(confidenceScore(o), confidenceBand(o));
}
/** The valuation's confidence score out of 100, from the score's own factor; null when missing. */
export function confidenceScore(o: Pick<OpportunityItem, 'factors'>): number | null {
  const f = valuationConfidence(o);
  return !f || f.status !== 'AVAILABLE' || f.signal === null ? null : Math.round(f.signal);
}
/**
 * The valuation's band ("medium") as the factor's explanation states it: "The valuation's
 * confidence score is 78 of 100 (medium confidence)". Null when it doesn't say; never derived from
 * the score. A band field on the factor would replace this reading (PROGRESS needs list).
 */
export function confidenceBand(o: Pick<OpportunityItem, 'factors'>): string | null {
  const f = valuationConfidence(o);
  if (!f || f.status !== 'AVAILABLE') return null;
  return /\((high|medium|low) confidence\)/i.exec(f.explanation ?? '')?.[1].toLowerCase() ?? null;
}
export function confidenceLow(o: Pick<OpportunityItem, 'factors'>): boolean {
  return isLowConfidence(confidenceBand(o));
}
function valuationConfidence(o: Pick<OpportunityItem, 'factors'>) {
  return o.factors.find((x) => x.code === 'VALUATION_CONFIDENCE');
}

/** The factors that earned points, most points first: the strongest evidence behind the rank. */
export function strongestFactors(o: OpportunityItem): string[] {
  return o.factors
    .filter((f) => f.status === 'AVAILABLE' && (f.points ?? 0) > 0)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .map((f) => f.label);
}

/** Share of the score bar, in percent of the highest score. */
export function scoreShare(part: number, max: number): number {
  return max > 0 ? Math.min(100, Math.max(0, (part / max) * 100)) : 0;
}

/**
 * The API's four orders as table columns (DESIGN.md §7: sorted on the server). Score and the
 * one-year forecast sort only high to low; the ZentraValue sorts both ways.
 */
export const SORT_COLUMNS: Record<OpportunitySort, Sort> = {
  SCORE_DESC: { key: 'score', dir: 'desc' },
  FORECAST_GROWTH_1Y_DESC: { key: 'forecast', dir: 'desc' },
  VALUE_DESC: { key: 'value', dir: 'desc' },
  VALUE_ASC: { key: 'value', dir: 'asc' },
};
export function sortFromColumn(sort: Sort | null): OpportunitySort {
  if (sort?.key === 'value') return sort.dir === 'asc' ? 'VALUE_ASC' : 'VALUE_DESC';
  if (sort?.key === 'forecast') return 'FORECAST_GROWTH_1Y_DESC';
  return 'SCORE_DESC';
}
