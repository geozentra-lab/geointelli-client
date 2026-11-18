import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PredictionMap, PropertyValuePrediction } from '../core/models/property_prediction_value';

@Injectable({
  providedIn: 'root',
})
export class PredictionService {
  private baseUrl = `${environment.apiUrl}/predictions`;

  constructor(private http: HttpClient) {}

  getPropertyValuePrediction(propertyId: number): Observable<PropertyValuePrediction> {
    const params = new HttpParams().set('propertyId', propertyId);
    return this.http.get<PropertyValuePrediction>(this.baseUrl + '/bypropertyid', { params });
  }

  getPropertyValuePredictionBulk(propertyIds: number[]): Observable<PredictionMap> {
    return this.http.post<PredictionMap>(this.baseUrl + '/bulk', { propertyIds: propertyIds });
  }
}
