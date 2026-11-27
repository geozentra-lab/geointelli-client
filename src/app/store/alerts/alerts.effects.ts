import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Action, Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  Observable,
  catchError,
  map,
  of,
  switchMap,
  concatMap,
  mergeMap,
  withLatestFrom,
} from 'rxjs';
import { AlertService } from '../../data-access/alert.service';
import { alertsActions as A } from './alerts.actions';
import { selectAlertsState as selectState } from './alerts.selectors';
import { UserActions } from '../user/user.actions';
import { UiActions } from '../ui/ui.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class AlertsEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(AlertService);
  private store = inject(Store);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load, UserActions.loaded),
      switchMap((a) =>
        this.service.list('page' in a ? a.page : 0).pipe(
          map((page) => A.loaded({ page })),
          catchError((e) => of(A.failed({ error: apiError(e), operation: 'load' }))),
        ),
      ),
    ),
  );
  save = createEffect(() =>
    this.actions.pipe(
      ofType(A.create, A.update, A.remove),
      concatMap((a) => {
        const request: Observable<Action> =
          a.type === A.create.type
            ? this.service.create(a.request).pipe(map((item) => A.saved({ item })))
            : a.type === A.update.type
              ? this.service.update(a.id, a.request).pipe(map((item) => A.saved({ item })))
              : this.service.remove(a.id).pipe(map(() => A.removed({ id: a.id })));
        return request.pipe(
          catchError((e) => of(A.failed({ error: apiError(e), operation: 'save' }))),
        );
      }),
    ),
  );
  refresh = createEffect(() =>
    this.actions.pipe(
      ofType(A.saved, A.removed),
      withLatestFrom(this.store.select(selectState)),
      mergeMap(([_, s]) =>
        of(
          UiActions.toast({ message: 'Changes saved.' }),
          A.load({ page: Math.min(s.page, Math.max(0, Math.ceil(s.totalElements / 20) - 1)) }),
        ),
      ),
    ),
  );
  monitoring = createEffect(() =>
    this.actions.pipe(
      ofType(A.monitoring, A.evaluationScheduled),
      mergeMap(
        ({ id }) =>
          this.service.monitoring(id).pipe(
            map((status) => A.monitoringLoaded({ id, status })),
            catchError((e) => of(A.monitoringFailed({ id, error: apiError(e) }))),
          ),
        4,
      ),
    ),
  );
  evaluate = createEffect(() =>
    this.actions.pipe(
      ofType(A.evaluate),
      concatMap(({ id }) =>
        this.service.evaluate(id).pipe(
          mergeMap(() =>
            of(
              A.evaluationScheduled({ id }),
              UiActions.toast({ message: 'Evaluation scheduled.' }),
            ),
          ),
          // Said in a toast too: the monitoring status reads share the inline message, the click doesn't.
          catchError((e) => {
            const error = apiError(e);
            return of(
              A.monitoringFailed({ id, error }),
              UiActions.toast({ message: 'Evaluation not scheduled. ' + error, kind: 'error' }),
            );
          }),
        ),
      ),
    ),
  );
}
