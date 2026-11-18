import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Parcel } from '../core/models/parcel';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ParcelService {
  private baseUrl = `${environment.apiUrl}/parcels`;

  constructor(private http: HttpClient) {}

  getParcels(bbox: string): Observable<Parcel[]> {
    const params = new HttpParams().set('bbox', bbox);

    return this.http.get<Parcel[]>(this.baseUrl, { params });
  }

  getParcelByFolio(folio: string, countyId: number): Observable<Parcel[]> {
    const params = new HttpParams().set('folio', folio).set('countyId', countyId);
    return this.http.get<Parcel[]>(this.baseUrl + '/byfolio', { params });
  }
}
