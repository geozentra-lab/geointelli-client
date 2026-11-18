import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  EMPTY,
  catchError,
  concatMap,
  exhaustMap,
  filter,
  map,
  of,
  switchMap,
  takeUntil,
  timer,
} from 'rxjs';
import { SessionScopedEffects } from '../session-scoped-effects';
import { UserActions } from '../user/user.actions';
import { NotificationService } from '../../data-access/notification.service';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { apiError } from '../../core/models/api-error';
import { NotificationsActions as A } from './notifications.actions';
@Injectable()
export class NotificationsEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(NotificationService);
  private auth = inject(KeycloakService);
  poll = createEffect(() =>
    this.actions.pipe(
      ofType(UserActions.loaded),
      switchMap(() =>
        timer(0, 30000).pipe(
          filter(
            () =>
              document.visibilityState === 'visible' && navigator.onLine && this.auth.isLoggedIn(),
          ),
          map(() => A.load()),
          takeUntil(this.actions.pipe(ofType(UserActions.signedOut))),
        ),
      ),
    ),
  );
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      exhaustMap(() =>
        !this.auth.isLoggedIn()
          ? EMPTY
          : this.service.list().pipe(
              map((page) => A.loaded({ page })),
              catchError((e) => of(A.failed({ error: apiError(e) }))),
              takeUntil(this.actions.pipe(ofType(A.markRead, A.readSaved, UserActions.signedOut))),
            ),
      ),
    ),
  );
  read = createEffect(() =>
    this.actions.pipe(
      ofType(A.markRead),
      concatMap(({ id }) =>
        !this.auth.isLoggedIn()
          ? EMPTY
          : this.service.markRead(id).pipe(
              map((item) => A.readSaved({ item })),
              catchError((e) => of(A.readFailed({ id, error: apiError(e) }))),
              takeUntil(this.actions.pipe(ofType(UserActions.signedOut))),
            ),
      ),
    ),
  );
}
