import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, mergeMap, of, switchMap } from 'rxjs';
import { RealtorLicenseService } from '../../data-access/realtor-license.service';
import { apiError } from '../../core/models/api-error';
import { UiActions } from '../ui/ui.actions';
import { RealtorLicenseActions as A } from './realtor-license.actions';
@Injectable()
export class RealtorLicenseEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private api = inject(RealtorLicenseService);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(() =>
        this.api.history().pipe(
          map((history) => A.loaded({ history })),
          catchError((e) => of(A.loadFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** exhaustMap: a double click sends one submission, never a second that would answer 409. */
  submit = createEffect(() =>
    this.actions.pipe(
      ofType(A.submit),
      exhaustMap(({ request }) =>
        this.api.submit(request).pipe(
          mergeMap((verification) => [
            A.submitted({ verification }),
            UiActions.toast({ message: 'License submitted for review.' }),
          ]),
          catchError((e: unknown) =>
            of(
              A.submitFailed({
                error:
                  e instanceof HttpErrorResponse && e.status === 409
                    ? 'A submission is already pending or verified, so a new one cannot be sent.'
                    : apiError(e),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
