import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { RequestStatus } from '../../shared/components/request-status';
import { PropertyRef } from '../../shared/components/property-ref';
import { formatLocalDate } from '../../shared/data/format';
import { AlertRuleDTO, AlertRuleUpdate, Cadence, ValuationChangeDirection } from '../../core/models/api';
import { alertsActions as A } from '../../store/alerts/alerts.actions';
import { DIRECTIONS, checkStatus, criteria, errorSentence, eventLabel } from './alert-words';

/**
 * An alert rule in the record pane (DESIGN.md §5 Register): the rule (what it watches for, what it
 * follows, and one form for its name, how often it is checked and, for ZentraValue rules, the
 * change that notifies), then its checks as the monitor reports them, in words. The pane's header
 * holds Pause or Resume, Check now and Delete.
 */
@Component({
  selector: 'gz-alert-record',
  imports: [FormsModule, RequestStatus, PropertyRef, ...RECORD_KIT],
  template: `
    @let a = rule();
    <gz-record-section heading="Rule">
      <gz-record-group>
        <div gz-record-row label="Watches for">{{ eventLabel(a.eventType) }}</div>
        @if (a.eventType === 'VALUATION_CHANGED') {
          <div gz-record-row label="Notifies when it">{{ criteria(a) }}</div>
        }
        <div gz-record-row label="Follows">
          @if (a.savedSearchId) {
            {{ follows() }}
          } @else if (a.propertyId) {
            <gz-property-ref [propertyId]="a.propertyId" />
          }
        </div>
        <div gz-record-row label="Created">{{ day(a.createdAt) }}</div>
      </gz-record-group>
      @if (a.eventType === 'LISTING_PRICE_CHANGED') {
        <p class="ar-note">
          Listing prices aren’t available yet; this rule starts checking once they are. Assessed
          values are not listing prices.
        </p>
      }

      <form class="ar-form" (ngSubmit)="save()" aria-label="Change this rule">
        <div class="formfield">
          <label [for]="id + '-name'">Name</label>
          <input [id]="id + '-name'" name="name" maxlength="120" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        </div>
        <div class="formfield">
          <label [for]="id + '-cadence'">Checked</label>
          <select [id]="id + '-cadence'" name="cadence" [ngModel]="cadence()" (ngModelChange)="cadence.set($event)">
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </div>
        @if (a.eventType === 'VALUATION_CHANGED') {
          <div class="formfield">
            <label [for]="id + '-min'">Moves at least (%)</label>
            <input [id]="id + '-min'" name="minimum" type="number" min="0" max="100000" step="0.1"
              [attr.aria-describedby]="id + '-min-hint'"
              [ngModel]="minimum()" (ngModelChange)="minimum.set($event === '' ? null : $event)" />
            <p class="smalltext muted" [id]="id + '-min-hint'">0 notifies on any change.</p>
          </div>
          <div class="formfield">
            <label [for]="id + '-dir'">Direction</label>
            <select [id]="id + '-dir'" name="direction" [ngModel]="direction()" (ngModelChange)="direction.set($event)">
              @for (d of directions; track d[0]) {
                <option [value]="d[0]">{{ d[1] }}</option>
              }
            </select>
          </div>
        }
        <div class="ar-actions">
          <button class="btn" [attr.aria-disabled]="why() || saving() ? 'true' : null"
            [attr.aria-describedby]="why() ? id + '-why' : null">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
          @if (why(); as reason) {
            <p class="ar-why" [id]="id + '-why'">{{ reason }}</p>
          }
        </div>
        @if (a.eventType === 'VALUATION_CHANGED') {
          <p class="ar-note">Changing the change that notifies records a new starting point, without a notification.</p>
        }
      </form>
    </gz-record-section>

    <gz-record-section heading="Checks">
      <gz-request-status
        [loading]="!monitor() && !!state().monitoringPending[a.id]"
        loadingText="Loading its checks…"
        [error]="state().monitoringErrors[a.id]"
        (retry)="refresh()"
      />
      @if (monitor(); as m) {
        <gz-record-group>
          <div gz-record-row label="Status">{{ checkStatus(m) }}</div>
          <!-- Never checked, or nothing scheduled, is a known state in words, not missing data. -->
          <div gz-record-row label="Last check">{{ day(m.lastEvaluatedAt) ?? 'Not checked yet' }}</div>
          <div gz-record-row label="Next check">
            {{ day(m.nextEvaluationAt) ?? (a.effectivePaused ? 'Not while paused' : 'Not scheduled') }}
          </div>
          <div gz-record-row label="Properties checked" [numeric]="true">{{ m.scannedMatches.toLocaleString('en-US') }}</div>
        </gz-record-group>
        <gz-record-group heading="Notifications">
          <div gz-record-row label="Sent" [numeric]="true">{{ m.sentEvents.toLocaleString('en-US') }}</div>
          <div gz-record-row label="Waiting to send" [numeric]="true">{{ m.pendingEvents.toLocaleString('en-US') }}</div>
          <div gz-record-row label="Failed to send" [numeric]="true">
            <span [class.attention]="m.failedEvents > 0">{{ m.failedEvents.toLocaleString('en-US') }}</span>
          </div>
        </gz-record-group>
        @if (m.lastErrorCode; as code) {
          <p class="ar-note attention" role="status">{{ errorSentence(code) }}</p>
          <details class="ar-details">
            <summary>Details</summary>
            <gz-record-group>
              <div gz-record-row label="Code">{{ code }}</div>
            </gz-record-group>
          </details>
        }
        @if (!m.monitoringEnabled) {
          <p class="ar-note">Background checks are switched off on the server, so this rule isn’t checked.</p>
        } @else if (!m.publisherEnabled) {
          <p class="ar-note">Sending is switched off on the server: notifications wait until it is on.</p>
        }
        <div class="ar-actions">
          <button type="button" class="btn small" [attr.aria-disabled]="state().monitoringPending[a.id] ? 'true' : null"
            (click)="refresh()">
            {{ state().monitoringPending[a.id] ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
      }
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
    }
    gz-record-section + gz-record-section {
      margin-top: var(--sp-16);
    }
    gz-record-group + gz-record-group {
      margin-top: var(--sp-12);
    }
    .ar-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-12) var(--sp-16);
      margin-top: var(--sp-16);
    }
    .ar-form .formfield:first-child {
      grid-column: 1 / -1;
    }
    .ar-actions {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
      margin-top: var(--sp-8);
    }
    .ar-form .ar-note {
      grid-column: 1 / -1;
    }
    .ar-why {
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .ar-note {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .ar-note.attention {
      font-size: var(--fs-cell);
    }
    .ar-details {
      margin-top: var(--sp-8);
      font-size: var(--fs-cell);
    }
    .ar-details summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
  `,
})
export class AlertRecord {
  readonly rule = input.required<AlertRuleDTO>();
  /** What it follows, in words ("Saved search: 33133 houses"), for a saved-search rule. */
  readonly follows = input<string | null>(null);
  private readonly w = inject(Workspace);
  readonly state = this.w.alertState;
  readonly id = 'ar-' + Math.random().toString(36).slice(2, 8);
  readonly directions = DIRECTIONS;
  readonly eventLabel = eventLabel;
  readonly criteria = criteria;
  readonly checkStatus = checkStatus;
  readonly errorSentence = errorSentence;

  readonly name = signal('');
  readonly cadence = signal<Cadence>('DAILY');
  readonly minimum = signal<number | null>(0);
  readonly direction = signal<ValuationChangeDirection>('ANY');
  readonly saving = computed(() => this.state().saving > 0);
  readonly monitor = computed(() => this.state().monitoring[this.rule().id]);
  /** The rule as last shown, to tell the user's edits from a fresh answer. */
  private base: AlertRuleDTO | null = null;

  constructor() {
    // The form follows the rule on screen. Another rule: every field. The same rule answered again
    // (a Pause in the header, a save): only the fields the user hasn't edited, so typing survives.
    effect(() => {
      const a = this.rule();
      untracked(() => {
        const was = this.base;
        const keep = was?.id === a.id;
        if (!keep || this.name() === was.name) this.name.set(a.name);
        if (!keep || this.cadence() === was.cadence) this.cadence.set(a.cadence);
        if (!keep || this.minimum() === (was.minimumChangePercent ?? 0)) this.minimum.set(a.minimumChangePercent ?? 0);
        if (!keep || this.direction() === (was.changeDirection ?? 'ANY')) this.direction.set(a.changeDirection ?? 'ANY');
        this.base = a;
      });
    });
  }

  /** The changes the form would send; empty when nothing changed. */
  private readonly changes = computed<AlertRuleUpdate>(() => {
    const a = this.rule();
    const out: AlertRuleUpdate = {};
    if (this.name().trim() !== a.name) out.name = this.name().trim();
    if (this.cadence() !== a.cadence) out.cadence = this.cadence();
    if (a.eventType === 'VALUATION_CHANGED') {
      if (this.minimum() !== (a.minimumChangePercent ?? 0)) out.minimumChangePercent = this.minimum() ?? 0;
      if (this.direction() !== (a.changeDirection ?? 'ANY')) out.changeDirection = this.direction();
    }
    return out;
  });
  /** Why Save changes can't run, written next to it (DESIGN.md §12). */
  readonly why = computed(() => {
    if (!this.name().trim()) return 'Enter a name.';
    const min = this.minimum();
    if (this.rule().eventType === 'VALUATION_CHANGED' && (min === null || !Number.isFinite(min) || min < 0 || min > 100000))
      return 'The change runs from 0% to 100,000%.';
    return Object.keys(this.changes()).length ? null : 'Nothing has changed.';
  });

  save() {
    if (this.why() || this.saving() || !this.w.requireAccount('update alert rules')) return;
    this.w.store.dispatch(A.update({ id: this.rule().id, request: this.changes() }));
  }
  refresh() {
    if (!this.state().monitoringPending[this.rule().id]) this.w.store.dispatch(A.monitoring({ id: this.rule().id }));
  }
  day(v: string | null | undefined) {
    return formatLocalDate(v);
  }
}
