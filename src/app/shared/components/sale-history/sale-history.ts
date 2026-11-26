import { LoadingSpinner } from '../loading-spinner';
import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Sale } from '../../../core/models/sale';
import { PropertyValuePrediction } from '../../../core/models/property_prediction_value';
import { ChartBandPoint, ChartPoint, TimeChart } from '../../charts/time-chart';
import { monthLabel } from '../../charts/scale';
import { Sort, TABLE_KIT, sortRows } from '../../table';
import { countOf, formatRecordDate } from '../../data/format';

/** The estimate the chart appends: a legacy prediction or the explained valuation both fit. */
export type EstimatePoint = Pick<PropertyValuePrediction, 'predictedPrice' | 'predictionDate'>;

export interface PriceHistoryPoint {
  price: number;
  date: string | null;
  estimate: boolean;
}

/** Plottable sales in date order (a positive price and a real date), then the estimate. */
export function priceHistory(
  sales: readonly Sale[],
  prediction: EstimatePoint | null,
): PriceHistoryPoint[] {
  const points: PriceHistoryPoint[] = sales
    .filter(
      (s) =>
        Number.isFinite(s.salePrice) && s.salePrice > 0 && Number.isFinite(Date.parse(s.saleDate)),
    )
    .slice()
    .sort((a, b) => Date.parse(a.saleDate) - Date.parse(b.saleDate))
    .map((s) => ({ price: s.salePrice, date: s.saleDate, estimate: false }));
  if (prediction && Number.isFinite(prediction.predictedPrice) && prediction.predictedPrice > 0) {
    points.push({
      price: prediction.predictedPrice,
      date: Number.isFinite(Date.parse(prediction.predictionDate))
        ? prediction.predictionDate
        : null,
      estimate: true,
    });
  }
  return points;
}

/** One row of the sales table, with every missing field kept as null (shown as Unavailable). */
export interface SaleRow {
  date: string | null;
  price: number | null;
  type: string | null;
  instrument: string | null;
}
const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
export function saleRows(sales: readonly Sale[]): SaleRow[] {
  return sales.map((s) => ({
    date: Number.isFinite(Date.parse(s.saleDate)) ? s.saleDate : null,
    price: Number.isFinite(s.salePrice) ? s.salePrice : null,
    type: text(s.saleType),
    instrument: text(s.instrumentNumber),
  }));
}

/**
 * Sales and the ZentraValue over time (DESIGN.md §11): the time-axis chart, then its table twin,
 * the recorded sales (date, price, type, instrument). Both reflow at phone width; the sale tiles
 * that were clipped on phones are gone (§14, bug 3).
 */
@Component({
  selector: 'gz-sale-history',
  imports: [LoadingSpinner, CurrencyPipe, TimeChart, ...TABLE_KIT],
  templateUrl: './sale-history.html',
  styleUrl: './sale-history.css',
})
export class SaleHistory {
  private static next = 0;
  readonly uid = 'sales-' + SaleHistory.next++;
  sales = input<readonly Sale[]>([]);
  prediction = input<EstimatePoint | null>(null);
  /** The monthly ZentraValue (published valuations) and its 80% range, when the page has them. */
  line = input<readonly ChartPoint[]>([]);
  band = input<readonly ChartBandPoint[]>([]);
  /** h2 on the property page (under its h1), h3 inside the live-map dialog. */
  headingLevel = input<2 | 3>(3);
  // A failed estimate is reported once, by the valuation panel with its retry; the chart just omits it.
  loading = input(false);
  readonly sort = signal<Sort | null>({ key: 'date', dir: 'desc' });

  points = computed(() => priceHistory(this.sales(), this.prediction()));
  readonly chartPoints = computed<ChartPoint[]>(() =>
    this.points()
      .filter((p) => !p.estimate)
      .map((p) => ({ date: new Date(p.date!), value: p.price })),
  );
  readonly estimate = computed(() => this.points().find((p) => p.estimate) ?? null);
  /** The estimate on the time axis; an undated estimate can't be placed and is only listed. */
  readonly estimatePoint = computed<ChartPoint | null>(() => {
    const e = this.estimate();
    return e?.date ? { date: new Date(e.date), value: e.price } : null;
  });
  readonly rows = computed(() => saleRows(this.sales()));
  readonly sortedRows = computed(() =>
    sortRows(this.rows(), this.sort(), (r, key) =>
      key === 'date' ? (r.date ? Date.parse(r.date) : null) : key === 'price' ? r.price : null,
    ),
  );
  /** Transfers recorded at $0 are listed but not plotted. */
  readonly zeroTransfers = computed(() => this.rows().filter((r) => r.price === 0).length);
  readonly hasChart = computed(
    () => this.chartPoints().length > 0 || !!this.estimatePoint() || this.line().length > 1,
  );
  /** What the chart shows, from the records themselves: "2 recorded sales; the last 10 monthly…". */
  readonly lede = computed(() => {
    const sales = this.chartPoints().length;
    const line = [...this.line()].sort((a, b) => +a.date - +b.date);
    const parts = [sales ? countOf(sales, 'recorded sale') : 'No sale with a price on record'];
    if (line.length > 1)
      parts.push(
        `the last ${line.length} monthly ZentraValues, ${monthLabel(line[0].date)} to ${monthLabel(line.at(-1)!.date)}`,
      );
    else if (this.estimatePoint()) parts.push('the current ZentraValue');
    return parts.join('; ') + '.';
  });
  date(value: string | null) {
    return formatRecordDate(value);
  }
}
