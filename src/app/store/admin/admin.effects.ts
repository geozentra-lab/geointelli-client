import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of, switchMap } from 'rxjs';
import { AdminService } from '../../data-access/admin.service';
import { apiError } from '../../core/models/api-error';
import { UiActions } from '../ui/ui.actions';
import { AdminActions as A } from './admin.actions';
@Injectable()
export class AdminEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private api = inject(AdminService);
  dataQuality = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadDataQuality),
      switchMap(({ rule, page }) =>
        this.api.dataQuality(rule, page).pipe(
          map((report) => A.dataQualityLoaded({ report })),
          catchError((e) => of(A.dataQualityFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  refreshRequests = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadRefreshRequests),
      switchMap(({ status, page }) =>
        this.api.valuationRefreshRequests(status, page).pipe(
          map((p) => A.refreshRequestsLoaded({ page: p })),
          catchError((e) => of(A.refreshRequestsFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** mergeMap: acting on one request never cancels an action on another. */
  cancel = createEffect(() =>
    this.actions.pipe(
      ofType(A.cancelRefresh),
      mergeMap(({ id }) =>
        this.api.cancelValuationRefresh(id).pipe(
          mergeMap((request) => [
            A.refreshRequestChanged({ id, request }),
            UiActions.toast({ message: 'Refresh request cancelled.' }),
          ]),
          catchError((e) => of(A.refreshActionFailed({ id, error: apiError(e) }))),
        ),
      ),
    ),
  );
  retry = createEffect(() =>
    this.actions.pipe(
      ofType(A.retryRefresh),
      mergeMap(({ id, idempotencyKey }) =>
        this.api.retryValuationRefresh(id, idempotencyKey).pipe(
          mergeMap((request) => [
            A.refreshRequestChanged({ id, request }),
            UiActions.toast({ message: 'A new refresh request was queued.' }),
          ]),
          catchError((e) => of(A.refreshActionFailed({ id, error: apiError(e) }))),
        ),
      ),
    ),
  );
}
