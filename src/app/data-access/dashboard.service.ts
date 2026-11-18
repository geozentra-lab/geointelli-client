import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  AffordabilityCardDTO,
  AffordabilityRequest,
  AlertsCard,
  FavoritesCard,
  MortgageContextCardDTO,
  MortgageRequest,
  SavedSearchesCard,
} from '../core/models/api';
import {
  ActivityCardDTO,
  InvestorOccupancyExposureCardDTO,
  InvestorValueEquityDebtCardDTO,
  RealtorClientsLeadsCardDTO,
  RealtorTasksPipelineCardDTO,
} from '../core/models/dashboard';
import { queryParams } from './http-params';
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
  /** Without a portfolio the investor cards cover every portfolio of the user. */
  investorOccupancyExposure(portfolioId: number | null) {
    return this.http.get<InvestorOccupancyExposureCardDTO>(
      environment.apiUrl + '/dashboards/investor/occupancy-exposure',
      { params: queryParams({ portfolioId }) },
    );
  }
  investorValueEquityDebt(portfolioId: number | null) {
    return this.http.get<InvestorValueEquityDebtCardDTO>(
      environment.apiUrl + '/dashboards/investor/value-equity-debt',
      { params: queryParams({ portfolioId }) },
    );
  }
  /** Inputs go as query parameters and are not stored; omitted ones are listed as missing. */
  affordability(inputs: Partial<AffordabilityRequest> = {}) {
    return this.http.get<AffordabilityCardDTO>(this.base + '/affordability', {
      params: queryParams(inputs),
    });
  }
  mortgageContext(inputs: Partial<MortgageRequest> = {}) {
    return this.http.get<MortgageContextCardDTO>(
      environment.apiUrl + '/dashboards/lender/mortgage-context',
      { params: queryParams(inputs) },
    );
  }
}
