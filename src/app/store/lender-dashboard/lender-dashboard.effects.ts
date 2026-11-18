import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { EMPTY, catchError, map, merge, of, switchMap, withLatestFrom } from 'rxjs';
import { LenderService } from '../../data-access/lender.service';
import { apiError } from '../../core/models/api-error';
import { LenderDashboardActions as A, LenderCardKey } from './lender-dashboard.actions';
import { selectLenderDashboard } from './lender-dashboard.selectors';
const fail = (card: LenderCardKey) => (e: unknown) =>
  of(A.cardFailed({ card, error: apiError(e) }));
@Injectable()
export class LenderDashboardEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private store = inject(Store);
  private api = inject(LenderService);
  organizations = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(() =>
        this.api.organizations().pipe(
          map((organizations) => A.organizationsLoaded({ organizations })),
          catchError(fail('organizations')),
        ),
      ),
    ),
  );
  /** The organization in view is known after the list or a switch; then its cards load. */
  cards = createEffect(() =>
    this.actions.pipe(
      ofType(A.organizationsLoaded, A.selectOrganization),
      withLatestFrom(this.store.select(selectLenderDashboard)),
      switchMap(([, { organizationId }]) =>
        organizationId === null ? EMPTY : of(A.loadCards({ organizationId })),
      ),
    ),
  );
  pipelineAndRecent = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadCards),
      switchMap(({ organizationId }) =>
        merge(
          this.api.pipeline(organizationId).pipe(
            map((pipeline) => A.pipelineLoaded({ organizationId, pipeline })),
            catchError(fail('pipeline')),
          ),
          this.api.applications(organizationId, 0, null, 6).pipe(
            map((page) => A.recentLoaded({ organizationId, page })),
            catchError(fail('recent')),
          ),
        ),
      ),
    ),
  );
  approvedFunded = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadCards, A.setPeriod),
      withLatestFrom(this.store.select(selectLenderDashboard)),
      switchMap(([, { organizationId, period }]) =>
        organizationId === null
          ? EMPTY
          : this.api.approvedFunded(organizationId, period.fromDate, period.toDate).pipe(
              map((card) => A.approvedFundedLoaded({ card })),
              catchError(fail('approvedFunded')),
            ),
      ),
    ),
  );
  /** LTV of every recent application with collateral, in parallel; a new list cancels them. */
  collateral = createEffect(() =>
    this.actions.pipe(
      ofType(A.recentLoaded),
      switchMap(({ organizationId, page }) =>
        merge(
          ...page.content
            .filter((a) => a.propertyId !== null)
            .map((a) =>
              this.api.collateralAnalysis(organizationId, a.id).pipe(
                map((analysis) => A.collateralLoaded({ applicationId: a.id, analysis })),
                catchError((e) =>
                  of(A.collateralFailed({ applicationId: a.id, error: apiError(e) })),
                ),
              ),
            ),
        ),
      ),
    ),
  );
}
