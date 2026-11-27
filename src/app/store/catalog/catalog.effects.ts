import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  EMPTY,
  catchError,
  defer,
  filter,
  finalize,
  map,
  of,
  switchMap,
  mergeMap,
  from,
  tap,
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
  /**
   * Ids accepted for a lookup, from the moment they are accepted (waiting behind the four in flight,
   * or in flight) until the answer. Marked on acceptance, not when the request starts, so an id still
   * waiting is not queued a second time. Failures are recorded in state so components stop asking.
   */
  private pending = new Set<number>();
  private catalog = this.store.selectSignal(selectCatalog);
  resolve = createEffect(() =>
    // A new session restarts the effects: it starts with nothing pending. Ids still waiting in the
    // queue when the last one ended never reached their finalize and would otherwise stay marked.
    defer(() => {
      this.pending.clear();
      return this.actions.pipe(
        ofType(A.resolveProperty),
        filter(({ id }) => !this.catalog().entities[id] && !this.pending.has(id)),
        tap(({ id }) => this.pending.add(id)),
        mergeMap(
          ({ id }) =>
            defer(() =>
              // Cached by another answer (a search, a page of results) while it waited: nothing to ask.
              this.catalog().entities[id]
                ? EMPTY
                : this.properties.getById(id).pipe(
                    map((property) => A.cacheProperty({ property })),
                    // Callers show "details unavailable" with a retry; not worth a toast.
                    catchError(() => of(A.resolveFailed({ id }))),
                  ),
            ).pipe(finalize(() => this.pending.delete(id))),
          4,
        ),
      );
    }),
  );
  /** Photos for a property just cached, unless they were read already (a failed read is tried again). */
  favoritePhotos = createEffect(() =>
    this.actions.pipe(
      ofType(A.cacheProperty),
      withLatestFrom(this.store.select(selectCatalog)),
      filter(([{ property }, s]) => !(property.id! in s.photos) || !!s.photoErrors[property.id!]),
      mergeMap(
        ([{ property }]) =>
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
