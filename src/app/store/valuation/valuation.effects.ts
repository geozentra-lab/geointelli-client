import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { PredictionService } from '../../data-access/prediction.service';
import { ValuationService } from '../../data-access/valuation.service';
import { ValuationActions as A } from './valuation.actions';
@Injectable()
export class ValuationEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(PredictionService);
  private valuations = inject(ValuationService);
  /** switchMap cancels the previous property's request when the page moves to another one. */
  valuationDetail = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadDetail),
      switchMap(({ propertyId }) =>
        this.valuations.get(propertyId).pipe(
          map((valuation) => A.detailLoaded({ propertyId, valuation })),
          catchError((e: unknown) =>
            of(
              A.detailFailed({
                propertyId,
                notFound: isNotFound(e),
                error: isNotFound(e)
                  ? 'This property was not found.'
                  : 'The valuation could not be loaded. Please retry.',
              }),
            ),
          ),
        ),
      ),
    ),
  );
  detail = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(({ propertyId }) =>
        this.service.getPropertyValuePrediction(propertyId).pipe(
          map((prediction) => A.loaded({ prediction })),
          // 404 means no estimate has been scored for this property: an empty state, not an outage.
          catchError((e: unknown) =>
            of(
              isNotFound(e)
                ? A.loaded({ prediction: null })
                : A.failed({ error: 'The prediction is unavailable for this property.' }),
            ),
          ),
        ),
      ),
    ),
  );
  bulk = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadBulk),
      switchMap(({ propertyIds }) =>
        this.service.getPropertyValuePredictionBulk(propertyIds).pipe(
          map((predictions) => A.bulkLoaded({ predictions })),
          // 404 means none of the visible properties has an estimate yet.
          catchError((e: unknown) =>
            of(
              isNotFound(e)
                ? A.bulkLoaded({ predictions: {} })
                : A.bulkFailed({ error: 'The growth heatmap could not load. Please retry.' }),
            ),
          ),
        ),
      ),
    ),
  );
}
function isNotFound(e: unknown) {
  return e instanceof HttpErrorResponse && e.status === 404;
}
