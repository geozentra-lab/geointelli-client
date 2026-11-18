import { createReducer, on } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  InvestmentAnalysisRequest,
  InvestmentAnalysisResponse,
  ScenarioDTO,
} from '../../core/models/investment';
import { Remote, done, failed, idle, pending } from '../remote';
import { InvestmentActions as A } from './investment.actions';
export interface InvestmentState {
  analysis: Remote<InvestmentAnalysisResponse>;
  /** The inputs the analysis on screen was calculated from. */
  analyzed: InvestmentAnalysisRequest | null;
  scenarios: Remote<Page<ScenarioDTO>>;
  activeId: number | null;
  saving: boolean;
  writeError: string | null;
}
export const investmentReducer = createReducer<InvestmentState>(
  {
    analysis: idle(),
    analyzed: null,
    scenarios: idle(),
    activeId: null,
    saving: false,
    writeError: null,
  },
  on(A.analyze, (s) => ({ ...s, analysis: pending(s.analysis) })),
  on(A.analyzed, (s, { request, response }) => ({
    ...s,
    analysis: done(response),
    analyzed: request,
  })),
  on(A.analysisFailed, (s, { error }) => ({ ...s, analysis: failed(s.analysis, error) })),
  on(A.loadScenarios, (s) => ({ ...s, scenarios: pending(s.scenarios) })),
  on(A.scenariosLoaded, (s, { page }) => ({
    ...s,
    scenarios: done(page),
    activeId: page.content.some((x) => x.id === s.activeId) ? s.activeId : null,
  })),
  on(A.scenariosFailed, (s, { error }) => ({ ...s, scenarios: failed(s.scenarios, error) })),
  on(A.openScenario, (s, { id }) => ({ ...s, activeId: id, writeError: null })),
  on(A.createScenario, A.updateScenario, A.removeScenario, (s) => ({
    ...s,
    saving: true,
    writeError: null,
  })),
  // Newest first, as the server lists them; a saved scenario becomes the one in the form.
  on(A.scenarioSaved, (s, { scenario, created }) => {
    const page = s.scenarios.value;
    const content = page
      ? created
        ? [scenario, ...page.content]
        : page.content.map((x) => (x.id === scenario.id ? scenario : x))
      : [scenario];
    return {
      ...s,
      saving: false,
      activeId: scenario.id,
      scenarios: done({
        ...(page ?? { page: 0, size: 50, totalPages: 1 }),
        content,
        totalElements: (page?.totalElements ?? 0) + (created ? 1 : 0),
      }),
    };
  }),
  on(A.scenarioRemoved, (s, { id }) => {
    const page = s.scenarios.value;
    return {
      ...s,
      saving: false,
      activeId: s.activeId === id ? null : s.activeId,
      scenarios: page
        ? done({
            ...page,
            content: page.content.filter((x) => x.id !== id),
            totalElements: Math.max(0, page.totalElements - 1),
          })
        : s.scenarios,
    };
  }),
  on(A.writeFailed, (s, { error }) => ({ ...s, saving: false, writeError: error })),
);
