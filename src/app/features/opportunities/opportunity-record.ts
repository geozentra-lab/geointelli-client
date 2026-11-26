import { Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { OpportunityItem } from '../../core/models/opportunity';
import { RECORD_KIT } from '../../shared/components/record';
import { ScoreFactors } from '../../shared/components/score-factors';
import { formatConfidenceValue, formatLocalDate, formatRecordDate } from '../../shared/data/format';
import { confidenceBand, confidenceLow, confidenceScore, signedPercent } from './opportunity-rows';

/**
 * One scored property in the Opportunities record pane: the score and how much of it the evidence
 * on record could reach, every factor as a bar of points (missing ones hatched), the valuation the
 * score used, and the scoring version under Method (DESIGN.md §9: no version strings outside it).
 * Everything comes from the row of GET /opportunities as sent; nothing is recalculated.
 */
@Component({
  selector: 'gz-opportunity-record',
  imports: [CurrencyPipe, DecimalPipe, ScoreFactors, ...RECORD_KIT],
  template: `
    @let o = item();
    <gz-record-section class="flush" heading="Score">
      <p class="or-score">
        <b>{{ o.score | number: '1.0-1' }}</b> of {{ o.maxScore }}
      </p>
      <p class="or-coverage">
        <span class="covbar" aria-hidden="true"><i [style.width.%]="coverageShare()"></i></span>
        The evidence on record covers {{ o.coveragePercent | number: '1.0-0' }} of
        {{ o.maxScore }} points, so the score can't go higher than that.
      </p>
      <p class="or-caution">A research aid that ranks stored evidence, not advice to buy.</p>
    </gz-record-section>

    <gz-record-section class="flush" heading="Factors">
      <gz-score-factors
        [factors]="o.factors"
        [compact]="true"
        [caption]="'Opportunity score factors for ' + title()"
      />
    </gz-record-section>

    <!-- Every missing value says why under the word: the reasons differ, so no shared note. -->
    <gz-record-section class="flush" heading="Valuation the score used">
      <gz-record-group>
        <div
          gz-record-row
          label="ZentraValue"
          [numeric]="true"
          [missing]="o.estimatedValue === null"
          [showReason]="true"
          reason="No estimate was stored with this score."
        >
          {{ o.estimatedValue | currency: 'USD' : 'symbol' : '1.0-0' }}
        </div>
        <!-- DESIGN.md §9: an estimate never appears without its range. Scores don't store it. -->
        @if (o.estimatedValue !== null) {
          <div
            gz-record-row
            label="80% range"
            [missing]="true"
            [showReason]="true"
            reason="Opportunity scores don't store the range. The property record shows the estimate with its range and confidence."
          ></div>
        }
        <div
          gz-record-row
          label="Confidence"
          [numeric]="true"
          [missing]="confidence() === null"
          [showReason]="true"
          reason="The score's valuation-confidence factor has no value."
        >
          <span [class.attention]="lowConfidence()">{{ confidence() }}</span>
        </div>
        <div
          gz-record-row
          label="Next 12 months"
          [numeric]="true"
          [missing]="o.forecastGrowth1yPct === null"
          [showReason]="true"
          reason="No one-year forecast was stored with this score."
        >
          {{ forecast() }}
        </div>
        <div
          gz-record-row
          label="Sales through"
          [numeric]="true"
          [missing]="!dataThrough()"
          [showReason]="true"
          reason="The valuation's data date was not stored with this score."
        >
          {{ dataThrough() }}
        </div>
        <div
          gz-record-row
          label="Scored"
          [numeric]="true"
          [missing]="!scoredAt()"
          [showReason]="true"
          reason="The scoring date was not sent."
        >
          {{ scoredAt() }}
        </div>
      </gz-record-group>
    </gz-record-section>

    <details class="or-method">
      <summary>Method</summary>
      <gz-record-group>
        @if (scoreVersion()) {
          <div gz-record-row label="Scoring version">{{ scoreVersion() }}</div>
        }
        <div
          gz-record-row
          label="Valuation run"
          [missing]="!o.valuationRunId"
          [showReason]="true"
          reason="Not stored with this score."
        >
          {{ o.valuationRunId }}
        </div>
      </gz-record-group>
    </details>
  `,
  styles: `
    :host {
      display: block;
    }
    gz-record-section + gz-record-section {
      margin-top: var(--sp-8);
    }
    .or-score {
      margin: var(--sp-4) 0 0;
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .or-score b {
      font-size: var(--fs-page);
      line-height: var(--lh-page);
      font-weight: 600;
      letter-spacing: var(--track-24);
      color: var(--ink);
    }
    .or-coverage {
      display: flex;
      align-items: baseline;
      gap: var(--sp-8);
      margin: var(--sp-4) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .or-coverage .covbar {
      position: relative;
      top: -1px;
    }
    .or-caution {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .or-method {
      margin-top: var(--sp-16);
      font-size: var(--fs-cell);
    }
    .or-method summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
  `,
})
export class OpportunityRecord {
  readonly item = input.required<OpportunityItem>();
  /** The page's scoring version (GET /opportunities sends one for every row). */
  readonly scoreVersion = input('');
  readonly title = input('this property');

  readonly coverageShare = computed(() => {
    const o = this.item();
    return o.maxScore > 0 ? Math.min(100, Math.max(0, (o.coveragePercent / o.maxScore) * 100)) : 0;
  });
  /**
   * "78 of 100 · Medium" (DESIGN.md §9) from the score's "Valuation confidence" factor (opportunity
   * rows carry no confidence field); null when the factor has no value (the row is then Unavailable).
   */
  readonly confidence = computed(() => {
    const o = this.item();
    return confidenceScore(o) === null
      ? null
      : formatConfidenceValue(confidenceScore(o), confidenceBand(o));
  });
  readonly lowConfidence = computed(() => confidenceLow(this.item()));
  readonly forecast = computed(() => signedPercent(this.item().forecastGrowth1yPct));
  readonly dataThrough = computed(() => formatRecordDate(this.item().valuationDataThrough));
  /** scoredAt is an instant: the viewer's own day. */
  readonly scoredAt = computed(() => formatLocalDate(this.item().scoredAt));
}
