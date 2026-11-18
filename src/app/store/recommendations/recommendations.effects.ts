import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { RecommendationService } from '../../data-access/recommendation.service';
import { RecommendationsActions as A } from './recommendations.actions';
import { CatalogActions } from '../catalog/catalog.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class RecommendationsEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(RecommendationService);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(({ limit }) =>
        this.service.list(limit).pipe(
          map((response) => A.loaded({ response })),
          catchError((e) => of(A.failed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** Reuses catalog caching so recommendation cards share photos and favorites with search. */
  cache = createEffect(() =>
    this.actions.pipe(
      ofType(A.loaded),
      map(({ response }) =>
        CatalogActions.cacheItems({ items: response.content.map((i) => i.property) }),
      ),
    ),
  );
}
