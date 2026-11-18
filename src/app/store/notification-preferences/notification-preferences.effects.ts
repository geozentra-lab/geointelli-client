import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, mergeMap, of, switchMap } from 'rxjs';
import { NotificationService } from '../../data-access/notification.service';
import { NotificationPreferencesActions as A } from './notification-preferences.actions';
import { UiActions } from '../ui/ui.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class NotificationPreferencesEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(NotificationService);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(() =>
        this.service.preferences().pipe(
          map((preferences) => A.loaded({ preferences })),
          catchError((e) => of(A.failed({ error: apiError(e), operation: 'load' }))),
        ),
      ),
    ),
  );
  save = createEffect(() =>
    this.actions.pipe(
      ofType(A.save),
      concatMap(({ request }) =>
        this.service.updatePreferences(request).pipe(
          mergeMap((preferences) =>
            of(
              A.saved({ preferences }),
              UiActions.toast({ message: 'Notification settings saved.' }),
            ),
          ),
          catchError((e) => of(A.failed({ error: apiError(e), operation: 'save' }))),
        ),
      ),
    ),
  );
}
