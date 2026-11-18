import { createReducer, on } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  LenderApplicationDTO,
  LenderApprovedFundedCardDTO,
  LenderCollateralAnalysisDTO,
  LenderOrganizationDTO,
  LenderPipelineDTO,
} from '../../core/models/lender';
import { Remote, cardDone, done, failed, idle, pending } from '../remote';
import { LenderDashboardActions as A, LenderPeriod } from './lender-dashboard.actions';
export interface LenderDashboardState {
  organizations: Remote<LenderOrganizationDTO[]>;
  organizationId: number | null;
  period: LenderPeriod;
  pipeline: Remote<LenderPipelineDTO>;
  recent: Remote<Page<LenderApplicationDTO>>;
  approvedFunded: Remote<LenderApprovedFundedCardDTO>;
  /** Loan-to-value of each recent application, by application ID. */
  collateral: Record<number, Remote<LenderCollateralAnalysisDTO>>;
}
export const lenderDashboardReducer = createReducer<LenderDashboardState>(
  {
    organizations: idle(),
    organizationId: null,
    period: { fromDate: null, toDate: null },
    pipeline: idle(),
    recent: idle(),
    approvedFunded: idle(),
    collateral: {},
  },
  on(A.load, (s) => ({ ...s, organizations: pending(s.organizations) })),
  // Keep the organization in view when it is still listed, else open the first one.
  on(A.organizationsLoaded, (s, { organizations }) => ({
    ...s,
    organizations: done(organizations),
    organizationId: organizations.some((o) => o.id === s.organizationId)
      ? s.organizationId
      : (organizations[0]?.id ?? null),
  })),
  on(A.selectOrganization, (s, { organizationId }) => ({ ...s, organizationId })),
  on(A.setPeriod, (s, { period }) => ({ ...s, period, approvedFunded: pending(s.approvedFunded) })),
  on(A.loadCards, (s, { organizationId }) => {
    // Another organization's figures are cleared at once; the same one refreshes in place.
    const same = s.pipeline.value?.organizationId === organizationId;
    return {
      ...s,
      pipeline: pending(s.pipeline, same),
      recent: pending(s.recent, same),
      approvedFunded: pending(s.approvedFunded, same),
      collateral: same ? s.collateral : {},
    };
  }),
  on(A.pipelineLoaded, (s, { organizationId, pipeline }) =>
    organizationId === s.organizationId ? { ...s, pipeline: done(pipeline) } : s,
  ),
  on(A.recentLoaded, (s, { organizationId, page }) =>
    organizationId === s.organizationId
      ? {
          ...s,
          recent: done(page),
          collateral: Object.fromEntries(
            page.content
              .filter((a) => a.propertyId !== null)
              .map((a) => [a.id, pending(s.collateral[a.id] ?? idle())]),
          ),
        }
      : s,
  ),
  on(A.approvedFundedLoaded, (s, { card }) =>
    card.organizationId === s.organizationId ? { ...s, approvedFunded: cardDone(card) } : s,
  ),
  on(A.collateralLoaded, (s, { applicationId, analysis }) =>
    s.collateral[applicationId]
      ? { ...s, collateral: { ...s.collateral, [applicationId]: done(analysis) } }
      : s,
  ),
  on(A.collateralFailed, (s, { applicationId, error }) =>
    s.collateral[applicationId]
      ? {
          ...s,
          collateral: {
            ...s.collateral,
            [applicationId]: failed(s.collateral[applicationId], error),
          },
        }
      : s,
  ),
  on(A.cardFailed, (s, { card, error }) => ({ ...s, [card]: failed(s[card], error) })),
);
