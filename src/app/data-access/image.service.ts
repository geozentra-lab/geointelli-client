import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PropertyImage } from '../core/models/property-image';

@Injectable({
  providedIn: 'root',
})
export class ImageService {
  private baseUrl = `${environment.apiUrl}/images`;

  constructor(private http: HttpClient) {}

  getPropertyImages(propertyId: number) {
    return this.http.get<PropertyImage[]>(`${this.baseUrl}/property/${propertyId}`);
  }
}
