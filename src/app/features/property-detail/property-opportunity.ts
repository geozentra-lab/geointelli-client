import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { RequestStatus } from '../../shared/components/request-status';
import { OpportunityFactor } from '../../core/models/opportunity';
import { labelFor } from '../../shared/pipes/label.pipe';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';

/**
 * The property's opportunity score (GET /properties/id/{id}/opportunity-score): every factor of the
 * scoring version with its evidence and points, or why it is unavailable. Missing evidence adds no
 * points and the coverage says how much of the score could be measured at all.
 */
@Component({
  selector: 'gz-property-opportunity',
  imports: [DatePipe, DecimalPipe, RequestStatus],
  template: `
    <div class="panel section">
      <div class="panelhead">
        <div>
          <h3>Opportunity score</h3>
          <p class="smalltext muted">
            Ranks the evidence stored today: forecasts, market outlook and valuation confidence
          </p>
        </div>
        @if (score().value; as s) {
          <span class="tag">{{ s.scoreVersion }}</span>
        }
      </div>
      <gz-request-status
        [loading]="score().loading && !score().value"
        loadingText="Scoring this property…"
        [error]="score().error"
        retryLabel="Retry score"
        (retry)="load()"
      />
      @if (score().value; as s) {
        @if (s.status === 'SCORED' && s.score !== null) {
          <div class="score-head">
            <p class="score-value">
              {{ s.score | number: '1.0-1' }}<span class="muted"> / {{ s.maxScore }}</span>
            </p>
            <div class="score-meter" role="img" [attr.aria-label]="meterLabel()">
              <span class="earned" [style.width.%]="(s.score / s.maxScore) * 100"></span>
              <span
                class="coverage"
                [style.width.%]="(s.coveragePercent / s.maxScore) * 100"
              ></span>
            </div>
            <p class="smalltext muted">
              The evidence available covers {{ s.coveragePercent | number: '1.0-0' }} of
              {{ s.maxScore }} points, so the score cannot go higher than that.
            </p>
          </div>
        } @else {
          <p class="insight warning">This property cannot be scored yet.</p>
          <ul class="reason-list">
            @for (r of s.reasons; track r.code) {
              <li>{{ r.message }}</li>
            }
          </ul>
        }
        <div class="tablewrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Factor</th>
                <th scope="col">Evidence</th>
                <th scope="col" class="num">Points</th>
              </tr>
            </thead>
            <tbody>
              @for (f of s.factors; track f.code) {
                <tr [class.unavailable]="f.status !== 'AVAILABLE'">
                  <td>
                    <b>{{ f.label }}</b>
                    <div class="smalltext muted">{{ category(f.category) }}</div>
                  </td>
                  <td>
                    @if (f.status === 'AVAILABLE') {
                      <b>{{ signal(f) }}</b>
                    } @else {
                      <span class="tag">Unavailable</span>
                    }
                    <div class="smalltext muted">{{ f.explanation }}</div>
                  </td>
                  <td class="num">
                    {{ f.points === null ? '—' : (f.points | number: '1.0-2') }}
                    <span class="smalltext muted">/ {{ f.weight }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="sourcedata">
          @if (s.valuation; as v) {
            From the {{ v.valuationStatus }} valuation, model {{ v.modelVersion }}, data through
            {{ v.dataThrough | date: 'mediumDate' }} ·
          }
          Scored {{ s.scoredAt | date: 'medium' }}. A research aid, not a recommendation to buy.
        </p>
        @for (n of s.notes; track n) {
          <p class="sourcedata">{{ n }}</p>
        }
      }
    </div>
  `,
  styles: `
    .score-head {
      display: grid;
      gap: 8px;
      margin: 6px 0 16px;
    }
    .score-value {
      margin: 0;
      font:
        700 30px Manrope,
        sans-serif;
      font-variant-numeric: tabular-nums;
    }
    .score-value .muted {
      font-size: 16px;
    }
    .score-meter {
      position: relative;
      height: 10px;
      border-radius: 99px;
      background: #f0f2f3;
      overflow: hidden;
    }
    .score-meter span {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 99px;
    }
    .score-meter .coverage {
      background: #e8d5c6;
    }
    .score-meter .earned {
      z-index: 1;
      background: var(--copper);
    }
    tr.unavailable b {
      color: var(--muted);
    }
    .num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .reason-list {
      margin: 0 0 14px;
      padding-left: 18px;
      color: var(--ink-2);
      font-size: 13px;
    }
  `,
})
export class PropertyOpportunity {
  private store = inject(Store);
  propertyId = input.required<number>();
  private insights = this.store.selectSignal(selectPropertyInsights);
  score = computed(() =>
    this.insights().propertyId === this.propertyId()
      ? this.insights().opportunity
      : { value: null, loading: true, error: null },
  );
  meterLabel = computed(() => {
    const s = this.score().value;
    return s && s.score !== null
      ? `Score ${s.score} of ${s.maxScore}; evidence covers ${s.coveragePercent} points`
      : '';
  });
  constructor() {
    effect(() => {
      this.propertyId();
      untracked(() => this.load());
    });
  }
  load() {
    this.store.dispatch(A.loadOpportunity({ propertyId: this.propertyId() }));
  }
  category = labelFor;
  /** PERCENT evidence with its sign; SCORE evidence out of 100. */
  signal(f: OpportunityFactor) {
    if (f.signal === null) return '—';
    if (f.signalUnit === 'PERCENT') return (f.signal > 0 ? '+' : '') + f.signal.toFixed(2) + '%';
    if (f.signalUnit === 'SCORE') return Math.round(f.signal) + ' of 100';
    return String(f.signal);
  }
}
