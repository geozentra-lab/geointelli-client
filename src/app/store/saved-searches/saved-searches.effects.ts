import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Action, Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  Observable,
  catchError,
  map,
  of,
  switchMap,
  concatMap,
  mergeMap,
  from,
  withLatestFrom,
} from 'rxjs';
import { SavedSearchService } from '../../data-access/saved-search.service';
import { savedSearchesActions as A } from './saved-searches.actions';
import { selectSavedSearchesState as selectState } from './saved-searches.selectors';
import { UserActions } from '../user/user.actions';
import { UiActions } from '../ui/ui.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class SavedSearchesEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(SavedSearchService);
  private store = inject(Store);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load, UserActions.loaded),
      switchMap((a) =>
        this.service.list('page' in a ? a.page : 0).pipe(
          map((page) => A.loaded({ page })),
          catchError((e) => of(A.failed({ error: apiError(e), operation: 'load' }))),
        ),
      ),
    ),
  );
  save = createEffect(() =>
    this.actions.pipe(
      ofType(A.create, A.update, A.remove),
      concatMap((a) => {
        const request: Observable<Action> =
          a.type === A.create.type
            ? this.service.create(a.request).pipe(map((item) => A.saved({ item })))
            : a.type === A.update.type
              ? this.service.update(a.id, a.request).pipe(map((item) => A.saved({ item })))
              : this.service.remove(a.id).pipe(map(() => A.removed({ id: a.id })));
        return request.pipe(
          catchError((e) => of(A.failed({ error: apiError(e), operation: 'save' }))),
        );
      }),
    ),
  );
  options = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadOptions),
      switchMap(() =>
        this.service.listAll().pipe(
          map((items) => A.optionsLoaded({ items })),
          catchError((e) =>
            of(A.optionsFailed({ error: 'Could not load your saved searches. ' + apiError(e) })),
          ),
        ),
      ),
    ),
  );
  preview = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadPreview),
      switchMap(({ id }) =>
        this.service.results(id, 0, 8).pipe(
          map((page) => A.previewLoaded({ id, page })),
          catchError((e) => of(A.previewFailed({ id, error: apiError(e) }))),
        ),
      ),
    ),
  );
  refresh = createEffect(() =>
    this.actions.pipe(
      ofType(A.saved, A.removed),
      withLatestFrom(this.store.select(selectState)),
      mergeMap(([_, s]) =>
        of(
          UiActions.toast({ message: 'Changes saved.' }),
          A.load({ page: Math.min(s.page, Math.max(0, Math.ceil(s.totalElements / 20) - 1)) }),
        ),
      ),
    ),
  );
}
