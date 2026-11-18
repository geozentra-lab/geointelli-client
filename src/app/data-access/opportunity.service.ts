import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  OpportunityPageDTO,
  OpportunityQuery,
  OpportunityRefreshMode,
  OpportunityRefreshResultDTO,
} from '../core/models/opportunity';
import { queryParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class OpportunityService {
  private http = inject(HttpClient);
  /** Stored scores of the current scoring version; filters that are left out are not applied. */
  browse(query: OpportunityQuery) {
    return this.http.get<OpportunityPageDTO>(environment.apiUrl + '/opportunities', {
      params: queryParams(query),
    });
  }
  /** Admin: rescore missing or stale scores (INCREMENTAL) or every valued property (FULL). */
  refresh(mode: OpportunityRefreshMode) {
    return this.http.post<OpportunityRefreshResultDTO>(
      environment.apiUrl + '/admin/opportunity-scores/refresh',
      null,
      { params: { mode } },
    );
  }
}
