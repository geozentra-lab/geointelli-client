import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT, Sort, StageLink, sortRows } from '../../shared/table';
import { countOf, formatLocalDate, formatLocalDateTime, formatRecordDate } from '../../shared/data/format';
import { RealtorLicenseStatus } from '../../core/models/api';
import { LICENSE_STATUS_LABELS } from '../../core/models/realtor-license';
import {
  DEFAULT_REGISTRY_SOURCE,
  LicenseAutoCheckResult,
  RealtorLicenseReviewDTO,
} from '../../core/models/account';
import { AdminAccessActions as A } from '../../store/admin-access/admin-access.actions';
import { selectAdminAccess } from '../../store/admin-access/admin-access.selectors';
import { AdminGate, adminAccess } from './admin-gate';

const STATUSES: readonly RealtorLicenseStatus[] = ['PENDING_REVIEW', 'VERIFIED', 'REJECTED'];
const AUTO_CHECK: Record<LicenseAutoCheckResult, string> = {
  MATCH: 'Matches the registry',
  NO_MATCH: 'No match in the registry',
  INCONCLUSIVE: 'Inconclusive',
};
const REGISTRY_MAX = 200;
const REASON_MAX = 500;

/**
 * Realtor licenses (backend SCRUM-204): a realtor account is approved from its license. A register:
 * status links kept in the address (`?status=`, Pending review when absent), a table with the
 * automatic registry check, server pages of 20, and the submission in the record pane. Approving
 * names the registry the license was checked against; rejecting adds a reason the applicant sees.
 * Realm role "admin" only.
 */
@Component({
  imports: [FormsModule, RouterLink, PageHeading, RequestStatus, Desk, RecordPane, AdminGate, ...RECORD_KIT, ...TABLE_KIT],
  template: `<gz-desk [open]="paneLicense() !== null" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading title="Realtor licenses" subtitle="A realtor account is approved once its license is checked against the state registry.">
        @if (access() === 'admin') {
          <button type="button" class="btn" [attr.aria-disabled]="s().licenses.loading ? 'true' : null" (click)="refresh()">
            {{ s().licenses.loading ? 'Refreshing…' : 'Refresh' }}
          </button>
        }
      </gz-heading>
      @if (access() !== 'admin') {
        <gz-admin-gate [access]="access()" what="the realtor license reviews" />
      } @else {
        <gz-stage-links [stages]="statusLinks" [active]="statusKey()" param="status" label="Filter by status" />
        <gz-request-status
          [loading]="s().licenses.loading && !s().licenses.value"
          loadingText="Loading license submissions…"
          [error]="s().licenses.error"
          (retry)="refresh()"
        />
        @if (s().licenses.value; as page) {
          @if (page.content.length) {
            <p class="rl-count" #listTop tabindex="-1">{{ countOf(page.totalElements, 'submission') }} · {{ statusWord(s().licenseQuery.status) }}</p>
            <table
              gz-table
              class="rl-table"
              [(sort)]="sort"
              [(selected)]="selectedId"
              (activated)="open($event)"
              (dismissed)="closePane()"
              [paneOpen]="paneLicense() !== null"
              [attr.aria-busy]="s().licenses.loading ? 'true' : null"
            >
              <caption class="sr-only">Realtor license submissions. Choose a row to see the submission and decide it.</caption>
              <thead>
                <tr>
                  <th gz-sort="email">Applicant</th>
                  <th gz-sort="name" data-priority="2">Name on the license</th>
                  <th scope="col" data-priority="2">License number</th>
                  <th scope="col" data-priority="3">State</th>
                  <th gz-sort="expires" numeric data-priority="2">Expires</th>
                  <th scope="col" data-priority="3">Brokerage</th>
                  <th gz-sort="submitted" numeric data-priority="2">Submitted</th>
                  <th gz-sort="check">Automatic check</th>
                  @if (decided()) {
                    <th scope="col" data-priority="2">Decision</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (l of rows(); track l.id) {
                  <tr [gz-row]="l.id">
                    <td class="rl-applicant">
                      <span class="cell-main">{{ l.applicantEmail }}</span>
                      <a class="cell-sub" [routerLink]="['/admin/users', l.applicantUserId]" [queryParams]="{ email: l.applicantEmail }">Role history</a>
                      <span class="m-only cell-sub">{{ l.licenseHolderName }} · {{ l.licensingState }} {{ l.licenseNumber }}</span>
                    </td>
                    <td data-priority="2">{{ l.licenseHolderName }}</td>
                    <td class="nowrap" data-priority="2">{{ l.licenseNumber }}</td>
                    <td data-priority="3">{{ l.licensingState }}</td>
                    <td class="num nowrap" data-priority="2">
                      @if (calendar(l.licenseExpirationDate); as d) {
                        {{ d }}
                      } @else {
                        <span class="muted">Not given</span>
                      }
                    </td>
                    <td data-priority="3">
                      @if (l.brokerageName) {
                        {{ l.brokerageName }}
                      } @else {
                        <span class="muted">Not given</span>
                      }
                    </td>
                    <td class="num nowrap" data-priority="2">{{ day(l.submittedAt) }}</td>
                    <td class="rl-check">
                      <span [class]="checkClass(l.autoCheckResult)">{{ checkWord(l.autoCheckResult) }}</span>
                      @if (l.autoCheckNote) {
                        <span class="cell-sub">{{ l.autoCheckNote }}</span>
                      }
                    </td>
                    @if (decided()) {
                      <td data-priority="2">
                        {{ decisionLine(l) }}
                        @if (l.rejectionReason) {
                          <span class="cell-sub">{{ l.rejectionReason }}</span>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
            <gz-pager
              [page]="page.page"
              [size]="page.size"
              [total]="page.totalElements"
              [loading]="s().licenses.loading"
              (changed)="toPage($event)"
            />
            @if (sort()) {
              <p class="table-note">Sorted within this page.</p>
            }
          } @else {
            <p class="rl-empty" #listTop tabindex="-1">{{ emptyText() }}</p>
          }
        }
      }

      @if (paneLicense(); as l) {
        <gz-record-pane
          deskSlot
          [heading]="l.licenseHolderName"
          noun="submission"
          backLabel="Realtor licenses"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() >= 0 && paneIndex() < rows().length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          <span paneMeta>{{ l.licensingState }} {{ l.licenseNumber }} · {{ statusWord(l.status) }}</span>
          @let formKind = l.status === 'PENDING_REVIEW' ? form() : null;
          @if (l.status === 'PENDING_REVIEW' && !formKind) {
            <div paneActions class="rl-actions">
              <button type="button" class="btn primary" (click)="openForm('approve')">Approve…</button>
              <button type="button" class="btn" (click)="openForm('reject')">Reject…</button>
            </div>
          }
          @if (!formKind && errorOf(l); as error) {
            <p class="field-error rl-pane-error" role="alert">{{ error }}</p>
          }
          @if (formKind; as kind) {
            <gz-record-section [heading]="kind === 'approve' ? 'Approve' : 'Reject'">
              <form class="rl-form" (ngSubmit)="decide(l)">
                <div class="formfield">
                  <label for="rl-registry">Registry checked</label>
                  <input
                    id="rl-registry"
                    name="registrySource"
                    type="text"
                    required
                    [attr.maxlength]="registryMax"
                    aria-describedby="rl-registry-hint"
                    [ngModel]="registry()"
                    (ngModelChange)="registry.set($event)"
                  />
                  <p class="smalltext muted" id="rl-registry-hint">Where you checked the license. Saved with the decision.</p>
                </div>
                @if (kind === 'reject') {
                  <div class="formfield">
                    <label for="rl-reason">Reason</label>
                    <textarea
                      id="rl-reason"
                      name="rejectionReason"
                      rows="3"
                      required
                      [attr.maxlength]="reasonMax"
                      aria-describedby="rl-reason-hint"
                      [ngModel]="reason()"
                      (ngModelChange)="reason.set($event)"
                    ></textarea>
                    <p class="smalltext muted" id="rl-reason-hint">Shown to the applicant. Up to {{ reasonMax }} characters.</p>
                  </div>
                }
                <div class="rl-form-actions">
                  <button
                    class="btn primary"
                    [attr.aria-disabled]="why(kind) || acting(l) ? 'true' : null"
                    [attr.aria-describedby]="why(kind) ? 'rl-why' : null"
                  >
                    {{ submitWord(kind, l) }}
                  </button>
                  <button type="button" class="btn" (click)="closeForm()">Cancel</button>
                  @if (why(kind); as reasonWhy) {
                    <p class="rl-why" id="rl-why">{{ reasonWhy }}</p>
                  }
                </div>
                @if (errorOf(l); as error) {
                  <p class="field-error" role="alert">{{ error }}</p>
                }
              </form>
            </gz-record-section>
          }
          <gz-record-section heading="License">
            <gz-record-group>
              <div gz-record-row label="Name on the license">{{ l.licenseHolderName }}</div>
              <div gz-record-row label="License number">{{ l.licenseNumber }}</div>
              <div gz-record-row label="State">{{ l.licensingState }}</div>
              <div gz-record-row label="Expires">
                @if (calendar(l.licenseExpirationDate); as d) {
                  {{ d }}
                } @else {
                  <span class="muted">Not given</span>
                }
              </div>
              <div gz-record-row label="Brokerage">
                @if (l.brokerageName) {
                  {{ l.brokerageName }}
                } @else {
                  <span class="muted">Not given</span>
                }
              </div>
              <div gz-record-row label="Work email">
                @if (l.workEmail) {
                  {{ l.workEmail }}
                } @else {
                  <span class="muted">Not given</span>
                }
              </div>
            </gz-record-group>
            <gz-record-group heading="Applicant">
              <div gz-record-row label="Account email">{{ l.applicantEmail }}</div>
              <div gz-record-row label="User ID" [numeric]="true">{{ l.applicantUserId }}</div>
              <div gz-record-row label="Submitted">{{ when(l.submittedAt) }}</div>
            </gz-record-group>
            <p class="rl-text">
              <a [routerLink]="['/admin/users', l.applicantUserId]" [queryParams]="{ email: l.applicantEmail }">Role history</a>
            </p>
          </gz-record-section>
          <gz-record-section heading="Automatic check">
            @if (l.autoCheckResult) {
              <gz-record-group>
                <div gz-record-row label="Result"><span [class]="checkClass(l.autoCheckResult)">{{ checkWord(l.autoCheckResult) }}</span></div>
                @if (l.autoCheckNote) {
                  <div gz-record-row label="Note">{{ l.autoCheckNote }}</div>
                }
                @if (l.autoCheckSource) {
                  <div gz-record-row label="Source">{{ l.autoCheckSource }}</div>
                }
                @if (l.autoCheckedAt) {
                  <div gz-record-row label="Checked">{{ when(l.autoCheckedAt) }}</div>
                }
              </gz-record-group>
            } @else {
              <p class="rl-text muted">This submission hasn’t been checked automatically.</p>
            }
          </gz-record-section>
          @if (l.status !== 'PENDING_REVIEW') {
            <gz-record-section heading="Decision">
              <gz-record-group>
                <div gz-record-row label="Status">{{ statusWord(l.status) }}</div>
                @if (l.decidedAt) {
                  <div gz-record-row label="Decided">{{ when(l.decidedAt) }}</div>
                }
                @if (l.decisionMethod === 'AUTOMATIC') {
                  <div gz-record-row label="Decided by">The automatic check</div>
                } @else {
                  <div gz-record-row label="Decided by" [missing]="l.reviewedByUserId === null" [showReason]="true" reason="The submission names no admin.">
                    User ID {{ l.reviewedByUserId }}
                  </div>
                }
                @if (l.registrySource) {
                  <div gz-record-row label="Registry checked">{{ l.registrySource }}</div>
                }
                @if (l.rejectionReason) {
                  <div gz-record-row label="Reason">{{ l.rejectionReason }}</div>
                }
              </gz-record-group>
            </gz-record-section>
          }
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    .rl-count {
      margin: var(--sp-12) 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    .rl-empty {
      margin: 0;
      padding: var(--sp-16) 0;
      font-size: var(--fs-body);
      max-width: var(--measure);
      outline: none;
    }
    .rl-applicant {
      min-width: 200px;
      overflow-wrap: anywhere;
    }
    .rl-check {
      min-width: 160px;
      max-width: 40ch;
    }
    .rl-actions,
    .rl-form-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .rl-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .rl-pane-error {
      margin: var(--sp-8) 0;
    }
    .rl-form {
      display: grid;
      gap: var(--sp-12);
      margin-top: var(--sp-8);
    }
    .rl-text {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      max-width: var(--measure);
    }
    gz-record-section + gz-record-section {
      margin-top: var(--sp-16);
    }
  `,
})
export class RealtorLicenses {
  readonly w = inject(Workspace);
  private readonly injector = inject(Injector);
  readonly s = this.w.store.selectSignal(selectAdminAccess);
  readonly access = adminAccess();
  private readonly listTop = viewChild<ElementRef<HTMLElement>>('listTop');
  readonly countOf = countOf;
  readonly registryMax = REGISTRY_MAX;
  readonly reasonMax = REASON_MAX;
  /** Pending review is the default (no `status` in the address). */
  readonly statusLinks: StageLink[] = STATUSES.map((st) => ({
    key: st === 'PENDING_REVIEW' ? null : st,
    label: LICENSE_STATUS_LABELS[st],
    count: null,
  }));
  private readonly statusParam = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('status'))), {
    initialValue: null,
  });
  readonly statusKey = computed(() => {
    const v = this.statusParam();
    return v === 'VERIFIED' || v === 'REJECTED' ? v : null;
  });
  readonly status = computed<RealtorLicenseStatus>(() => (this.statusKey() as RealtorLicenseStatus | null) ?? 'PENDING_REVIEW');
  /** The list on screen holds decided submissions: a Decision column. */
  readonly decided = computed(() => this.s().licenseQuery.status !== 'PENDING_REVIEW');
  readonly emptyText = computed(() => {
    const st = this.s().licenseQuery.status;
    return st === 'PENDING_REVIEW'
      ? 'No license is waiting for review.'
      : `No license has been ${LICENSE_STATUS_LABELS[st].toLowerCase()} yet.`;
  });

  readonly sort = signal<Sort | null>(null);
  readonly rows = computed(() =>
    sortRows(this.s().licenses.value?.content ?? [], this.sort(), (l, key) =>
      key === 'email'
        ? l.applicantEmail
        : key === 'name'
          ? l.licenseHolderName
          : key === 'expires'
            ? l.licenseExpirationDate
            : key === 'submitted'
              ? l.submittedAt
              : key === 'check'
                ? l.autoCheckResult && AUTO_CHECK[l.autoCheckResult]
                : null,
    ),
  );
  readonly selectedId = signal<unknown>(null);
  readonly pane = signal(false);
  readonly paneIndex = computed(() => this.rows().findIndex((l) => l.id === this.selectedId()));
  readonly paneLicense = computed(() => (this.pane() ? (this.rows()[this.paneIndex()] ?? null) : null));
  readonly paneLabel = computed(() => 'License submission: ' + (this.paneLicense()?.licenseHolderName ?? ''));
  readonly position = computed(() => (this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.rows().length} on this page`));
  readonly form = signal<'approve' | 'reject' | null>(null);
  readonly registry = signal(DEFAULT_REGISTRY_SOURCE);
  readonly reason = signal('');
  private readonly sent = signal<number | null>(null);
  private focusList = false;
  private firstLoad = true;

  constructor() {
    // The list whenever the status in the address changes; on opening the page, always.
    effect(() => {
      const status = this.status();
      if (this.access() !== 'admin') return;
      untracked(() => {
        const s = this.s();
        const same = s.licenseQuery.status === status;
        const first = this.firstLoad;
        this.firstLoad = false;
        if (!first && same && s.licenses.value && !s.licenses.error) return;
        this.pane.set(false);
        this.w.store.dispatch(A.loadLicenses({ query: { status, page: first && same ? s.licenseQuery.page : 0 } }));
      });
    });
    // A submission that left the page closes its pane; focus goes to the top of the list.
    effect(() => {
      if (!this.pane() || this.paneLicense()) return;
      untracked(() => {
        this.pane.set(false);
        this.resetForm();
        afterNextRender(() => this.listTop()?.nativeElement.focus(), { injector: this.injector });
      });
    });
    effect(() => {
      this.selectedId();
      untracked(() => this.resetForm());
    });
    effect(() => {
      const id = this.sent();
      const s = this.s();
      if (id === null || s.licenseActing[id]) return;
      untracked(() => {
        this.sent.set(null);
        // A form opened meanwhile on another submission is that one's and stays.
        if (!s.licenseErrors[id] && this.selectedId() === id) this.resetForm();
      });
    });
    effect(() => {
      if (this.s().licenses.loading || !this.focusList) return;
      this.focusList = false;
      untracked(() => {
        const el = this.listTop()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
  }

  statusWord(status: RealtorLicenseStatus) {
    return LICENSE_STATUS_LABELS[status] ?? status;
  }
  checkWord(result: LicenseAutoCheckResult | null) {
    return result ? (AUTO_CHECK[result] ?? result) : 'Not checked';
  }
  checkClass(result: LicenseAutoCheckResult | null) {
    return result === 'MATCH' ? 'positive' : result === 'NO_MATCH' ? 'attention' : result ? '' : 'muted';
  }
  decisionLine(l: RealtorLicenseReviewDTO) {
    const parts = [this.statusWord(l.status), l.decidedAt ? this.day(l.decidedAt) : null, l.decisionMethod === 'AUTOMATIC' ? 'Automatic' : null];
    return parts.filter(Boolean).join(' · ');
  }
  calendar(v: string | null) {
    return formatRecordDate(v);
  }
  day(v: string) {
    return formatLocalDate(v);
  }
  when(v: string) {
    return formatLocalDateTime(v);
  }
  acting(l: RealtorLicenseReviewDTO) {
    return this.s().licenseActing[l.id] ?? null;
  }
  errorOf(l: RealtorLicenseReviewDTO) {
    return this.s().licenseErrors[l.id] ?? null;
  }
  why(kind: 'approve' | 'reject') {
    const registry = this.registry().trim();
    const reason = this.reason().trim();
    if (!registry) return 'Name the registry you checked.';
    if (registry.length > REGISTRY_MAX) return `Keep the registry to ${REGISTRY_MAX} characters.`;
    if (kind === 'reject' && !reason) return 'Write the reason first: the applicant sees it.';
    if (kind === 'reject' && reason.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters.`;
    return null;
  }
  submitWord(kind: 'approve' | 'reject', l: RealtorLicenseReviewDTO) {
    const acting = this.acting(l);
    if (acting) return acting === 'approve' ? 'Approving…' : 'Rejecting…';
    return kind === 'approve' ? 'Approve realtor access' : 'Reject license';
  }

  refresh() {
    if (!this.s().licenses.loading) this.w.store.dispatch(A.loadLicenses({ query: this.s().licenseQuery }));
  }
  toPage(page: number) {
    this.focusList = true;
    this.pane.set(false);
    this.w.store.dispatch(A.loadLicenses({ query: { ...this.s().licenseQuery, page } }));
  }
  open(id: unknown) {
    this.selectedId.set(id);
    this.pane.set(true);
  }
  closePane() {
    if (!this.pane()) return;
    this.pane.set(false);
    this.resetForm();
    afterNextRender(() => document.querySelector<HTMLElement>('.rl-table tr.gz-row.sel')?.focus(), { injector: this.injector });
  }
  step(by: number) {
    const next = this.rows()[this.paneIndex() + by];
    if (next) this.open(next.id);
  }
  openForm(kind: 'approve' | 'reject') {
    this.form.set(kind);
    this.registry.set(DEFAULT_REGISTRY_SOURCE);
    this.reason.set('');
    afterNextRender(() => document.querySelector<HTMLElement>(kind === 'reject' ? '#rl-reason' : '#rl-registry')?.focus(), {
      injector: this.injector,
    });
  }
  closeForm() {
    this.resetForm();
    afterNextRender(() => document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus(), { injector: this.injector });
  }
  private resetForm() {
    this.form.set(null);
    this.registry.set(DEFAULT_REGISTRY_SOURCE);
    this.reason.set('');
  }
  decide(l: RealtorLicenseReviewDTO) {
    const kind = this.form();
    if (!kind || l.status !== 'PENDING_REVIEW' || this.why(kind) || this.acting(l)) return;
    const registrySource = this.registry().trim();
    this.sent.set(l.id);
    this.w.store.dispatch(
      kind === 'approve'
        ? A.approveLicense({ id: l.id, registrySource })
        : A.rejectLicense({ id: l.id, registrySource, rejectionReason: this.reason().trim() }),
    );
  }
}
