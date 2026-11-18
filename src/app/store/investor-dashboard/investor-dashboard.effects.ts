import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { EMPTY, catchError, map, merge, of, switchMap, withLatestFrom } from 'rxjs';
import { DashboardService } from '../../data-access/dashboard.service';
import { PortfolioService } from '../../data-access/portfolio.service';
import { apiError } from '../../core/models/api-error';
import { InvestorDashboardActions as A, InvestorCardKey } from './investor-dashboard.actions';
import { selectInvestorDashboard, selectSummaryTarget } from './investor-dashboard.selectors';
const fail = (card: InvestorCardKey) => (e: unknown) =>
  of(A.cardFailed({ card, error: apiError(e) }));
@Injectable()
export class InvestorDashboardEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private store = inject(Store);
  private dashboards = inject(DashboardService);
  private portfolios = inject(PortfolioService);
  list = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(() =>
        this.portfolios.list(0).pipe(
          map((page) => A.portfoliosLoaded({ page })),
          catchError(fail('portfolios')),
        ),
      ),
    ),
  );
  /** Both cards of the scope at once; a new scope cancels the previous one's requests. */
  cards = createEffect(() =>
    this.actions.pipe(
      ofType(A.load, A.selectScope),
      withLatestFrom(this.store.select(selectInvestorDashboard)),
      switchMap(([, { portfolioId }]) =>
        merge(
          this.dashboards.investorValueEquityDebt(portfolioId).pipe(
            map((card) => A.valueEquityDebtLoaded({ card })),
            catchError(fail('valueEquityDebt')),
          ),
          this.dashboards.investorOccupancyExposure(portfolioId).pipe(
            map((card) => A.occupancyExposureLoaded({ card })),
            catchError(fail('occupancyExposure')),
          ),
        ),
      ),
    ),
  );
  /** Once the list (or a new scope) says which single portfolio is in view, read its summary. */
  summaryTarget = createEffect(() =>
    this.actions.pipe(
      ofType(A.portfoliosLoaded, A.selectScope),
      withLatestFrom(this.store.select(selectSummaryTarget)),
      switchMap(([, portfolioId]) =>
        portfolioId === null ? EMPTY : of(A.loadSummary({ portfolioId })),
      ),
    ),
  );
  summary = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadSummary),
      switchMap(({ portfolioId }) =>
        this.portfolios.summary(portfolioId).pipe(
          map((summary) => A.summaryLoaded({ portfolioId, summary })),
          catchError(fail('summary')),
        ),
      ),
    ),
  );
}
