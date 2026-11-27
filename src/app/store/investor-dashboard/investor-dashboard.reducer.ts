import { createReducer, on } from '@ngrx/store';
import { Page, PortfolioDTO } from '../../core/models/api';
import {
  InvestorIncomeExpensesReturnsCardDTO,
  InvestorOccupancyExposureCardDTO,
  InvestorOpportunitiesCardDTO,
  InvestorValueEquityDebtCardDTO,
} from '../../core/models/dashboard';
import { Remote, cardDone, done, failed, idle, pending } from '../remote';
import { InvestorDashboardActions as A } from './investor-dashboard.actions';

/** The four cards of GET /dashboards/investor, each with its own state. */
export type InvestorCardKey = 'valueEquityDebt' | 'incomeExpensesReturns' | 'occupancyExposure' | 'opportunities';
export const INVESTOR_CARDS: readonly InvestorCardKey[] = [
  'valueEquityDebt',
  'incomeExpensesReturns',
  'occupancyExposure',
  'opportunities',
];
const NOT_RETURNED = 'This card was not returned.';

export interface InvestorDashboardState {
  portfolios: Remote<Page<PortfolioDTO>>;
  /** The scope of the cards: one portfolio, or null for all of them. */
  portfolioId: number | null;
  valueEquityDebt: Remote<InvestorValueEquityDebtCardDTO>;
  incomeExpensesReturns: Remote<InvestorIncomeExpensesReturnsCardDTO>;
  occupancyExposure: Remote<InvestorOccupancyExposureCardDTO>;
  opportunities: Remote<InvestorOpportunitiesCardDTO>;
}
const cards = (s: InvestorDashboardState, keep: boolean) => ({
  valueEquityDebt: pending(s.valueEquityDebt, keep),
  incomeExpensesReturns: pending(s.incomeExpensesReturns, keep),
  occupancyExposure: pending(s.occupancyExposure, keep),
  opportunities: pending(s.opportunities, keep),
});
/** A card with status ERROR keeps its error; a missing one says so. */
const card = <T extends { status: string; error: string | null }>(r: Remote<T>, c: T | null) =>
  c ? cardDone(c) : failed(r, NOT_RETURNED);

export const investorDashboardReducer = createReducer<InvestorDashboardState>(
  {
    portfolios: idle(),
    portfolioId: null,
    valueEquityDebt: idle(),
    incomeExpensesReturns: idle(),
    occupancyExposure: idle(),
    opportunities: idle(),
  },
  on(A.load, (s) => ({ ...s, portfolios: pending(s.portfolios), ...cards(s, true) })),
  // A portfolio deleted elsewhere drops out of scope instead of answering 404.
  on(A.portfoliosLoaded, (s, { page }) => ({
    ...s,
    portfolios: done(page),
    portfolioId: page.content.some((p) => p.id === s.portfolioId) ? s.portfolioId : null,
  })),
  on(A.portfoliosFailed, (s, { error }) => ({ ...s, portfolios: failed(s.portfolios, error) })),
  // Another scope never shows the previous one's figures, even for a moment.
  on(A.selectScope, (s, { portfolioId }) => ({ ...s, portfolioId, ...cards(s, false) })),
  // An answer for a scope no longer in view is dropped.
  on(A.dashboardLoaded, (s, { dashboard: d }) =>
    d.portfolioId === s.portfolioId
      ? {
          ...s,
          valueEquityDebt: card(s.valueEquityDebt, d.valueEquityDebt),
          incomeExpensesReturns: card(s.incomeExpensesReturns, d.incomeExpensesReturns),
          occupancyExposure: card(s.occupancyExposure, d.occupancyExposure),
          opportunities: card(s.opportunities, d.opportunities),
        }
      : s,
  ),
  on(A.dashboardFailed, (s, { portfolioId, error }) =>
    portfolioId === s.portfolioId
      ? {
          ...s,
          valueEquityDebt: failed(s.valueEquityDebt, error),
          incomeExpensesReturns: failed(s.incomeExpensesReturns, error),
          occupancyExposure: failed(s.occupancyExposure, error),
          opportunities: failed(s.opportunities, error),
        }
      : s,
  ),
);
