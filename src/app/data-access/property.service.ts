import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Property } from '../core/models/property';
import { PropertyExtraFeatures } from '../core/models/extra_features';
import {
  Page,
  PropertyCompareResponse,
  PropertySearchItem,
  PropertySearchRequest,
  SchoolContextDTO,
  TransportContextDTO,
} from '../core/models/api';
import { queryParams } from './http-params';

@Injectable({
  providedIn: 'root',
})
export class PropertyService {
  private baseUrl = `${environment.apiUrl}/properties`;

  constructor(private http: HttpClient) {}
  search(query: PropertySearchRequest) {
    return this.http.get<Page<PropertySearchItem>>(this.baseUrl + '/search', {
      params: queryParams(query),
    });
  }
  getById(id: number) {
    return this.http.get<Property>(`${this.baseUrl}/id/${id}`);
  }
  /** Units of a parent property (condo buildings), ordered by ID; empty when it has none. */
  children(id: number, page = 0) {
    return this.http.get<Page<Partial<Property>>>(`${this.baseUrl}/id/${id}/children`, {
      params: queryParams({ page, size: 20 }),
    });
  }
  extraFeatures(
    id: number,
    query: { year?: number; history?: boolean; page?: number; size?: number } = {},
  ) {
    return this.http.get<PropertyExtraFeatures>(`${this.baseUrl}/id/${id}/extra-features`, {
      params: queryParams(query),
    });
  }

  /** Two to five internal property IDs; columns keep the request order. */
  compare(propertyIds: number[]) {
    return this.http.post<PropertyCompareResponse>(this.baseUrl + '/compare', { propertyIds });
  }
  schoolContext(id: number) {
    return this.http.get<SchoolContextDTO>(
      `${this.baseUrl}/id/${id}/location-intelligence/schools`,
    );
  }
  transportContext(id: number) {
    return this.http.get<TransportContextDTO>(
      `${this.baseUrl}/id/${id}/location-intelligence/transport`,
    );
  }

  getPropertyDetails(folio: string | number, countyId: number): Observable<Property> {
    return this.http.get<Property>(`${this.baseUrl}/${encodeURIComponent(folio)}`, {
      params: new HttpParams().set('countyId', countyId),
    });
  }
}
