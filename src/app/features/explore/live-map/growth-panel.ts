import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  GROWTH_METRICS,
  GrowthCell,
  GrowthMetric,
  GrowthSummary,
  MIN_RELIABLE_HOMES,
  formatGrowth,
} from './services/growth-grid';

/** Short names for the measures in the segmented control; the full name heads the section. */
const SHORT: Record<GrowthMetric, string> = {
  annual: 'Annual',
  total: 'Total',
  forecast: 'Next 12 months',
};

/**
 * What the growth squares on the parcel search map show (DESIGN.md §10 heat): the measure, the
 * figures for the homes in view as ruled rows, homes per colour class as a table, the fastest and
 * slowest squares, and the model behind the estimates in a Method disclosure (§9: no model version
 * strings in the interface outside Method). Figures come from the predictions as sent.
 */
@Component({
  selector: 'gz-growth-panel',
  imports: [DatePipe],
  host: { role: 'region', 'aria-labelledby': 'growth-title' },
  template: `
    @let g = summary();
    <h2 id="growth-title">{{ g.metric.name }}</h2>
    <div class="toggle lm-metrics" role="group" aria-label="Growth measure">
      @for (m of metrics; track m.id) {
        <button
          type="button"
          [class.active]="metric() === m.id"
          [attr.aria-pressed]="metric() === m.id"
          [disabled]="m.id === 'forecast' && !forecastHomes()"
          (click)="metricChange.emit(m.id)"
        >
          {{ short[m.id] }}
        </button>
      }
    </div>
    @if (!forecastHomes()) {
      <p class="lm-note">Next 12 months: no forecasts for the homes in view.</p>
    }
    <p class="lm-note">
      {{ g.metric.help }} Each square is the median of the homes inside it, about
      {{ cellMeters() }} m across.
    </p>

    @if (!g.homes) {
      <p class="lm-body">
        None of the {{ excludedCount(g) }} homes in view can be measured this way:
        {{ excludedText(g) }}.
      </p>
    } @else {
      <dl class="lm-figures">
        <div>
          <dt>Median in view</dt>
          @if (fmt(g.median); as median) {
            <dd>{{ median }}</dd>
          } @else {
            <dd class="na"><span class="na-word">Unavailable</span></dd>
          }
        </div>
        <div>
          <dt>Middle half of homes</dt>
          @if (fmt(g.p25) !== null && fmt(g.p75) !== null) {
            <dd>{{ fmt(g.p25) }} to {{ fmt(g.p75) }}</dd>
          } @else {
            <dd class="na"><span class="na-word">Unavailable</span></dd>
          }
        </div>
        <div>
          <dt>Homes mapped</dt>
          <dd>{{ g.homes }} in {{ g.cells.length }} {{ g.cells.length === 1 ? 'square' : 'squares' }}</dd>
        </div>
        <div>
          <dt>Left out</dt>
          <dd>
            {{ excludedCount(g) }}
            @if (excludedCount(g)) {
              <span class="lm-why">{{ excludedText(g) }}</span>
            }
          </dd>
        </div>
      </dl>

      <table class="lm-classes">
        <caption class="sr-only">Homes in view per colour class</caption>
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col" class="num">Homes</th>
            <th scope="col"><span class="sr-only">Share</span></th>
          </tr>
        </thead>
        <tbody>
          @for (c of g.metric.classes; track c.color; let i = $index) {
            <tr>
              <td><i class="swatch" [style.background]="c.color"></i>{{ c.label }}</td>
              <td class="num">{{ g.histogram[i] }}</td>
              <td class="lm-share">
                <i [style.width.%]="(g.histogram[i] / histogramMax()) * 100"></i>
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (g.fastest.length) {
        <div class="lm-spots">
          <div>
            <h3>Fastest areas in view</h3>
            @for (c of g.fastest; track c.key) {
              <button type="button" class="lm-spot" (click)="focusCell.emit(c)">
                <i class="swatch" [style.background]="g.metric.classes[c.classIndex].color"></i>
                <b>{{ fmt(c.median) }}</b><span>{{ c.count }} homes</span>
              </button>
            }
          </div>
          @if (g.slowest.length) {
            <div>
              <h3>Slowest areas in view</h3>
              @for (c of g.slowest; track c.key) {
                <button type="button" class="lm-spot" (click)="focusCell.emit(c)">
                  <i class="swatch" [style.background]="g.metric.classes[c.classIndex].color"></i>
                  <b>{{ fmt(c.median) }}</b><span>{{ c.count }} homes</span>
                </button>
              }
            </div>
          }
        </div>
      }
    }
    @if (g.sources.length) {
      <details class="lm-method">
        <summary>Method</summary>
        <p>
          Squares are drawn on a fixed grid with fixed colour steps, so a colour means the same
          thing anywhere on the map. Faint squares hold fewer than {{ minReliable }} homes.
        </p>
        @for (s of g.sources; track s.modelVersion + s.predictionDate) {
          <p>
            Estimates: model {{ s.modelVersion
            }}{{ s.predictionDate ? ', ' + (s.predictionDate | date: 'mediumDate') : '' }} ({{
              s.count
            }}
            {{ s.count === 1 ? 'home' : 'homes' }})
          </p>
        }
      </details>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: var(--sp-24);
      padding-top: var(--sp-12);
      border-top: 2px solid var(--ink);
    }
    h2 {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    h3 {
      margin: var(--sp-16) 0 var(--sp-4);
      font-size: var(--fs-cell);
      font-weight: 600;
    }
    .lm-note,
    .lm-method p {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .lm-body {
      font-size: var(--fs-body);
    }
    .lm-metrics {
      margin-top: var(--sp-4);
    }
    .toggle button:disabled {
      color: var(--placeholder);
      cursor: not-allowed;
    }
    .lm-figures {
      margin: var(--sp-16) 0 0;
      border-top: 1px solid var(--ink);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .lm-figures div {
      display: grid;
      grid-template-columns: 44% minmax(0, 1fr);
      border-bottom: 1px solid var(--rule);
    }
    .lm-figures dt,
    .lm-figures dd {
      margin: 0;
      padding: 8px 0;
    }
    .lm-figures dt {
      color: var(--ink-2);
    }
    .lm-figures dd {
      padding-left: 10px;
      font-variant-numeric: tabular-nums lining-nums;
    }
    .lm-why {
      display: block;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .lm-classes {
      width: 100%;
      margin-top: var(--sp-16);
      border-collapse: collapse;
      font-size: var(--fs-cell);
      font-variant-numeric: tabular-nums lining-nums;
    }
    .lm-classes th {
      padding: 4px 0;
      font-size: var(--fs-caption);
      font-weight: 500;
      text-align: left;
      color: var(--ink-2);
      border-bottom: 1px solid var(--rule-strong);
    }
    .lm-classes td {
      padding: 4px 0;
      border-bottom: 1px solid var(--rule);
    }
    .lm-classes .num {
      padding-right: 12px;
      text-align: right;
    }
    .lm-share {
      width: 34%;
    }
    .lm-share i {
      display: block;
      height: 8px;
      background: var(--ink);
    }
    .swatch {
      display: inline-block;
      width: 14px;
      height: 12px;
      margin-right: 8px;
      vertical-align: -1px;
      box-shadow: inset 0 0 0 1px rgb(23 39 53 / 0.2);
    }
    .lm-spots {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--sp-16);
    }
    .lm-spot {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 6px 4px;
      background: transparent;
      border-bottom: 1px solid var(--rule);
      font-size: var(--fs-cell);
      text-align: left;
    }
    .lm-spot:hover {
      background: var(--row-hover);
    }
    .lm-spot .swatch {
      margin-right: 0;
    }
    .lm-spot span {
      margin-left: auto;
      font-size: var(--fs-caption);
      color: var(--ink-2);
    }
    .lm-method {
      margin-top: var(--sp-16);
    }
    .lm-method summary {
      font-size: var(--fs-cell);
      font-weight: 500;
      color: var(--copper);
      cursor: pointer;
    }
  `,
})
export class GrowthPanel {
  readonly summary = input.required<GrowthSummary>();
  readonly metric = input.required<GrowthMetric>();
  /** Homes in view with a 1-year forecast; the forecast measure is offered only when there are some. */
  readonly forecastHomes = input(0);
  readonly cellMeters = input(0);
  readonly metricChange = output<GrowthMetric>();
  readonly focusCell = output<GrowthCell>();
  readonly metrics = Object.values(GROWTH_METRICS);
  readonly short = SHORT;
  readonly minReliable = MIN_RELIABLE_HOMES;

  /** A growth figure, or null (shown as Unavailable) when there is none. */
  fmt(value: number | null) {
    return value === null ? null : formatGrowth(value, GROWTH_METRICS[this.metric()]);
  }
  histogramMax() {
    return Math.max(1, ...this.summary().histogram);
  }
  excludedText(s: GrowthSummary) {
    const e = s.excluded;
    return [
      e.noSale && `${e.noSale} with no recorded sale`,
      e.recentSale && `${e.recentSale} sold within the last year`,
      e.noForecast && `${e.noForecast} without a forecast`,
      e.noEstimate && `${e.noEstimate} without an estimate`,
    ]
      .filter(Boolean)
      .join(', ');
  }
  excludedCount(s: GrowthSummary) {
    const e = s.excluded;
    return e.noSale + e.recentSale + e.noForecast + e.noEstimate;
  }
}
