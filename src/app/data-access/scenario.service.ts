import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Page } from '../core/models/api';
import {
  ScenarioCreateRequest,
  ScenarioDTO,
  ScenarioUpdateRequest,
} from '../core/models/investment';

/** The current user's saved scenarios; another user's scenario answers 404. */
@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/scenarios';
  list(page = 0, size = 50) {
    return this.http.get<Page<ScenarioDTO>>(this.base, { params: { page, size } });
  }
  create(body: ScenarioCreateRequest) {
    return this.http.post<ScenarioDTO>(this.base, body);
  }
  update(id: number, body: ScenarioUpdateRequest) {
    return this.http.patch<ScenarioDTO>(`${this.base}/${id}`, body);
  }
  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
