import { createReducer, on } from '@ngrx/store';
import {
  LenderApplicationDTO,
  LenderApplicationStage,
  LenderCollateralAnalysisDTO,
  LenderImportResult,
  LenderOrganizationDTO,
  LenderPipelineDTO,
} from '../../core/models/lender';
import { LenderActions as A, LenderWrite } from './lender.actions';
import { Remote, done, failed, idle, pending } from '../remote';
export interface LenderState {
  organizations: LenderOrganizationDTO[];
  organizationsLoading: boolean;
  organizationsLoaded: boolean;
  organizationsError: string | null;
  selectedId: number | null;
  pipeline: LenderPipelineDTO | null;
  pipelineLoading: boolean;
  pipelineError: string | null;
  applications: LenderApplicationDTO[];
  page: number;
  totalPages: number;
  totalElements: number;
  stage: LenderApplicationStage | null;
  applicationsLoading: boolean;
  applicationsLoaded: boolean;
  applicationsError: string | null;
  members: number[];
  membersLoading: boolean;
  membersError: string | null;
  importResult: LenderImportResult | null;
  /** In-flight writes; forms keep their drafts until the write settles without saveError. */
  saving: number;
  pendingWrite: LenderWrite | null;
  saveError: string | null;
  /** LTV per application ID, read when asked for. */
  collateral: Record<number, Remote<LenderCollateralAnalysisDTO>>;
}
export const initialLenderState: LenderState = {
  organizations: [],
  organizationsLoading: false,
  organizationsLoaded: false,
  organizationsError: null,
  selectedId: null,
  pipeline: null,
  pipelineLoading: false,
  pipelineError: null,
  applications: [],
  page: 0,
  totalPages: 0,
  totalElements: 0,
  stage: null,
  applicationsLoading: false,
  applicationsLoaded: false,
  applicationsError: null,
  members: [],
  membersLoading: false,
  membersError: null,
  importResult: null,
  saving: 0,
  pendingWrite: null,
  saveError: null,
  collateral: {},
};
const orgScoped = {
  pipeline: null,
  pipelineError: null,
  applications: [],
  page: 0,
  totalPages: 0,
  totalElements: 0,
  applicationsLoaded: false,
  applicationsError: null,
  members: [],
  membersError: null,
  importResult: null,
  collateral: {},
};
const started = (write: LenderWrite) => (s: LenderState) => ({
  ...s,
  saving: s.saving + 1,
  pendingWrite: write,
  saveError: null,
});
const settled = (s: LenderState) => ({ ...s, saving: Math.max(0, s.saving - 1) });
export const lenderReducer = createReducer(
  initialLenderState,
  on(A.loadOrganizations, (s) => ({ ...s, organizationsLoading: true, organizationsError: null })),
  on(A.organizationsLoaded, (s, { organizations }) => {
    // Keep the current organization if it is still accessible; otherwise fall back to the first.
    const selectedId = organizations.some((o) => o.id === s.selectedId)
      ? s.selectedId
      : (organizations[0]?.id ?? null);
    return {
      ...s,
      ...(selectedId === s.selectedId ? {} : orgScoped),
      organizations,
      selectedId,
      organizationsLoading: false,
      organizationsLoaded: true,
    };
  }),
  on(A.organizationsFailed, (s, { error }) => ({
    ...s,
    organizationsLoading: false,
    organizationsError: error,
  })),
  on(A.selectOrganization, (s, { organizationId }) =>
    organizationId === s.selectedId ? s : { ...s, ...orgScoped, selectedId: organizationId },
  ),
  on(A.createOrganization, started('organization')),
  on(A.organizationCreated, (s, { organization }) => ({
    ...settled(s),
    ...orgScoped,
    organizations: [...s.organizations.filter((o) => o.id !== organization.id), organization],
    organizationsLoaded: true,
    selectedId: organization.id,
  })),
  on(A.loadCollateral, (s, { applicationId }) => ({
    ...s,
    collateral: {
      ...s.collateral,
      [applicationId]: pending(s.collateral[applicationId] ?? idle()),
    },
  })),
  on(A.collateralLoaded, (s, { applicationId, analysis }) =>
    analysis.organizationId === s.selectedId
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
  // A changed application (amount, stage, property) makes its LTV stale.
  on(A.applicationSaved, (s, { application }) => {
    const { [application.id]: _, ...collateral } = s.collateral;
    return { ...s, collateral };
  }),
  on(A.loadPipeline, (s) => ({ ...s, pipelineLoading: true, pipelineError: null })),
  on(A.pipelineLoaded, (s, { pipeline }) =>
    // A summary for an organization the user has since switched away from is discarded.
    pipeline.organizationId === s.selectedId ? { ...s, pipeline, pipelineLoading: false } : s,
  ),
  on(A.pipelineFailed, (s, { error }) => ({ ...s, pipelineLoading: false, pipelineError: error })),
  on(A.loadApplications, (s, { page, stage }) => ({
    ...s,
    page,
    stage,
    applicationsLoading: true,
    applicationsError: null,
  })),
  on(A.applicationsLoaded, (s, { page }) => ({
    ...s,
    applications: page.content,
    page: page.page,
    totalPages: page.totalPages,
    totalElements: page.totalElements,
    applicationsLoading: false,
    applicationsLoaded: true,
  })),
  on(A.applicationsFailed, (s, { error }) => ({
    ...s,
    applicationsLoading: false,
    applicationsError: error,
  })),
  on(A.createApplication, started('application')),
  on(A.updateApplication, started('update')),
  on(A.applicationSaved, (s, { application, created }) => ({
    ...settled(s),
    applications: created
      ? s.applications
      : s.applications.map((a) => (a.id === application.id ? application : a)),
  })),
  on(A.loadMembers, (s) => ({ ...s, membersLoading: true, membersError: null })),
  on(A.membersLoaded, (s, { members }) => ({ ...s, members, membersLoading: false })),
  on(A.membersFailed, (s, { error }) => ({ ...s, membersLoading: false, membersError: error })),
  on(A.addMember, A.removeMember, started('member')),
  on(A.membersChanged, settled),
  on(A.importApplications, (s) => ({ ...started('import')(s), importResult: null })),
  on(A.importFinished, (s, { result }) => ({ ...settled(s), importResult: result })),
  on(A.clearImport, (s) => ({ ...s, importResult: null })),
  on(A.writeFailed, (s, { error }) => ({ ...settled(s), saveError: error })),
);
