import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  InvestmentAnalysisRequest,
  InvestmentAnalysisResponse,
  ScenarioCreateRequest,
  ScenarioDTO,
  ScenarioUpdateRequest,
} from '../../core/models/investment';
export const InvestmentActions = createActionGroup({
  source: 'Investment API',
  events: {
    Analyze: props<{ request: InvestmentAnalysisRequest }>(),
    Analyzed: props<{ request: InvestmentAnalysisRequest; response: InvestmentAnalysisResponse }>(),
    'Analysis failed': props<{ error: string }>(),
    'Load scenarios': emptyProps(),
    'Scenarios loaded': props<{ page: Page<ScenarioDTO> }>(),
    'Scenarios failed': props<{ error: string }>(),
    /** The scenario whose assumptions are in the form; null for a new, unsaved one. */
    'Open scenario': props<{ id: number | null }>(),
    'Create scenario': props<{ request: ScenarioCreateRequest }>(),
    'Update scenario': props<{ id: number; request: ScenarioUpdateRequest }>(),
    'Remove scenario': props<{ id: number }>(),
    'Scenario saved': props<{ scenario: ScenarioDTO; created: boolean }>(),
    'Scenario removed': props<{ id: number }>(),
    'Write failed': props<{ error: string }>(),
  },
});
