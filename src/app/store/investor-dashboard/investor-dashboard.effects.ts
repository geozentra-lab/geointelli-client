import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';
import { DashboardService } from '../../data-access/dashboard.service';
import { PortfolioService } from '../../data-access/portfolio.service';
import { apiError } from '../../core/models/api-error';
import { InvestorDashboardActions as A } from './investor-dashboard.actions';
import { selectInvestorDashboard } from './investor-dashboard.selectors';
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
        // The scope picker lists every portfolio "All portfolios" covers (the backend caps both at 100).
        this.portfolios.list(0, 100).pipe(
          map((page) => A.portfoliosLoaded({ page })),
          catchError((e) => of(A.portfoliosFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** The four cards of the scope in one request; a new scope cancels the previous one's. */
  cards = createEffect(() =>
    this.actions.pipe(
      ofType(A.load, A.selectScope),
      withLatestFrom(this.store.select(selectInvestorDashboard)),
      switchMap(([, { portfolioId }]) =>
        this.dashboards.investorDashboard(portfolioId).pipe(
          map((dashboard) => A.dashboardLoaded({ dashboard })),
          catchError((e) => of(A.dashboardFailed({ portfolioId, error: apiError(e) }))),
        ),
      ),
    ),
  );
}
