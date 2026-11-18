import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  ComparableCandidateResponse,
  ComparableRequest,
  ComparableResponse,
} from '../core/models/api';
import { queryParams } from './http-params';
@Injectable({ providedIn: 'root' })
export class ComparableService {
  private http = inject(HttpClient);
  get(propertyId: number, query: ComparableRequest) {
    return this.http.get<ComparableResponse>(
      `${environment.apiUrl}/properties/id/${propertyId}/comparables`,
      { params: queryParams(query) },
    );
  }
  /** Unranked qualified sales that pass the filters (months, radius, area and bedroom tolerance). */
  candidates(propertyId: number, query: ComparableRequest) {
    return this.http.get<ComparableCandidateResponse>(
      `${environment.apiUrl}/properties/id/${propertyId}/comparables/candidates`,
      { params: queryParams(query) },
    );
  }
}
