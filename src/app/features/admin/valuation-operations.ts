import {
  Component,
  DestroyRef,
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
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { PropertyRef } from '../../shared/components/property-ref';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT, StageLink } from '../../shared/table';
import { countOf, formatLocalDateTime, formatLocalTime } from '../../shared/data/format';
import { labelFor } from '../../shared/pipes/label.pipe';
import { Kpi } from '../dashboard/dash-ui';
import { AdminActions as A } from '../../store/admin/admin.actions';
import { selectAdmin } from '../../store/admin/admin.selectors';
import { OpportunitiesActions as O } from '../../store/opportunities/opportunities.actions';
import { selectOpportunities } from '../../store/opportunities/opportunities.selectors';
import {
  VALUATION_REFRESH_STATUSES,
  ValuationRefreshRequestDTO,
  ValuationRefreshStatus,
  canCancelRefresh,
  canRetryRefresh,
} from '../../core/models/admin';
import { OpportunityRefreshMode } from '../../core/models/opportunity';
import { AdminGate, adminAccess } from './admin-gate';

const STATUS: Record<string, string> = {
  PENDING: 'Pending',
  LEASED: 'In progress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};
const TRIGGER: Record<string, string> = {
  SALE_CHANGE: 'Sale change',
  PROPERTY_CHANGE: 'Property change',
  MODEL_PUBLICATION: 'Model publication',
};

/**
 * Valuation operations (DESIGN.md §5 Register, Valuation operations): the opportunity scores (two
 * runs and the last run's result in this session), then the revaluation requests raised by sale and
 * property changes as a register: status links kept in the address (`?status=`), a table, server
 * pages of 20, and the request in the record pane with Retry or Cancel and its error code under
 * Details. Realm role "admin" only.
 */
@Component({
  imports: [DecimalPipe, PageHeading, RequestStatus, PropertyRef, Desk, RecordPane, AdminGate, Kpi, ...RECORD_KIT, ...TABLE_KIT],
  template: `<gz-desk [open]="pane() !== null" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading title="Valuation operations" subtitle="Revaluation requests raised by sale and property changes, and the opportunity scores.">
        @if (access() === 'admin') {
          <button type="button" class="btn" [attr.aria-disabled]="s().refreshes.loading ? 'true' : null" (click)="refresh()">
            {{ s().refreshes.loading ? 'Refreshing…' : 'Refresh' }}
          </button>
        }
      </gz-heading>
      @if (access() !== 'admin') {
        <gz-admin-gate [access]="access()" what="valuation operations" />
      } @else {
        <section class="vo-scores" aria-labelledby="vo-scores-title">
          <h2 id="vo-scores-title">Opportunity scores</h2>
          <p class="vo-text">Stored per valuation run and read by the Opportunities page. A run finishes before it answers; a full rescore can take several minutes.</p>
          <div class="vo-buttons">
            <button type="button" class="btn primary" [attr.aria-disabled]="scores().loading ? 'true' : null" (click)="rescore('INCREMENTAL')">
              {{ scores().loading && mode() === 'INCREMENTAL' ? 'Updating…' : 'Update missing and stale scores' }}
            </button>
            <button type="button" class="btn" [attr.aria-disabled]="scores().loading ? 'true' : null" (click)="rescore('FULL')">
              {{ scores().loading && mode() === 'FULL' ? 'Rescoring…' : 'Rescore every property…' }}
            </button>
            @if (scores().loading) {
              <p class="vo-why" role="status">A scoring run is under way. It answers when it has finished.</p>
            }
          </div>
          @if (!scores().loading && scores().error; as error) {
            <p class="field-error vo-error" role="alert">The scores could not be updated: {{ error }}</p>
          }
          @if (scores().value; as r) {
            <h3 class="vo-run" #runTitle tabindex="-1">Last run: {{ r.mode === 'FULL' ? 'every property' : 'missing and stale scores' }}{{ time(r.finishedAt) ? ', finished at ' + time(r.finishedAt) : '' }}</h3>
            <dl class="kpi-row">
              <div gz-kpi label="Scored" [value]="(r.processed | number) ?? null" [caption]="(r.scored | number) + ' with a score · ' + (r.unavailable | number) + ' without enough evidence'"></div>
              <div gz-kpi label="Removed" [value]="(r.removed | number) ?? null" caption="Scores taken away"></div>
              <div gz-kpi label="Took" [value]="seconds(r.durationMillis)" [caption]="'Score version ' + r.scoreVersion"></div>
            </dl>
          }
        </section>

        <section class="vo-requests" aria-labelledby="vo-requests-title">
          <h2 id="vo-requests-title">Revaluation requests</h2>
          <p class="vo-text">Raised when a sale or a property record changes, or a valuation model is published.</p>
          <gz-stage-links [stages]="statusLinks" [active]="status()" param="status" label="Filter by status" />
          <gz-request-status
            [loading]="s().refreshes.loading && !s().refreshes.value"
            loadingText="Loading requests…"
            [error]="s().refreshes.error"
            (retry)="load(s().refreshPage)"
          />
          @if (s().refreshes.value; as page) {
            @if (page.content.length) {
              <p class="vo-count" #count tabindex="-1">{{ countOf(page.totalElements, 'request') }}{{ status() ? ' · ' + statusWord(status()!) : '' }}</p>
              <table
                gz-table
                class="vo-table"
                [(selected)]="selectedId"
                (activated)="openRequest($event)"
                (dismissed)="closePane()"
                [paneOpen]="pane() !== null"
                [attr.aria-busy]="s().refreshes.loading ? 'true' : null"
              >
                <caption class="sr-only">Revaluation requests, newest first. Choose a row to see the request and retry or cancel it.</caption>
                <thead>
                  <tr>
                    <th scope="col">Change</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="num" data-priority="2">Attempts</th>
                    <th scope="col" class="num" data-priority="3">Next attempt</th>
                    <th scope="col" class="num" data-priority="2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of page.content; track r.requestId) {
                    <tr [gz-row]="r.requestId">
                      <td class="vo-change">
                        <span class="cell-main">{{ trigger(r.triggerType) }}</span>
                        <span class="cell-sub">
                          @if (r.propertyId) {
                            <gz-property-ref [propertyId]="r.propertyId" [link]="false" />
                          } @else if (r.scopeType === 'FULL_MARKET') {
                            Whole market
                          }
                          @if (r.saleId) {
                            · sale ID {{ r.saleId }}
                          }
                        </span>
                      </td>
                      <td [class.attention]="r.status === 'FAILED'">
                        {{ statusWord(r.status) }}
                        @if (r.lastErrorCode && r.status !== 'FAILED') {
                          <span class="cell-sub">Last attempt failed</span>
                        } @else if (r.outcome && r.outcome !== r.status) {
                          <span class="cell-sub">{{ label(r.outcome) }}</span>
                        }
                        <span class="m-only cell-sub">{{ r.attempts }} of {{ r.maxAttempts }} attempts · {{ when(r.updatedAt) }}</span>
                      </td>
                      <td class="num" data-priority="2">{{ r.attempts }} of {{ r.maxAttempts }}</td>
                      <td class="num nowrap" data-priority="3">{{ r.status === 'PENDING' && r.nextAttemptAt ? when(r.nextAttemptAt) : '' }}</td>
                      <td class="num nowrap" data-priority="2">{{ when(r.updatedAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <gz-pager
                [page]="page.page"
                [size]="page.size"
                [total]="page.totalElements"
                [loading]="s().refreshes.loading"
                (changed)="toPage($event)"
              />
              <p class="table-note">Newest first. Times are your own clock. A failed model publication is retried by the valuation worker, not from here.</p>
            } @else {
              <p class="vo-text">{{ status() ? 'No request has the status ' + statusWord(status()!) + '.' : 'No revaluation request has been raised yet.' }}</p>
            }
          }
        </section>
      }

      @if (paneRequest(); as r) {
        <gz-record-pane
          deskSlot
          [heading]="trigger(r.triggerType)"
          noun="request"
          backLabel="Valuation operations"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() >= 0 && paneIndex() < rows().length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          <span paneMeta>{{ statusWord(r.status) }}</span>
          @if (canRetry(r) || canCancel(r) || r.status === 'FAILED') {
            <div paneActions class="vo-pane-actions">
              @if (r.status === 'FAILED') {
                <button type="button" class="btn primary"
                  [attr.aria-disabled]="!canRetry(r) || busy() ? 'true' : null"
                  [attr.aria-describedby]="!canRetry(r) || waitingOn(r) ? 'vo-retry-why' : null"
                  (click)="retry(r)">
                  {{ s().acting[r.requestId] === 'retry' ? 'Retrying…' : 'Retry' }}
                </button>
              }
              @if (canCancel(r)) {
                <button type="button" class="btn" [attr.aria-disabled]="busy() ? 'true' : null"
                  [attr.aria-describedby]="waitingOn(r) ? 'vo-retry-why' : null" (click)="cancel(r)">
                  {{ s().acting[r.requestId] === 'cancel' ? 'Cancelling…' : 'Cancel' }}
                </button>
              }
              @if (waitingOn(r)) {
                <p class="vo-why" id="vo-retry-why">Another request’s retry or cancel is still being sent.</p>
              } @else if (r.status === 'FAILED' && !canRetry(r)) {
                <p class="vo-why" id="vo-retry-why">A model publication is retried by the valuation worker.</p>
              }
            </div>
          }
          @if (actionError(); as error) {
            <p class="field-error vo-pane-error" role="alert">{{ error }}</p>
          }
          @if (r.lastErrorCode) {
            <gz-record-section heading="What went wrong">
              <p class="vo-pane-text attention">{{ r.status === 'FAILED' ? 'Every attempt failed.' : 'The last attempt failed; another is scheduled.' }}</p>
              <details class="vo-details">
                <summary>Details</summary>
                <gz-record-group>
                  <div gz-record-row label="Code">{{ r.lastErrorCode }}</div>
                </gz-record-group>
              </details>
            </gz-record-section>
          }
          <gz-record-section heading="Request">
            <gz-record-group>
              <div gz-record-row label="Status">{{ statusWord(r.status) }}</div>
              @if (r.outcome && r.outcome !== r.status) {
                <div gz-record-row label="Outcome">{{ label(r.outcome) }}</div>
              }
              <div gz-record-row label="Change">{{ trigger(r.triggerType) }}</div>
              @if (r.propertyId) {
                <div gz-record-row label="Property"><gz-property-ref [propertyId]="r.propertyId" /></div>
              } @else {
                <div gz-record-row label="Scope">{{ r.scopeType === 'FULL_MARKET' ? 'Whole market' : label(r.scopeType) }}</div>
              }
              @if (r.saleId) {
                <div gz-record-row label="Sale ID">{{ r.saleId }}</div>
              }
              @if (r.sourceVersion) {
                <div gz-record-row label="Source version">{{ r.sourceVersion }}</div>
              }
              @if (r.sourceChangedAt) {
                <div gz-record-row label="Changed at the source">{{ when(r.sourceChangedAt) }}</div>
              }
            </gz-record-group>
          </gz-record-section>
          <gz-record-section heading="Attempts">
            <gz-record-group>
              <div gz-record-row label="Attempts" [numeric]="true">{{ r.attempts }} of {{ r.maxAttempts }}</div>
              @if (r.nextAttemptAt && r.status === 'PENDING') {
                <div gz-record-row label="Next attempt">{{ when(r.nextAttemptAt) }}</div>
              }
              @if (r.leaseExpiresAt && r.status === 'LEASED') {
                <div gz-record-row label="A worker holds it until">{{ when(r.leaseExpiresAt) }}</div>
              }
              <div gz-record-row label="Raised">{{ when(r.createdAt) }}</div>
              @if (r.startedAt) {
                <div gz-record-row label="Started">{{ when(r.startedAt) }}</div>
              }
              @if (r.completedAt) {
                <div gz-record-row label="Finished">{{ when(r.completedAt) }}</div>
              }
              <div gz-record-row label="Updated">{{ when(r.updatedAt) }}</div>
              @if (r.runId) {
                <div gz-record-row label="Valuation run">{{ r.runId }}</div>
              }
            </gz-record-group>
          </gz-record-section>
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    .vo-scores,
    .vo-requests {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    .vo-requests {
      margin-top: var(--sp-24);
      padding-bottom: var(--sp-16);
    }
    h2 {
      margin: 0;
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .vo-text {
      margin: var(--sp-4) 0 var(--sp-12);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .vo-buttons,
    .vo-pane-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .vo-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .vo-error {
      margin: var(--sp-8) 0 0;
    }
    .vo-pane-error {
      margin: var(--sp-8) 0;
    }
    .vo-run {
      margin: var(--sp-16) 0 var(--sp-8);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      font-weight: 600;
      outline: none;
    }
    .vo-count {
      margin: var(--sp-12) 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    .vo-change {
      min-width: 200px;
    }
    .vo-pane-text {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .vo-details {
      margin-top: var(--sp-8);
      font-size: var(--fs-cell);
    }
    .vo-details summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
    gz-record-section + gz-record-section {
      margin-top: var(--sp-16);
    }
    @media (max-width: 700px) {
      .vo-scores,
      .vo-requests {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
      .vo-buttons .btn {
        flex: 1 1 100%;
      }
    }
  `,
})
export class ValuationOperations {
  readonly w = inject(Workspace);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly s = this.w.store.selectSignal(selectAdmin);
  readonly access = adminAccess();
  private readonly opportunities = this.w.store.selectSignal(selectOpportunities);
  readonly scores = computed(() => this.opportunities().refresh);
  private readonly countEl = viewChild<ElementRef<HTMLElement>>('count');
  private readonly runTitle = viewChild<ElementRef<HTMLElement>>('runTitle');
  readonly canCancel = canCancelRefresh;
  readonly canRetry = canRetryRefresh;
  readonly countOf = countOf;
  readonly statusLinks: StageLink[] = [
    { key: null, label: 'All', count: null },
    ...VALUATION_REFRESH_STATUSES.map((st) => ({ key: st, label: STATUS[st], count: null })),
  ];
  /** The status in the address (`?status=`): the list follows it, Back included. */
  readonly status = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((q) => {
        const v = q.get('status');
        return VALUATION_REFRESH_STATUSES.includes(v as ValuationRefreshStatus) ? (v as ValuationRefreshStatus) : null;
      }),
    ),
    { initialValue: null },
  );

  readonly rows = computed(() => this.s().refreshes.value?.content ?? []);
  readonly selectedId = signal<unknown>(null);
  readonly pane = signal<'request' | null>(null);
  readonly paneIndex = computed(() => this.rows().findIndex((r) => r.requestId === this.selectedId()));
  readonly paneRequest = computed(() => (this.pane() ? (this.rows()[this.paneIndex()] ?? null) : null));
  readonly paneLabel = computed(() => 'Revaluation request: ' + (this.paneRequest() ? this.trigger(this.paneRequest()!.triggerType) : ''));
  readonly position = computed(() =>
    this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.rows().length} on this page`,
  );
  /** The scoring run asked for here (the slice keeps no mode while it runs). */
  readonly mode = signal<OpportunityRefreshMode | null>(null);
  /** The retry or cancel sent from the pane, and the request it was for. */
  private readonly lastAction = signal<string | null>(null);
  readonly actionError = computed(() => {
    const id = this.lastAction();
    return id !== null && id === this.selectedId() && !this.s().acting[id] ? this.s().actionError : null;
  });
  private focusCount = false;
  private focusRun = false;
  /** The last action was a retry: its answer is a new request, which the pane moves to. */
  private retried = false;

  constructor() {
    // The requests whenever the status in the address changes (the pane closes, focus stays put).
    effect(() => {
      const status = this.status();
      if (this.access() !== 'admin') return;
      untracked(() => {
        const s = this.s();
        if (s.refreshes.value && s.refreshStatus === status && !s.refreshes.error) return;
        this.pane.set(null);
        this.w.store.dispatch(A.loadRefreshRequests({ status, page: 0 }));
      });
    });
    // A request that left the page (paging, or another status) closes its pane, with focus kept.
    effect(() => {
      if (this.pane() && !this.paneRequest()) untracked(() => this.closePane(true));
    });
    // Another request in the pane: an earlier action's error was the other's.
    effect(() => {
      const id = this.selectedId();
      untracked(() => {
        if (this.lastAction() !== null && this.lastAction() !== id) this.lastAction.set(null);
      });
    });
    // A retry answers with a new request, listed first when it belongs under the filter shown: the
    // pane moves to it. Only to a request that wasn't listed before the click (under "Failed" the
    // first row is another failed request, and the pane stays where it is).
    effect(() => {
      const id = this.lastAction();
      const s = this.s();
      if (id === null || s.acting[id] || s.actionError) return;
      untracked(() => {
        const first = this.rows()[0];
        const isNew = !!first && !this.listedBeforeRetry.has(first.requestId);
        if (this.retried && first && first.requestId !== id && !isNew) this.retried = false;
        if (this.retried && first && first.requestId !== id && isNew) {
          this.retried = false;
          this.selectedId.set(first.requestId);
          afterNextRender(() => document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus(), { injector: this.injector });
        }
      });
    });
    // After paging, the list starts from its count, which takes focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.s().refreshes.loading || !this.focusCount) return;
      this.focusCount = false;
      untracked(() => {
        const el = this.countEl()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
    // A scoring run that finished: its result takes focus.
    effect(() => {
      const sc = this.scores();
      if (sc.loading || !this.focusRun) return;
      this.focusRun = false;
      untracked(() => afterNextRender(() => this.runTitle()?.nativeElement.focus(), { injector: this.injector }));
    });
  }

  statusWord(status: string) {
    return STATUS[status] ?? labelFor(status);
  }
  trigger(type: string) {
    return TRIGGER[type] ?? labelFor(type);
  }
  label(code: string) {
    return labelFor(code);
  }
  when(v: string) {
    return formatLocalDateTime(v);
  }
  time(v: string) {
    return formatLocalTime(v);
  }
  seconds(ms: number) {
    return ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${(ms / 1000).toFixed(1)} s`;
  }
  /** A retry or cancel is on its way: one at a time, so its answer (or error) lands on its own request. */
  readonly busy = computed(() => Object.keys(this.s().acting).length > 0);
  /** Busy with another request than this one. */
  waitingOn(r: ValuationRefreshRequestDTO) {
    return this.busy() && !this.s().acting[r.requestId];
  }

  load(page: number) {
    this.w.store.dispatch(A.loadRefreshRequests({ status: this.status(), page }));
  }
  refresh() {
    if (!this.s().refreshes.loading) this.load(this.s().refreshPage);
  }
  toPage(page: number) {
    this.focusCount = true;
    this.pane.set(null);
    this.load(page);
  }
  openRequest(id: unknown) {
    this.selectedId.set(id);
    this.pane.set('request');
  }
  closePane(keepFocus = false) {
    if (!this.pane()) return;
    this.pane.set(null);
    if (keepFocus) return;
    afterNextRender(() => document.querySelector<HTMLElement>('.vo-table tr.gz-row.sel')?.focus(), { injector: this.injector });
  }
  step(by: number) {
    const next = this.rows()[this.paneIndex() + by];
    if (next) this.openRequest(next.requestId);
  }
  /**
   * One key per failed request, kept for the visit: a second click (or a resent request) gets the
   * retry already queued back from the server instead of queueing another one.
   */
  private readonly retryKeys = new Map<string, string>();
  /** The requests listed when Retry was pressed: the one the retry answers with is the new one. */
  private listedBeforeRetry = new Set<string>();
  retry(r: ValuationRefreshRequestDTO) {
    if (!this.canRetry(r) || this.busy() || !this.w.requireAccount('retry revaluations')) return;
    this.listedBeforeRetry = new Set(this.rows().map((x) => x.requestId));
    this.lastAction.set(r.requestId);
    this.retried = true;
    document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus();
    const key = this.retryKeys.get(r.requestId) ?? crypto.randomUUID();
    this.retryKeys.set(r.requestId, key);
    this.w.store.dispatch(A.retryRefresh({ id: r.requestId, idempotencyKey: key }));
  }
  async cancel(r: ValuationRefreshRequestDTO) {
    if (this.busy()) return;
    if (
      (await this.confirmation.confirm({
        title: 'Cancel this revaluation?',
        message: 'The property keeps its current valuation until another change is recorded.',
      })) &&
      !this.destroy.destroyed &&
      !this.busy()
    ) {
      this.lastAction.set(r.requestId);
      this.retried = false;
      // The buttons go once it is cancelled: focus waits on the pane's title.
      document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus();
      this.w.store.dispatch(A.cancelRefresh({ id: r.requestId }));
    }
  }
  async rescore(mode: OpportunityRefreshMode) {
    if (this.scores().loading || !this.w.requireAccount('update opportunity scores')) return;
    if (
      mode === 'FULL' &&
      !(await this.confirmation.confirm({
        title: 'Rescore every property?',
        message: 'Every property with a valuation is scored again. The run answers when it has finished, which can take several minutes.',
      }))
    )
      return;
    if (this.destroy.destroyed || this.scores().loading) return;
    this.mode.set(mode);
    this.focusRun = true;
    this.w.store.dispatch(O.refreshScores({ mode }));
  }
}
