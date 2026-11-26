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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT, Sort, StageLink, sortRows } from '../../shared/table';
import { countOf, formatLocalDate, formatLocalDateTime } from '../../shared/data/format';
import {
  ROLE_LABELS,
  RequestableRole,
  RoleRequestReviewDTO,
  RoleRequestStatus,
} from '../../core/models/account';
import { AdminAccessActions as A } from '../../store/admin-access/admin-access.actions';
import { selectAdminAccess } from '../../store/admin-access/admin-access.selectors';
import { AdminGate, adminAccess } from './admin-gate';

const STATUSES: readonly RoleRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED'];
const STATUS_WORD: Record<RoleRequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  REVOKED: 'Revoked',
};
const ROLES: readonly RequestableRole[] = ['investor', 'lender'];
const REASON_MAX = 500;

/**
 * Role requests (backend SCRUM-204): investor and lender accounts ask for their role, an admin
 * approves (optional reason) or rejects (required reason, shown to the applicant). A register:
 * status links and a role select kept in the address (`?status=`, Pending when absent, `ALL` for
 * every status; `?role=`), a table, server pages of 20, and the request in the record pane with
 * its decision form. Realtors are not here: they are approved from their license.
 * Realm role "admin" only.
 */
@Component({
  imports: [FormsModule, RouterLink, PageHeading, RequestStatus, Desk, RecordPane, AdminGate, ...RECORD_KIT, ...TABLE_KIT],
  template: `<gz-desk [open]="paneRequest() !== null" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading title="Role requests" subtitle="Investor and lender accounts ask for their role here. Realtors are approved from their license.">
        @if (access() === 'admin') {
          <button type="button" class="btn" [attr.aria-disabled]="s().requests.loading ? 'true' : null" (click)="refresh()">
            {{ s().requests.loading ? 'Refreshing…' : 'Refresh' }}
          </button>
        }
      </gz-heading>
      @if (access() !== 'admin') {
        <gz-admin-gate [access]="access()" what="role requests" />
      } @else {
        <div class="rr-filters">
          <gz-stage-links [stages]="statusLinks" [active]="statusKey()" param="status" label="Filter by status" />
          <label class="inline-filter rr-role">
            <span>Role</span>
            <select (change)="pickRole($any($event.target).value)">
              <option value="" [selected]="role() === null">All</option>
              @for (r of roles; track r) {
                <option [value]="r" [selected]="r === role()">{{ roleWord(r) }}</option>
              }
            </select>
          </label>
        </div>
        <gz-request-status
          [loading]="s().requests.loading && !s().requests.value"
          loadingText="Loading role requests…"
          [error]="s().requests.error"
          (retry)="refresh()"
        />
        @if (s().requests.value; as page) {
          @if (page.content.length) {
            <p class="rr-count" #listTop tabindex="-1">{{ countOf(page.totalElements, 'request') }} · {{ filterWords() }}</p>
            <table
              gz-table
              class="rr-table"
              [(sort)]="sort"
              [(selected)]="selectedId"
              (activated)="open($event)"
              (dismissed)="closePane()"
              [paneOpen]="paneRequest() !== null"
              [attr.aria-busy]="s().requests.loading ? 'true' : null"
            >
              <caption class="sr-only">Role requests. Choose a row to see the request and decide it.</caption>
              <thead>
                <tr>
                  <th gz-sort="email">Applicant</th>
                  <th gz-sort="role" data-priority="2">Role</th>
                  <th scope="col" data-priority="2">Organization</th>
                  <th scope="col" data-priority="3">Note</th>
                  <th gz-sort="requested" numeric data-priority="2">Requested</th>
                  <th gz-sort="status">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr [gz-row]="r.id">
                    <td class="rr-applicant">
                      <span class="cell-main">{{ r.applicantEmail }}</span>
                      <a class="cell-sub" [routerLink]="['/admin/users', r.userId]" [queryParams]="{ email: r.applicantEmail }">Role history</a>
                      <span class="m-only cell-sub">{{ roleWord(r.role) }} · {{ day(r.createdAt) }}</span>
                    </td>
                    <td data-priority="2">{{ roleWord(r.role) }}</td>
                    <td data-priority="2">
                      @if (r.organizationName) {
                        {{ r.organizationName }}
                      } @else if (r.role === 'lender') {
                        <span class="muted">Not given</span>
                      }
                    </td>
                    <td data-priority="3"><span class="rr-note">{{ r.note }}</span></td>
                    <td class="num nowrap" data-priority="2">{{ day(r.createdAt) }}</td>
                    <td>
                      <span [class]="statusClass(r.status)">{{ statusWord(r.status) }}</span>
                      @if (r.status !== 'PENDING' && r.decisionReason) {
                        <span class="cell-sub rr-reason">{{ r.decisionReason }}</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <gz-pager
              [page]="page.page"
              [size]="page.size"
              [total]="page.totalElements"
              [loading]="s().requests.loading"
              (changed)="toPage($event)"
            />
            @if (sort()) {
              <p class="table-note">Sorted within this page.</p>
            }
          } @else {
            <div class="rr-empty">
              <p #listTop tabindex="-1">{{ emptyText() }}</p>
              @if (filtered()) {
                <button type="button" class="btn" (click)="clearFilter()">Clear filter</button>
              }
            </div>
          }
        }
      }

      @if (paneRequest(); as r) {
        <gz-record-pane
          deskSlot
          [heading]="r.applicantEmail"
          noun="request"
          backLabel="Role requests"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() >= 0 && paneIndex() < rows().length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          <span paneMeta>{{ roleWord(r.role) }} · {{ statusWord(r.status) }}</span>
          @let formKind = r.status === 'PENDING' ? form() : null;
          @if (r.status === 'PENDING' && !formKind) {
            <div paneActions class="rr-actions">
              <button type="button" class="btn primary" (click)="openForm('approve')">Approve…</button>
              <button type="button" class="btn" (click)="openForm('reject')">Reject…</button>
            </div>
          }
          @if (!formKind && errorOf(r); as error) {
            <p class="field-error rr-pane-error" role="alert">{{ error }}</p>
          }
          @if (formKind; as kind) {
            <gz-record-section [heading]="kind === 'approve' ? 'Approve' : 'Reject'">
              <form class="rr-form" (ngSubmit)="decide(r)">
                <div class="formfield">
                  <label for="rr-reason">{{ kind === 'approve' ? 'Reason (optional)' : 'Reason' }}</label>
                  <textarea
                    id="rr-reason"
                    name="reason"
                    rows="3"
                    [attr.maxlength]="reasonMax"
                    [required]="kind === 'reject'"
                    aria-describedby="rr-reason-hint"
                    [ngModel]="reason()"
                    (ngModelChange)="reason.set($event)"
                  ></textarea>
                  <p class="smalltext muted" id="rr-reason-hint">
                    {{ kind === 'reject' ? 'Shown to the applicant. ' : '' }}Up to {{ reasonMax }} characters.
                  </p>
                </div>
                <div class="rr-form-actions">
                  <button
                    class="btn primary"
                    [attr.aria-disabled]="why(kind) || acting(r) ? 'true' : null"
                    [attr.aria-describedby]="why(kind) ? 'rr-why' : null"
                  >
                    {{ submitWord(kind, r) }}
                  </button>
                  <button type="button" class="btn" (click)="closeForm()">Cancel</button>
                  @if (why(kind); as reasonWhy) {
                    <p class="rr-why" id="rr-why">{{ reasonWhy }}</p>
                  }
                </div>
                @if (errorOf(r); as error) {
                  <p class="field-error" role="alert">{{ error }}</p>
                }
              </form>
            </gz-record-section>
          }
          <gz-record-section heading="Request">
            <gz-record-group>
              <div gz-record-row label="Applicant">{{ r.applicantEmail }}</div>
              <div gz-record-row label="User ID" [numeric]="true">{{ r.userId }}</div>
              <div gz-record-row label="Role">{{ roleWord(r.role) }}</div>
              @if (r.role === 'lender') {
                <div gz-record-row label="Organization">
                  @if (r.organizationName) {
                    {{ r.organizationName }}
                  } @else {
                    <span class="muted">Not given</span>
                  }
                </div>
              }
              <div gz-record-row label="Requested">{{ when(r.createdAt) }}</div>
              <div gz-record-row label="Status">{{ statusWord(r.status) }}</div>
              @if (r.decidedAt) {
                <div gz-record-row label="Decided">{{ when(r.decidedAt) }}</div>
              }
              @if (r.status === 'APPROVED' || r.status === 'REJECTED') {
                <div gz-record-row label="Decided by" [missing]="r.decidedByUserId === null" [showReason]="true" reason="The request names no admin.">
                  User ID {{ r.decidedByUserId }}
                </div>
              }
              @if (r.decisionReason) {
                <div gz-record-row label="Reason">{{ r.decisionReason }}</div>
              }
            </gz-record-group>
            @if (r.note) {
              <gz-record-group heading="Note from the applicant">
                <p class="rr-text">{{ r.note }}</p>
              </gz-record-group>
            }
            <p class="rr-text">
              <a [routerLink]="['/admin/users', r.userId]" [queryParams]="{ email: r.applicantEmail }">Role history</a>
              @if (r.status === 'APPROVED') {
                · To take this access away, revoke it there.
              }
            </p>
          </gz-record-section>
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    .rr-filters {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--sp-8) var(--sp-24);
    }
    .rr-filters gz-stage-links {
      flex: 1 1 auto;
    }
    .rr-role {
      padding-bottom: var(--sp-4);
    }
    .rr-count {
      margin: var(--sp-12) 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    .rr-empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-12);
      padding: var(--sp-16) 0;
    }
    .rr-empty p {
      margin: 0;
      font-size: var(--fs-body);
      max-width: var(--measure);
      outline: none;
    }
    .rr-applicant {
      min-width: 200px;
      overflow-wrap: anywhere;
    }
    .rr-note {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-width: 36ch;
    }
    .rr-reason {
      max-width: 36ch;
    }
    .rr-actions,
    .rr-form-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .rr-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .rr-pane-error {
      margin: var(--sp-8) 0;
    }
    .rr-form {
      display: grid;
      gap: var(--sp-12);
      margin-top: var(--sp-8);
    }
    .rr-text {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      max-width: var(--measure);
    }
    gz-record-section + gz-record-section {
      margin-top: var(--sp-16);
    }
    @media (max-width: 700px) {
      .rr-role {
        width: 100%;
      }
      .rr-role select {
        flex: 1;
      }
    }
  `,
})
export class RoleRequests {
  readonly w = inject(Workspace);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  readonly s = this.w.store.selectSignal(selectAdminAccess);
  readonly access = adminAccess();
  private readonly listTop = viewChild<ElementRef<HTMLElement>>('listTop');
  readonly countOf = countOf;
  readonly roles = ROLES;
  readonly reasonMax = REASON_MAX;
  /** Pending is the default (no `status` in the address); All is `ALL`. */
  readonly statusLinks: StageLink[] = [
    { key: null, label: 'Pending', count: null },
    ...STATUSES.filter((st) => st !== 'PENDING').map((st) => ({ key: st, label: STATUS_WORD[st], count: null })),
    { key: 'ALL', label: 'All', count: null },
  ];
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => ({ status: q.get('status'), role: q.get('role') }))), {
    initialValue: { status: null, role: null },
  });
  /** The status link that is current: null is Pending. */
  readonly statusKey = computed(() => {
    const v = this.query().status;
    return v === 'ALL' || (STATUSES.includes(v as RoleRequestStatus) && v !== 'PENDING') ? v : null;
  });
  /** The status the list asks for: null is every status. */
  readonly status = computed<RoleRequestStatus | null>(() => {
    const key = this.statusKey();
    return key === 'ALL' ? null : ((key as RoleRequestStatus | null) ?? 'PENDING');
  });
  readonly role = computed<RequestableRole | null>(() => {
    const v = this.query().role;
    return ROLES.includes(v as RequestableRole) ? (v as RequestableRole) : null;
  });
  readonly filtered = computed(() => this.status() !== 'PENDING' || this.role() !== null);
  readonly filterWords = computed(() => {
    const st = this.s().requestQuery.status;
    const role = this.s().requestQuery.role;
    return [st ? STATUS_WORD[st] : 'Every status', role ? ROLE_LABELS[role] : null].filter(Boolean).join(' · ');
  });
  readonly emptyText = computed(() => {
    const { status, role } = this.s().requestQuery;
    const who = role ? ROLE_LABELS[role].toLowerCase() + ' ' : '';
    if (status === 'PENDING') return role ? `No ${who}request is waiting for a decision.` : 'No request is waiting for a decision.';
    if (status === null) return `No ${who}role request has been made yet.`;
    return `No ${who}request has been ${STATUS_WORD[status].toLowerCase()}.`;
  });

  readonly sort = signal<Sort | null>(null);
  readonly rows = computed(() =>
    sortRows(this.s().requests.value?.content ?? [], this.sort(), (r, key) =>
      key === 'email' ? r.applicantEmail : key === 'role' ? r.role : key === 'requested' ? r.createdAt : key === 'status' ? STATUS_WORD[r.status] : null,
    ),
  );
  readonly selectedId = signal<unknown>(null);
  readonly pane = signal(false);
  readonly paneIndex = computed(() => this.rows().findIndex((r) => r.id === this.selectedId()));
  readonly paneRequest = computed(() => (this.pane() ? (this.rows()[this.paneIndex()] ?? null) : null));
  readonly paneLabel = computed(() => 'Role request: ' + (this.paneRequest()?.applicantEmail ?? ''));
  readonly position = computed(() => (this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.rows().length} on this page`));
  /** The decision form open in the pane, and its reason. */
  readonly form = signal<'approve' | 'reject' | null>(null);
  readonly reason = signal('');
  /** The request whose decision was sent from the form, until it is answered. */
  private readonly sent = signal<number | null>(null);
  private focusList = false;
  private firstLoad = true;

  constructor() {
    // The list whenever the filters in the address change; on opening the page, always (the queue moves).
    effect(() => {
      const status = this.status();
      const role = this.role();
      if (this.access() !== 'admin') return;
      untracked(() => {
        const s = this.s();
        const same = s.requestQuery.status === status && s.requestQuery.role === role;
        const first = this.firstLoad;
        this.firstLoad = false;
        if (!first && same && s.requests.value && !s.requests.error) return;
        this.pane.set(false);
        this.w.store.dispatch(A.loadRoleRequests({ query: { status, role, page: first && same ? s.requestQuery.page : 0 } }));
      });
    });
    // A request that left the page (decided out of this filter, or paged away) closes its pane;
    // focus goes to the top of the list rather than to the page.
    effect(() => {
      if (!this.pane() || this.paneRequest()) return;
      untracked(() => {
        this.pane.set(false);
        this.resetForm();
        afterNextRender(() => this.listTop()?.nativeElement.focus(), { injector: this.injector });
      });
    });
    // Another request in the pane: the form starts again.
    effect(() => {
      this.selectedId();
      untracked(() => this.resetForm());
    });
    // The decision was answered: done closes the form; a failure keeps it, with the error under it.
    // A form opened meanwhile on another request is that request's and stays.
    effect(() => {
      const id = this.sent();
      const s = this.s();
      if (id === null || s.requestActing[id]) return;
      untracked(() => {
        this.sent.set(null);
        if (!s.requestErrors[id] && this.selectedId() === id) this.resetForm();
      });
    });
    // After paging, the list starts from its count, which takes focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.s().requests.loading || !this.focusList) return;
      this.focusList = false;
      untracked(() => {
        const el = this.listTop()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
  }

  roleWord(role: RequestableRole) {
    return ROLE_LABELS[role] ?? role;
  }
  statusWord(status: RoleRequestStatus) {
    return STATUS_WORD[status] ?? status;
  }
  statusClass(status: RoleRequestStatus) {
    return status === 'APPROVED' ? 'positive' : status === 'REJECTED' || status === 'REVOKED' ? 'negative' : status === 'CANCELLED' ? 'muted' : '';
  }
  day(v: string) {
    return formatLocalDate(v);
  }
  when(v: string) {
    return formatLocalDateTime(v);
  }
  acting(r: RoleRequestReviewDTO) {
    return this.s().requestActing[r.id] ?? null;
  }
  errorOf(r: RoleRequestReviewDTO) {
    return this.s().requestErrors[r.id] ?? null;
  }
  /** Why the form's button can't send yet; null when it can. */
  why(kind: 'approve' | 'reject') {
    const text = this.reason().trim();
    if (kind === 'reject' && !text) return 'Write the reason first: the applicant sees it.';
    if (text.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters.`;
    return null;
  }
  submitWord(kind: 'approve' | 'reject', r: RoleRequestReviewDTO) {
    const acting = this.acting(r);
    if (acting) return acting === 'approve' ? 'Approving…' : 'Rejecting…';
    return kind === 'approve' ? `Approve ${this.roleWord(r.role).toLowerCase()} access` : 'Reject request';
  }

  pickRole(role: string) {
    void this.router.navigate([], { queryParams: { role: role || null }, queryParamsHandling: 'merge' });
  }
  clearFilter() {
    void this.router.navigate([], { queryParams: { status: null, role: null }, queryParamsHandling: 'merge' });
  }
  refresh() {
    if (!this.s().requests.loading) this.w.store.dispatch(A.loadRoleRequests({ query: this.s().requestQuery }));
  }
  toPage(page: number) {
    this.focusList = true;
    this.pane.set(false);
    this.w.store.dispatch(A.loadRoleRequests({ query: { ...this.s().requestQuery, page } }));
  }
  open(id: unknown) {
    this.selectedId.set(id);
    this.pane.set(true);
  }
  closePane() {
    if (!this.pane()) return;
    this.pane.set(false);
    this.resetForm();
    afterNextRender(() => document.querySelector<HTMLElement>('.rr-table tr.gz-row.sel')?.focus(), { injector: this.injector });
  }
  step(by: number) {
    const next = this.rows()[this.paneIndex() + by];
    if (next) this.open(next.id);
  }
  openForm(kind: 'approve' | 'reject') {
    this.form.set(kind);
    this.reason.set('');
    afterNextRender(() => document.querySelector<HTMLElement>('#rr-reason')?.focus(), { injector: this.injector });
  }
  closeForm() {
    this.resetForm();
    afterNextRender(() => document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus(), { injector: this.injector });
  }
  private resetForm() {
    this.form.set(null);
    this.reason.set('');
  }
  decide(r: RoleRequestReviewDTO) {
    const kind = this.form();
    if (!kind || r.status !== 'PENDING' || this.why(kind) || this.acting(r)) return;
    const reason = this.reason().trim();
    this.sent.set(r.id);
    this.w.store.dispatch(
      kind === 'approve' ? A.approveRoleRequest({ id: r.id, reason: reason || null }) : A.rejectRoleRequest({ id: r.id, reason }),
    );
  }
}
