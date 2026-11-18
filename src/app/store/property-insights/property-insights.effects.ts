import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Observable, catchError, concat, from, map, mergeMap, of, switchMap } from 'rxjs';
import { Action } from '@ngrx/store';
import { PropertyService } from '../../data-access/property.service';
import { ComparableService } from '../../data-access/comparable.service';
import { ParcelService } from '../../data-access/parcel.service';
import { ValuationService } from '../../data-access/valuation.service';
import { apiError } from '../../core/models/api-error';
import { ComparableRequest } from '../../core/models/api';
import { parcelPoint } from '../../shared/data/parcel-geometry';
import { InsightSection, PropertyInsightsActions as A } from './property-insights.actions';
/** Up to four parcel lookups at a time for the map pins. */
const PARCEL_CONCURRENCY = 4;
/** Same search the Compare page starts with; ten pins keep the map readable. */
export const COMPARABLES_MAP_QUERY: ComparableRequest = {
  radiusMeters: 2000,
  months: 24,
  limit: 10,
};
@Injectable()
export class PropertyInsightsEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private properties = inject(PropertyService);
  private comparables = inject(ComparableService);
  private parcels = inject(ParcelService);
  private valuations = inject(ValuationService);
  /** A failed read becomes that section's error, phrased for the section. */
  private fail(propertyId: number, section: InsightSection, prefix = '') {
    return (e: unknown): Observable<Action> =>
      of(A.failed({ propertyId, section, error: prefix + apiError(e) }));
  }
  features = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadFeatures),
      switchMap(({ propertyId, history, page }) =>
        this.properties.extraFeatures(propertyId, { history, page, size: 25 }).pipe(
          map((features) => A.featuresLoaded({ propertyId, features })),
          catchError(this.fail(propertyId, 'features')),
        ),
      ),
    ),
  );
  units = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadUnits),
      switchMap(({ propertyId, page }) =>
        this.properties.children(propertyId, page).pipe(
          map((p) => A.unitsLoaded({ propertyId, page: p })),
          catchError(this.fail(propertyId, 'units')),
        ),
      ),
    ),
  );
  candidates = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadCandidates),
      switchMap(({ propertyId, query }) =>
        this.comparables.candidates(propertyId, query).pipe(
          map((response) => A.candidatesLoaded({ propertyId, response })),
          catchError(this.fail(propertyId, 'candidates')),
        ),
      ),
    ),
  );
  history = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadHistory),
      switchMap(({ propertyId, page }) =>
        this.valuations.history(propertyId, page).pipe(
          map((p) => A.historyLoaded({ propertyId, page: p })),
          catchError(this.fail(propertyId, 'history')),
        ),
      ),
    ),
  );
  opportunity = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadOpportunity),
      switchMap(({ propertyId }) =>
        this.valuations.opportunityScore(propertyId).pipe(
          map((score) => A.opportunityLoaded({ propertyId, score })),
          catchError((e: unknown) =>
            of(
              A.failed({
                propertyId,
                section: 'opportunity',
                error:
                  e instanceof HttpErrorResponse && e.status === 404
                    ? 'This property was not found.'
                    : apiError(e),
              }),
            ),
          ),
        ),
      ),
    ),
  );
  /**
   * The comparable sales first, then the parcel of the home and of each comparable for its pin.
   * One failed parcel only leaves that pin off the map; a new property cancels all of it.
   */
  comparablesMap = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadComparablesMap),
      switchMap(({ propertyId, subject }) =>
        this.comparables.get(propertyId, COMPARABLES_MAP_QUERY).pipe(
          switchMap((response) => {
            const targets = [
              ...(subject ? [{ key: 'subject' as const, ...subject }] : []),
              ...response.comparables.map((c) => ({
                key: c.candidate.propertyId,
                folio: c.candidate.folio,
                countyId: c.candidate.countyId,
              })),
            ];
            return concat(
              of(A.comparablesMapLoaded({ propertyId, response })),
              from(targets).pipe(
                mergeMap(
                  (t) =>
                    this.parcels.getParcelByFolio(t.folio, t.countyId).pipe(
                      map((parcels) =>
                        A.placementFound({
                          propertyId,
                          key: t.key,
                          placement: parcelPoint(parcels),
                        }),
                      ),
                      catchError(() =>
                        of(A.placementFound({ propertyId, key: t.key, placement: null })),
                      ),
                    ),
                  PARCEL_CONCURRENCY,
                ),
              ),
            );
          }),
          catchError(
            this.fail(propertyId, 'comparables', 'Comparable sales could not be loaded. '),
          ),
        ),
      ),
    ),
  );
}
