import { createActionGroup, props } from '@ngrx/store';
import {
  OpportunityPageDTO,
  OpportunityQuery,
  OpportunityRefreshMode,
  OpportunityRefreshResultDTO,
} from '../../core/models/opportunity';
export const OpportunitiesActions = createActionGroup({
  source: 'Opportunities API',
  events: {
    /** The Opportunities page: one page of scored properties for the filters. */
    Browse: props<{ query: OpportunityQuery }>(),
    Browsed: props<{ query: OpportunityQuery; page: OpportunityPageDTO }>(),
    'Browse failed': props<{ error: string }>(),
    /** The dashboard card: the best scores, unfiltered. */
    'Load top': props<{ size: number }>(),
    'Top loaded': props<{ page: OpportunityPageDTO }>(),
    'Top failed': props<{ error: string }>(),
    /** Admin: recalculate the stored scores, then read them again. */
    'Refresh scores': props<{ mode: OpportunityRefreshMode }>(),
    'Scores refreshed': props<{ result: OpportunityRefreshResultDTO }>(),
    'Refresh failed': props<{ error: string }>(),
  },
});
