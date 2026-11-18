import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  AffordabilityRequest,
  AffordabilityResponse,
  MortgageRequest,
  MortgageResponse,
} from '../core/models/api';
import { InvestmentAnalysisRequest, InvestmentAnalysisResponse } from '../core/models/investment';
@Injectable({ providedIn: 'root' })
export class InvestmentAnalysisService {
  private http = inject(HttpClient);
  calculate(body: MortgageRequest) {
    return this.http.post<MortgageResponse>(environment.apiUrl + '/calculations/mortgage', body);
  }
  /** Operating result, financed returns and an optional equity projection of a rental. */
  investment(body: InvestmentAnalysisRequest) {
    return this.http.post<InvestmentAnalysisResponse>(
      environment.apiUrl + '/calculations/investment',
      body,
    );
  }
  affordability(body: AffordabilityRequest) {
    return this.http.post<AffordabilityResponse>(
      environment.apiUrl + '/calculations/affordability',
      body,
    );
  }
}
