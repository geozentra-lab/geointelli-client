import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Page, PortfolioDTO, PortfolioSummaryDTO } from '../../core/models/api';
import {
  InvestorOccupancyExposureCardDTO,
  InvestorValueEquityDebtCardDTO,
} from '../../core/models/dashboard';
export type InvestorCardKey = 'portfolios' | 'valueEquityDebt' | 'occupancyExposure' | 'summary';
export const InvestorDashboardActions = createActionGroup({
  source: 'Investor dashboard API',
  events: {
    /** The portfolio list and the cards of the current scope. */
    Load: emptyProps(),
    'Portfolios loaded': props<{ page: Page<PortfolioDTO> }>(),
    /** null covers every portfolio of the user. */
    'Select scope': props<{ portfolioId: number | null }>(),
    'Value equity debt loaded': props<{ card: InvestorValueEquityDebtCardDTO }>(),
    'Occupancy exposure loaded': props<{ card: InvestorOccupancyExposureCardDTO }>(),
    /** Income and expenses exist per portfolio only, so the summary follows a single portfolio. */
    'Load summary': props<{ portfolioId: number }>(),
    'Summary loaded': props<{ portfolioId: number; summary: PortfolioSummaryDTO }>(),
    'Card failed': props<{ card: InvestorCardKey; error: string }>(),
  },
});
