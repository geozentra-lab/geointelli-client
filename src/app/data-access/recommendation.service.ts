import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RecommendationResponse } from '../core/models/api';
@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private http = inject(HttpClient);
  /** Uses only the signed-in user's saved preferences; limit is 1 to 50. */
  list(limit = 20) {
    return this.http.get<RecommendationResponse>(environment.apiUrl + '/recommendations', {
      params: { limit },
    });
  }
}
