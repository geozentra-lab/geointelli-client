import { StageBars, StageRow } from '../dashboard/dash-ui';
import { LabelPipe } from '../../shared/pipes/label.pipe';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { Metric } from '../../shared/components/metric';
import { PropertyPicker } from '../../shared/components/property-picker';
import { PropertyRef } from '../../shared/components/property-ref';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { LenderActions as A, LenderWrite } from '../../store/lender/lender.actions';
import { selectLender, selectLenderOrganization } from '../../store/lender/lender.selectors';
import {
  LENDER_IMPORT_EXAMPLE,
  LENDER_IMPORT_MAX_ROWS,
  LENDER_STAGES,
  LOAN_TYPES,
  LTV_REASONS,
  LenderApplicationDTO,
  LenderCollateralAnalysisDTO,
  LenderLoanType,
  LenderApplicationStage,
  TERMINAL_LENDER_STAGES,
  lenderStageLabels,
  loanTypeLabels,
  nextLenderStages,
  parseLenderImport,
} from '../../core/models/lender';
type Tab = 'pipeline' | 'applications' | 'import' | 'team';
const emptyApplication = () => ({
  applicantName: '',
  requestedAmount: null as number | null,
  applicantEmail: '',
  propertyId: null as number | null,
  notes: '',
  loanType: 'UNKNOWN' as LenderLoanType,
});
/** Two decimals at most, as the backend stores USD amounts. */
const isAmount = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && Math.round(v * 100) === v * 100;
@Component({
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    PageHeading,
    RequestStatus,
    Pagination,
    Metric,
    PropertyPicker,
    PropertyRef,
    StageBars,
    LabelPipe,
  ],
  templateUrl: './loan-review.html',
  styles: `
    .org-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
    }
    .grow {
      flex: 1;
    }
    .member-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .org-bar .formfield {
      min-width: 220px;
    }
    .app-row {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding: 16px 0;
      border-bottom: 1px solid var(--line);
    }
    .app-row:last-of-type {
      border-bottom: 0;
    }
    .app-main {
      flex: 1;
      min-width: 0;
    }
    .app-main p {
      margin: 6px 0 0;
      color: var(--ink-2);
      font-size: 13px;
    }
    .app-row > .actions {
      align-items: flex-start;
      flex-wrap: wrap;
      justify-content: flex-end;
      max-width: 50%;
    }
    .app-main p.ltv {
      color: var(--ink);
    }
    .ltv .tag {
      margin-left: 6px;
    }
    .move {
      margin-top: 12px;
      padding: 14px;
      border-radius: var(--radius);
      background: #f6f8f8;
    }
    textarea.json {
      width: 100%;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
    }
    @media (max-width: 760px) {
      .app-row {
        flex-direction: column;
      }
      .app-row > .actions {
        max-width: none;
        justify-content: flex-start;
      }
    }
  `,
})
export class LoanReview implements OnInit {
  w = inject(Workspace);
  private confirmation = inject(ConfirmationService);
  private destroy = inject(DestroyRef);
  lender = this.w.store.selectSignal(selectLender);
  organization = this.w.store.selectSignal(selectLenderOrganization);
  readonly tabs: [Tab, string][] = [
    ['pipeline', 'Pipeline'],
    ['applications', 'Applications'],
    ['import', 'Import'],
    ['team', 'Team'],
  ];
  readonly stages = LENDER_STAGES;
  readonly maxRows = LENDER_IMPORT_MAX_ROWS;
  readonly example = LENDER_IMPORT_EXAMPLE;
  label = (stage: LenderApplicationStage) => lenderStageLabels[stage];
  readonly loanTypes = LOAN_TYPES;
  loanType = (t: LenderLoanType | null | undefined) => loanTypeLabels[t ?? 'UNKNOWN'] ?? t;
  nextStages = nextLenderStages;
  tab = signal<Tab>('pipeline');
  orgName = '';
  showNewOrg = signal(false);
  application = emptyApplication();
  memberId: number | null = null;
  importText = '';
  importError = signal<string | null>(null);
  /** Application whose stage change form is open, and the target stage with its amounts. */
  moving = signal<{ id: number; stage: LenderApplicationStage } | null>(null);
  approvedAmount: number | null = null;
  fundedAmount: number | null = null;
  readonly isOwner = computed(() => {
    const org = this.organization();
    const me = this.w.account().profile?.id;
    return !!org && me !== undefined && org.ownerUserId === me;
  });
  /** Same pipeline bars as the lender dashboard: count and requested amount per stage. */
  readonly stageRows = computed<StageRow[]>(() => {
    const p = this.lender().pipeline;
    return this.stages.map((stage) => ({
      key: stage,
      label: this.label(stage),
      count: p?.stages[stage]?.count ?? 0,
      amount: p?.stages[stage]?.requestedAmount ?? 0,
      muted: stage === 'REJECTED' || stage === 'WITHDRAWN',
    }));
  });
  private pending: LenderWrite | null = null;
  constructor() {
    // Drafts are cleared only once their write settled without an error.
    effect(() => {
      const s = this.lender();
      if (this.pending === null || s.saving) return;
      if (!s.saveError) {
        if (this.pending === 'organization') {
          this.orgName = '';
          this.showNewOrg.set(false);
        }
        if (this.pending === 'application') this.application = emptyApplication();
        if (this.pending === 'update') this.moving.set(null);
        if (this.pending === 'member') this.memberId = null;
      }
      this.pending = null;
    });
  }
  ngOnInit() {
    if (this.w.auth.isLoggedIn()) this.reload();
  }
  reload() {
    this.w.store.dispatch(A.loadOrganizations());
  }
  select(tab: Tab) {
    this.tab.set(tab);
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const button = event.currentTarget as HTMLButtonElement;
    const buttons = Array.from(
      button.parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]'),
    );
    const index = buttons.indexOf(button);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    this.select(buttons[next].dataset['tab'] as Tab);
    buttons[next].focus();
  }
  private ready(action: string) {
    return !this.lender().saving && this.w.requireAccount(action);
  }
  private write(kind: LenderWrite) {
    this.pending = kind;
  }

  chooseOrganization(id: number) {
    this.moving.set(null);
    this.w.store.dispatch(A.selectOrganization({ organizationId: Number(id) }));
  }
  createOrganization() {
    const name = this.orgName.trim();
    if (!name || name.length > 160 || !this.ready('create an organization')) return;
    this.write('organization');
    this.w.store.dispatch(A.createOrganization({ name }));
  }

  loadMembers() {
    this.w.store.dispatch(A.loadMembers());
  }
  loadPipeline() {
    this.w.store.dispatch(A.loadPipeline());
  }
  loadApplications(page: number, stage = this.lender().stage) {
    this.w.store.dispatch(A.loadApplications({ page, stage }));
  }
  /** Opens the applications list filtered on a stage picked in the pipeline. */
  openStage(stage: string | null) {
    this.select('applications');
    this.filterStage((stage as LenderApplicationStage | null) ?? null);
  }
  filterStage(stage: LenderApplicationStage | null) {
    this.moving.set(null);
    this.loadApplications(0, stage);
  }
  applicationValid() {
    const a = this.application;
    return (
      !!a.applicantName.trim() &&
      a.applicantName.trim().length <= 160 &&
      isAmount(a.requestedAmount) &&
      a.requestedAmount <= 9999999999999999.99
    );
  }
  createApplication() {
    const a = this.application;
    if (!this.applicationValid() || !this.ready('record applications')) return;
    this.write('application');
    this.w.store.dispatch(
      A.createApplication({
        request: {
          applicantName: a.applicantName.trim(),
          requestedAmount: a.requestedAmount!,
          currency: 'USD',
          applicantEmail: a.applicantEmail.trim() || undefined,
          propertyId: a.propertyId ?? undefined,
          notes: a.notes.trim() || undefined,
          loanType: a.loanType,
        },
      }),
    );
  }
  /** Loan-to-value from the linked property's stored valuation; informational only. */
  checkLtv(applicationId: number) {
    this.w.store.dispatch(A.loadCollateral({ applicationId }));
  }
  basis(v: LenderCollateralAnalysisDTO) {
    const what = { FUNDED: 'funded', APPROVED: 'approved', REQUESTED: 'requested' }[
      v.loanAmountBasis
    ];
    return `${what ?? 'loan'} amount`;
  }
  ltvWhy(v: LenderCollateralAnalysisDTO) {
    return v.ltv.reasons.map((r) => LTV_REASONS[r] ?? r).join(' ') || 'not available.';
  }
  /** Approval and funding need an amount; other transitions go straight to the server. */
  startMove(app: LenderApplicationDTO, stage: LenderApplicationStage) {
    if (stage === 'APPROVED' || stage === 'FUNDED') {
      this.approvedAmount = app.approvedAmount ?? app.requestedAmount;
      this.fundedAmount = app.fundedAmount ?? app.approvedAmount;
      this.moving.set({ id: app.id, stage });
      return;
    }
    void this.move(app, stage);
  }
  moveError(app: LenderApplicationDTO) {
    const m = this.moving();
    if (!m || m.id !== app.id) return null;
    if (m.stage === 'APPROVED') {
      if (!isAmount(this.approvedAmount)) return 'Enter the approved amount (up to two decimals).';
      if (this.approvedAmount > app.requestedAmount)
        return 'The approved amount cannot exceed the requested amount.';
    }
    if (m.stage === 'FUNDED') {
      if (!isAmount(this.fundedAmount)) return 'Enter the funded amount (up to two decimals).';
      if (app.approvedAmount !== null && this.fundedAmount > app.approvedAmount)
        return 'The funded amount cannot exceed the approved amount.';
    }
    return null;
  }
  async move(app: LenderApplicationDTO, stage: LenderApplicationStage) {
    if (!nextLenderStages(app.stage).includes(stage) || this.moveError(app)) return;
    if (
      TERMINAL_LENDER_STAGES.includes(stage) &&
      !(await this.confirmation.confirm({
        title: 'Mark as ' + this.label(stage).toLowerCase() + '?',
        message:
          app.applicantName +
          "'s application will be recorded as " +
          this.label(stage).toLowerCase() +
          '. Its stage cannot be changed afterwards.',
        confirmLabel: 'Mark ' + this.label(stage).toLowerCase(),
      }))
    )
      return;
    if (this.destroy.destroyed || !this.ready('update applications')) return;
    this.write('update');
    this.w.store.dispatch(
      A.updateApplication({
        id: app.id,
        request: {
          stage,
          ...(stage === 'APPROVED' ? { approvedAmount: this.approvedAmount! } : {}),
          ...(stage === 'FUNDED' ? { fundedAmount: this.fundedAmount! } : {}),
        },
      }),
    );
  }

  addMember() {
    const id = Number(this.memberId);
    if (!Number.isSafeInteger(id) || id <= 0 || !this.ready('manage team access')) return;
    if (this.lender().members.includes(id)) {
      this.w.toast('User ' + id + ' already has access.');
      return;
    }
    this.write('member');
    this.w.store.dispatch(A.addMember({ userId: id }));
  }
  async removeMember(userId: number) {
    const org = this.organization();
    if (!org || userId === org.ownerUserId) return;
    if (
      !(await this.confirmation.confirm({
        title: 'Remove access?',
        message:
          'User ' +
          userId +
          ' will no longer see ' +
          org.name +
          "'s applications. Applications they recorded stay with the organization.",
        confirmLabel: 'Remove access',
      })) ||
      this.destroy.destroyed ||
      !this.ready('manage team access')
    )
      return;
    this.write('member');
    this.w.store.dispatch(A.removeMember({ userId }));
  }

  useExample() {
    this.importText = this.example;
    this.importError.set(null);
  }
  runImport() {
    const parsed = parseLenderImport(this.importText);
    if ('error' in parsed) {
      this.importError.set(parsed.error);
      return;
    }
    this.importError.set(null);
    if (!this.ready('import applications')) return;
    this.write('import');
    this.w.store.dispatch(A.importApplications({ request: parsed.request }));
  }
  importErrorText(code: string | null) {
    return (
      (
        {
          INVALID_ROW: 'Missing or invalid fields',
          INVALID_TRANSITION: 'Stage change not allowed',
          CONFLICT_RETRY_ROW: 'Changed concurrently, retry this row',
        } as Record<string, string>
      )[code ?? ''] ??
      code ??
      ''
    );
  }
}
