import { Component, computed, effect, inject, linkedSignal, untracked } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../../shared/data/workspace';
import { PageHeading } from '../../../shared/components/page-heading';
import { TABLE_KIT } from '../../../shared/table';
import { countOf, formatLocalDate, formatRecordDate, plainNote } from '../../../shared/data/format';
import {
  LENDER_STAGES,
  LOAN_TYPES,
  LTV_REASONS,
  LenderApplicationDTO,
  LenderApplicationStage,
  LenderCollateralAnalysisDTO,
  LenderLoanType,
  lenderStageLabels,
  loanTypeLabels,
} from '../../../core/models/lender';
import { LenderDashboardActions as A } from '../../../store/lender-dashboard/lender-dashboard.actions';
import { selectLenderDashboard } from '../../../store/lender-dashboard/lender-dashboard.selectors';
import { Kpi, StageBars, StageRow, usdCompact } from '../dash-ui';
import { MixBar, MixPart, OVERVIEW_STYLES, OverviewSection, shareText } from '../overview-ui';

const WAITING: LenderApplicationStage[] = ['SUBMITTED', 'UNDER_REVIEW'];
/** Categorical colours follow the loan type, in a fixed order; an unknown type is the hatch. */
const MIX_COLORS: Record<LenderLoanType, string | null> = {
  CONVENTIONAL: 'var(--chart-cat-1)',
  FHA: 'var(--chart-cat-2)',
  VA: 'var(--chart-cat-3)',
  USDA: 'var(--chart-cat-4)',
  UNKNOWN: null,
};
const DISCLAIMER = 'Informational only; not a credit decision or approval.';

/**
 * Lender overview (DESIGN.md §8; SOW IV "Bank/Lender"): the lead is "Waiting for review", the
 * Submitted and Under review applications, oldest update first, with their LTV, and a way into
 * Applications; then the pipeline by stage (count and requested amount of every stage, from the
 * pipeline the lead already reads; a stage opens Applications filtered on it); then two columns:
 * approved and funded this month (the approved-funded card, with its period) and the funded loan
 * mix as a segmented bar with its table twin (an unknown loan type is the hatched part).
 *
 * The lender dashboard slice holds only the 6 newest applications of every stage (the API lists
 * them newest first), so the lead lists the waiting ones among them against each stage's count from
 * the pipeline; Applications lists them all (PROGRESS.md, needs store work). Tracking only: nothing
 * here is a credit decision.
 */
@Component({
  selector: 'gz-lender-dashboard',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeading,
    Kpi,
    MixBar,
    StageBars,
    OverviewSection,
    ...TABLE_KIT,
  ],
  template: `@let orgList = d().organizations.value;
    <gz-heading title="Lending">
      @if (orgList && orgList.length > 1) {
        <label class="ov-scope" for="dash-org">
          <span>Organization</span>
          <select
            id="dash-org"
            [value]="d().organizationId"
            (change)="select(+$any($event.target).value)"
          >
            @for (o of orgList; track o.id) {
              <option [value]="o.id" [selected]="o.id === d().organizationId">{{ o.name }}</option>
            }
          </select>
        </label>
      }
    </gz-heading>
    @let p = d().pipeline.value;
    @let recent = d().recent.value;
    @let af = d().approvedFunded.value;
    <section
      gz-overview-section
      #leadSection
      heading="Waiting for review"
      [caption]="waitingCaption()"
      [busy]="(d().pipeline.loading && !!p) || (d().recent.loading && !!recent)"
    >
      @if (tableShown()) {
        <a actions class="btn primary" routerLink="/loan-review" [queryParams]="applications()"
          >Open Applications</a
        >
      }
      @if (d().organizations.error) {
        <div class="insight danger ov-alert" role="alert">
          <span>Your lending organizations could not load.</span>
          <button type="button" class="btn small" (click)="leadSection.retried(); load()">Retry</button>
        </div>
      } @else if (noOrg()) {
        <div class="ov-empty">
          <p>Create your lending organization to track applications and collateral.</p>
          <a class="btn primary" routerLink="/loan-review">Set up organization</a>
        </div>
      } @else if (d().pipeline.error || d().recent.error) {
        <div class="insight danger ov-alert" role="alert">
          <span>Applications could not load.</span>
          <button type="button" class="btn small" (click)="leadSection.retried(); load()">Retry</button>
        </div>
      } @else if (!p || !recent) {
        @for (i of skeleton; track i) {
          <div class="row-skeleton" aria-hidden="true"></div>
        }
        <p class="sr-only" role="status">Loading applications…</p>
      } @else if (!waitingTotal()) {
        <div class="ov-empty">
          <p>No applications waiting.</p>
          <a class="btn primary" routerLink="/loan-review" [queryParams]="applications()"
            >New application</a
          >
        </div>
      } @else if (!waitingRows().length) {
        <div class="ov-empty">
          <p>
            None of the {{ recent.content.length }} newest applications, which is all the overview
            receives, is waiting. Applications lists the ones that are: {{ stageCounts() }}.
          </p>
          <a class="btn primary" routerLink="/loan-review" [queryParams]="applications()"
            >Open Applications</a
          >
        </div>
      } @else {
        <table gz-table class="ov-table" sticky="none">
          <caption class="sr-only">
            Applications waiting for review, oldest update first
          </caption>
          <thead>
            <tr>
              <th scope="col">Applicant</th>
              <th scope="col" class="ld-w-stage" data-priority="2">Stage</th>
              <th scope="col" class="num ld-w-money">Requested</th>
              <th scope="col" class="num ld-w-date" data-priority="2">Last update</th>
              <th scope="col" class="num ld-w-ltv" data-priority="2">LTV</th>
            </tr>
          </thead>
          <tbody>
            @for (a of waitingRows(); track a.id) {
              <tr>
                <td>
                  <span class="cell-main">{{ a.applicantName }}</span>
                  <span class="cell-sub">{{ loanType(a.loanType) }}</span>
                  <span class="cell-sub m-only">{{ stageLabel(a.stage) }} · updated {{ date(a.updatedAt) }}</span>
                  <span class="cell-sub m-only">{{ ltvLine(a) }}</span>
                </td>
                <td data-priority="2">{{ stageLabel(a.stage) }}</td>
                <td class="num">{{ a.requestedAmount | currency: a.currency : 'symbol' : '1.0-0' }}</td>
                <td class="num" data-priority="2">{{ date(a.updatedAt) }}</td>
                @if (a.propertyId === null) {
                  <td class="num muted" data-priority="2">No property linked</td>
                } @else {
                  @let l = ltv(a.id);
                  @if (l.loading) {
                    <td class="num" data-priority="2">
                      <span class="skeleton ld-skel" aria-hidden="true"></span
                      ><span class="sr-only">Checking LTV</span>
                    </td>
                  } @else {
                    <td
                      gz-cell
                      class="num"
                      data-priority="2"
                      [missing]="l.percent === null"
                      [reason]="l.reason"
                      [showReason]="true"
                    >
                      {{ l.percent | number: '1.0-1' }}%
                      <span class="cell-sub">of {{ l.basis }}</span>
                      @if (l.limited) {
                        <span class="cell-sub attention">Limited estimate</span>
                      }
                    </td>
                  }
                }
              </tr>
            }
          </tbody>
        </table>
        @if (listedText(); as listed) {
          <p class="ov-note">
            {{ listed }} The overview receives only the {{ recent.content.length }} newest
            applications; Applications lists every one.
          </p>
        }
        <p class="ov-note">
          LTV is from the stored ZentraValue of each linked property. {{ disclaimer() }}
        </p>
      }
    </section>
    @if (!noOrg() && d().organizationId !== null) {
      <section
        gz-overview-section
        #pipelineSection
        class="ld-pipeline"
        heading="Pipeline by stage"
        [caption]="pipelineCaption()"
        [busy]="d().pipeline.loading && !!p"
      >
        <a actions class="ov-link" routerLink="/loan-review" [queryParams]="pipelineLink()">Open Pipeline</a>
        @if (d().pipeline.error) {
          <div class="insight danger ov-alert" role="alert">
            <span>The pipeline could not load.</span>
            <button type="button" class="btn small" (click)="pipelineSection.retried(); load()">Retry</button>
          </div>
        } @else if (!p) {
          @for (i of skeleton; track i) {
            <div class="row-skeleton" aria-hidden="true"></div>
          }
        } @else if (!p.total) {
          <p class="ov-text">Applications appear here by stage, with the amounts requested.</p>
        } @else {
          <div class="ld-stages">
            <gz-stage-bars
              [rows]="stageRows()"
              link="/loan-review"
              param="stage"
              [query]="applications()"
              label="Applications by stage"
            />
          </div>
          <p class="ov-note">
            Each application is counted once, in its current stage, with the amount it requests. A
            stage opens Applications filtered on it.
          </p>
        }
      </section>
      <div class="ov-cols">
        <section
          gz-overview-section
          #fundedSection
          [heading]="fundedHeading()"
          [caption]="periodCaption()"
          [busy]="d().approvedFunded.loading && !!af"
        >
          @if (d().approvedFunded.error) {
            <div class="insight danger ov-alert" role="alert">
              <span>Approved and funded loans could not load.</span>
              <button type="button" class="btn small" (click)="fundedSection.retried(); reloadPeriod()">
                Retry
              </button>
            </div>
          } @else if (!af) {
            @for (i of skeleton; track i) {
              <div class="row-skeleton" aria-hidden="true"></div>
            }
          } @else if (af.status === 'EMPTY') {
            <p class="ov-text">No application was approved or funded {{ periodWords() }}.</p>
          } @else {
            <dl class="kpi-row">
              <div
                gz-kpi
                label="Approved"
                [value]="money(af.approved.totalAmount)"
                [caption]="countOf(af.approved.count, 'application')"
                unavailable="No approved amount was returned"
              ></div>
              <div
                gz-kpi
                label="Funded"
                [value]="money(af.funded.totalAmount)"
                [caption]="countOf(af.funded.count, 'loan')"
                unavailable="No funded amount was returned"
              ></div>
            </dl>
            @if (plainNote(af.note); as note) {
              <p class="ov-note">{{ note }}</p>
            }
          }
          <details class="ld-period" [open]="periodOpen">
            <summary #periodSummary>Change period</summary>
            <form class="ld-form" #pf="ngForm" (ngSubmit)="pf.valid && applyPeriod()">
              <div class="formfield">
                <label for="lender-from">From</label>
                <input
                  id="lender-from"
                  name="fromDate"
                  type="date"
                  min="1900-01-01"
                  max="9999-12-31"
                  [(ngModel)]="fromDate"
                  [required]="!!toDate"
                />
              </div>
              <div class="formfield">
                <label for="lender-to">To</label>
                <input
                  id="lender-to"
                  name="toDate"
                  type="date"
                  min="1900-01-01"
                  max="9999-12-31"
                  [(ngModel)]="toDate"
                  [required]="!!fromDate"
                />
              </div>
              <button
                class="btn"
                [disabled]="pf.invalid || periodInvalid()"
                [attr.aria-describedby]="periodInvalid() || pf.invalid ? 'lender-period-why' : null"
              >
                Apply
              </button>
              @if (d().period.fromDate) {
                <button
                  type="button"
                  class="linkbtn"
                  (click)="resetPeriod(); periodSummary.focus()"
                >
                  This month
                </button>
              }
            </form>
            @if (periodInvalid()) {
              <p class="field-error" id="lender-period-why">The first day must not be after the last day.</p>
            } @else if (pf.invalid) {
              <p class="ov-note" id="lender-period-why">Choose both days, or neither for this month.</p>
            }
          </details>
        </section>
        <section
          gz-overview-section
          #mixSection
          heading="Loan mix"
          [caption]="mixCaption()"
          [busy]="d().approvedFunded.loading && !!af"
        >
          @if (d().approvedFunded.error) {
            <div class="insight danger ov-alert" role="alert">
              <span>The loan mix could not load.</span>
              <button type="button" class="btn small" (click)="mixSection.retried(); reloadPeriod()">
                Retry
              </button>
            </div>
          } @else if (!af) {
            @for (i of skeleton; track i) {
              <div class="row-skeleton" aria-hidden="true"></div>
            }
          } @else if (!af.funded.count) {
            <p class="ov-text">No loans were funded {{ periodWords() }}.</p>
          } @else {
            <gz-mix-bar [parts]="mixParts()" [total]="af.funded.count" label="Funded loans by loan type" />
            <table gz-table class="ov-table ld-mix" sticky="none">
              <caption class="sr-only">
                Funded loans by loan type
              </caption>
              <thead>
                <tr>
                  <th scope="col">Loan type</th>
                  <th scope="col" class="num">Loans</th>
                  <th scope="col" class="num" data-priority="2">Share</th>
                  <th scope="col" class="num">Funded</th>
                </tr>
              </thead>
              <tbody>
                @for (m of mixRows(); track m.key) {
                  <tr>
                    <!-- The swatch is the legend; the unknown part's cell is hatched like its block. -->
                    <td
                      gz-cell
                      [missing]="m.key === 'UNKNOWN'"
                      reason="Loan type not recorded"
                      [showReason]="true"
                    >
                      <span class="ld-swatch" aria-hidden="true" [style.background-color]="m.color"></span>
                      {{ m.label }}
                    </td>
                    <td class="num">{{ m.value }}</td>
                    <td class="num" data-priority="2">{{ share(m) }}</td>
                    <td class="num">{{ m.amount | currency: af.currency : 'symbol' : '1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      </div>
    }`,
  styles: [
    OVERVIEW_STYLES,
    `
      .ov-scope {
        display: flex;
        align-items: center;
        gap: var(--sp-8);
        font-size: var(--fs-cell);
        color: var(--ink-2);
      }
      .ov-scope select {
        min-width: 220px;
      }
      .ld-w-stage {
        width: 14%;
      }
      .ld-w-money,
      .ld-w-date {
        width: 13%;
      }
      .ld-w-ltv {
        width: 24%;
      }
      .ld-skel {
        display: inline-block;
        width: 56px;
        height: 16px;
        vertical-align: middle;
      }
      .ld-period {
        margin-top: var(--sp-16);
        font-size: var(--fs-cell);
      }
      .ld-period summary {
        cursor: pointer;
        color: var(--copper);
        font-weight: 500;
      }
      .ld-form {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: var(--sp-12);
        margin-top: var(--sp-12);
      }
      gz-mix-bar {
        display: block;
        margin: var(--sp-4) 0 var(--sp-12);
      }
      .ld-pipeline {
        margin-top: var(--sp-24);
      }
      .ld-stages {
        max-width: 760px;
      }
      .ld-swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        margin-right: var(--sp-8);
        border-radius: 2px;
        vertical-align: -1px;
      }
      @media (max-width: 700px) {
        .ov-scope {
          width: 100%;
        }
        .ov-scope select {
          flex: 1;
          min-width: 0;
        }
      }
    `,
  ],
})
export class LenderDashboard {
  readonly w = inject(Workspace);
  /** Backend notes without developer field names (DESIGN.md §13). */
  readonly plainNote = plainNote;
  readonly d = this.w.store.selectSignal(selectLenderDashboard);
  /**
   * Into Loan review on the organization chosen here (?org=, applied there and taken out of the
   * address): Loan review keeps its own choice, the first organization on a first visit.
   */
  private readonly org = computed((): Record<string, string> => {
    const id = this.d().organizationId;
    return id === null ? {} : { org: String(id) };
  });
  readonly applications = computed(() => ({ tab: 'applications', ...this.org() }));
  readonly pipelineLink = this.org;
  readonly skeleton = [0, 1, 2];
  readonly countOf = countOf;
  readonly noOrg = computed(() => this.d().organizations.value?.length === 0);
  /** The period form starts from the period in view (the slice keeps it between visits). */
  fromDate = this.d().period.fromDate ?? '';
  toDate = this.d().period.toDate ?? '';
  /** Open on arrival when a period is set; after that only the viewer opens or closes it. */
  readonly periodOpen = !!this.d().period.fromDate;

  readonly waitingTotal = computed(() => {
    const st = this.d().pipeline.value?.stages ?? {};
    return WAITING.reduce((n, k) => n + (st[k]?.count ?? 0), 0);
  });
  /** The waiting applications among the recent ones the slice holds, oldest update first. */
  readonly waitingRows = computed<LenderApplicationDTO[]>(() =>
    (this.d().recent.value?.content ?? [])
      .filter((a) => WAITING.includes(a.stage))
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt) || a.id - b.id),
  );
  /** The table (and its way into Applications) shows only with waiting rows and no error. */
  readonly tableShown = computed(() => {
    const s = this.d();
    return (
      !this.noOrg() &&
      !s.organizations.error &&
      !s.pipeline.error &&
      !s.recent.error &&
      !!s.pipeline.value &&
      this.waitingTotal() > 0 &&
      this.waitingRows().length > 0
    );
  });
  /** Each waiting stage as the pipeline sends it: count and requested amount (never summed). */
  /**
   * Every stage in pipeline order, with its count and requested amount; lost stages muted. A stage
   * with no application requests $0; one with applications but no amount sent is Unavailable.
   */
  readonly stageRows = computed<StageRow[]>(() => {
    const st = this.d().pipeline.value?.stages ?? {};
    return LENDER_STAGES.map((stage) => {
      const count = st[stage]?.count ?? 0;
      return {
        key: stage,
        label: lenderStageLabels[stage],
        count,
        amount: count ? (st[stage]?.requestedAmount ?? null) : 0,
        muted: stage === 'REJECTED' || stage === 'WITHDRAWN',
      };
    });
  });
  readonly pipelineCaption = computed(() => {
    const p = this.d().pipeline.value;
    if (!p || !p.total || this.d().pipeline.error) return '';
    const asOf = formatRecordDate(p.asOf);
    return `${countOf(p.total, 'application')} · requested amounts in ${p.currency}${asOf ? ' · as of ' + asOf : ''}`;
  });
  readonly waitingCaption = computed(() => {
    const st = this.d().pipeline.value?.stages;
    if (!st || !this.waitingTotal() || this.d().pipeline.error) return '';
    return WAITING.map((k) => {
      const t = st[k];
      const money = usdCompact(t?.requestedAmount ?? 0);
      return `${lenderStageLabels[k]} ${t?.count ?? 0} (${money} requested)`;
    }).join(' · ');
  });
  /** "4 submitted, 4 under review": the pipeline's counts. */
  readonly stageCounts = computed(() => {
    const st = this.d().pipeline.value?.stages ?? {};
    return `${st.SUBMITTED?.count ?? 0} submitted, ${st.UNDER_REVIEW?.count ?? 0} under review`;
  });
  /** When the slice holds fewer than the pipeline counts: rows on screen against each stage's count. */
  readonly listedText = computed(() => {
    const st = this.d().pipeline.value?.stages ?? {};
    const rows = this.waitingRows();
    const parts = WAITING.map((k) => ({
      shown: rows.filter((a) => a.stage === k).length,
      count: st[k]?.count ?? 0,
      word: k === 'SUBMITTED' ? 'submitted' : 'under review',
    }));
    if (parts.every((x) => x.shown >= x.count)) return '';
    return 'Listed: ' + parts.map((x) => `${x.shown} of ${x.count} ${x.word}`).join(' and ') + '.';
  });
  readonly disclaimer = computed(() => {
    const analyses = Object.values(this.d().collateral);
    // Backend copy without field names (DESIGN.md §13); ours when the backend's can't be shown.
    return plainNote(analyses.find((c) => c.value?.disclaimer)?.value?.disclaimer) ?? DISCLAIMER;
  });

  /**
   * Whether the card on screen is this month's (asked for without dates). While a new period loads,
   * the previous card stays (at 60%), and so do its heading and wording.
   */
  readonly shownIsMonth = linkedSignal<{ settled: boolean; month: boolean }, boolean>({
    source: () => {
      const s = this.d();
      return {
        settled: !s.approvedFunded.loading && !!s.approvedFunded.value,
        month: s.period.fromDate === null,
      };
    },
    computation: (src, previous) => (src.settled ? src.month : (previous?.value ?? src.month)),
  });
  // After a failed request the section shows only the error, so the heading and the caption name
  // no period: the one held is not the one asked for.
  readonly fundedHeading = computed(() =>
    this.shownIsMonth() && !this.d().approvedFunded.error
      ? 'Approved and funded this month'
      : 'Approved and funded',
  );
  readonly periodCaption = computed(() => {
    const p = this.d().approvedFunded.value?.period;
    if (!p || this.d().approvedFunded.error) return '';
    return `${formatRecordDate(p.fromDate)} to ${formatRecordDate(p.toDate)} · ${p.timeZone} days`;
  });
  readonly periodWords = computed(() => (this.shownIsMonth() ? 'this month' : 'in this period'));
  readonly mixCaption = computed(() => {
    const af = this.d().approvedFunded.value;
    if (!af || !af.funded.count || this.d().approvedFunded.error) return '';
    return `${countOf(af.funded.count, 'loan')} funded ${this.periodWords()}, by loan type`;
  });
  private readonly mix = computed(() => this.d().approvedFunded.value?.fundedLoanMix ?? []);
  readonly mixRows = computed(() =>
    LOAN_TYPES.map((type) => {
      const m = this.mix().find((x) => (x.loanType ?? 'UNKNOWN') === type);
      return {
        key: type,
        label: type === 'UNKNOWN' ? 'Loan type not recorded' : loanTypeLabels[type],
        value: m?.count ?? 0,
        amount: m?.totalAmount ?? 0,
        color: MIX_COLORS[type],
      };
    }).filter((m) => m.value > 0),
  );
  readonly mixParts = computed<MixPart[]>(() => this.mixRows());

  /** A boolean, so the cards load once when the account arrives, not on every account change. */
  private readonly signedIn = computed(() => this.w.auth.isLoggedIn() && !!this.w.account().profile);
  constructor() {
    effect(() => {
      if (this.signedIn()) untracked(() => this.load());
    });
  }
  load() {
    this.w.store.dispatch(A.load());
  }
  select(organizationId: number) {
    this.w.store.dispatch(A.selectOrganization({ organizationId }));
  }
  periodInvalid() {
    return !!this.fromDate && !!this.toDate && this.fromDate > this.toDate;
  }
  /** Both days or neither: the API refuses a period with one end only. */
  applyPeriod() {
    if (this.periodInvalid() || !this.fromDate !== !this.toDate) return;
    this.w.store.dispatch(
      A.setPeriod({ period: { fromDate: this.fromDate || null, toDate: this.toDate || null } }),
    );
  }
  resetPeriod() {
    this.fromDate = '';
    this.toDate = '';
    this.w.store.dispatch(A.setPeriod({ period: { fromDate: null, toDate: null } }));
  }
  /** The approved-funded card again, for the period in view. */
  reloadPeriod() {
    this.w.store.dispatch(A.setPeriod({ period: this.d().period }));
  }
  money(v: number | null | undefined) {
    return usdCompact(v);
  }
  /** A loan type's share of the funded loans, against the card's own funded count. */
  share(m: { value: number }) {
    return shareText(m.value, this.d().approvedFunded.value?.funded.count ?? 0);
  }
  stageLabel(s: LenderApplicationStage) {
    return lenderStageLabels[s] ?? s;
  }
  loanType(t: LenderLoanType | null | undefined) {
    return !t || t === 'UNKNOWN' ? 'Loan type not recorded' : (loanTypeLabels[t] ?? t);
  }
  date(value: string) {
    return formatLocalDate(value) ?? '';
  }
  /** The phone's second line for LTV, where the column is hidden. */
  ltvLine(a: LenderApplicationDTO) {
    if (a.propertyId === null) return 'LTV: no property linked';
    const l = this.ltv(a.id);
    if (l.loading) return 'Checking LTV…';
    if (l.percent === null) return 'LTV unavailable: ' + l.reason;
    const pct = (Math.round(l.percent * 10) / 10).toLocaleString('en-US');
    return `LTV ${pct}% of ${l.basis}${l.limited ? ' · Limited estimate' : ''}`;
  }
  /** The LTV cell of one waiting application, from its collateral analysis. */
  ltv(applicationId: number) {
    const c = this.d().collateral[applicationId];
    const v = c?.value ?? null;
    return {
      loading: !c || c.loading,
      percent: c?.error || !v ? null : v.ltv.percent,
      reason: c?.error ? 'LTV could not load' : this.ltvWhy(v),
      basis: this.basis(v),
      limited: v?.ltv.status === 'LIMITED',
    };
  }
  basis(v: LenderCollateralAnalysisDTO | null | undefined) {
    if (!v) return '';
    const what = { FUNDED: 'funded', APPROVED: 'approved', REQUESTED: 'requested' }[
      v.loanAmountBasis
    ];
    return `${usdCompact(v.loanAmount) ?? 'the loan'} ${what ?? ''}`.trim();
  }
  ltvWhy(v: LenderCollateralAnalysisDTO | null | undefined) {
    if (!v) return 'No loan-to-value was returned';
    return v.ltv.reasons.map((r) => LTV_REASONS[r] ?? r).join(' ') || 'No loan-to-value was returned';
  }
}
