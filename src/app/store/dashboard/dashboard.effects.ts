import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Observable, catchError, map, merge, of, switchMap } from 'rxjs';
import { Action } from '@ngrx/store';
import { DashboardService } from '../../data-access/dashboard.service';
import { DashboardActions as A, DashboardCardKey } from './dashboard.actions';
import { apiError } from '../../core/models/api-error';
/** One card's request; a failure becomes that card's error and never blanks the others. */
function card<T>(
  key: DashboardCardKey,
  request: Observable<T>,
  loaded: (value: T) => Action,
): Observable<Action> {
  return request.pipe(
    map(loaded),
    catchError((e) => of(A.cardFailed({ card: key, error: apiError(e) }))),
  );
}
@Injectable()
export class DashboardEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(DashboardService);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(() =>
        merge(
          card('favorites', this.service.favorites(), (c) => A.favoritesLoaded({ card: c })),
          card('savedSearches', this.service.savedSearches(), (c) =>
            A.savedSearchesLoaded({ card: c }),
          ),
          card('alerts', this.service.alerts(), (c) => A.alertsLoaded({ card: c })),
          card('activity', this.service.activity(), (c) => A.activityLoaded({ card: c })),
        ),
      ),
    ),
  );
}
