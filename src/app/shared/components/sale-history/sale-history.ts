import { LoadingSpinner } from '../loading-spinner';
import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Sale } from '../../../core/models/sale';
import { PropertyValuePrediction } from '../../../core/models/property_prediction_value';

/** The estimate the chart appends: a legacy prediction or the explained valuation both fit. */
export type EstimatePoint = Pick<PropertyValuePrediction, 'predictedPrice' | 'predictionDate'>;

export interface PriceHistoryPoint {
  price: number;
  date: string | null;
  estimate: boolean;
}

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

@Component({
  selector: 'gz-sale-history',
  imports: [LoadingSpinner, CurrencyPipe, DatePipe],
  templateUrl: './sale-history.html',
  styleUrl: './sale-history.css',
})
export class SaleHistory {
  dateValue(date: string) {
    return new Date(date);
  }
  sales = input<readonly Sale[]>([]);
  prediction = input<EstimatePoint | null>(null);
  // A failed estimate is reported once, by the valuation panel with its retry; the chart just omits it.
  loading = input(false);
  active = signal<number | null>(null);
  hovered = signal<number | null>(null);
  focused = signal<number | null>(null);
  highlighted = computed(() => this.hovered() ?? this.focused());
  tooltip = computed(() => {
    const index = this.highlighted();
    return index === null ? null : (this.chart().points[index] ?? null);
  });
  points = computed(() => priceHistory(this.sales(), this.prediction()));
  chart = computed(() => {
    const points = this.points();
    const prices = points.map((p) => p.price);
    const low = Math.min(...prices),
      high = Math.max(...prices);
    const padding = Math.max((high - low) * 0.2, high * 0.08, 1);
    const min = Math.max(0, low - padding),
      max = high + padding;
    const plotted = points.map((p, i) => ({
      ...p,
      x: points.length === 1 ? 450 : 100 + (i * 700) / (points.length - 1),
      y: 210 - ((p.price - min) / (max - min)) * 170,
    }));
    const sales = plotted.filter((p) => !p.estimate);
    const last = plotted.at(-1),
      previous = plotted.at(-2);
    return {
      points: plotted,
      line: sales.map((p) => `${p.x},${p.y}`).join(' '),
      estimateLine:
        last?.estimate && previous ? `${previous.x},${previous.y} ${last.x},${last.y}` : '',
      ticks: [0, 0.5, 1].map((t) => ({ price: min + (max - min) * t, y: 210 - t * 170 })),
    };
  });
  selected = computed(() => this.points()[this.active() ?? this.points().length - 1] ?? null);
}
