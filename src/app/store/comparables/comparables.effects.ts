import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { ComparableService } from '../../data-access/comparable.service';
import { ComparablesActions as A } from './comparables.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class ComparablesEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(ComparableService);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(({ id, query }) =>
        this.service.get(id, query).pipe(
          map((response) => A.loaded({ response })),
          catchError((e) => of(A.failed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
}
