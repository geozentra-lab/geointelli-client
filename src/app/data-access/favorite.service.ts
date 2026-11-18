import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { FavoriteDTO } from '../core/models/api';
@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/properties';
  list() {
    return this.http.get<FavoriteDTO[]>(this.base + '/favorites');
  }
  add(propertyId: number) {
    return this.http.post<FavoriteDTO>(`${this.base}/${propertyId}/favorite`, {});
  }
  remove(propertyId: number) {
    return this.http.delete<void>(`${this.base}/${propertyId}/favorite`);
  }
}
