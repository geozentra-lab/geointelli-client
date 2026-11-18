import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PropertyValuation,
  ValuationPoint,
  amount,
  valuationPoints,
  valuationShowsEstimate,
} from '../../core/models/property-valuation';
import { CONFIDENCE, compactMoney } from '../../shared/components/value-forecast';
import { metersToMiles } from './comparables-map.util';

const MATCH_LEVELS: Record<string, string> = {
  SAME_PARENT_GROUP: 'Same property group',
  SAME_SUBDIVISION: 'Same subdivision',
  SAME_NEIGHBORHOOD: 'Same neighborhood',
  NEARBY: 'Nearby',
};

/** Chart geometry in SVG units; x is proportional to years after the prediction date. */
const W = 600,
  H = 230,
  LEFT = 62,
  RIGHT = 26,
  TOP = 26,
  BOTTOM = 34;

export interface ValuationChart {
  width: number;
  height: number;
  left: number;
  right: number;
  base: number;
  bands: string[];
  segments: { d: string; scenario: boolean }[];
  dots: {
    x: number;
    y: number;
    tick: string;
    short: string;
    now: boolean;
    anchor: string;
    labelY: number;
  }[];
  yTicks: { y: number; label: string }[];
}

/**
 * Lines join the yearly points only as a visual guide. Each shaded band runs between two points
 * that both have bounds; year 0 pinches to the estimate itself, because its 80%/90% ranges mean
 * something different from the illustrative forecast bounds.
 */
export function valuationChart(points: ValuationPoint[], withRanges = true): ValuationChart | null {
  if (points.length < 2) return null;
  const bounded = (p: ValuationPoint) =>
    !withRanges
      ? null
      : p.years === 0
        ? { low: p.value, high: p.value }
        : p.low !== null && p.high !== null
          ? p
          : null;
  const values = points.flatMap((p) => [
    p.value,
    ...(bounded(p) ? [p.low ?? p.value, p.high ?? p.value] : []),
  ]);
  const min = Math.min(...values),
    max = Math.max(...values);
  const pad = (max - min || max * 0.1 || 1) * 0.08;
  const lo = Math.max(0, min - pad),
    hi = max + pad;
  const first = points[0].years,
    span = Math.max(points[points.length - 1].years - first, 1);
  const x = (years: number) => LEFT + ((years - first) / span) * (W - LEFT - RIGHT);
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * (H - TOP - BOTTOM);
  const f = (n: number) => n.toFixed(1);
  const bands: string[] = [];
  const segments: { d: string; scenario: boolean }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    segments.push({
      d: `M${f(x(a.years))} ${f(y(a.value))} L${f(x(b.years))} ${f(y(b.value))}`,
      scenario: b.scenario,
    });
    const ra = bounded(a),
      rb = bounded(b);
    if (ra && rb)
      bands.push(
        [
          [a.years, ra.low!],
          [b.years, rb.low!],
          [b.years, rb.high!],
          [a.years, ra.high!],
        ]
          .map(([yr, v]) => `${f(x(yr))},${f(y(v))}`)
          .join(' '),
      );
  }
  const dots = points.map((p, i) => {
    const py = y(p.value);
    return {
      x: x(p.years),
      y: py,
      tick: p.years === 0 ? 'Now' : `+${p.years} yr`,
      short: compactMoney(p.value),
      now: p.years === 0,
      anchor: i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
      labelY: py < TOP + 14 ? py + 20 : py - 11,
    };
  });
  const yTicks = [0, 1, 2, 3].map((i) => {
    const v = lo + ((hi - lo) * i) / 3;
    return { y: y(v), label: compactMoney(v) };
  });
  return {
    width: W,
    height: H,
    left: LEFT,
    right: W - RIGHT,
    base: H - BOTTOM,
    bands,
    segments,
    dots,
    yTicks,
  };
}

/**
 * The explained ZentraValue for the property page, read from GET /properties/id/{id}/valuation.
 * Shows only what the server sent: nothing is recalculated and missing values are "unavailable".
 */
@Component({
  selector: 'gz-property-valuation',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink],
  template: `
    @if (valuation(); as v) {
      <section class="pv" aria-label="Value estimate and forecast">
        @if (v.status === 'limited' && reasons().length) {
          <div class="caution" role="note">
            <strong>Limited valuation: read with care</strong>
            <ul>
              @for (r of reasons(); track r.code) {
                <li>{{ r.message }}</li>
              }
            </ul>
          </div>
        }

        @if (!showsEstimate()) {
          <div class="unsupported">
            <h3>No estimate for this property</h3>
            <p class="sub">ZentraValue does not produce an estimate here, for these reasons:</p>
            <ul>
              @for (r of reasons(); track r.code) {
                <li>{{ r.message }}</li>
              } @empty {
                <li>The model does not support this property.</li>
              }
            </ul>
          </div>
        } @else {
          <div class="vf-head">
            <div>
              <div class="eyebrow">ZentraValue estimate</div>
              <div class="bigvalue">
                @if (estimate(); as e) {
                  {{ e | currency: 'USD' : 'symbol' : '1.0-0' }}
                } @else {
                  <span class="muted">Unavailable</span>
                }
              </div>
            </div>
            @if (confidence(); as c) {
              <span class="tag" [class]="c.tone" [title]="c.text">{{ c.label }}</span>
            }
          </div>
          <div class="vf-ranges">
            @for (r of ranges(); track r.label) {
              <div>
                <span>{{ r.label }}</span>
                <strong
                  >{{ r.low | currency: 'USD' : 'symbol' : '1.0-0' }} –
                  {{ r.high | currency: 'USD' : 'symbol' : '1.0-0' }}</strong
                >
              </div>
            }
            @if (v.evidence?.lastSale; as s) {
              <div>
                <span>Last recorded sale</span>
                @if (s.hasSaleHistory && lastSalePrice() !== null) {
                  <strong
                    >{{ lastSalePrice() | currency: 'USD' : 'symbol' : '1.0-0' }}
                    @if (s.date) {
                      <span class="when">{{ s.date | date: 'mediumDate' }}</span>
                    }
                  </strong>
                } @else {
                  <strong class="muted">No recorded sale</strong>
                }
              </div>
            }
          </div>

          <div class="vf-forecast">
            <div class="vf-title">
              <h4>Value forecast</h4>
              @if (predictionDate()) {
                <span class="smalltext muted"
                  >Years after {{ predictionDate() | date: 'mediumDate' }}</span
                >
              }
            </div>
            @if (v.status === 'limited') {
              <p class="caution inline" role="note">Limited valuation: {{ reasonText() }}</p>
            }
            @if (forecasts().length) {
              @if (chart(); as c) {
                <svg
                  class="vf-chart"
                  [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height"
                  role="img"
                  [attr.aria-label]="chartLabel()"
                >
                  @for (t of c.yTicks; track $index) {
                    <line
                      class="grid"
                      [attr.x1]="c.left"
                      [attr.x2]="c.right"
                      [attr.y1]="t.y"
                      [attr.y2]="t.y"
                    />
                    <text class="tick" [attr.x]="c.left - 8" [attr.y]="t.y + 4" text-anchor="end">
                      {{ t.label }}
                    </text>
                  }
                  @for (b of c.bands; track $index) {
                    <polygon class="band" [attr.points]="b" />
                  }
                  @for (s of c.segments; track $index) {
                    <path class="line" [class.scenario]="s.scenario" [attr.d]="s.d" />
                  }
                  @for (d of c.dots; track d.tick) {
                    <circle [attr.cx]="d.x" [attr.cy]="d.y" r="4.5" [class.now]="d.now" />
                    <text
                      class="value"
                      [attr.x]="d.x"
                      [attr.y]="d.labelY"
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
                      {{ d.tick }}
                    </text>
                  }
                </svg>
                <p class="legend smalltext muted">
                  @if (hasRanges()) {
                    <label class="checkbox range-toggle"
                      ><input
                        type="checkbox"
                        [checked]="showRanges()"
                        (change)="showRanges.set(!showRanges())"
                      /><span class="key band"></span> Show illustrative forecast ranges</label
                    >
                  }
                  <span class="key dash"></span> Trend scenario (3 and 7 years). Lines connect the
                  yearly values as a visual guide; they are not monthly predictions.
                </p>
              }
              <div class="vf-cards">
                @for (f of forecasts(); track f.years) {
                  <div class="vf-card">
                    <span class="smalltext muted"
                      >{{ f.label }}
                      @if (f.scenario) {
                        <span class="tag scenario">Trend scenario</span>
                      }
                    </span>
                    <strong>{{ f.value | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
                    @let c = change(f);
                    @if (c !== null) {
                      <span class="chg" [class.up]="c >= 0" [class.down]="c < 0"
                        >{{ c > 0 ? '+' : '' }}{{ c | number: '1.1-1' }}% vs estimate now</span
                      >
                    }
                    @if (f.low !== null && f.high !== null) {
                      <span class="smalltext muted"
                        >Illustrative range {{ f.low | currency: 'USD' : 'symbol' : '1.0-0' }} –
                        {{ f.high | currency: 'USD' : 'symbol' : '1.0-0' }}</span
                      >
                    }
                  </div>
                }
              </div>
            } @else {
              <p class="sub">Forecasts are not available for this property.</p>
            }
          </div>

          @if (v.explanation; as x) {
            <div class="pv-block">
              <h4>What drives this estimate</h4>
              @if (x.summary) {
                <p class="summary">{{ x.summary }}</p>
              }
              @if (factors().length) {
                <ul class="factors">
                  @for (fa of factors(); track fa.code) {
                    <li>
                      <div class="factor-head">
                        <b>{{ fa.label }}</b>
                        @if (fa.pct !== null) {
                          <span class="chg" [class.up]="fa.pct >= 0" [class.down]="fa.pct < 0"
                            >{{ fa.pct > 0 ? '+' : '' }}{{ fa.pct | number: '1.0-1' }}%
                            @if (fa.usd !== null) {
                              · {{ fa.usd > 0 ? '+' : ''
                              }}{{ fa.usd | currency: 'USD' : 'symbol' : '1.0-0' }}
                            }
                          </span>
                        }
                      </div>
                      @if (fa.pct !== null) {
                        <div class="factor-bar" aria-hidden="true">
                          <span
                            [class.down]="fa.pct < 0"
                            [style.width.%]="((fa.pct < 0 ? -fa.pct : fa.pct) / maxPct()) * 50"
                          ></span>
                        </div>
                      }
                      <p class="sub">{{ fa.text }}</p>
                    </li>
                  }
                </ul>
                <p class="smalltext muted">
                  Factor effects overlap, so they are not meant to be added together.
                </p>
              }
              @if (x.note) {
                <p class="vf-note">{{ x.note }}</p>
              }
            </div>
          }

          @if (v.evidence?.comparables; as cmp) {
            <div class="pv-block">
              <h4>Supporting evidence: comparable sales</h4>
              <p class="sub">
                {{
                  cmp.label ||
                    "Selected separately as supporting evidence, not the model's calculation."
                }}
              </p>
              @if (cmp.data?.comparables?.length) {
                <ul class="comps">
                  @for (c of cmp.data!.comparables; track c.candidate.propertyId) {
                    <li>
                      <a [routerLink]="['/property', c.candidate.propertyId]">{{
                        c.candidate.address || 'Folio ' + c.candidate.folio
                      }}</a>
                      <span class="smalltext muted"
                        >{{ matchLabel(c.candidate.matchLevel) }} ·
                        {{ miles(c.candidate.distanceMeters) }}
                        @if (c.candidate.bedrooms !== null) {
                          · {{ c.candidate.bedrooms }} bd
                        }
                        @if (c.candidate.livingAreaSqft) {
                          · {{ c.candidate.livingAreaSqft | number: '1.0-0' }} sqft
                        }
                      </span>
                      <strong
                        >{{ c.candidate.salePrice | currency: 'USD' : 'symbol' : '1.0-0' }}
                        <span class="when">{{
                          c.candidate.saleDate | date: 'mediumDate'
                        }}</span></strong
                      >
                    </li>
                  }
                </ul>
                @if (cmp.data!.warnings.length) {
                  <details class="smalltext muted">
                    <summary>How these sales were selected</summary>
                    <ul>
                      @for (w of cmp.data!.warnings; track $index) {
                        <li>{{ w }}</li>
                      }
                    </ul>
                  </details>
                }
              } @else if (cmp.status === 'UNAVAILABLE' || !cmp.data) {
                <p class="sub">Supporting comparable sales are unavailable right now.</p>
              } @else {
                <p class="sub">No comparable sales matched the search for this property.</p>
              }
            </div>
          }
        }

        @for (n of v.notes ?? []; track $index) {
          <p class="vf-note">{{ n }}</p>
        }

        @if (v.method; as m) {
          <div class="pv-block method">
            <h4>Method</h4>
            @if (m.valuationMethod) {
              <div class="lineitem">
                <span>Valuation method</span><b>{{ m.valuationMethod }}</b>
              </div>
            }
            @if (m.modelVersion) {
              <div class="lineitem">
                <span>Model version</span><b>{{ m.modelVersion }}</b>
              </div>
            }
            @if (m.predictionDate) {
              <div class="lineitem">
                <span>Estimated on</span><b>{{ m.predictionDate | date: 'mediumDate' }}</b>
              </div>
            }
            @if (m.dataThrough) {
              <div class="lineitem">
                <span>Latest sale in model data</span
                ><b>{{ m.dataThrough | date: 'mediumDate' }}</b>
              </div>
            }
            @if (m.createdAt) {
              <div class="lineitem">
                <span>Scoring run completed</span><b>{{ m.createdAt | date: 'medium' }}</b>
              </div>
            }
            @if (v.reproducibility?.runId || v.reproducibility?.inputHash) {
              <p class="sourcedata">
                @if (v.reproducibility?.runId) {
                  Run {{ v.reproducibility?.runId }}
                }
                @if (v.reproducibility?.inputHash) {
                  · input {{ v.reproducibility?.inputHash }}
                }
              </p>
            }
          </div>
        }
        @if (showsEstimate()) {
          <p class="sourcedata">
            Estimates and forecasts are model outputs, not appraisals. The 80% and 90% ranges apply
            to the current estimate only.
          </p>
        }
      </section>
    }
  `,
  styles: `
    .pv {
      display: grid;
      gap: 18px;
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
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
      align-content: start;
    }
    .vf-ranges span {
      font-size: 12px;
      color: var(--muted);
    }
    .when {
      display: block;
      font-weight: 400;
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
    .vf-forecast,
    .pv-block {
      display: grid;
      gap: 12px;
    }
    .pv-block {
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }
    .vf-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 10px;
    }
    .vf-card strong {
      font-size: 18px;
    }
    .tag.scenario {
      margin-left: 4px;
      padding: 2px 6px;
      font-size: 10px;
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
    .caution {
      margin: 0;
      padding: 12px 14px;
      border-radius: var(--radius);
      border: 1px solid var(--warning-line);
      border-left: 3px solid #c08a2b;
      background: var(--warning-bg);
      color: #5e4514;
      font-size: 13px;
      line-height: 1.5;
    }
    .caution ul {
      margin: 6px 0 0;
      padding-left: 18px;
    }
    .caution.inline {
      padding: 8px 12px;
    }
    .unsupported h3 {
      margin: 0 0 6px;
    }
    .unsupported ul {
      margin: 10px 0 0;
      padding-left: 18px;
      font-size: 14px;
      line-height: 1.6;
    }
    .vf-chart {
      width: 100%;
      height: auto;
      display: block;
    }
    .vf-chart .grid {
      stroke: var(--line);
      stroke-width: 1;
    }
    .vf-chart .band {
      fill: #ad724c1f;
      stroke: none;
    }
    .vf-chart .line {
      fill: none;
      stroke: var(--copper);
      stroke-width: 2.5;
      stroke-linecap: round;
    }
    .vf-chart .line.scenario {
      stroke-dasharray: 6 5;
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
    .legend {
      margin: 0;
      line-height: 1.7;
    }
    .key {
      display: inline-block;
      width: 18px;
      height: 10px;
      margin: 0 4px 0 2px;
      vertical-align: middle;
    }
    .key.band {
      background: #ad724c33;
      border-radius: 2px;
    }
    .range-toggle {
      display: inline-flex;
      gap: 6px;
      margin-right: 12px;
      font-size: inherit;
    }
    .key.dash {
      height: 0;
      border-top: 2.5px dashed var(--copper);
      margin-left: 10px;
    }
    .summary {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .factors,
    .comps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
    }
    .factors li {
      display: grid;
      gap: 5px;
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
    }
    .factor-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 14px;
    }
    .factor-bar {
      position: relative;
      height: 6px;
      border-radius: 3px;
      background: #f0f3f4;
    }
    .factor-bar::before {
      content: '';
      position: absolute;
      left: 50%;
      top: -2px;
      bottom: -2px;
      width: 1px;
      background: #c6cfd5;
    }
    .factor-bar span {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      border-radius: 3px;
      background: var(--green);
    }
    .factor-bar span.down {
      left: auto;
      right: 50%;
      background: var(--danger);
    }
    .comps li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'addr price' 'meta price';
      column-gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
      font-size: 14px;
    }
    .comps a {
      grid-area: addr;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .comps .smalltext {
      grid-area: meta;
    }
    .comps strong {
      grid-area: price;
      text-align: right;
    }
    details ul {
      margin: 6px 0 0;
      padding-left: 18px;
      line-height: 1.6;
    }
    summary {
      cursor: pointer;
    }
    .vf-note {
      margin: 0;
      padding: 8px 12px;
      border-radius: 8px;
      background: #f6efe9;
      font-size: 13px;
    }
    .method .lineitem b {
      text-align: right;
    }
  `,
})
export class PropertyValuationView {
  valuation = input<PropertyValuation | null>(null);

  showsEstimate = computed(() => valuationShowsEstimate(this.valuation()));
  reasons = computed(() => this.valuation()?.reasons ?? []);
  reasonText = computed(() =>
    this.reasons()
      .map((r) => r.message)
      .join(' '),
  );
  estimate = computed(() => amount(this.valuation()?.estimate?.value));
  lastSalePrice = computed(() => amount(this.valuation()?.evidence?.lastSale?.price));
  predictionDate = computed(() => this.valuation()?.method?.predictionDate ?? null);
  confidence = computed(
    () => CONFIDENCE[(this.valuation()?.estimate?.confidence ?? '').toLowerCase()] ?? null,
  );
  ranges = computed(() => {
    const e = this.valuation()?.estimate;
    return (
      [
        ['Likely range (80%)', e?.range80],
        ['Wider range (90%)', e?.range90],
      ] as const
    )
      .map(([label, r]) => ({ label, low: amount(r?.low), high: amount(r?.high) }))
      .filter((r) => r.low !== null && r.high !== null);
  });
  points = computed(() => valuationPoints(this.valuation()));
  forecasts = computed(() => this.points().filter((p) => p.years > 0));
  /** The wide illustrative bounds set the scale; hiding them rescales the chart to the values. */
  showRanges = signal(true);
  hasRanges = computed(() => this.forecasts().some((f) => f.low !== null && f.high !== null));
  chart = computed(() => valuationChart(this.points(), this.showRanges()));
  chartLabel = computed(() =>
    [
      'Value forecast:',
      ...this.points().map((p) => `${p.label.toLowerCase()} ${compactMoney(p.value)}`),
    ].join(', '),
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
  change(f: ValuationPoint) {
    const now = this.estimate();
    return now && now > 0 ? ((f.value - now) / now) * 100 : null;
  }
  matchLabel(level: string | null | undefined) {
    return (level && MATCH_LEVELS[level]) || 'Comparable';
  }
  miles(meters: number | null | undefined) {
    return metersToMiles(meters);
  }
}
