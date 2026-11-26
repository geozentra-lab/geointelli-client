import { Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  PropertyValuation,
  amount,
  valuationShowsEstimate,
} from '../../core/models/property-valuation';
import { formatConfidence, formatRecordDate, isLowConfidence } from '../data/format';
import { RECORD_KIT } from './record';

/** The 80% band and the estimate's tick on the range track, as percentages of its width. */
export interface RangeGeometry {
  low: number;
  high: number;
  left: number;
  right: number;
  tick: number | null;
}

/**
 * Where the 80% range and the estimate sit on the track (DESIGN.md §9). The scale is the 90% range
 * when the backend sends one that contains the 80% range; otherwise the 80% range widened by 25% on
 * each side. Positions are rounded to 0.1%. Null when there is no usable 80% range.
 */
export function rangeGeometry(
  value: number | null,
  low: number | null,
  high: number | null,
  low90: number | null = null,
  high90: number | null = null,
): RangeGeometry | null {
  if (low === null || high === null || !(high > low)) return null;
  let lo: number, hi: number;
  if (low90 !== null && high90 !== null && low90 <= low && high90 >= high && high90 > low90) {
    lo = low90;
    hi = high90;
  } else {
    const pad = (high - low) / 4;
    lo = low - pad;
    hi = high + pad;
  }
  if (value !== null) {
    lo = Math.min(lo, value);
    hi = Math.max(hi, value);
  }
  const pos = (x: number) => Math.round(((x - lo) / (hi - lo)) * 1000) / 10;
  return {
    low,
    high,
    left: pos(low),
    right: Math.round((100 - pos(high)) * 10) / 10,
    tick: value === null ? null : pos(value),
  };
}

/**
 * ZentraValue, the signature element (DESIGN.md §9): one component wherever a ZentraValue appears.
 *
 *   <gz-zentra-value [valuation]="v" size="page" />   the property aside: 40 px figure, forecast rows
 *   <gz-zentra-value [valuation]="v" />               panes and the live-map dialog: 32 px
 *   <gz-zentra-value [valuation]="v" layout="line" />  one line above the comparables table
 *
 * Label row (ZentraValue, or "Limited estimate", and the date), the figure, the 80% range band with
 * the estimate's tick, then the confidence and the date the sales data runs to. A limited estimate
 * gives the backend's reasons under the confidence line; with no estimate the figure and the range
 * become the Unavailable marker with the backend's reason. Nothing is recalculated.
 */
@Component({
  selector: 'gz-zentra-value',
  imports: [CurrencyPipe, DecimalPipe, ...RECORD_KIT],
  template: `
    @if (layout() === 'line') {
      <p class="zv-line">
        <span class="zv-line-label">{{ heading() }}</span>&ngsp;
        @if (value() !== null) {
          <b class="zv-line-fig">{{ value() | currency: 'USD' : 'symbol' : '1.0-0' }}</b>&ngsp;
          @if (range(); as r) {
            <span class="num"
              >80% range {{ r.low | currency: 'USD' : 'symbol' : '1.0-0' }} to
              {{ r.high | currency: 'USD' : 'symbol' : '1.0-0' }}</span
            >&ngsp;
          }
          <span [class.attention]="lowConfidence()">{{ confidence() }}</span>
        } @else {
          <span class="na zv-line-na"><span class="na-word">Unavailable</span></span>&ngsp;
          <span class="zv-line-why">{{ reasonText() }}</span>
        }
      </p>
    } @else {
      <div class="zv" [class.zv-page]="size() === 'page'">
        <div class="zv-label">
          <span>{{ heading() }}</span>&ngsp;
          @if (date(); as d) {
            <span class="num">{{ d }}</span>
          }
        </div>
        @if (value() !== null) {
          <div class="zv-fig">{{ value() | currency: 'USD' : 'symbol' : '1.0-0' }}</div>
          @if (range(); as r) {
            <div class="range-track" aria-hidden="true">
              <i [style.left.%]="r.left" [style.right.%]="r.right"></i>
              @if (r.tick !== null) {
                <i class="pt" [style.left.%]="r.tick"></i>
              }
            </div>
            <div class="range-ends num">
              <b>{{ r.low | currency: 'USD' : 'symbol' : '1.0-0' }}</b>&ngsp;<span>80% range</span
              >&ngsp;<b>{{ r.high | currency: 'USD' : 'symbol' : '1.0-0' }}</b>
            </div>
          } @else {
            <div class="zv-gap na">
              <span class="na-word">Unavailable</span>
              <span class="na-why">No 80% range was returned with this estimate.</span>
            </div>
          }
          <p class="zv-conf">
            <span [class.attention]="lowConfidence()">{{ confidence() }}</span>
            @if (dataThrough(); as d) {
              <span class="muted"> from sales through {{ d }}</span>
            }
          </p>
          @if (limited()) {
            @for (r of reasons(); track $index) {
              <p class="zv-limit">{{ r }}</p>
            }
          }
        } @else {
          <div class="zv-na na">
            <span class="na-word">Unavailable</span>
            @for (r of noEstimateReasons(); track $index) {
              <span class="na-why">{{ r }}</span>
            }
          </div>
        }
        @if (details() && value() !== null) {
          <gz-record-group heading="Next 12 months">
            @if (forecast(); as f) {
              <div gz-record-row label="Forecast" [numeric]="true">
                {{ f.value | currency: 'USD' : 'symbol' : '1.0-0' }}
                @if (f.change !== null) {
                  <span class="muted">({{ f.change > 0 ? '+' : '' }}{{ f.change | number: '1.1-1' }}%)</span>
                }
              </div>
              @if (f.low !== null && f.high !== null) {
                <div gz-record-row label="Range (illustrative)" [numeric]="true">
                  {{ f.low | currency: 'USD' : 'symbol' : '1.0-0' }} to
                  {{ f.high | currency: 'USD' : 'symbol' : '1.0-0' }}
                </div>
              }
            } @else {
              <div
                gz-record-row
                label="Forecast"
                [missing]="true"
                reason="No 12-month forecast was returned"
              ></div>
            }
          </gz-record-group>
          @if (lastSale(); as s) {
            <gz-record-group>
              <div gz-record-row label="Last sale" [numeric]="true">
                @if (s.price !== null) {
                  {{ s.price | currency: 'USD' : 'symbol' : '1.0-0' }}{{ s.date ? ', ' + s.date : '' }}
                } @else {
                  <span class="muted">None on record</span>
                }
              </div>
            </gz-record-group>
          }
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .zv-label {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-12);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    /* Proportional figures for a standalone number (DESIGN.md §3). */
    .zv-fig {
      margin: 6px 0 var(--sp-12);
      font-size: var(--fs-record);
      line-height: var(--lh-record);
      font-weight: 600;
      letter-spacing: var(--track-32);
      font-variant-numeric: proportional-nums lining-nums;
      overflow-wrap: anywhere;
    }
    .zv-page .zv-fig {
      font-size: var(--fs-figure);
      line-height: var(--lh-figure);
    }
    .range-track {
      position: relative;
      height: 18px;
      margin: 0 0 4px;
    }
    .range-track::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 8px;
      height: 2px;
      background: var(--rule-strong);
    }
    .range-track i {
      position: absolute;
      top: 3px;
      height: 12px;
      background: var(--copper-band);
      border-left: 2px solid var(--copper);
      border-right: 2px solid var(--copper);
    }
    .range-track i.pt {
      top: 0;
      width: 2px;
      height: 18px;
      margin-left: -1px;
      background: var(--ink);
      border: 0;
    }
    .range-ends {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-8);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .range-ends b {
      color: var(--ink);
      font-weight: 500;
    }
    .zv-conf {
      margin: var(--sp-12) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .zv-limit {
      margin: var(--sp-4) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--attention);
      max-width: var(--measure);
    }
    .zv-na,
    .zv-gap {
      display: block;
      margin-top: var(--sp-8);
      padding: var(--sp-12);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .zv-na .na-why + .na-why {
      margin-top: var(--sp-4);
    }
    gz-record-group {
      margin-top: var(--sp-8);
    }
    .zv-line {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px var(--sp-16);
      margin: 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .zv-line-label {
      font-weight: 500;
      color: var(--ink);
    }
    .zv-line-fig {
      font-size: var(--fs-section);
      font-weight: 600;
      color: var(--ink);
    }
    .zv-line-na {
      padding: 2px 8px;
    }
    @media (max-width: 700px) {
      .zv-page .zv-fig {
        font-size: var(--fs-record);
        line-height: var(--lh-record);
      }
    }
  `,
})
export class ZentraValue {
  readonly valuation = input<PropertyValuation | null>(null);
  /** 'page': the 40 px figure of the property aside; 'pane': 32 px in panes and dialogs. */
  readonly size = input<'page' | 'pane'>('pane');
  readonly layout = input<'block' | 'line'>('block');
  /** The 12-month forecast and the last sale, as ruled rows under the block. */
  readonly details = input(true);

  readonly shows = computed(() => valuationShowsEstimate(this.valuation()));
  readonly limited = computed(() => this.valuation()?.status === 'limited');
  readonly heading = computed(() => (this.limited() ? 'Limited estimate' : 'ZentraValue'));
  /** The estimate, only when the backend calls it supported or limited and sent a number. */
  readonly value = computed(() =>
    this.shows() ? amount(this.valuation()?.estimate?.value) : null,
  );
  readonly date = computed(() =>
    this.value() === null ? null : formatRecordDate(this.valuation()?.method?.predictionDate),
  );
  readonly dataThrough = computed(() => formatRecordDate(this.valuation()?.method?.dataThrough));
  readonly range = computed(() => {
    const e = this.valuation()?.estimate;
    return rangeGeometry(
      this.value(),
      amount(e?.range80?.low),
      amount(e?.range80?.high),
      amount(e?.range90?.low),
      amount(e?.range90?.high),
    );
  });
  /** DESIGN.md §9. The valuation endpoint sends the band without a score: "Medium confidence". */
  readonly confidence = computed(() => formatConfidence(null, this.valuation()?.estimate?.confidence));
  readonly lowConfidence = computed(() => isLowConfidence(this.valuation()?.estimate?.confidence));
  readonly reasons = computed(() =>
    (this.valuation()?.reasons ?? []).map((r) => r.message).filter(Boolean),
  );
  /** Why there is no figure: the backend's reasons, or what is missing from its answer. */
  readonly noEstimateReasons = computed(() => {
    const v = this.valuation();
    if (!v) return ['No valuation is on record for this property.'];
    if (this.shows()) return ['No estimate value was returned.'];
    return this.reasons().length
      ? this.reasons()
      : ['The model does not produce an estimate for this property.'];
  });
  readonly reasonText = computed(() => this.noEstimateReasons().join(' '));
  readonly forecast = computed(() => {
    const f = this.valuation()?.forecasts?.oneYear;
    const value = amount(f?.value);
    if (value === null) return null;
    const now = this.value();
    return {
      value,
      low: amount(f?.low),
      high: amount(f?.high),
      change: now ? ((value - now) / now) * 100 : null,
    };
  });
  /** From the valuation's evidence; omitted when the backend sent none. */
  readonly lastSale = computed(() => {
    const s = this.valuation()?.evidence?.lastSale;
    if (!s) return null;
    const price = s.hasSaleHistory ? amount(s.price) : null;
    return { price, date: price === null ? null : formatRecordDate(s.date) };
  });
}
