import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  EMPTY,
  Observable,
  catchError,
  map,
  of,
  switchMap,
  mergeMap,
  concatMap,
  withLatestFrom,
  filter,
  takeUntil,
} from 'rxjs';
import { PortfolioService } from '../../data-access/portfolio.service';
import { portfolioActions as A } from './portfolio.actions';
import { selectPortfolioState } from './portfolio.selectors';
import { PortfolioMutation } from './portfolio.model';
import { UserActions } from '../user/user.actions';
import { UiActions } from '../ui/ui.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class PortfolioEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(PortfolioService);
  private store = inject(Store);
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load, UserActions.loaded),
      switchMap((a) =>
        this.service.list('page' in a ? a.page : 0).pipe(
          map((page) => A.loaded({ page })),
          catchError((e) => of(A.failed({ section: 'list', error: apiError(e) }))),
        ),
      ),
    ),
  );
  select = createEffect(() =>
    this.actions.pipe(
      ofType(A.loaded),
      withLatestFrom(this.store.select(selectPortfolioState)),
      mergeMap(([{ page }, s]) =>
        page.content.length === 0 && page.page > 0
          ? of(A.load({ page: page.page - 1 }))
          : !page.content.some((p) => p.id === s.selectedId)
            ? of(A.select({ id: page.content[0]?.id ?? null }))
            : EMPTY,
      ),
    ),
  );
  refresh = createEffect(() =>
    this.actions.pipe(
      ofType(A.select, A.refresh),
      withLatestFrom(this.store.select(selectPortfolioState)),
      mergeMap(([_, s]) =>
        s.selectedId === null
          ? EMPTY
          : of(
              A.loadHoldings({ id: s.selectedId, page: s.holdingsPage?.page ?? 0 }),
              A.loadSummary({ id: s.selectedId, ...s.summaryQuery }),
            ),
      ),
    ),
  );
  holdings = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadHoldings, A.select),
      filter((a) => a.type === A.loadHoldings.type || a.id === null),
      switchMap((a) =>
        a.type === A.select.type
          ? EMPTY
          : this.service.holdings(a.id, a.page).pipe(
              map((page) => A.holdingsLoaded({ id: a.id, page })),
              catchError((e) => of(A.failed({ section: 'holdings', error: apiError(e) }))),
            ),
      ),
    ),
  );
  summary = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadSummary, A.select),
      filter((a) => a.type === A.loadSummary.type || a.id === null),
      switchMap((a) =>
        a.type === A.select.type
          ? EMPTY
          : this.service.summary(a.id, a.fromDate, a.toDate).pipe(
              map((summary) => A.summaryLoaded({ id: a.id, summary })),
              catchError((e) => of(A.failed({ section: 'summary', error: apiError(e) }))),
            ),
      ),
    ),
  );
  selectHolding = createEffect(() =>
    this.actions.pipe(
      ofType(A.holdingsLoaded),
      withLatestFrom(this.store.select(selectPortfolioState)),
      mergeMap(([{ id, page }, s]) =>
        id === s.selectedId && page.content.length === 0 && page.page > 0
          ? of(A.loadHoldings({ id, page: page.page - 1 }))
          : id === s.selectedId && !page.content.some((h) => h.id === s.selectedHoldingId)
            ? of(A.selectHolding({ holdingId: page.content[0]?.id ?? null }))
            : EMPTY,
      ),
    ),
  );
  requestRecords = createEffect(() =>
    this.actions.pipe(
      ofType(A.selectHolding),
      withLatestFrom(this.store.select(selectPortfolioState)),
      mergeMap(([{ holdingId }, s]) =>
        holdingId === null || s.selectedId === null
          ? EMPTY
          : of(A.loadRecords({ id: s.selectedId, holdingId, page: 0 })),
      ),
    ),
  );
  records = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadRecords, A.select, A.selectHolding),
      filter(
        (a) =>
          a.type === A.loadRecords.type ||
          (a.type === A.select.type ? a.id === null : a.holdingId === null),
      ),
      switchMap((a) =>
        a.type !== A.loadRecords.type
          ? EMPTY
          : this.service
              .records(a.id, a.holdingId, a.page, { fromDate: a.fromDate, toDate: a.toDate })
              .pipe(
                takeUntil(this.actions.pipe(ofType(A.select, A.selectHolding))),
                map((page) => A.recordsLoaded({ id: a.id, holdingId: a.holdingId, page })),
                catchError((e) => of(A.failed({ section: 'records', error: apiError(e) }))),
              ),
      ),
    ),
  );
  clampRecords = createEffect(() =>
    this.actions.pipe(
      ofType(A.recordsLoaded),
      withLatestFrom(this.store.select(selectPortfolioState)),
      mergeMap(([{ id, holdingId, page }, s]) =>
        page.content.length === 0 &&
        page.page > 0 &&
        id === s.selectedId &&
        holdingId === s.selectedHoldingId
          ? of(A.loadRecords({ id, holdingId, page: page.page - 1, ...s.recordsQuery }))
          : EMPTY,
      ),
    ),
  );
  mutate = createEffect(() =>
    this.actions.pipe(
      ofType(A.mutate),
      concatMap(({ mutation }) =>
        this.write(mutation).pipe(
          map(() => A.mutationSucceeded()),
          catchError((e) => of(A.failed({ section: 'save', error: apiError(e) }))),
        ),
      ),
    ),
  );
  saved = createEffect(() =>
    this.actions.pipe(
      ofType(A.mutationSucceeded),
      withLatestFrom(this.store.select(selectPortfolioState)),
      mergeMap(([_, s]) => {
        const result = [
          UiActions.toast({ message: 'Changes saved.' }),
          A.load({ page: s.page?.page ?? 0 }),
          A.refresh(),
        ];
        return s.selectedId !== null && s.selectedHoldingId !== null
          ? of(
              ...result,
              A.loadRecords({
                id: s.selectedId,
                holdingId: s.selectedHoldingId,
                page: s.records?.page ?? 0,
                ...s.recordsQuery,
              }),
            )
          : of(...result);
      }),
    ),
  );
  private write(m: PortfolioMutation): Observable<unknown> {
    switch (m.kind) {
      case 'create-portfolio':
        return this.service.create(m.body);
      case 'update-portfolio':
        return this.service.update(m.id, m.body);
      case 'remove-portfolio':
        return this.service.remove(m.id);
      case 'add-holding':
        return this.service.addHolding(m.id, m.body);
      case 'update-holding':
        return this.service.updateHolding(m.id, m.holdingId, m.body);
      case 'remove-holding':
        return this.service.removeHolding(m.id, m.holdingId);
      case 'add-record':
        return this.service.addRecord(m.id, m.holdingId, m.body);
      case 'update-record':
        return this.service.updateRecord(m.id, m.holdingId, m.recordId, m.body);
      case 'remove-record':
        return this.service.removeRecord(m.id, m.holdingId, m.recordId);
    }
  }
}
