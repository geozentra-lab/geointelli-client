import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { InvestmentAnalysisService } from '../../data-access/investment-analysis.service';
import { MortgageActions as A } from './mortgage.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class MortgageEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(InvestmentAnalysisService);
  calculate = createEffect(() =>
    this.actions.pipe(
      ofType(A.calculate),
      switchMap(({ request }) =>
        this.service.calculate(request).pipe(
          map((response) => A.calculated({ response })),
          catchError((e) => of(A.failed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
}
