import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { RequestStatus } from '../../shared/components/request-status';
import { RECORD_KIT } from '../../shared/components/record';
import { ScoreFactors, splitVersionNotes } from '../../shared/components/score-factors';
import { formatLocalDate, formatRecordDate } from '../../shared/data/format';
import { PropertyInsightsActions as A } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';

/**
 * The property's opportunity score (GET /properties/id/{id}/opportunity-score): every factor of the
 * scoring version with its evidence and points, or why it is unavailable. Missing evidence adds no
 * points and the coverage says how much of the score could be measured at all.
 */
@Component({
  selector: 'gz-property-opportunity',
  imports: [DecimalPipe, RequestStatus, ScoreFactors, ...RECORD_KIT],
  template: `
    <gz-record-section heading="Opportunity score">
      <p class="op-lede">
        Ranks the evidence stored today: forecasts, market outlook and valuation confidence. A
        research aid, not a recommendation to buy.
      </p>
      <gz-request-status
        [loading]="score().loading && !score().value"
        loadingText="Scoring this property…"
        [error]="score().error"
        retryLabel="Retry score"
        (retry)="load()"
      />
      @if (score().value; as s) {
        @if (s.status === 'SCORED' && s.score !== null) {
          <p class="op-score">
            <b>{{ s.score | number: '1.0-1' }}</b> of {{ s.maxScore }}
          </p>
          <p class="op-coverage">
            <span class="covbar" aria-hidden="true"
              ><i [style.width.%]="share(s.coveragePercent, s.maxScore)"></i
            ></span>
            The evidence on record covers {{ s.coveragePercent | number: '1.0-0' }} of
            {{ s.maxScore }} points, so the score can't go higher than that.
          </p>
        } @else {
          <p class="op-caution" role="note">This property can't be scored yet.</p>
          <ul class="reason-list">
            @for (r of s.reasons; track r.code) {
              <li>{{ r.message }}</li>
            }
          </ul>
        }
        <gz-score-factors [factors]="s.factors" />
        <p class="table-note">
          @if (s.valuation; as v) {
            From the {{ v.valuationStatus }} valuation
            @if (day(v.dataThrough); as d) {
              with sales through {{ d }}
            }
            ·
          }
          Scored {{ localDay(s.scoredAt) }}.
        </p>
        <!-- Backend notes that name the scoring version go under Method (DESIGN.md §9). -->
        @let notes = splitNotes(s.notes, s.scoreVersion);
        @for (n of notes.plain; track n) {
          <p class="table-note">{{ n }}</p>
        }
        <details class="op-method">
          <summary>Method</summary>
          <gz-record-group>
            <div gz-record-row label="Scoring version">{{ s.scoreVersion }}</div>
            @if (s.valuation?.modelVersion; as m) {
              <div gz-record-row label="Valuation model">{{ m }}</div>
            }
            @if (s.valuation?.runId; as run) {
              <div gz-record-row label="Valuation run">{{ run }}</div>
            }
          </gz-record-group>
          @for (n of notes.method; track n) {
            <p class="table-note">{{ n }}</p>
          }
        </details>
      }
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .op-lede {
      margin: 0 0 var(--sp-12);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .op-score {
      margin: 0;
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .op-score b {
      font-size: var(--fs-page);
      line-height: var(--lh-page);
      font-weight: 600;
      color: var(--ink);
    }
    .op-coverage {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      margin: var(--sp-4) 0 var(--sp-12);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .op-caution {
      margin: 0 0 var(--sp-4);
      font-size: var(--fs-body);
      color: var(--attention);
    }
    .reason-list {
      margin: 0 0 var(--sp-12);
      padding-left: 18px;
      color: var(--ink-2);
      font-size: var(--fs-cell);
    }
    .op-method {
      margin-top: var(--sp-12);
      font-size: var(--fs-cell);
    }
    .op-method summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
    .op-method gz-record-group {
      max-width: 640px;
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
  constructor() {
    effect(() => {
      this.propertyId();
      untracked(() => this.load());
    });
  }
  load() {
    this.store.dispatch(A.loadOpportunity({ propertyId: this.propertyId() }));
  }
  splitNotes = splitVersionNotes;
  /** A calendar date (dataThrough), as written. */
  day(value: string | null | undefined) {
    return formatRecordDate(value);
  }
  /** An instant (scoredAt): the viewer's own day, as the record pane writes it (DESIGN.md §13). */
  localDay(value: string | null | undefined) {
    return formatLocalDate(value);
  }
  share(part: number, whole: number) {
    return whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;
  }
}
