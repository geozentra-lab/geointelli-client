import { LabelPipe } from '../../shared/pipes/label.pipe';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { DestroyRef } from '@angular/core';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Workspace } from '../../shared/data/workspace';
import { SAVED_SEARCH_PICKER_LIMIT } from '../../data-access/saved-search.service';
import { savedSearchesActions as S } from '../../store/saved-searches/saved-searches.actions';
import { selectSavedSearchesState } from '../../store/saved-searches/saved-searches.selectors';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { PropertyPicker } from '../../shared/components/property-picker';
import { PropertyRef } from '../../shared/components/property-ref';
import { alertsActions as A } from '../../store/alerts/alerts.actions';
import {
  AlertRuleDTO,
  AlertRuleUpdate,
  AlertEventType,
  Cadence,
  ValuationChangeDirection,
} from '../../core/models/api';

const DIRECTIONS: [ValuationChangeDirection, string][] = [
  ['ANY', 'Up or down'],
  ['INCREASE', 'Increases only'],
  ['DECREASE', 'Decreases only'],
];
@Component({
  imports: [
    FormsModule,
    DatePipe,
    PageHeading,
    RequestStatus,
    Pagination,
    PropertyPicker,
    PropertyRef,
    LabelPipe,
  ],
  templateUrl: './alerts.html',
})
export class Alerts implements OnInit {
  w = inject(Workspace);
  confirmation = inject(ConfirmationService);
  destroy = inject(DestroyRef);
  private searches = this.w.store.selectSignal(selectSavedSearchesState);
  /**
   * All saved searches for the target picker. The Saved screen holds only its current page, so
   * the slice keeps this complete list next to it.
   */
  readonly searchOptions = computed(() => this.searches().options.value);
  readonly optionsLoading = computed(() => this.searches().options.loading);
  readonly optionsError = computed(() => this.searches().options.error);
  readonly optionsLimit = SAVED_SEARCH_PICKER_LIMIT;
  readonly directions = DIRECTIONS;
  name = '';
  eventType: AlertEventType = 'NEW_MATCH';
  target: 'search' | 'property' = 'search';
  targetId: number | null = null;
  cadence: Cadence = 'DAILY';
  /** VALUATION_CHANGED only: 0 notifies on any change. */
  minimumChangePercent = 0;
  changeDirection: ValuationChangeDirection = 'ANY';
  /** The valuation rule whose threshold is being edited inline. */
  editing = signal<number | null>(null);
  editMinimum = 0;
  editDirection: ValuationChangeDirection = 'ANY';
  private submittedName: string | null = null;
  constructor() {
    effect(() => {
      const state = this.w.alertState();
      if (this.submittedName !== null && !state.saving) {
        if (!state.error && this.name.trim() === this.submittedName) {
          this.name = '';
          this.targetId = null;
        }
        this.submittedName = null;
      }
    });
  }
  searchName(id: number) {
    return (
      (this.searchOptions() ?? []).find((s) => s.id === id)?.name ??
      this.w.searches().find((s) => s.id === id)?.name ??
      '#' + id
    );
  }
  loadSearchOptions() {
    if (!this.optionsLoading()) this.w.store.dispatch(S.loadOptions());
  }
  /** "5% or more, increases only": the rule's valuation criteria in words. */
  criteria(a: AlertRuleDTO) {
    const min = a.minimumChangePercent ?? 0;
    const size = min > 0 ? `Changes of ${min}% or more` : 'Any change';
    const way = DIRECTIONS.find((d) => d[0] === (a.changeDirection ?? 'ANY'))?.[1] ?? '';
    return `${size} · ${way.toLowerCase()}`;
  }
  thresholdInvalid(value: number | null) {
    return value === null || !Number.isFinite(value) || value < 0 || value > 100000;
  }
  editCriteria(a: AlertRuleDTO) {
    this.editing.set(a.id);
    this.editMinimum = a.minimumChangePercent ?? 0;
    this.editDirection = a.changeDirection ?? 'ANY';
  }
  saveCriteria(a: AlertRuleDTO) {
    if (this.thresholdInvalid(this.editMinimum)) return;
    this.update(a, {
      minimumChangePercent: this.editMinimum,
      changeDirection: this.editDirection,
    });
    this.editing.set(null);
  }
  eventLabel(event: string) {
    return (
      (
        {
          NEW_MATCH: 'New matching property',
          LISTING_PRICE_CHANGED: 'Listing price change',
          VALUATION_CHANGED: 'Valuation change',
        } as Record<string, string>
      )[event] || event
    );
  }

  ngOnInit() {
    if (this.w.auth.isLoggedIn()) {
      this.page(0);
      if (!this.searchOptions()) this.loadSearchOptions();
    }
  }
  page(page: number) {
    this.w.store.dispatch(A.load({ page }));
  }
  create() {
    if (this.w.alertState().saving || !this.w.requireAccount('create alert rules')) return;
    if (
      !this.name.trim() ||
      !this.targetId ||
      (this.eventType === 'NEW_MATCH' && this.target !== 'search') ||
      (this.eventType === 'VALUATION_CHANGED' && this.thresholdInvalid(this.minimumChangePercent))
    )
      return;
    this.submittedName = this.name.trim();
    this.w.store.dispatch(
      A.create({
        request: {
          name: this.name.trim(),
          eventType: this.eventType,
          cadence: this.cadence,
          ...(this.eventType === 'VALUATION_CHANGED'
            ? {
                minimumChangePercent: this.minimumChangePercent,
                changeDirection: this.changeDirection,
              }
            : {}),
          ...(this.target === 'search'
            ? { savedSearchId: this.targetId }
            : { propertyId: this.targetId }),
        },
      }),
    );
  }
  update(a: AlertRuleDTO, request: AlertRuleUpdate) {
    if (!this.w.alertState().saving && this.w.requireAccount('update alert rules'))
      this.w.store.dispatch(A.update({ id: a.id, request }));
  }
  async remove(id: number) {
    const item = this.w.alerts().find((a) => a.id === id);
    if (
      (await this.confirmation.confirm({
        title: 'Delete alert rule?',
        message:
          'Stop monitoring "' + (item?.name || 'this rule') + '"? You can create a new rule later.',
      })) &&
      !this.destroy.destroyed &&
      !this.w.alertState().saving
    )
      this.w.store.dispatch(A.remove({ id }));
  }
  setEvent(type: AlertEventType) {
    this.eventType = type;
    if (type === 'NEW_MATCH' && this.target !== 'search') {
      this.target = 'search';
      this.targetId = null;
    }
  }
  status(id: number) {
    if (!this.w.alertState().monitoringPending[id]) this.w.store.dispatch(A.monitoring({ id }));
  }
  evaluate(id: number) {
    if (!this.w.alertState().evaluationPending[id] && this.w.requireAccount('evaluate alert rules'))
      this.w.store.dispatch(A.evaluate({ id }));
  }
}
