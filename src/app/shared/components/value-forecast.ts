import { Component, computed, input } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  PropertyValuePrediction,
  hasGrowth,
  predictionNotes,
} from '../../core/models/property_prediction_value';

export interface ForecastPoint {
  years: number;
  label: string;
  value: number;
  low: number | null;
  high: number | null;
  /** Change from today's estimate, in percent. */
  change: number;
}

/** Forecast horizons in order; a horizon the model did not score is left out. */
export function forecastPoints(p: PropertyValuePrediction | null): ForecastPoint[] {
  if (!p || !(p.predictedPrice > 0)) return [];
  const rows: [
    number,
    string,
    number | null | undefined,
    number | null | undefined,
    number | null | undefined,
  ][] = [
    [1, 'In 1 year', p.forecast1y, p.forecast1yLow, p.forecast1yHigh],
    [3, 'In 3 years', p.forecast3y, p.forecast3yLow, p.forecast3yHigh],
    [7, 'In 7 years', p.forecast7y, p.forecast7yLow, p.forecast7yHigh],
  ];
  return rows
    .filter((r): r is [number, string, number, number | null, number | null] => (r[2] ?? 0) > 0)
    .map(([years, label, value, low, high]) => ({
      years,
      label,
      value,
      low: low ?? null,
      high: high ?? null,
      change: ((value - p.predictedPrice) / p.predictedPrice) * 100,
    }));
}

/**
 * Normalises a LocalDate the API may send as [yyyy, m, d] (when Jackson writes dates as arrays)
 * to an ISO string the date pipe accepts.
 */
export function isoDate(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (Array.isArray(value) && value.length >= 3 && value.every(Number.isFinite)) {
    const [y, m, d] = value as number[];
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

export const CONFIDENCE: Record<string, { label: string; tone: string; text: string }> = {
  high: { label: 'High confidence', tone: 'green', text: 'Similar homes were valued accurately.' },
  medium: { label: 'Medium confidence', tone: 'amber', text: 'Expect a moderate margin of error.' },
  low: {
    label: 'Low confidence',
    tone: 'copper',
    text: 'Few reliable comparisons; treat as a rough guide.',
  },
};

/** Chart geometry: x is proportional to years ahead, y spans the point values only. */
const W = 560,
  H = 170,
  LEFT = 16,
  RIGHT = 16,
  TOP = 30,
  BOTTOM = 34;

/**
 * Current value estimate and its 1/3/7-year forecast from /api/predictions. compact drops the chart
 * and the long explanations for the property dialog.
 */
@Component({
  selector: 'gz-value-forecast',
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    @if (prediction(); as p) {
      <section class="vf" [class.compact]="compact()" aria-label="Value estimate and forecast">
        @if (!compact()) {
          <div class="vf-head">
            <div>
              <span class="eyebrow">ZentraValue estimate</span>
              <div class="bigvalue">
                {{ p.predictedPrice | currency: 'USD' : 'symbol' : '1.0-0' }}
              </div>
            </div>
            @if (confidence(); as c) {
              <span class="tag" [class]="c.tone" [title]="c.text">{{ c.label }}</span>
            }
          </div>
          <div class="vf-ranges">
            <div>
              <span>Likely range (80%)</span>
              <strong
                >{{ p.predictedPriceLow | currency: 'USD' : 'symbol' : '1.0-0' }} –
                {{ p.predictedPriceHigh | currency: 'USD' : 'symbol' : '1.0-0' }}</strong
              >
            </div>
            @if (p.predictedPriceLow90 && p.predictedPriceHigh90) {
              <div>
                <span>Wider range (90%)</span>
                <strong
                  >{{ p.predictedPriceLow90 | currency: 'USD' : 'symbol' : '1.0-0' }} –
                  {{ p.predictedPriceHigh90 | currency: 'USD' : 'symbol' : '1.0-0' }}</strong
                >
              </div>
            }
            @if (growth(); as g) {
              <div>
                <span
                  >Since last sale
                  @if (lastSaleDate(); as d) {
                    ({{ d | date: 'MMM yyyy' }})
                  }
                </span>
                <strong [class.up]="g.growthPercentage >= 0" [class.down]="g.growthPercentage < 0"
                  >{{ g.growthPercentage > 0 ? '+' : ''
                  }}{{ g.growthPercentage | number: '1.1-1' }}%</strong
                >
              </div>
            }
          </div>
        }

        @if (points().length) {
          <div class="vf-forecast">
            <div class="vf-title">
              <h4>Value forecast</h4>
              @if (p.marketOutlook1yPct !== null && p.marketOutlook1yPct !== undefined) {
                <span class="smalltext muted"
                  >County market, next 12 months:
                  <b [class.up]="p.marketOutlook1yPct >= 0" [class.down]="p.marketOutlook1yPct < 0"
                    >{{ p.marketOutlook1yPct > 0 ? '+' : ''
                    }}{{ p.marketOutlook1yPct | number: '1.1-1' }}%</b
                  ></span
                >
              }
            </div>
            @if (!compact() && chart(); as c) {
              <svg
                class="vf-chart"
                [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height"
                role="img"
                [attr.aria-label]="chartLabel()"
              >
                <line
                  class="axis"
                  [attr.x1]="c.left"
                  [attr.x2]="c.right"
                  [attr.y1]="c.base"
                  [attr.y2]="c.base"
                />
                <path class="line" [attr.d]="c.path" />
                @for (d of c.dots; track d.label) {
                  <circle [attr.cx]="d.x" [attr.cy]="d.y" r="4.5" [class.now]="d.now" />
                  <text
                    class="value"
                    [attr.x]="d.x"
                    [attr.y]="d.y - 11"
                    [attr.text-anchor]="d.anchor"
                  >
                    {{ d.short }}
                  </text>
                  <text
                    class="tick"
                    [attr.x]="d.x"
                    [attr.y]="c.height - 10"
                    [attr.text-anchor]="d.anchor"
                  >
                    {{ d.label }}
                  </text>
                }
              </svg>
            }
            <div class="vf-cards">
              @for (f of points(); track f.years) {
                <div class="vf-card">
                  <span class="smalltext muted">{{ f.label }}</span>
                  <strong>{{ f.value | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                  <span class="chg" [class.up]="f.change >= 0" [class.down]="f.change < 0"
                    >{{ f.change > 0 ? '+' : '' }}{{ f.change | number: '1.1-1' }}% vs today</span
                  >
                  @if (!compact() && f.low && f.high) {
                    <span class="smalltext muted"
                      >{{ f.low | currency: 'USD' : 'symbol' : '1.0-0' }} –
                      {{ f.high | currency: 'USD' : 'symbol' : '1.0-0' }}</span
                    >
                  }
                </div>
              }
            </div>
            @if (!compact() && p.unchangedHomeValue1y) {
              <div class="lineitem">
                <span>In 1 year if it simply tracks the county market</span
                ><strong>{{
                  p.unchangedHomeValue1y | currency: 'USD' : 'symbol' : '1.0-0'
                }}</strong>
              </div>
            }
          </div>
        } @else if (!compact()) {
          <p class="sub spacer">A forecast is not available for this property type.</p>
        }

        @if (!compact()) {
          @for (n of notes(); track $index) {
            <p class="vf-note">{{ n }}</p>
          }
        }
        <p class="sourcedata">
          Model {{ p.modelVersion }}
          @if (predictionDate(); as d) {
            · estimated {{ d | date: 'mediumDate' }}
          }
          @if (dataThrough(); as d) {
            · sales through {{ d | date: 'mediumDate' }}
          }
          @if (!compact()) {
            <br />Estimates and forecasts are model outputs, not appraisals. The 3- and 7-year
            values are trend scenarios and their ranges are illustrative.
          }
        </p>
      </section>
    }
  `,
  styles: `
    .vf {
      display: grid;
      gap: 16px;
    }
    .vf-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    .vf-ranges {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 10px;
    }
    .vf-ranges > div,
    .vf-card {
      display: grid;
      gap: 3px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
    }
    .vf-ranges span {
      font-size: 12px;
      color: var(--muted);
    }
    .vf-title {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }
    .vf-title h4 {
      margin: 0;
      font-size: 15px;
    }
    .vf-forecast {
      display: grid;
      gap: 12px;
    }
    .vf-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }
    .vf-card strong {
      font-size: 18px;
    }
    .chg {
      font-size: 13px;
      font-weight: 600;
    }
    .up {
      color: var(--green);
    }
    .down {
      color: var(--danger);
    }
    .vf-chart {
      width: 100%;
      height: auto;
      display: block;
    }
    .vf-chart .axis {
      stroke: var(--line);
      stroke-width: 1;
    }
    .vf-chart .line {
      fill: none;
      stroke: var(--copper);
      stroke-width: 2.5;
      stroke-linejoin: round;
    }
    .vf-chart circle {
      fill: #fff;
      stroke: var(--copper);
      stroke-width: 2.5;
    }
    .vf-chart circle.now {
      fill: var(--ink);
      stroke: var(--ink);
    }
    .vf-chart text {
      font-size: 12px;
      fill: var(--muted);
    }
    .vf-chart text.value {
      fill: var(--ink);
      font-weight: 600;
    }
    .vf-note {
      margin: 0;
      padding: 8px 12px;
      border-radius: 8px;
      background: #f6efe9;
      font-size: 13px;
    }
    .compact {
      gap: 10px;
    }
    .compact .vf-cards {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    .compact .vf-card {
      padding: 8px;
    }
    .compact .vf-card strong {
      font-size: 14px;
    }
    .compact .chg {
      font-size: 12px;
    }
  `,
})
export class ValueForecast {
  prediction = input<PropertyValuePrediction | null>(null);
  compact = input(false);

  points = computed(() => forecastPoints(this.prediction()));
  growth = computed(() => {
    const p = this.prediction();
    return hasGrowth(p) ? p : null;
  });
  confidence = computed(
    () => CONFIDENCE[(this.prediction()?.confidence ?? '').toLowerCase()] ?? null,
  );
  notes = computed(() => predictionNotes(this.prediction()));
  predictionDate = computed(() => isoDate(this.prediction()?.predictionDate));
  dataThrough = computed(() => isoDate(this.prediction()?.dataThrough));
  lastSaleDate = computed(() => isoDate(this.prediction()?.lastSaleDate));

  chart = computed(() => {
    const p = this.prediction();
    const points = this.points();
    if (!p || !points.length) return null;
    const series = [{ years: 0, label: 'Today', value: p.predictedPrice }, ...points];
    const values = series.map((s) => s.value);
    const min = Math.min(...values),
      max = Math.max(...values);
    const pad = (max - min || max * 0.05) * 0.25;
    const lo = min - pad,
      hi = max + pad;
    const maxYears = series[series.length - 1].years || 1;
    const x = (years: number) => LEFT + 20 + (years / maxYears) * (W - LEFT - RIGHT - 40);
    const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * (H - TOP - BOTTOM);
    const dots = series.map((s, i) => ({
      x: x(s.years),
      y: y(s.value),
      label: i === 0 ? 'Today' : `+${s.years} yr`,
      short: compactMoney(s.value),
      now: i === 0,
      anchor: i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle',
    }));
    return {
      width: W,
      height: H,
      left: LEFT,
      right: W - RIGHT,
      base: H - BOTTOM + 6,
      path: dots.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' '),
      dots,
    };
  });
  chartLabel = computed(() =>
    [
      'Value forecast:',
      `today ${compactMoney(this.prediction()?.predictedPrice ?? 0)}`,
      ...this.points().map((f) => `${f.label.toLowerCase()} ${compactMoney(f.value)}`),
    ].join(', '),
  );
}

export function compactMoney(value: number) {
  if (value >= 1_000_000)
    return '$' + (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2) + 'M';
  if (value >= 1_000) return '$' + Math.round(value / 1_000) + 'K';
  return '$' + Math.round(value);
}
