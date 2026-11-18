import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Page } from '../core/models/api';
import { PropertyValuation, ValuationHistoryEntry } from '../core/models/property-valuation';
import { OpportunityScoreDTO } from '../core/models/opportunity';

@Injectable({ providedIn: 'root' })
export class ValuationService {
  private http = inject(HttpClient);
  /** 404 means the property does not exist; an unmodelled property is 200 "unsupported". */
  get(propertyId: number) {
    return this.http.get<PropertyValuation>(
      `${environment.apiUrl}/properties/id/${propertyId}/valuation`,
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
