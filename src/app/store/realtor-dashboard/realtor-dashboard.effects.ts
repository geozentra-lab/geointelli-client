import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, merge, of, switchMap } from 'rxjs';
import { DashboardService } from '../../data-access/dashboard.service';
import { CrmService } from '../../data-access/crm.service';
import { apiError } from '../../core/models/api-error';
import { RealtorDashboardActions as A, RealtorCardKey } from './realtor-dashboard.actions';
const fail = (card: RealtorCardKey) => (e: unknown) =>
  of(A.cardFailed({ card, error: apiError(e) }));
@Injectable()
export class RealtorDashboardEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private dashboards = inject(DashboardService);
  private crm = inject(CrmService);
  /** Three requests in parallel; each card fills as soon as its own answer arrives. */
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(() =>
        merge(
          this.dashboards.realtorClientsLeads(5).pipe(
            map((card) => A.clientsLeadsLoaded({ card })),
            catchError(fail('clientsLeads')),
          ),
          this.dashboards.realtorTasksPipeline(5, 7).pipe(
            map((card) => A.tasksPipelineLoaded({ card })),
            catchError(fail('tasksPipeline')),
          ),
          this.crm.activities(0, 5).pipe(
            map((page) => A.activityLoaded({ page })),
            catchError(fail('activity')),
          ),
        ),
      ),
    ),
  );
}
