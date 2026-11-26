import { UiActions } from '../ui/ui.actions';
import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, concatMap, tap } from 'rxjs';
import { UserService } from '../../data-access/user.service';
import { UserActions as A } from './user.actions';
import { apiError } from '../../core/models/api-error';
import { SessionEvents } from '../../core/auth/session-events';
@Injectable()
export class UserEffects extends SessionScopedEffects {
  private session = inject(SessionEvents);
  private actions = inject(Actions);
  private service = inject(UserService);
  endSession = createEffect(
    () =>
      this.actions.pipe(
        ofType(A.signedOut),
        tap(() => this.session.end()),
      ),
    { dispatch: false },
  );
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(() =>
        this.service.me().pipe(
          map((profile) => A.loaded({ profile })),
          catchError((e) => of(A.failed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  preferences = createEffect(() =>
    this.actions.pipe(
      ofType(A.loaded, A.loadPreferences),
      switchMap(() =>
        this.service.preferences().pipe(
          map((preferences) => A.preferencesLoaded({ preferences })),
          catchError((e) => of(A.preferencesLoadFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  update = createEffect(() =>
    this.actions.pipe(
      ofType(A.saveProfile),
      concatMap((action) =>
        this.service
          .updateProfile(action.request)
          .pipe(
            map((profile) => A.profileSaved({ profile })),
            catchError((e) => of(A.profileFailed({ error: apiError(e) }))),
          ),
      ),
    ),
  );
  savePreferences = createEffect(() =>
    this.actions.pipe(
      ofType(A.savePreferences),
      concatMap(({ preferences }) =>
        this.service.updatePreferences(preferences).pipe(
          map((preferences) => A.preferencesSaved({ preferences })),
          catchError((e) => of(A.preferencesFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  feedback = createEffect(() =>
    this.actions.pipe(
      ofType(A.profileSaved, A.preferencesSaved, A.profileFailed, A.preferencesFailed),
      map((a) =>
        UiActions.toast({
          kind: 'error' in a ? 'error' : 'info',
          message:
            'error' in a
              ? 'Changes could not be saved. ' + a.error
              : a.type === A.profileSaved.type
                ? 'Profile updated.'
                : 'Preferences saved.',
        }),
      ),
    ),
  );
}
