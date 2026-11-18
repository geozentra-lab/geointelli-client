import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  LenderApplicationCreateRequest,
  LenderApplicationDTO,
  LenderApplicationStage,
  LenderApplicationUpdateRequest,
  LenderCollateralAnalysisDTO,
  LenderImportRequest,
  LenderImportResult,
  LenderOrganizationDTO,
  LenderPipelineDTO,
} from '../../core/models/lender';
export type LenderWrite = 'organization' | 'application' | 'update' | 'member' | 'import';
export const LenderActions = createActionGroup({
  source: 'Lender API',
  events: {
    'Load organizations': emptyProps(),
    'Organizations loaded': props<{ organizations: LenderOrganizationDTO[] }>(),
    'Organizations failed': props<{ error: string }>(),
    'Select organization': props<{ organizationId: number }>(),
    'Create organization': props<{ name: string }>(),
    'Organization created': props<{ organization: LenderOrganizationDTO }>(),

    'Load pipeline': emptyProps(),
    'Pipeline loaded': props<{ pipeline: LenderPipelineDTO }>(),
    'Pipeline failed': props<{ error: string }>(),

    'Load applications': props<{ page: number; stage: LenderApplicationStage | null }>(),
    'Applications loaded': props<{ page: Page<LenderApplicationDTO> }>(),
    'Applications failed': props<{ error: string }>(),
    'Create application': props<{ request: LenderApplicationCreateRequest }>(),
    'Update application': props<{ id: number; request: LenderApplicationUpdateRequest }>(),
    'Application saved': props<{ application: LenderApplicationDTO; created: boolean }>(),

    'Load members': emptyProps(),
    'Members loaded': props<{ members: number[] }>(),
    'Members failed': props<{ error: string }>(),
    'Add member': props<{ userId: number }>(),
    'Remove member': props<{ userId: number }>(),
    'Members changed': props<{ message: string }>(),

    'Import applications': props<{ request: LenderImportRequest }>(),
    'Import finished': props<{ result: LenderImportResult }>(),
    'Clear import': emptyProps(),

    'Write failed': props<{ write: LenderWrite; error: string }>(),

    /** Loan-to-value from the linked property's stored valuation; informational only. */
    'Load collateral': props<{ applicationId: number }>(),
    'Collateral loaded': props<{ applicationId: number; analysis: LenderCollateralAnalysisDTO }>(),
    'Collateral failed': props<{ applicationId: number; error: string }>(),
  },
});
