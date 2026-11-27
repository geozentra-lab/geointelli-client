import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { READ_TIMEOUT } from '../core/interceptors/error.interceptor';
import { Page } from '../core/models/api';
import { PropertyValuation, ValuationHistoryEntry } from '../core/models/property-valuation';
import { OpportunityScoreDTO } from '../core/models/opportunity';

@Injectable({ providedIn: 'root' })
export class ValuationService {
  private http = inject(HttpClient);
  /**
   * 404 means the property does not exist; an unmodelled property is 200 "unsupported". Given 30 s
   * and never asked twice: the answer (estimate, factors, comparables, forecasts) can take 9–12 s,
   * and at the 12 s default the page failed and sent the same slow request again (sweep, Nov 26, 2026).
   */
  get(propertyId: number) {
    return this.http.get<PropertyValuation>(
      `${environment.apiUrl}/properties/id/${propertyId}/valuation`,
      { context: new HttpContext().set(READ_TIMEOUT, 30_000) },
    );
  }
  /** Archived versions, newest first; reading history never triggers a refresh. */
  history(propertyId: number, page = 0, size = 10) {
    return this.http.get<Page<ValuationHistoryEntry>>(
      `${environment.apiUrl}/properties/id/${propertyId}/valuations`,
      { params: { page, size } },
    );
  }
  /** Scored now from the stored valuation; UNAVAILABLE without its one-year forecast. */
  opportunityScore(propertyId: number) {
    return this.http.get<OpportunityScoreDTO>(
      `${environment.apiUrl}/properties/id/${propertyId}/opportunity-score`,
    );
  }
}
