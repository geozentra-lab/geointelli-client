import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  LenderApplicationDTO,
  LenderApprovedFundedCardDTO,
  LenderCollateralAnalysisDTO,
  LenderOrganizationDTO,
  LenderPipelineDTO,
} from '../../core/models/lender';
export type LenderCardKey = 'organizations' | 'pipeline' | 'recent' | 'approvedFunded';
/** Both days of a period (UTC, included), or both null for the current month. */
export interface LenderPeriod {
  fromDate: string | null;
  toDate: string | null;
}
export const LenderDashboardActions = createActionGroup({
  source: 'Lender dashboard API',
  events: {
    Load: emptyProps(),
    'Organizations loaded': props<{ organizations: LenderOrganizationDTO[] }>(),
    'Select organization': props<{ organizationId: number }>(),
    'Set period': props<{ period: LenderPeriod }>(),
    'Load cards': props<{ organizationId: number }>(),
    'Pipeline loaded': props<{ organizationId: number; pipeline: LenderPipelineDTO }>(),
    'Recent loaded': props<{ organizationId: number; page: Page<LenderApplicationDTO> }>(),
    'Approved funded loaded': props<{ card: LenderApprovedFundedCardDTO }>(),
    'Collateral loaded': props<{ applicationId: number; analysis: LenderCollateralAnalysisDTO }>(),
    'Collateral failed': props<{ applicationId: number; error: string }>(),
    'Card failed': props<{ card: LenderCardKey; error: string }>(),
  },
});
