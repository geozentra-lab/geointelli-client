import { Component, computed, inject } from '@angular/core';
import { DashboardOverview } from '../dashboard-overview';
import { Workspace } from '../../../shared/data/workspace';
import { selectDashboard } from '../../../store/dashboard/dashboard.selectors';
import { selectRecommendations } from '../../../store/recommendations/recommendations.selectors';
import { Kpi, Recommended, RecentActivity } from '../dash-ui';
import { AffordabilityCard } from '../finance-cards';

/**
 * Entry-level customer (SOW II.4.o): recommendations, favorites, saved searches, alerts,
 * affordability and recent activity. Market snapshot waits for a market endpoint.
 */
@Component({
  selector: 'gz-buyer-dashboard',
  imports: [DashboardOverview, Kpi, Recommended, RecentActivity, AffordabilityCard],
  template: `@if (signedIn()) {
      <div class="kpi-row section">
        <gz-kpi
          label="Saved properties"
          icon="heart"
          link="/saved"
          [value]="d().favorites.value?.count ?? null"
          [loading]="d().favorites.loading && !d().favorites.value"
          caption="Homes you are watching"
          unavailable="Tap the heart on a property"
        />
        <gz-kpi
          label="Saved searches"
          icon="search"
          tone="ink"
          link="/saved"
          [value]="d().savedSearches.value?.count ?? null"
          [loading]="d().savedSearches.loading && !d().savedSearches.value"
          caption="Monitored for new matches"
          unavailable="Save a search in Explore"
        />
        <gz-kpi
          label="Active alerts"
          icon="bell"
          tone="green"
          link="/alerts"
          [value]="d().alerts.value?.activeCount ?? null"
          [loading]="d().alerts.loading && !d().alerts.value"
          [caption]="(d().alerts.value?.pausedCount ?? 0) + ' paused'"
          unavailable="No alert rules yet"
        />
        <gz-kpi
          label="Matches for you"
          icon="spark"
          tone="amber"
          link="/opportunities"
          [query]="{ view: 'matches' }"
          [value]="matches()"
          [loading]="recs().loading && !recs().response"
          caption="From your budget and target counties"
          unavailable="Set your preferences"
        />
      </div>
      <div class="dash-grid section">
        <gz-recommended />
        <div class="dash-side">
          <gz-affordability-card />
          <gz-recent-activity />
        </div>
      </div>
    }
    <gz-dashboard-overview [compact]="signedIn()" />`,
})
export class BuyerDashboard {
  w = inject(Workspace);
  d = this.w.store.selectSignal(selectDashboard);
  signedIn = computed(() => this.w.auth.isLoggedIn() && !!this.w.account().profile);
  recs = this.w.store.selectSignal(selectRecommendations);
  /** Suggestions the Recommended card loaded; null until they arrive. */
  matches = computed(() => this.recs().response?.content.length ?? null);
}
