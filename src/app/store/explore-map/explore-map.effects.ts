import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  defer,
  filter,
  finalize,
  from,
  map,
  mergeMap,
  of,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import { ParcelService } from '../../data-access/parcel.service';
import { parcelPoint } from '../../shared/data/parcel-geometry';
import { ExploreMapActions as A, PlaceTarget } from './explore-map.actions';
import { selectExploreMap } from './explore-map.selectors';

/** Up to four parcel lookups at a time, as for the comparables map. */
const PARCEL_CONCURRENCY = 4;

@Injectable()
export class ExploreMapEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private store = inject(Store);
  private parcels = inject(ParcelService);

  /**
   * Each result's parcel by folio and county; its centroid is the pin and its outline the boundary.
   * A 404 (or no usable geometry) means no boundary is on record; any other failure is reported as
   * such, so it can be retried and is never shown as "no boundary".
   *
   * One page at a time: a new request replaces the lookups still queued or running for the page
   * before (switchMap), so a page the user has left never holds up the one on screen. The same
   * lookups asked for again while they run are not restarted. The local state lives inside
   * `defer`, so it starts over when the session ends and the effect is resubscribed.
   */
  place = createEffect(() =>
    defer(() => {
      /** Properties of the current page whose lookup hasn't answered yet. */
      let running = new Set<number>();
      return this.actions.pipe(
        ofType(A.placeProperties),
        withLatestFrom(this.store.select(selectExploreMap)),
        map(([{ targets }, s]) => unplaced(targets, s.placements)),
        // Everything asked for is already being looked up: carry on.
        filter((batch) => !batch.length || !batch.every((t) => running.has(t.propertyId))),
        switchMap((batch) => {
          const ids = new Set(batch.map((t) => t.propertyId));
          running = ids;
          return from(batch).pipe(
            mergeMap(
              (t) => this.lookup(t).pipe(finalize(() => ids.delete(t.propertyId))),
              PARCEL_CONCURRENCY,
            ),
          );
        }),
      );
    }),
  );

  private lookup(t: PlaceTarget) {
    return this.parcels.getParcelByFolio(t.folio, t.countyId).pipe(
      map((parcels) => A.placementFound({ propertyId: t.propertyId, placement: parcelPoint(parcels) })),
      catchError((e: unknown) =>
        of(
          e instanceof HttpErrorResponse && e.status === 404
            ? A.placementFound({ propertyId: t.propertyId, placement: null })
            : A.placementFailed({ propertyId: t.propertyId }),
        ),
      ),
    );
  }
}

/** The targets still to look up, each property once. */
export function unplaced(targets: PlaceTarget[], placements: Record<number, unknown>) {
  const seen = new Set<number>();
  return targets.filter((t) => {
    if (t.propertyId in placements || seen.has(t.propertyId)) return false;
    seen.add(t.propertyId);
    return true;
  });
}
