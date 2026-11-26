import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PropertyValuation,
  amount,
  longestScenarioWord,
  valuationPoints,
  valuationShowsEstimate,
} from '../../core/models/property-valuation';
import { CONFIDENCE } from '../../shared/components/value-forecast';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT } from '../../shared/table';
import { ChartBandPoint, ChartPoint, TimeChart } from '../../shared/charts/time-chart';
import { formatRecordDate } from '../../shared/data/format';
import { metersToMiles } from './comparables-map.util';
import { forecastSeries } from './valuation-series';

const MATCH_LEVELS: Record<string, string> = {
  SAME_PARENT_GROUP: 'Same property group',
  SAME_SUBDIVISION: 'Same subdivision',
  SAME_NEIGHBORHOOD: 'Same neighborhood',
  NEARBY: 'Nearby',
};

/**
 * The Valuation tab's record, read from GET /properties/id/{id}/valuation (the ZentraValue block
 * itself is in the page's aside). Ruled sections: the forecast (the monthly ZentraValue, the
 * estimate and the 1-, 3- and 5-year fan on a time axis, with its table twin; 7 years instead of 5
 * on a valuation scored before the change), what drives the
 * estimate, the supporting comparable sales, and the model details in a Method disclosure.
 * Shows only what the server sent: nothing is recalculated and missing values are Unavailable.
 */
@Component({
  selector: 'gz-property-valuation',
  imports: [CurrencyPipe, DecimalPipe, RouterLink, TimeChart, ...RECORD_KIT, ...TABLE_KIT],
  template: `
    @if (valuation(); as v) {
      <div class="pv">
        @if (!showsEstimate()) {
          <gz-record-section heading="No estimate for this property">
            <p class="pv-lede">ZentraValue does not produce an estimate here, for these reasons:</p>
            <ul class="reasons">
              @for (r of reasons(); track r.code) {
                <li>{{ r.message }}</li>
              } @empty {
                <li>The model does not support this property.</li>
              }
            </ul>
          </gz-record-section>
        } @else {
          <gz-record-section heading="Forecast">
            <p class="pv-lede">
              The estimate and its forecasts at their dates.
              @if (predictionDate(); as d) {
                Forecast years count from the estimate date, {{ d }}.
              }
              Three- and {{ scenarioWord() }}-year values are trend scenarios.
            </p>
            @if (v.status === 'limited') {
              <p class="caution" role="note">Limited estimate: {{ reasonText() }}</p>
            }
            @if (hasChart()) {
              <gz-time-chart
                [estimate]="estimatePoint()"
                [line]="historyLine()"
                [band]="historyBand()"
                [forecast]="forecastPoints()"
                [modelLabel]="historyLine().length > 1 ? 'ZentraValue, monthly' : 'ZentraValue'"
                forecastLabel="Forecast"
                [height]="260"
                ariaLabel="ZentraValue estimates and forecasts by date. The table below lists the same values."
              />
              @if (hasRanges()) {
                <label class="checkbox range-toggle"
                  ><input
                    type="checkbox"
                    [checked]="showRanges()"
                    (change)="showRanges.set(!showRanges())"
                  />
                  Show illustrative forecast ranges</label
                >
              }
            }
            <table gz-table sticky="none" class="forecast-table">
              <caption class="sr-only">
                Estimate and forecasts
              </caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col" class="num">Value</th>
                  <th scope="col" class="num">Change from now</th>
                  <th scope="col" class="num" data-priority="2">Range</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span class="cell-main">Estimate now</span>
                    <span class="cell-sub">{{ confidence() }}</span>
                  </td>
                  <td
                    gz-cell
                    class="num nowrap"
                    [missing]="estimate() === null"
                    reason="No estimate value was returned"
                  >
                    {{ estimate() | currency: 'USD' : 'symbol' : '1.0-0' }}
                  </td>
                  <td class="num"></td>
                  <td
                    gz-cell
                    class="num nowrap"
                    data-priority="2"
                    [missing]="!range80()"
                    reason="No 80% range was returned"
                  >
                    @if (range80(); as r) {
                      {{ r.low | currency: 'USD' : 'symbol' : '1.0-0' }} to
                      {{ r.high | currency: 'USD' : 'symbol' : '1.0-0' }}
                      <span class="cell-sub">80% range</span>
                    }
                  </td>
                </tr>
                @for (f of forecasts(); track f.years) {
                  @let c = change(f.value);
                  <tr>
                    <td>
                      <span class="cell-main">{{ f.label }}</span>
                      @if (f.scenario) {
                        <span class="cell-sub">Trend scenario</span>
                      }
                    </td>
                    <td class="num nowrap">{{ f.value | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                    <td class="num nowrap">
                      @if (c !== null) {
                        {{ c > 0 ? '+' : c < 0 ? '−' : '' }}{{ abs(c) | number: '1.1-1' }}%
                      }
                    </td>
                    <td
                      gz-cell
                      class="num nowrap"
                      data-priority="2"
                      [missing]="f.low === null || f.high === null"
                      reason="No range was returned for this forecast"
                    >
                      {{ f.low | currency: 'USD' : 'symbol' : '1.0-0' }} to
                      {{ f.high | currency: 'USD' : 'symbol' : '1.0-0' }}
                      <span class="cell-sub">Illustrative</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!forecasts().length) {
              <p class="table-note">Forecasts are not available for this property.</p>
            }
            <p class="table-note">
              @if (range90(); as r) {
                The estimate's 90% range is {{ r.low | currency: 'USD' : 'symbol' : '1.0-0' }} to
                {{ r.high | currency: 'USD' : 'symbol' : '1.0-0' }}.
              }
              Forecast ranges are illustrative, not 80% ranges.
            </p>
          </gz-record-section>

          @if (v.explanation; as x) {
            <gz-record-section heading="What drives this estimate">
              @if (x.summary) {
                <p class="summary">{{ x.summary }}</p>
              }
              @if (factors().length) {
                <table gz-table sticky="none" class="factors">
                  <caption class="sr-only">
                    Factors behind the estimate
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Factor</th>
                      <th scope="col" class="num">Effect</th>
                      <th scope="col" data-priority="2"><span class="sr-only">Size of the effect</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (fa of factors(); track fa.code) {
                      <tr>
                        <td class="wrap">
                          <span class="cell-main">{{ fa.label }}</span>
                          <span class="cell-sub">{{ fa.text }}</span>
                        </td>
                        <td
                          gz-cell
                          class="num nowrap"
                          [missing]="fa.pct === null"
                          reason="Not quantified by the model"
                          [class.positive]="(fa.pct ?? 0) > 0"
                          [class.negative]="(fa.pct ?? 0) < 0"
                        >
                          {{ sign(fa.pct) }}{{ abs(fa.pct) | number: '1.0-1' }}%
                          @if (fa.usd !== null) {
                            · {{ sign(fa.usd) }}{{ abs(fa.usd) | currency: 'USD' : 'symbol' : '1.0-0' }}
                          }
                        </td>
                        <td data-priority="2" class="bar-cell">
                          @if (fa.pct !== null) {
                            <span class="factor-bar" aria-hidden="true"
                              ><i
                                [class.down]="fa.pct < 0"
                                [style.width.%]="((abs(fa.pct) ?? 0) / maxPct()) * 50"
                              ></i
                            ></span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                <p class="table-note">
                  Factor effects overlap, so they are not meant to be added together.
                </p>
              }
              @if (x.note) {
                <p class="table-note">{{ x.note }}</p>
              }
            </gz-record-section>
          }

          @if (v.evidence?.comparables; as cmp) {
            <gz-record-section heading="Supporting comparable sales">
              <p class="pv-lede">
                {{
                  cmp.label ||
                    "Selected separately as supporting evidence, not the model's calculation."
                }}
              </p>
              @if (cmp.data?.comparables?.length) {
                <table gz-table sticky="none">
                  <caption class="sr-only">
                    Supporting comparable sales
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Address</th>
                      <th scope="col" class="num" data-priority="3">Beds</th>
                      <th scope="col" class="num" data-priority="3">Living area, sq ft</th>
                      <th scope="col" class="num" data-priority="2">Sold</th>
                      <th scope="col" class="num">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of cmp.data!.comparables; track c.candidate.propertyId) {
                      <tr>
                        <td>
                          <a [routerLink]="['/property', c.candidate.propertyId]">{{
                            c.candidate.address || 'Folio ' + c.candidate.folio
                          }}</a>
                          <span class="cell-sub"
                            >{{ matchLabel(c.candidate.matchLevel) }} ·
                            {{ miles(c.candidate.distanceMeters) }}</span
                          >
                        </td>
                        <td gz-cell class="num" data-priority="3" [missing]="c.candidate.bedrooms === null" reason="Not in the county record">
                          {{ c.candidate.bedrooms }}
                        </td>
                        <td gz-cell class="num" data-priority="3" [missing]="!c.candidate.livingAreaSqft" reason="Not in the county record">
                          {{ c.candidate.livingAreaSqft | number: '1.0-0' }}
                        </td>
                        <td class="num nowrap" data-priority="2">{{ day(c.candidate.saleDate) }}</td>
                        <td class="num nowrap">
                          {{ c.candidate.salePrice | currency: 'USD' : 'symbol' : '1.0-0' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (cmp.data!.warnings.length) {
                  <details class="pv-details">
                    <summary>How these sales were selected</summary>
                    <ul>
                      @for (w of cmp.data!.warnings; track $index) {
                        <li>{{ w }}</li>
                      }
                    </ul>
                  </details>
                }
              } @else if (cmp.status === 'UNAVAILABLE' || !cmp.data) {
                <p class="pv-empty">Supporting comparable sales could not be loaded.</p>
              } @else {
                <p class="pv-empty">No comparable sales matched the search for this property.</p>
              }
            </gz-record-section>
          }
        }

        @if (v.method || v.notes?.length || showsEstimate()) {
          <div class="pv-foot">
            @for (n of v.notes ?? []; track $index) {
              <p class="table-note">{{ n }}</p>
            }
            @if (showsEstimate()) {
              <p class="table-note">
                Estimates and forecasts are model outputs, not appraisals. The 80% and 90% ranges
                apply to the current estimate only.
              </p>
            }
            @if (v.method; as m) {
              <details class="pv-details method">
                <summary>Method</summary>
                <gz-record-group>
                  @if (m.valuationMethod) {
                    <div gz-record-row label="Valuation method">{{ m.valuationMethod }}</div>
                  }
                  @if (m.modelVersion) {
                    <div gz-record-row label="Model version">{{ m.modelVersion }}</div>
                  }
                  @if (day(m.predictionDate); as d) {
                    <div gz-record-row label="Estimated on" [numeric]="true">{{ d }}</div>
                  }
                  @if (day(m.dataThrough); as d) {
                    <div gz-record-row label="Latest sale in model data" [numeric]="true">{{ d }}</div>
                  }
                  @if (day(m.createdAt); as d) {
                    <div gz-record-row label="Scoring run completed" [numeric]="true">{{ d }}</div>
                  }
                  @if (v.reproducibility?.runId; as run) {
                    <div gz-record-row label="Run">{{ run }}</div>
                  }
                  @if (v.reproducibility?.inputHash; as hash) {
                    <div gz-record-row label="Input">{{ hash }}</div>
                  }
                </gz-record-group>
              </details>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .pv {
      display: grid;
      gap: var(--sp-24);
    }
    .pv > * {
      min-width: 0;
    }
    .pv-lede,
    .summary {
      margin: 0 0 var(--sp-12);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .summary {
      font-size: var(--fs-body);
      line-height: var(--lh-body);
      color: var(--ink);
    }
    .reasons {
      margin: 0;
      padding-left: 18px;
      font-size: var(--fs-body);
      line-height: 1.6;
      max-width: var(--measure);
    }
    /* A limited estimate: the word, then the backend's reasons, in the attention colour. */
    .caution {
      margin: 0 0 var(--sp-12);
      padding: var(--sp-8) var(--sp-12);
      border: 1px solid var(--rule);
      box-shadow: inset 2px 0 0 var(--attention);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--attention);
      max-width: var(--measure);
    }
    .range-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    gz-time-chart + .range-toggle,
    gz-time-chart {
      margin-bottom: var(--sp-8);
    }
    table {
      margin-top: var(--sp-8);
    }
    td.wrap {
      white-space: normal;
      max-width: 52ch;
    }
    .bar-cell {
      width: 30%;
      vertical-align: middle;
    }
    /* Effect size around a centre line: polarity colours, with the sign and the words beside it. */
    .factor-bar {
      position: relative;
      display: block;
      height: 6px;
      background: var(--rule);
    }
    .factor-bar::before {
      content: '';
      position: absolute;
      left: 50%;
      top: -3px;
      bottom: -3px;
      width: 1px;
      background: var(--rule-strong);
    }
    .factor-bar i {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      background: var(--positive);
    }
    .factor-bar i.down {
      left: auto;
      right: 50%;
      background: var(--negative);
    }
    .pv-empty {
      margin: 0;
      font-size: var(--fs-body);
      color: var(--ink-2);
    }
    .pv-details {
      margin-top: var(--sp-12);
      font-size: var(--fs-cell);
    }
    .pv-details summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
    .pv-details ul {
      margin: var(--sp-8) 0 0;
      padding-left: 18px;
      color: var(--ink-2);
      line-height: 1.6;
    }
    .pv-foot .table-note {
      margin-top: 0;
    }
    .pv-foot .table-note + .table-note {
      margin-top: var(--sp-4);
    }
    .method gz-record-group {
      max-width: 640px;
    }
    @media (max-width: 700px) {
      .forecast-table th {
        white-space: normal;
      }
    }
  `,
})
export class PropertyValuationView {
  valuation = input<PropertyValuation | null>(null);
  /** The monthly ZentraValue and its 80% band from published versions, when the page has them. */
  historyLine = input<readonly ChartPoint[]>([]);
  historyBand = input<readonly ChartBandPoint[]>([]);

  showsEstimate = computed(() => valuationShowsEstimate(this.valuation()));
  reasons = computed(() => this.valuation()?.reasons ?? []);
  reasonText = computed(() =>
    this.reasons()
      .map((r) => r.message)
      .join(' '),
  );
  estimate = computed(() => amount(this.valuation()?.estimate?.value));
  predictionDate = computed(() => formatRecordDate(this.valuation()?.method?.predictionDate));
  confidence = computed(
    () =>
      CONFIDENCE[(this.valuation()?.estimate?.confidence ?? '').toLowerCase()]?.label ??
      'Confidence not stated',
  );
  private range = (r: { low?: number | null; high?: number | null } | null | undefined) => {
    const low = amount(r?.low),
      high = amount(r?.high);
    return low !== null && high !== null ? { low, high } : null;
  };
  range80 = computed(() => this.range(this.valuation()?.estimate?.range80));
  range90 = computed(() => this.range(this.valuation()?.estimate?.range90));
  forecasts = computed(() => valuationPoints(this.valuation()).filter((p) => p.years > 0));
  /** "five", or "seven" on a valuation scored before the 5-year forecast replaced the 7-year one. */
  scenarioWord = computed(() => longestScenarioWord(this.forecasts()));
  /** The wide illustrative bounds set the scale; hiding them rescales the chart to the values. */
  showRanges = signal(true);
  hasRanges = computed(() => this.forecasts().some((f) => f.low !== null && f.high !== null));
  forecastPoints = computed(() => forecastSeries(this.valuation(), this.showRanges()));
  estimatePoint = computed<ChartPoint | null>(() => {
    const value = this.estimate();
    const d = this.valuation()?.method?.predictionDate;
    const t = d ? Date.parse(d.length === 10 ? d + 'T00:00:00Z' : d) : NaN;
    return value !== null && Number.isFinite(t) ? { date: new Date(t), value } : null;
  });
  /** A chart only when there is more than the estimate to show. */
  hasChart = computed(
    () => !!this.estimatePoint() && (this.forecastPoints().length > 0 || this.historyLine().length > 1),
  );
  factors = computed(() =>
    (this.valuation()?.explanation?.factors ?? []).map((f) => ({
      ...f,
      pct: amount(f.pct),
      usd: amount(f.usd),
    })),
  );
  maxPct = computed(() => Math.max(1, ...this.factors().map((f) => Math.abs(f.pct ?? 0))));

  /** Change from the current estimate, in percent; null when there is no estimate. */
  change(value: number) {
    const now = this.estimate();
    return now && now > 0 ? ((value - now) / now) * 100 : null;
  }
  abs(v: number | null) {
    return v === null ? null : Math.abs(v);
  }
  sign(v: number | null) {
    return v === null ? '' : v > 0 ? '+' : v < 0 ? '−' : '';
  }
  day(value: string | null | undefined) {
    return formatRecordDate(value);
  }
  matchLabel(level: string | null | undefined) {
    return (level && MATCH_LEVELS[level]) || 'Comparable';
  }
  miles(meters: number | null | undefined) {
    return metersToMiles(meters);
  }
}
