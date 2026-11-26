import { Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { PropertyPicker } from '../../shared/components/property-picker';
import { SAVED_SEARCH_PICKER_LIMIT } from '../../data-access/saved-search.service';
import {
  AlertEventType,
  AlertRuleRequest,
  Cadence,
  ValuationChangeDirection,
} from '../../core/models/api';
import { alertsActions as A } from '../../store/alerts/alerts.actions';
import { savedSearchesActions as S } from '../../store/saved-searches/saved-searches.actions';
import { selectSavedSearchesState } from '../../store/saved-searches/saved-searches.selectors';
import { DIRECTIONS } from './alert-words';

/**
 * New alert, in the record pane (DESIGN.md §5: "New …" forms open in the pane, never above the
 * list): a name, what to watch for, what to follow (a saved search, or for ZentraValue and listing
 * price changes a property), the change that notifies for ZentraValue rules, and how often. Create
 * is aria-disabled with the reason beside it until the rule can be sent.
 */
@Component({
  selector: 'gz-alert-form',
  imports: [FormsModule, RouterLink, PropertyPicker, ...RECORD_KIT],
  template: `
    <!-- The pane's title already says New alert. -->
    <gz-record-section>
      <form class="af-form" (ngSubmit)="create()">
        <div class="formfield af-wide">
          <label for="alertName">Name</label>
          <input id="alertName" name="name" maxlength="120" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        </div>
        <div class="formfield af-wide">
          <label for="eventType">Watch for</label>
          <select id="eventType" name="eventType" aria-describedby="eventType-hint" [ngModel]="eventType()" (ngModelChange)="setEvent($event)">
            <option value="NEW_MATCH">A new matching property</option>
            <option value="VALUATION_CHANGED">A ZentraValue change</option>
            <option value="LISTING_PRICE_CHANGED">A listing price change</option>
          </select>
          <p class="smalltext muted" id="eventType-hint">{{ eventHint() }}</p>
        </div>
        <div class="formfield af-wide">
          <label for="targetType">Follow</label>
          <select id="targetType" name="target" aria-describedby="targetType-hint" [ngModel]="target()" (ngModelChange)="setTarget($event)">
            <option value="search">A saved search</option>
            <option value="property" [disabled]="eventType() === 'NEW_MATCH'">A property</option>
          </select>
          @if (eventType() === 'NEW_MATCH') {
            <p class="smalltext muted" id="targetType-hint">New matches come from a saved search.</p>
          }
        </div>
        @if (target() === 'search') {
          <div class="formfield af-wide">
            <label for="targetId">Saved search</label>
            <select id="targetId" name="targetId" [ngModel]="targetId()" (ngModelChange)="targetId.set($event)"
              [attr.aria-disabled]="optionsLoading() ? 'true' : null">
              <option [ngValue]="null">{{ optionsLoading() ? 'Loading saved searches…' : 'Choose a saved search' }}</option>
              @for (s of searchOptions(); track s.id) {
                <option [ngValue]="s.id">{{ s.name }}</option>
              }
            </select>
            @if (optionsError(); as error) {
              <p class="smalltext" role="alert">
                Your saved searches could not load.
                <button type="button" class="linkbtn" (click)="loadOptions()">Retry</button>
              </p>
            } @else if (!optionsLoading() && !searchOptions().length) {
              <p class="smalltext muted">
                You have no saved searches yet. <a routerLink="/explore">Save one in Explore</a> to follow it.
              </p>
            } @else if (searchOptions().length >= optionsLimit) {
              <p class="smalltext muted">Showing your first {{ optionsLimit }} saved searches.</p>
            }
          </div>
        } @else {
          <gz-property-picker class="af-wide" label="Property" [propertyId]="targetId()" (selected)="targetId.set($event)" />
        }
        @if (eventType() === 'VALUATION_CHANGED') {
          <div class="formfield">
            <label for="minimumChange">Moves at least (%)</label>
            <input id="minimumChange" name="minimumChangePercent" type="number" min="0" max="100000" step="0.1"
              aria-describedby="minimumChange-hint"
              [ngModel]="minimum()" (ngModelChange)="minimum.set($event === '' ? null : $event)" />
            <p class="smalltext muted" id="minimumChange-hint">0 notifies on any change.</p>
          </div>
          <div class="formfield">
            <label for="changeDirection">Direction</label>
            <select id="changeDirection" name="changeDirection" [ngModel]="direction()" (ngModelChange)="direction.set($event)">
              @for (d of directions; track d[0]) {
                <option [value]="d[0]">{{ d[1] }}</option>
              }
            </select>
          </div>
        }
        <div class="formfield">
          <label for="cadence">Checked</label>
          <select id="cadence" name="cadence" [ngModel]="cadence()" (ngModelChange)="cadence.set($event)">
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </div>
        <div class="af-actions af-wide">
          <button class="btn primary" [attr.aria-disabled]="why() || saving() ? 'true' : null"
            [attr.aria-describedby]="why() ? 'af-why' : null">
            {{ saving() ? 'Creating…' : 'Create alert' }}
          </button>
          @if (why(); as reason) {
            <p class="af-why" id="af-why">{{ reason }}</p>
          }
        </div>
        @if (tried() && state().errorOperation === 'save' && state().error; as error) {
          <p class="field-error af-wide" role="alert">{{ error }}</p>
        }
      </form>
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
    }
    .af-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-12) var(--sp-16);
      margin-top: var(--sp-12);
    }
    .af-wide {
      grid-column: 1 / -1;
    }
    .af-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
      margin-top: var(--sp-8);
    }
    .af-why {
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
  `,
})
export class AlertForm {
  /** The rule was created: its name, so the page can open it. */
  readonly created = output<string>();
  private readonly w = inject(Workspace);
  readonly state = this.w.alertState;
  private readonly searches = this.w.store.selectSignal(selectSavedSearchesState);
  readonly directions = DIRECTIONS;
  readonly optionsLimit = SAVED_SEARCH_PICKER_LIMIT;
  /** Every saved search for the picker (the Saved page holds only a page of them). */
  readonly searchOptions = computed(() => this.searches().options.value ?? this.w.searches());
  readonly optionsLoading = computed(() => this.searches().options.loading);
  readonly optionsError = computed(() => this.searches().options.error);

  readonly name = signal('');
  readonly eventType = signal<AlertEventType>('NEW_MATCH');
  readonly target = signal<'search' | 'property'>('search');
  readonly targetId = signal<number | null>(null);
  readonly cadence = signal<Cadence>('DAILY');
  readonly minimum = signal<number | null>(0);
  readonly direction = signal<ValuationChangeDirection>('ANY');
  readonly saving = computed(() => this.state().saving > 0);
  private submitted: string | null = null;
  /** Create was pressed here, so a failed save is this form's. */
  readonly tried = signal(false);

  readonly eventHint = computed(() => {
    switch (this.eventType()) {
      case 'VALUATION_CHANGED':
        return 'Compares each newly published ZentraValue with the one before. The first check only records a starting point.';
      case 'LISTING_PRICE_CHANGED':
        return 'It can be saved now; checks start once listing prices are available. Assessed values are not listing prices.';
      default:
        return 'Notifies when a property newly matches the saved search.';
    }
  });

  constructor() {
    if (!this.searches().options.value && !this.optionsLoading()) this.loadOptions();
    // Created: the page opens the new rule.
    effect(() => {
      const s = this.state();
      if (this.submitted === null || s.saving) return;
      const name = this.submitted;
      this.submitted = null;
      if (!s.error) untracked(() => this.created.emit(name));
    });
  }

  /** Why Create alert can't run, written next to it (DESIGN.md §12); null when it can. */
  readonly why = computed(() => {
    if (!this.name().trim()) return 'Enter a name.';
    if (this.targetId() === null)
      return this.target() === 'search' ? 'Choose a saved search to follow.' : 'Choose a property to follow.';
    const min = this.minimum();
    if (this.eventType() === 'VALUATION_CHANGED' && (min === null || !Number.isFinite(min) || min < 0 || min > 100000))
      return 'The change runs from 0% to 100,000%.';
    return null;
  });

  setEvent(type: AlertEventType) {
    this.eventType.set(type);
    // New matches only come from a saved search.
    if (type === 'NEW_MATCH' && this.target() !== 'search') this.setTarget('search');
  }
  setTarget(target: 'search' | 'property') {
    this.target.set(target);
    this.targetId.set(null);
  }
  loadOptions() {
    this.w.store.dispatch(S.loadOptions());
  }
  create() {
    if (this.why() || this.saving() || !this.w.requireAccount('create alerts')) return;
    const request: AlertRuleRequest = {
      name: this.name().trim(),
      eventType: this.eventType(),
      cadence: this.cadence(),
      ...(this.eventType() === 'VALUATION_CHANGED'
        ? { minimumChangePercent: this.minimum() ?? 0, changeDirection: this.direction() }
        : {}),
      ...(this.target() === 'search' ? { savedSearchId: this.targetId()! } : { propertyId: this.targetId()! }),
    };
    this.submitted = request.name!;
    this.tried.set(true);
    this.w.store.dispatch(A.create({ request }));
  }
}
