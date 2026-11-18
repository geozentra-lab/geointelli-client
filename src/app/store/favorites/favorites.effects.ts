import { SessionScopedEffects } from '../session-scoped-effects';
import { Action } from '@ngrx/store';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  Observable,
  catchError,
  map,
  of,
  switchMap,
  concatMap,
  from,
  mergeMap,
  takeUntil,
} from 'rxjs';
import { FavoriteService } from '../../data-access/favorite.service';
import { PropertyService } from '../../data-access/property.service';
import { favoritesActions as A } from './favorites.actions';
import { CatalogActions } from '../catalog/catalog.actions';
import { UserActions } from '../user/user.actions';
import { UiActions } from '../ui/ui.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class FavoritesEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(FavoriteService);
  private properties = inject(PropertyService);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load, UserActions.loaded),
      switchMap(() =>
        this.service.list().pipe(
          takeUntil(this.actions.pipe(ofType(A.add, A.remove, A.saved, A.removed))),
          map((items) => A.loaded({ items })),
          catchError((e) => of(A.failed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  save = createEffect(() =>
    this.actions.pipe(
      ofType(A.add, A.remove),
      concatMap((a) => {
        const request: Observable<Action> =
          a.type === A.add.type
            ? this.service.add(a.propertyId).pipe(map((item) => A.saved({ item })))
            : this.service
                .remove(a.propertyId)
                .pipe(map(() => A.removed({ propertyId: a.propertyId })));
        return request.pipe(
          catchError((e) => of(A.failed({ error: apiError(e), propertyId: a.propertyId }))),
        );
      }),
    ),
  );
  hydrate = createEffect(() =>
    this.actions.pipe(
      ofType(A.loaded),
      switchMap(({ items }) =>
        from(items.filter((i) => i.favorite)).pipe(
          map((item) => A.loadProperty({ propertyId: item.propertyId })),
        ),
      ),
    ),
  );
  property = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadProperty),
      mergeMap(
        ({ propertyId }) =>
          this.properties.getById(propertyId).pipe(
            mergeMap((property) =>
              of(CatalogActions.cacheProperty({ property }), A.propertyLoaded({ propertyId })),
            ),
            catchError((e) => of(A.propertyFailed({ propertyId, error: apiError(e) }))),
          ),
        4,
      ),
    ),
  );
  feedback = createEffect(() =>
    this.actions.pipe(
      ofType(A.saved, A.removed, A.failed),
      map((a) =>
        UiActions.toast({
          kind: a.type === A.failed.type ? 'error' : 'info',
          message:
            a.type === A.failed.type
              ? 'Could not update favorites. ' + a.error
              : a.type === A.removed.type
                ? 'Removed from favorites.'
                : 'Added to favorites.',
        }),
      ),
    ),
  );
}
