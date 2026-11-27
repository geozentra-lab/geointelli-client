import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Action } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';
import { ContactRequestService } from '../../data-access/contact-request.service';
import { ContactRequestsActions as A } from './contact-requests.actions';
import { UiActions } from '../ui/ui.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class ContactRequestsEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(ContactRequestService);
  professionals = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadProfessionals),
      switchMap(() =>
        this.service.professionals().pipe(
          map((page) => A.professionalsLoaded({ professionals: page.content })),
          catchError((e) => of(A.professionalsFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  submit = createEffect(() =>
    this.actions.pipe(
      ofType(A.submit),
      concatMap(({ request, idempotencyKey }) =>
        this.service.submit(request, idempotencyKey).pipe(
          map((response) => A.submitted({ response })),
          // A professional who left the list since it was read (license expired, role revoked):
          // said in words, and the list is read again so they can't be chosen twice.
          catchError((e) =>
            e instanceof HttpErrorResponse && e.status === 404 && /professional/i.test(String(e.error?.message ?? ''))
              ? of<Action[]>(
                  A.submitFailed({ error: 'This professional is no longer listed. Choose another one.' }),
                  A.loadProfessionals(),
                )
              : of<Action[]>(A.submitFailed({ error: apiError(e) })),
          ),
        ),
      ),
    ),
  );
  feedback = createEffect(() =>
    this.actions.pipe(
      ofType(A.submitted),
      map(() => UiActions.toast({ message: 'Your contact request was sent.' })),
    ),
  );
}
