import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { READ_TIMEOUT } from '../core/interceptors/error.interceptor';
import { Page } from '../core/models/api';
import {
  DataQualityReportDTO,
  DataQualityRule,
  ValuationRefreshRequestDTO,
  ValuationRefreshStatus,
} from '../core/models/admin';
import { queryParams } from './http-params';

/** Administrator endpoints (realm role admin). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/admin';
  /**
   * Every rule with its count; with a rule, also one page of its issues. Read-only. The counts are
   * made in the background, so the summary answers at once (SCRUM-206); an issue page can take up
   * to the server's 30 s limit (then 503), so allow 45 s: above that limit, below CloudFront's 60 s.
   */
  dataQuality(rule: DataQualityRule | null, page = 0, size = 20) {
    return this.http.get<DataQualityReportDTO>(this.base + '/data-quality/issues', {
      params: queryParams({ rule, page, size }),
      context: new HttpContext().set(READ_TIMEOUT, 45_000),
    });
  }
  valuationRefreshRequests(status: ValuationRefreshStatus | null, page = 0, size = 20) {
    return this.http.get<Page<ValuationRefreshRequestDTO>>(
      this.base + '/valuation-refresh-requests',
      { params: queryParams({ status, page, size }) },
    );
  }
  cancelValuationRefresh(id: string) {
    return this.http.post<ValuationRefreshRequestDTO>(
      `${this.base}/valuation-refresh-requests/${id}/cancel`,
      null,
    );
  }
  /** The key makes a repeated click (or a network retry) create one new request, not two. */
  retryValuationRefresh(id: string, idempotencyKey: string) {
    return this.http.post<ValuationRefreshRequestDTO>(
      `${this.base}/valuation-refresh-requests/${id}/retry`,
      null,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }
}
