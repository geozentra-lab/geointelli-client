import { Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../../shared/data/workspace';
import { PageHeading } from '../../../shared/components/page-heading';
import { TABLE_KIT } from '../../../shared/table';
import { countOf, formatLocalDate } from '../../../shared/data/format';
import { labelFor } from '../../../shared/pipes/label.pipe';
import { AlertEventType, AlertsCard, SavedSearchesCard } from '../../../core/models/api';
import { DashboardActions } from '../../../store/dashboard/dashboard.actions';
import { selectDashboard } from '../../../store/dashboard/dashboard.selectors';
import { Matches } from '../../opportunities/matches';
import { RECOMMENDATION_LIMIT } from '../dash-ui';
import { OVERVIEW_STYLES, OverviewSection } from '../overview-ui';

const EVENTS: Record<AlertEventType, string> = {
  NEW_MATCH: 'New matches',
  LISTING_PRICE_CHANGED: 'Listing price changes',
  VALUATION_CHANGED: 'ZentraValue changes',
};
type Search = SavedSearchesCard['recent'][number];
type Rule = AlertsCard['recent'][number];

/**
 * Buyer overview (DESIGN.md §8): the lead is "Matches for your search", the top 5 of the same
 * suggestions as Opportunities' "Matched to you" (`gz-matches`, with the inline "Set your area and
 * budget" form and the no-matches state), then two columns: saved searches and alerts, from the
 * user dashboard cards (the newest five of each, by creation). Guests see the lead's sign-in line
 * only, and no card is asked for.
 */
@Component({
  selector: 'gz-buyer-dashboard',
  imports: [RouterLink, PageHeading, Matches, OverviewSection, ...TABLE_KIT],
  template: `<gz-heading title="Overview" />
    <gz-matches [limit]="5" [requestLimit]="recommendationLimit" />
    @if (signedIn()) {
      <div class="ov-cols">
        <section
          gz-overview-section
          #searchesSection
          heading="Saved searches"
          [caption]="searchesCaption()"
          [busy]="d().savedSearches.loading && !!d().savedSearches.value"
        >
          <a actions class="ov-link" routerLink="/saved">Manage saved searches</a>
          @let s = d().savedSearches;
          @if (s.error) {
            <div class="insight danger ov-alert" role="alert">
              <span>Saved searches could not load.</span>
              <button type="button" class="btn small" (click)="searchesSection.retried(); reload()">
                Retry
              </button>
            </div>
          } @else if (!s.value) {
            @for (i of skeleton; track i) {
              <div class="row-skeleton" aria-hidden="true"></div>
            }
            <p class="sr-only" role="status">Loading saved searches…</p>
          } @else if (!s.value.count) {
            <div class="ov-empty">
              <p>Searches you save in Explore will appear here, checked for new matches.</p>
              <a class="btn" routerLink="/explore">Explore properties</a>
            </div>
          } @else {
            <table gz-table class="ov-table" sticky="none">
              <caption class="sr-only">Saved searches, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Search</th>
                  <th scope="col" data-priority="2">Checked</th>
                  <th scope="col" class="num" data-priority="2">Saved</th>
                </tr>
              </thead>
              <tbody>
                @for (row of s.value.recent; track row.id) {
                  <tr>
                    <td>
                      <a routerLink="/saved">{{ row.name }}</a>
                      <span class="cell-sub m-only">{{ checked(row) }} · saved {{ date(row.createdAt) }}</span>
                    </td>
                    <td data-priority="2">{{ checked(row) }}</td>
                    <td class="num" data-priority="2">{{ date(row.createdAt) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
        <section
          gz-overview-section
          #alertsSection
          heading="Alerts"
          [caption]="alertsCaption()"
          [busy]="d().alerts.loading && !!d().alerts.value"
        >
          <a actions class="ov-link" routerLink="/alerts">Manage alerts</a>
          @let a = d().alerts;
          @if (a.error) {
            <div class="insight danger ov-alert" role="alert">
              <span>Alerts could not load.</span>
              <button type="button" class="btn small" (click)="alertsSection.retried(); reload()">
                Retry
              </button>
            </div>
          } @else if (!a.value) {
            @for (i of skeleton; track i) {
              <div class="row-skeleton" aria-hidden="true"></div>
            }
            <p class="sr-only" role="status">Loading alerts…</p>
          } @else if (!a.value.count) {
            <div class="ov-empty">
              <p>
                Alerts tell you when a saved search finds new matches or a property's ZentraValue
                changes.
              </p>
              <a class="btn" routerLink="/alerts">Create an alert</a>
            </div>
          } @else {
            <table gz-table class="ov-table" sticky="none">
              <caption class="sr-only">Alerts, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Alert</th>
                  <th scope="col" data-priority="2">Checked</th>
                  <th scope="col" data-priority="2">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (rule of a.value.recent; track rule.id) {
                  <tr>
                    <td>
                      <a routerLink="/alerts">{{ rule.name }}</a>
                      <span class="cell-sub">{{ event(rule) }}</span>
                      <span class="cell-sub m-only">{{ cadence(rule) }} · {{ status(rule) }}</span>
                    </td>
                    <td data-priority="2">{{ cadence(rule) }}</td>
                    <td data-priority="2">{{ status(rule) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      </div>
    }`,
  styles: OVERVIEW_STYLES,
})
export class BuyerDashboard {
  readonly w = inject(Workspace);
  readonly d = this.w.store.selectSignal(selectDashboard);
  readonly recommendationLimit = RECOMMENDATION_LIMIT;
  readonly skeleton = [0, 1, 2];
  readonly signedIn = computed(() => this.w.auth.isLoggedIn() && !!this.w.account().profile);
  readonly searchesCaption = computed(() => {
    const c = this.d().savedSearches.value;
    if (!c || this.d().savedSearches.error || !c.count) return '';
    return c.recent.length < c.count
      ? `${c.recent.length} newest of ${c.count}`
      : countOf(c.count, 'search', 'searches');
  });
  readonly alertsCaption = computed(() => {
    const c = this.d().alerts.value;
    if (!c || this.d().alerts.error || !c.count) return '';
    const split = `${c.activeCount} active, ${c.pausedCount} paused`;
    return c.recent.length < c.count
      ? `${c.recent.length} newest of ${c.count} · ${split}`
      : `${countOf(c.count, 'alert')}: ${split}`;
  });
  private loadedFor: number | undefined;
  constructor() {
    // The user cards load once the account is known: on a brand-new account /users/me provisions
    // the user, and asking in parallel would race that first-login creation.
    effect(() => {
      const userId = this.w.account().profile?.id;
      if (userId !== undefined && userId !== this.loadedFor && this.w.auth.isLoggedIn()) {
        this.loadedFor = userId;
        untracked(() => this.reload());
      }
    });
  }
  reload() {
    this.w.store.dispatch(DashboardActions.load());
  }
  checked(s: Search) {
    return s.paused ? 'Paused' : s.cadence === 'DAILY' ? 'Daily' : 'Weekly';
  }
  cadence(r: Rule) {
    return r.cadence === 'DAILY' ? 'Daily' : 'Weekly';
  }
  /** Paused by hand, or paused because the saved search it follows is paused. */
  status(r: Rule) {
    if (!r.effectivePaused) return 'Active';
    return r.paused ? 'Paused' : 'Paused with its search';
  }
  event(r: Rule) {
    return EVENTS[r.eventType] ?? labelFor(r.eventType);
  }
  date(value: string) {
    return formatLocalDate(value) ?? '';
  }
}
