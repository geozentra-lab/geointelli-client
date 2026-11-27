import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WRITE_TIMEOUT } from '../core/interceptors/error.interceptor';
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
  /**
   * Admin: rescore missing or stale scores (INCREMENTAL) or every valued property (FULL). The
   * server answers when the run is over (minutes for FULL), so it is given 15 minutes.
   */
  refresh(mode: OpportunityRefreshMode) {
    return this.http.post<OpportunityRefreshResultDTO>(
      environment.apiUrl + '/admin/opportunity-scores/refresh',
      null,
      { params: { mode }, context: new HttpContext().set(WRITE_TIMEOUT, 15 * 60_000) },
    );
  }
}
