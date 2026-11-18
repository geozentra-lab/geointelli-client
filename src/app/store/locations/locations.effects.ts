import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, EMPTY, groupBy, mergeMap } from 'rxjs';
import { LocationService } from '../../data-access/location.service';
import { LocationsActions as A } from './locations.actions';
@Injectable()
export class LocationsEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(LocationService);
  states = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadStates),
      switchMap(() =>
        this.service.getStates().pipe(
          map((states) => A.statesLoaded({ states })),
          catchError(() => of(A.failed({ error: 'States could not load. Please retry.' }))),
        ),
      ),
    ),
  );
  /** One request per state at a time; a state already loading is not asked for twice. */
  countiesFor = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadCountiesFor),
      groupBy(({ stateId }) => stateId),
      mergeMap((byState) =>
        byState.pipe(
          switchMap(({ stateId }) =>
            this.service.getCounties(stateId).pipe(
              map((counties) => A.countiesForLoaded({ stateId, counties })),
              catchError(() =>
                of(
                  A.countiesForFailed({
                    stateId,
                    error: 'Counties could not load. Please select the state again to retry.',
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  counties = createEffect(() =>
    this.actions.pipe(
      ofType(A.selectState),
      switchMap(({ stateId }) =>
        stateId === null
          ? EMPTY
          : this.service.getCounties(stateId).pipe(
              map((counties) => A.countiesLoaded({ counties })),
              catchError(() =>
                of(
                  A.failed({
                    error: 'Counties could not load. Please select the state again to retry.',
                  }),
                ),
              ),
            ),
      ),
    ),
  );
}
