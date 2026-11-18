import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { StateDTO, CountyLocationDTO } from '../core/models/location';
@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);
  getStates() {
    return this.http.get<StateDTO[]>(`${environment.apiUrl}/locations/states`);
  }
  getCounties(stateId: number) {
    return this.http.get<CountyLocationDTO[]>(`${environment.apiUrl}/locations/counties`, {
      params: new HttpParams().set('stateId', stateId),
    });
  }
}
