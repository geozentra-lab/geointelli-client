import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  Page,
  PortfolioDTO,
  PortfolioRequest,
  PortfolioSummaryDTO,
  HoldingDTO,
  HoldingRequest,
  FinancialRecordDTO,
  FinancialRecordRequest,
  FinancialCategory,
} from '../core/models/api';
import { queryParams } from './http-params';
@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/portfolios';
  list(page = 0) {
    return this.http.get<Page<PortfolioDTO>>(this.base, {
      params: queryParams({ page, size: 20 }),
    });
  }
  create(body: PortfolioRequest) {
    return this.http.post<PortfolioDTO>(this.base, body);
  }
  update(id: number, body: PortfolioRequest) {
    return this.http.patch<PortfolioDTO>(`${this.base}/${id}`, body);
  }
  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
  summary(id: number, fromDate?: string, toDate?: string) {
    return this.http.get<PortfolioSummaryDTO>(`${this.base}/${id}/summary`, {
      params: queryParams({ fromDate, toDate }),
    });
  }
  holdings(id: number, page = 0) {
    return this.http.get<Page<HoldingDTO>>(`${this.base}/${id}/holdings`, {
      params: queryParams({ page, size: 20 }),
    });
  }
  addHolding(id: number, body: HoldingRequest) {
    return this.http.post<HoldingDTO>(`${this.base}/${id}/holdings`, body);
  }
  updateHolding(id: number, holdingId: number, body: HoldingRequest) {
    return this.http.patch<HoldingDTO>(`${this.base}/${id}/holdings/${holdingId}`, body);
  }
  removeHolding(id: number, holdingId: number) {
    return this.http.delete<void>(`${this.base}/${id}/holdings/${holdingId}`);
  }
  records(
    id: number,
    holdingId: number,
    page = 0,
    filters: { fromDate?: string; toDate?: string; category?: FinancialCategory } = {},
  ) {
    return this.http.get<Page<FinancialRecordDTO>>(
      `${this.base}/${id}/holdings/${holdingId}/financial-records`,
      { params: queryParams({ ...filters, page, size: 20 }) },
    );
  }
  addRecord(id: number, holdingId: number, body: FinancialRecordRequest) {
    return this.http.post<FinancialRecordDTO>(
      `${this.base}/${id}/holdings/${holdingId}/financial-records`,
      body,
    );
  }
  updateRecord(id: number, holdingId: number, recordId: number, body: FinancialRecordRequest) {
    return this.http.patch<FinancialRecordDTO>(
      `${this.base}/${id}/holdings/${holdingId}/financial-records/${recordId}`,
      body,
    );
  }
  removeRecord(id: number, holdingId: number, recordId: number) {
    return this.http.delete<void>(
      `${this.base}/${id}/holdings/${holdingId}/financial-records/${recordId}`,
    );
  }
}
