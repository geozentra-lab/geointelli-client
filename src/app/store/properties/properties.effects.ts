import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, Observable, catchError, debounceTime, map, mergeMap, of, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { apiError } from '../../core/models/api-error';
import { Action } from '@ngrx/store';
import { ParcelService } from '../../data-access/parcel.service';
import { AddressService } from '../../data-access/address.service';
import { PropertyService } from '../../data-access/property.service';
import { MapLayerService } from '../../data-access/map-layer.service';
import { PropertiesActions as A } from './properties.actions';
import { CatalogActions } from '../catalog/catalog.actions';
const notFound = (e: unknown) => e instanceof HttpErrorResponse && e.status === 404;
@Injectable()
export class PropertiesEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private parcels = inject(ParcelService);
  private addresses = inject(AddressService);
  private properties = inject(PropertyService);
  private mapLayers = inject(MapLayerService);
  layers = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadLayers),
      switchMap(() =>
        this.mapLayers.layers().pipe(
          map((layers) => A.layersLoaded({ layers })),
          catchError(() => of(A.layersLoaded({ layers: [] }))),
        ),
      ),
    ),
  );
  parcels$ = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadParcels, A.search, A.clearParcels),
      switchMap((action) => {
        if (action.type === A.clearParcels.type) return EMPTY;
        const request: Observable<Action> =
          action.type === A.loadParcels.type
            ? this.parcels
                .getParcels(action.bbox)
                .pipe(map((parcels) => A.parcelsLoaded({ parcels, folio: null })))
            : action.query.mode === 'folio'
              ? this.parcels.getParcelByFolio(action.query.value, action.query.countyId).pipe(
                  map((response) => {
                    const parcels = (Array.isArray(response) ? response : [response]).filter(
                      Boolean,
                    );
                    return parcels.length
                      ? A.parcelsLoaded({ parcels, folio: parcels[0]?.folio ?? null })
                      : A.folioNotFound({ folio: action.query.value });
                  }),
                )
              : this.addresses.search(action.query.value).pipe(
                  // Cards are cached so the match list and pickers share photos and addresses.
                  mergeMap((matches) =>
                    of(
                      CatalogActions.cacheItems({ items: matches }),
                      A.addressMatched({ matches }),
                    ),
                  ),
                );
        return request.pipe(
          catchError((e) =>
            of(
              // "Not found" is an answer, not an outage: say so instead of blaming the connection.
              action.type === A.search.type && notFound(e)
                ? action.query.mode === 'folio'
                  ? A.folioNotFound({ folio: action.query.value })
                  : A.addressMatched({ matches: [] })
                : A.failed({ error: 'Could not load parcels. ' + apiError(e) }),
            ),
          ),
        );
      }),
    ),
  );
  /**
   * Address search returns lightweight cards without geometry (backend #142), so the boundary of
   * the shown match is fetched by folio and county. A new search or viewport load cancels it.
   */
  matchBoundary$ = createEffect(() =>
    this.actions.pipe(
      ofType(A.addressMatched, A.chooseMatch, A.search, A.loadParcels, A.clearParcels),
      switchMap((action) => {
        const match =
          action.type === A.chooseMatch.type
            ? action.match
            : action.type === A.addressMatched.type
              ? action.matches[0]
              : undefined;
        if (!match) return EMPTY;
        return this.parcels.getParcelByFolio(match.folio, match.countyId).pipe(
          map((response) => {
            const parcels = (Array.isArray(response) ? response : [response]).filter(Boolean);
            return parcels.length
              ? A.parcelsLoaded({ parcels, folio: parcels[0]?.folio ?? match.folio })
              : A.matchBoundaryMissing({ match });
          }),
          catchError((e) =>
            of(
              notFound(e)
                ? A.matchBoundaryMissing({ match })
                : A.failed({ error: 'Could not load the parcel boundary. ' + apiError(e) }),
            ),
          ),
        );
      }),
    ),
  );
  detail$ = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadDetail),
      switchMap(({ folio, countyId }) =>
        this.properties.getPropertyDetails(folio, countyId).pipe(
          map((property) => A.detailLoaded({ property })),
          catchError(() =>
            of(A.detailFailed({ error: 'Property details are unavailable. Please retry.' })),
          ),
        ),
      ),
    ),
  );
  suggestions$ = createEffect(() =>
    this.actions.pipe(
      ofType(A.suggest),
      debounceTime(350),
      switchMap(({ raw }) =>
        raw.trim().length < 3
          ? of(A.suggested({ suggestions: [] }))
          : this.addresses.suggest(raw).pipe(
              map((suggestions) => A.suggested({ suggestions })),
              catchError(() => of(A.suggested({ suggestions: [] }))),
            ),
      ),
    ),
  );
}
