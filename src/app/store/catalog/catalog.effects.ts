import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  EMPTY,
  catchError,
  filter,
  finalize,
  map,
  of,
  switchMap,
  mergeMap,
  from,
  timer,
  forkJoin,
  withLatestFrom,
  groupBy,
} from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AddressService } from '../../data-access/address.service';
import { LOOKUP_PAGE, MIN_LOOKUP_QUERY } from './catalog.model';
/** Typing pauses this long before a lookup is sent. */
const LOOKUP_DEBOUNCE_MS = 300;
import { selectCatalog } from './catalog.selectors';
import { PropertyService } from '../../data-access/property.service';
import { ImageService } from '../../data-access/image.service';
import { apiError } from '../../core/models/api-error';
import { CatalogActions as A } from './catalog.actions';
@Injectable()
export class CatalogEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private properties = inject(PropertyService);
  private images = inject(ImageService);
  private addresses = inject(AddressService);
  private store = inject(Store);
  /**
   * Typeaheads, one request stream per key: a new query (or closing the picker) cancels that
   * key's request in flight, and never another picker's. Results are cached for their photos.
   */
  lookup = createEffect(() =>
    this.actions.pipe(
      ofType(A.lookup, A.lookupClosed),
      groupBy((a) => a.key),
      mergeMap((byKey) =>
        byKey.pipe(
          switchMap((a) => {
            if (a.type === A.lookupClosed.type) return EMPTY;
            const { key, source } = a;
            const query = a.query.trim();
            if (query.length < MIN_LOOKUP_QUERY) return EMPTY;
            const request =
              source === 'address'
                ? this.addresses.search(query)
                : this.properties
                    .search({ address: query, page: 0, size: LOOKUP_PAGE })
                    .pipe(map((page) => page.content));
            return timer(a.immediate ? 0 : LOOKUP_DEBOUNCE_MS).pipe(
              switchMap(() => request),
              mergeMap((items) => [
                A.lookupLoaded({ key, query, items }),
                ...(items.length ? [A.cacheItems({ items })] : []),
              ]),
              // The address search answers 404 when nothing matches: an empty list, not an outage.
              catchError((e: unknown) =>
                of(
                  source === 'address' && e instanceof HttpErrorResponse && e.status === 404
                    ? A.lookupLoaded({ key, query, items: [] })
                    : A.lookupFailed({ key, query, error: apiError(e) }),
                ),
              ),
            );
          }),
        ),
      ),
    ),
  );
  search = createEffect(() =>
    this.actions.pipe(
      ofType(A.search),
      switchMap(({ query }) =>
        timer(250).pipe(
          switchMap(() => this.properties.search(query)),
          map((page) => A.loaded({ page })),
          catchError((e) => of(A.failed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  detail = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadDetail),
      switchMap(({ id }) =>
        this.properties.getById(id).pipe(
          map((property) => A.detailLoaded({ property })),
          catchError((e) => of(A.detailFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  photos = createEffect(() =>
    this.actions.pipe(
      ofType(A.loaded),
      switchMap(({ page }) =>
        from(page.content).pipe(
          mergeMap(
            (p) =>
              this.images.getPropertyImages(p.id).pipe(
                map((images) => A.photoLoaded({ id: p.id, images })),
                catchError((e) => of(A.photoLoaded({ id: p.id, images: [], error: apiError(e) }))),
              ),
            4,
          ),
        ),
      ),
    ),
  );
  /** Items cached by other features (e.g. recommendations) load photos without cancelling search. */
  cachedPhotos = createEffect(() =>
    this.actions.pipe(
      ofType(A.cacheItems),
      withLatestFrom(this.store.select(selectCatalog)),
      // Typeahead pickers re-cache the same matches on every keystroke; fetch each photo set once.
      mergeMap(([{ items }, catalog]) => from(items.filter((p) => !catalog.photos[p.id]))),
      mergeMap(
        (p) =>
          this.images.getPropertyImages(p.id).pipe(
            map((images) => A.photoLoaded({ id: p.id, images })),
            catchError((e) => of(A.photoLoaded({ id: p.id, images: [], error: apiError(e) }))),
          ),
        4,
      ),
    ),
  );
  /** Lookups in flight; failures are recorded in state so components stop re-requesting. */
  private resolved = new Set<number>();
  resolve = createEffect(() =>
    this.actions.pipe(
      ofType(A.resolveProperty),
      withLatestFrom(this.store.select(selectCatalog)),
      filter(([{ id }, catalog]) => !catalog.entities[id] && !this.resolved.has(id)),
      mergeMap(([{ id }]) => {
        this.resolved.add(id);
        return this.properties.getById(id).pipe(
          map((property) => A.cacheProperty({ property })),
          // Callers show "details unavailable" with a retry; a failed lookup is not worth a toast.
          catchError(() => of(A.resolveFailed({ id }))),
          finalize(() => this.resolved.delete(id)),
        );
      }, 4),
    ),
  );
  favoritePhotos = createEffect(() =>
    this.actions.pipe(
      ofType(A.cacheProperty),
      mergeMap(
        ({ property }) =>
          this.images.getPropertyImages(property.id!).pipe(
            map((images) => A.photoLoaded({ id: property.id!, images })),
            catchError((e) =>
              of(A.photoLoaded({ id: property.id!, images: [], error: apiError(e) })),
            ),
          ),
        4,
      ),
    ),
  );
  evidence = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadDetail),
      switchMap(({ id }) =>
        forkJoin({
          schools: this.properties.schoolContext(id).pipe(
            map((data) => ({ data, error: '' })),
            catchError((e) => of({ data: null, error: 'Schools: ' + apiError(e) })),
          ),
          transport: this.properties.transportContext(id).pipe(
            map((data) => ({ data, error: '' })),
            catchError((e) => of({ data: null, error: 'Transportation: ' + apiError(e) })),
          ),
        }).pipe(
          map((v) =>
            A.evidenceLoaded({
              id,
              evidence: {
                schools: v.schools.data,
                transportation: v.transport.data,
                errors: [v.schools.error, v.transport.error].filter(Boolean),
              },
            }),
          ),
        ),
      ),
    ),
  );
}
