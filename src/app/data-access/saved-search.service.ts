import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { environment } from '../../environments/environment';
import { Page, SavedSearchDTO, SavedSearchRequest, PropertySearchItem } from '../core/models/api';
import { queryParams } from './http-params';
/** The backend accepts page sizes of 1 to 100. */
export const SAVED_SEARCH_MAX_PAGE_SIZE = 100;
/** Pickers stop paging here so a runaway account cannot issue unbounded requests. */
export const SAVED_SEARCH_PICKER_LIMIT = 500;
@Injectable({ providedIn: 'root' })
export class SavedSearchService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/saved-searches';
  list(page = 0, size = 20) {
    return this.http.get<Page<SavedSearchDTO>>(this.base, {
      params: queryParams({ page, size }),
    });
  }
  /** Every saved search for pickers, paged at the backend maximum until the last page (capped). */
  listAll(): Observable<SavedSearchDTO[]> {
    const size = SAVED_SEARCH_MAX_PAGE_SIZE;
    return this.list(0, size).pipe(
      expand((page) =>
        page.page + 1 < page.totalPages && (page.page + 1) * size < SAVED_SEARCH_PICKER_LIMIT
          ? this.list(page.page + 1, size)
          : EMPTY,
      ),
      reduce((all, page) => all.concat(page.content), [] as SavedSearchDTO[]),
    );
  }
  create(body: SavedSearchRequest) {
    return this.http.post<SavedSearchDTO>(this.base, body);
  }
  update(id: number, body: SavedSearchRequest) {
    return this.http.patch<SavedSearchDTO>(`${this.base}/${id}`, body);
  }
  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
  /** Replays the saved filters against current records (also when monitoring is paused). */
  results(id: number, page = 0, size = 20) {
    return this.http.get<Page<PropertySearchItem>>(`${this.base}/${id}/results`, {
      params: queryParams({ page, size }),
    });
  }
}
