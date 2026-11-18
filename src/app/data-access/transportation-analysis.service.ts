import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TransportationAnalysisDTO } from '../core/models/api';

@Injectable({
  providedIn: 'root',
})
export class TransportationAnalysisService {
  private baseUrl = `${environment.apiUrl}/property-transportation-analysis`;

  constructor(private http: HttpClient) {}
  getBulk(propertyIds: number[]) {
    return this.http.post<Record<string, TransportationAnalysisDTO>>(this.baseUrl + '/bulk', {
      propertyIds,
    });
  }
}
