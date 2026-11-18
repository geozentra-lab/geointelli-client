import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, mergeMap, of, switchMap, withLatestFrom } from 'rxjs';
import { OpportunityService } from '../../data-access/opportunity.service';
import { apiError } from '../../core/models/api-error';
import { OpportunitiesActions as A } from './opportunities.actions';
import { selectOpportunities } from './opportunities.selectors';
@Injectable()
export class OpportunitiesEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private store = inject(Store);
  private api = inject(OpportunityService);
  /** switchMap: a newer filter cancels the older request, so results always match the filters. */
  browse = createEffect(() =>
    this.actions.pipe(
      ofType(A.browse),
      switchMap(({ query }) =>
        this.api.browse(query).pipe(
          map((page) => A.browsed({ query, page })),
          catchError((e) => of(A.browseFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  top = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadTop),
      switchMap(({ size }) =>
        this.api.browse({ page: 0, size, sort: 'SCORE_DESC' }).pipe(
          map((page) => A.topLoaded({ page })),
          catchError((e) => of(A.topFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** A rescoring run is synchronous and can be long: a second click waits for the first. */
  refresh = createEffect(() =>
    this.actions.pipe(
      ofType(A.refreshScores),
      exhaustMap(({ mode }) =>
        this.api.refresh(mode).pipe(
          map((result) => A.scoresRefreshed({ result })),
          catchError((e) => of(A.refreshFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** New scores make the list on screen stale; read it again with the same filters. */
  reloadAfterRefresh = createEffect(() =>
    this.actions.pipe(
      ofType(A.scoresRefreshed),
      withLatestFrom(this.store.select(selectOpportunities)),
      mergeMap(([, s]) => (s.results.value ? [A.browse({ query: s.query })] : [])),
    ),
  );
}
