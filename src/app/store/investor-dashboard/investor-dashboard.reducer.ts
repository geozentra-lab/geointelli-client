import { createReducer, on } from '@ngrx/store';
import { Page, PortfolioDTO, PortfolioSummaryDTO } from '../../core/models/api';
import {
  InvestorOccupancyExposureCardDTO,
  InvestorValueEquityDebtCardDTO,
} from '../../core/models/dashboard';
import { Remote, cardDone, done, failed, idle, pending } from '../remote';
import { InvestorDashboardActions as A } from './investor-dashboard.actions';
export interface InvestorDashboardState {
  portfolios: Remote<Page<PortfolioDTO>>;
  /** The scope of the cards: one portfolio, or null for all of them. */
  portfolioId: number | null;
  valueEquityDebt: Remote<InvestorValueEquityDebtCardDTO>;
  occupancyExposure: Remote<InvestorOccupancyExposureCardDTO>;
  /** Portfolio the summary belongs to; null when the scope covers several portfolios. */
  summaryFor: number | null;
  summary: Remote<PortfolioSummaryDTO>;
}
export const investorDashboardReducer = createReducer<InvestorDashboardState>(
  {
    portfolios: idle(),
    portfolioId: null,
    valueEquityDebt: idle(),
    occupancyExposure: idle(),
    summaryFor: null,
    summary: idle(),
  },
  on(A.load, (s) => ({
    ...s,
    portfolios: pending(s.portfolios),
    valueEquityDebt: pending(s.valueEquityDebt),
    occupancyExposure: pending(s.occupancyExposure),
  })),
  // A portfolio deleted elsewhere drops out of scope instead of answering 404.
  on(A.portfoliosLoaded, (s, { page }) => ({
    ...s,
    portfolios: done(page),
    portfolioId: page.content.some((p) => p.id === s.portfolioId) ? s.portfolioId : null,
  })),
  // Another scope never shows the previous one's figures, even for a moment.
  on(A.selectScope, (s, { portfolioId }) => ({
    ...s,
    portfolioId,
    valueEquityDebt: pending(s.valueEquityDebt, false),
    occupancyExposure: pending(s.occupancyExposure, false),
    summaryFor: null,
    summary: idle(),
  })),
  on(A.valueEquityDebtLoaded, (s, { card }) =>
    card.portfolioId === s.portfolioId ? { ...s, valueEquityDebt: cardDone(card) } : s,
  ),
  on(A.occupancyExposureLoaded, (s, { card }) =>
    card.portfolioId === s.portfolioId ? { ...s, occupancyExposure: cardDone(card) } : s,
  ),
  on(A.loadSummary, (s, { portfolioId }) => ({
    ...s,
    summaryFor: portfolioId,
    summary: pending(s.summary, portfolioId === s.summaryFor),
  })),
  on(A.summaryLoaded, (s, { portfolioId, summary }) =>
    portfolioId === s.summaryFor ? { ...s, summary: done(summary) } : s,
  ),
  on(A.cardFailed, (s, { card, error }) => ({ ...s, [card]: failed(s[card], error) })),
);
