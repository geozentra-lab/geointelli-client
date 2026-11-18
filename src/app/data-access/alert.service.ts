import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Page, AlertRuleDTO, AlertRuleRequest, AlertMonitoringDTO } from '../core/models/api';
import { queryParams } from './http-params';
@Injectable({ providedIn: 'root' })
export class AlertService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/alerts';
  list(page = 0) {
    return this.http.get<Page<AlertRuleDTO>>(this.base, {
      params: queryParams({ page, size: 20 }),
    });
  }
  create(body: AlertRuleRequest) {
    return this.http.post<AlertRuleDTO>(this.base, body);
  }
  update(id: number, body: Pick<AlertRuleRequest, 'name' | 'cadence' | 'paused'>) {
    return this.http.patch<AlertRuleDTO>(`${this.base}/${id}`, body);
  }
  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
  monitoring(id: number) {
    return this.http.get<AlertMonitoringDTO>(`${this.base}/${id}/monitoring`);
  }
  evaluate(id: number) {
    return this.http.post<void>(`${this.base}/${id}/evaluate`, null);
  }
}
