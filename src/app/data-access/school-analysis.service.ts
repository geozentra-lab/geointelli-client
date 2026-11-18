import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { SchoolAnalysisDTO } from '../core/models/api';
@Injectable({ providedIn: 'root' })
export class SchoolAnalysisService {
  private http = inject(HttpClient);
  getBulk(propertyIds: number[]) {
    return this.http.post<Record<string, SchoolAnalysisDTO>>(
      environment.apiUrl + '/property-school-analysis/bulk',
      { propertyIds },
    );
  }
}
