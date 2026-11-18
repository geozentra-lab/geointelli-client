import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';
import { PropertyService } from '../../data-access/property.service';
import { PropertyCompareActions as A } from './property-compare.actions';
import { selectCompareSelection } from './property-compare.selectors';
import { COMPARE_MIN } from './property-compare.reducer';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class PropertyCompareEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private store = inject(Store);
  private properties = inject(PropertyService);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      withLatestFrom(this.store.select(selectCompareSelection)),
      switchMap(([, ids]) =>
        ids.length < COMPARE_MIN
          ? of(A.failed({ error: 'Choose at least ' + COMPARE_MIN + ' properties to compare.' }))
          : this.properties.compare(ids).pipe(
              map((response) => A.loaded({ response })),
              catchError((e) => of(A.failed({ error: apiError(e) }))),
            ),
      ),
    ),
  );
}
