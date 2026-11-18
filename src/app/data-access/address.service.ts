import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PropertySearchItem } from '../core/models/api';

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  private baseUrl = `${environment.apiUrl}/addresses`;

  constructor(private http: HttpClient) {}

  /**
   * Up to the first 20 property cards matching a free-text address (backend #142). The backend
   * answers 404 when nothing matches; callers treat that as "no result", not an outage.
   */
  search(raw: string): Observable<PropertySearchItem[]> {
    const params = new HttpParams().set('rawAddress', raw);
    return this.http.get<PropertySearchItem[]>(`${this.baseUrl}/search`, { params });
  }

  suggest(raw: string): Observable<string[]> {
    const params = new HttpParams().set('raw', raw.trim());
    return this.http.get<string[]>(`${this.baseUrl}/suggest`, { params });
  }
}
