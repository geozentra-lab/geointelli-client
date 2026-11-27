import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AlertsCard, FavoritesCard, SavedSearchesCard } from '../core/models/api';
import {
  ActivityCardDTO,
  InvestorDashboardDTO,
  RealtorClientsLeadsCardDTO,
  RealtorTasksPipelineCardDTO,
} from '../core/models/dashboard';
import { queryParams } from './http-params';

/**
 * The overview cards. The affordability and mortgage-context cards are not read: they only run the
 * Studio's calculators on inputs the caller sends (no stored data, no live rate feed), so the
 * Studio stays the one place for them (DESIGN.md §8).
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/dashboards/user';
  favorites(limit = 5) {
    return this.http.get<FavoritesCard>(this.base + '/favorites', { params: { limit } });
  }
  savedSearches(limit = 5) {
    return this.http.get<SavedSearchesCard>(this.base + '/saved-searches', { params: { limit } });
  }
  alerts(limit = 5) {
    return this.http.get<AlertsCard>(this.base + '/alerts', { params: { limit } });
  }
  activity(limit = 6) {
    return this.http.get<ActivityCardDTO>(this.base + '/activity', { params: { limit } });
  }
  realtorClientsLeads(limit = 5) {
    return this.http.get<RealtorClientsLeadsCardDTO>(
      environment.apiUrl + '/dashboards/realtor/clients-leads',
      { params: { limit } },
    );
  }
  /** Active tasks overdue or due within `days` (1-90), earliest due first. */
  realtorTasksPipeline(limit = 5, days = 7) {
    return this.http.get<RealtorTasksPipelineCardDTO>(
      environment.apiUrl + '/dashboards/realtor/tasks-pipeline',
      { params: { limit, days } },
    );
  }
  /**
   * The four investor cards (value, income and returns, occupancy, opportunities) in one response;
   * without a portfolio they cover every portfolio of the user, the income card over the last 12
   * complete months.
   */
  investorDashboard(portfolioId: number | null) {
    return this.http.get<InvestorDashboardDTO>(environment.apiUrl + '/dashboards/investor', {
      params: queryParams({ portfolioId }),
    });
  }
}
