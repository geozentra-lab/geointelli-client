import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Page, PortfolioDTO } from '../../core/models/api';
import { InvestorDashboardDTO } from '../../core/models/dashboard';
export const InvestorDashboardActions = createActionGroup({
  source: 'Investor dashboard API',
  events: {
    /** The portfolio list and the cards of the current scope. */
    Load: emptyProps(),
    'Portfolios loaded': props<{ page: Page<PortfolioDTO> }>(),
    'Portfolios failed': props<{ error: string }>(),
    /** null covers every portfolio of the user. */
    'Select scope': props<{ portfolioId: number | null }>(),
    /** The four cards of one scope, from GET /dashboards/investor. */
    'Dashboard loaded': props<{ dashboard: InvestorDashboardDTO }>(),
    /** The whole request failed (503 when no card could be built): every card of that scope fails. */
    'Dashboard failed': props<{ portfolioId: number | null; error: string }>(),
  },
});
