import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, mergeMap, of, switchMap } from 'rxjs';
import { InvestmentAnalysisService } from '../../data-access/investment-analysis.service';
import { ScenarioService } from '../../data-access/scenario.service';
import { apiError } from '../../core/models/api-error';
import { UiActions } from '../ui/ui.actions';
import { InvestmentActions as A } from './investment.actions';
@Injectable()
export class InvestmentEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private analysis = inject(InvestmentAnalysisService);
  private scenarios = inject(ScenarioService);
  analyze = createEffect(() =>
    this.actions.pipe(
      ofType(A.analyze),
      switchMap(({ request }) =>
        this.analysis.investment(request).pipe(
          map((response) => A.analyzed({ request, response })),
          catchError((e) => of(A.analysisFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  list = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadScenarios),
      switchMap(() =>
        this.scenarios.list(0, 50).pipe(
          map((page) => A.scenariosLoaded({ page })),
          catchError((e) => of(A.scenariosFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** Writes run one after another, so a rename never races the save it follows. */
  write = createEffect(() =>
    this.actions.pipe(
      ofType(A.createScenario, A.updateScenario, A.removeScenario),
      concatMap((action) => {
        if (action.type === A.createScenario.type)
          return this.scenarios.create(action.request).pipe(
            mergeMap((scenario) => [
              A.scenarioSaved({ scenario, created: true }),
              UiActions.toast({ message: `Scenario "${scenario.name}" saved.` }),
            ]),
            catchError((e) => of(A.writeFailed({ error: apiError(e) }))),
          );
        if (action.type === A.updateScenario.type)
          return this.scenarios.update(action.id, action.request).pipe(
            mergeMap((scenario) => [
              A.scenarioSaved({ scenario, created: false }),
              UiActions.toast({ message: `Scenario "${scenario.name}" updated.` }),
            ]),
            catchError((e) => of(A.writeFailed({ error: apiError(e) }))),
          );
        const id = action.id;
        return this.scenarios.remove(id).pipe(
          mergeMap(() => [
            A.scenarioRemoved({ id }),
            UiActions.toast({ message: 'Scenario deleted.' }),
          ]),
          catchError((e) => of(A.writeFailed({ error: apiError(e) }))),
        );
      }),
    ),
  );
}
