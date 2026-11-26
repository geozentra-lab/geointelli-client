import {
  PropertyValuation,
  ValuationHistoryEntry,
  amount,
  valuationPoints,
  valuationShowsEstimate,
} from '../../core/models/property-valuation';
import { ChartBandPoint, ChartForecastPoint, ChartPoint } from '../../shared/charts/time-chart';
import { addMonths } from '../../shared/charts/scale';

/** A date-only value from the API as a UTC date, or null when it is missing or unreadable. */
function day(value: string | null | undefined): Date | null {
  if (!value) return null;
  const t = Date.parse(value.length === 10 ? value + 'T00:00:00Z' : value);
  return Number.isFinite(t) ? new Date(t) : null;
}

export interface HistorySeries {
  line: ChartPoint[];
  band: ChartBandPoint[];
}

/**
 * The monthly ZentraValue line and its 80% band from published valuation versions (DESIGN.md §11).
 * Only versions with an estimate are plotted, at the date the model scored them; when two versions
 * share a date the newest published one wins (the list arrives newest first). A version without
 * both range ends stays on the line but adds no band point. Oldest first.
 */
export function historySeries(entries: readonly ValuationHistoryEntry[]): HistorySeries {
  const seen = new Set<number>();
  const line: ChartPoint[] = [];
  const band: ChartBandPoint[] = [];
  for (const e of entries) {
    const v = e.valuation;
    if (!valuationShowsEstimate(v)) continue;
    const value = amount(v.estimate?.value);
    const date = day(v.method?.predictionDate);
    if (value === null || date === null || seen.has(+date)) continue;
    seen.add(+date);
    line.push({ date, value });
    const low = amount(v.estimate?.range80?.low),
      high = amount(v.estimate?.range80?.high);
    if (low !== null && high !== null && high >= low) band.push({ date, low, high });
  }
  const byDate = (a: { date: Date }, b: { date: Date }) => +a.date - +b.date;
  return { line: line.sort(byDate), band: band.sort(byDate) };
}

/**
 * The 1-, 3- and 5-year forecasts (7 on an older valuation) at their true dates (years after the date the model scored the
 * property). Bounds are kept only when asked for and when both ends are known; they are illustrative,
 * not 80% ranges. Empty without an estimate date, since the forecasts could not be placed.
 */
export function forecastSeries(
  v: PropertyValuation | null | undefined,
  withRanges = true,
): ChartForecastPoint[] {
  const base = day(v?.method?.predictionDate);
  if (!base) return [];
  return valuationPoints(v)
    .filter((p) => p.years > 0)
    .map((p) => ({
      date: addMonths(base, 12 * p.years),
      value: p.value,
      low: withRanges ? p.low : null,
      high: withRanges ? p.high : null,
    }));
}
