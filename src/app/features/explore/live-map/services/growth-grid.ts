import L from 'leaflet';
import { PropertyValuePrediction } from '../../../../core/models/property_prediction_value';
import { isoDate } from '../../../../shared/components/value-forecast';

/**
 * Growth heatmap as a grid of squares. Each square shows the median of the homes whose parcel centre
 * falls inside it. The grid is anchored to fixed map coordinates, so squares stay put while panning,
 * and colour classes use fixed breaks so a colour means the same thing everywhere.
 */
export type GrowthMetric = 'annual' | 'total' | 'forecast';

export interface GrowthClass {
  /** Lower bound, inclusive; the first class is open below. */
  from: number;
  color: string;
  label: string;
}
export interface GrowthMetricDef {
  id: GrowthMetric;
  name: string;
  /** Shown under the legend: what one value means. */
  help: string;
  unit: string;
  classes: GrowthClass[];
}

/**
 * ColorBrewer BrBG-7 (DESIGN.md §10): browns are the slower classes, teals the faster ones, and the
 * neutral middle class is the middle range of each metric's fixed breaks below: +3.5% to +5% a
 * year (annual), +50% to +100% (total) and +1% to +2.5% (forecast). It is not centred on 0%.
 * Colour-blind safe.
 */
const PALETTE = ['#8c510a', '#d8b365', '#f6e8c3', '#f5f5f5', '#c7eae5', '#5ab4ac', '#01665e'];

function classes(breaks: number[], fmt: (n: number) => string): GrowthClass[] {
  // breaks are the six inner boundaries between the seven classes.
  return PALETTE.map((color, i) => ({
    from: i === 0 ? -Infinity : breaks[i - 1],
    color,
    label:
      i === 0
        ? `Below ${fmt(breaks[0])}`
        : i === PALETTE.length - 1
          ? `${fmt(breaks[i - 1])} or more`
          : `${fmt(breaks[i - 1])} to ${fmt(breaks[i])}`,
  }));
}
const pct = (n: number) => (n > 0 ? '+' : '') + n + '%';

export const GROWTH_METRICS: Record<GrowthMetric, GrowthMetricDef> = {
  annual: {
    id: 'annual',
    name: 'Annual growth since last sale',
    help:
      'Yearly rate from the last sale price to today’s estimate. It compares homes fairly whether ' +
      'they sold 2 or 30 years ago. Homes sold less than a year ago are left out: their rate is noise.',
    unit: '%/yr',
    classes: classes([0, 2, 3.5, 5, 6.5, 8], pct),
  },
  total: {
    id: 'total',
    name: 'Total growth since last sale',
    help:
      'Change from the last sale price to today’s estimate. Mostly reflects how long ago the home ' +
      'sold, so long-held homes stand out.',
    unit: '%',
    classes: classes([0, 25, 50, 100, 200, 400], pct),
  },
  forecast: {
    id: 'forecast',
    name: 'Forecast, next 12 months',
    help: 'Change from today’s estimate to the model’s 1-year forecast.',
    unit: '%',
    classes: classes([-3, -1, 1, 2.5, 4, 6], pct),
  },
};

export type Exclusion = 'noEstimate' | 'noSale' | 'recentSale' | 'noForecast';

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** The metric for one home, or why it has none. Derived from the estimate and last sale as sent. */
export function growthValue(
  p: PropertyValuePrediction | null | undefined,
  metric: GrowthMetric,
  today = new Date(),
): { value: number } | { excluded: Exclusion } {
  if (!p || !(p.predictedPrice > 0)) return { excluded: 'noEstimate' };
  if (metric === 'forecast') {
    const f = p.forecast1y;
    return f && f > 0 ? { value: (f / p.predictedPrice - 1) * 100 } : { excluded: 'noForecast' };
  }
  const sale = p.lastSalePrice ?? 0;
  if (!(sale > 0)) return { excluded: 'noSale' };
  if (metric === 'total') return { value: (p.predictedPrice / sale - 1) * 100 };
  const sold = Date.parse(isoDate(p.lastSaleDate) ?? '');
  const valued = Date.parse(isoDate(p.predictionDate) ?? '') || today.getTime();
  const years = (valued - sold) / YEAR_MS;
  if (!Number.isFinite(years)) return { excluded: 'noSale' };
  if (years < 1) return { excluded: 'recentSale' };
  return { value: (Math.pow(p.predictedPrice / sale, 1 / years) - 1) * 100 };
}

export function classIndex(value: number, def: GrowthMetricDef): number {
  let index = 0;
  def.classes.forEach((c, i) => {
    if (value >= c.from) index = i;
  });
  return index;
}

/** Square size in metres for a zoom level: about 20–30 px on screen at every zoom. */
export function cellMetersForZoom(zoom: number): number {
  if (zoom < 15) return 160;
  if (zoom < 16) return 100;
  if (zoom < 17) return 60;
  if (zoom < 18) return 35;
  return 20;
}

export interface GrowthPoint {
  propertyId: number;
  lat: number;
  lng: number;
  value: number;
  estimate: number;
}
export interface GrowthCell {
  key: string;
  /** [[south, west], [north, east]] */
  bounds: [[number, number], [number, number]];
  count: number;
  median: number;
  min: number;
  max: number;
  medianEstimate: number;
  classIndex: number;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const crs = L.CRS.EPSG3857;

/** Groups points into squares of cellMeters (Web Mercator metres) anchored at the map origin. */
export function buildGrid(
  points: GrowthPoint[],
  cellMeters: number,
  def: GrowthMetricDef,
): GrowthCell[] {
  const groups = new Map<string, { ix: number; iy: number; points: GrowthPoint[] }>();
  for (const p of points) {
    const m = crs.project(L.latLng(p.lat, p.lng));
    const ix = Math.floor(m.x / cellMeters),
      iy = Math.floor(m.y / cellMeters);
    const key = ix + ':' + iy;
    const g = groups.get(key) ?? { ix, iy, points: [] };
    g.points.push(p);
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, g]) => {
    const sw = crs.unproject(L.point(g.ix * cellMeters, g.iy * cellMeters));
    const ne = crs.unproject(L.point((g.ix + 1) * cellMeters, (g.iy + 1) * cellMeters));
    const values = g.points.map((p) => p.value);
    const med = median(values);
    return {
      key,
      bounds: [
        [sw.lat, sw.lng],
        [ne.lat, ne.lng],
      ],
      count: values.length,
      median: med,
      min: Math.min(...values),
      max: Math.max(...values),
      medianEstimate: median(g.points.map((p) => p.estimate)),
      classIndex: classIndex(med, def),
    };
  });
}

/** Key of the square that contains a map position, for hover lookups. */
export function cellKeyAt(lat: number, lng: number, cellMeters: number): string {
  const m = crs.project(L.latLng(lat, lng));
  return Math.floor(m.x / cellMeters) + ':' + Math.floor(m.y / cellMeters);
}

/** Squares with fewer homes than this are drawn faded and never listed as hotspots. */
export const MIN_RELIABLE_HOMES = 3;

export interface GrowthSummary {
  metric: GrowthMetricDef;
  homes: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  /** Homes per colour class, in class order. */
  histogram: number[];
  excluded: Record<Exclusion, number>;
  cells: GrowthCell[];
  fastest: GrowthCell[];
  slowest: GrowthCell[];
  /** Model versions and dates behind the estimates, e.g. "v13 · Jun 25, 2026". */
  sources: { modelVersion: string; predictionDate: string | null; count: number }[];
}

export function summarize(
  points: GrowthPoint[],
  excluded: Record<Exclusion, number>,
  cells: GrowthCell[],
  def: GrowthMetricDef,
  sources: GrowthSummary['sources'],
): GrowthSummary {
  const values = points.map((p) => p.value);
  const histogram = def.classes.map(() => 0);
  for (const v of values) histogram[classIndex(v, def)]++;
  const reliable = cells.filter((c) => c.count >= MIN_RELIABLE_HOMES);
  const byMedian = [...reliable].sort((a, b) => b.median - a.median);
  return {
    metric: def,
    homes: values.length,
    median: values.length ? median(values) : null,
    p25: values.length ? quantile(values, 0.25) : null,
    p75: values.length ? quantile(values, 0.75) : null,
    histogram,
    excluded,
    cells,
    fastest: byMedian.slice(0, 3),
    // Never repeat a fastest square among the slowest ones.
    slowest: byMedian.slice(Math.max(3, byMedian.length - 3)).reverse(),
    sources,
  };
}

export function formatGrowth(value: number, def: GrowthMetricDef): string {
  const digits = def.id === 'total' ? 0 : 1;
  return (value > 0 ? '+' : '') + value.toFixed(digits) + (def.id === 'annual' ? '%/yr' : '%');
}
