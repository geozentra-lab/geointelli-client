import { Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { LabelPipe } from '../../shared/pipes/label.pipe';
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

/**
 * Valuation operations: the queue of revaluation requests raised by sale and property changes
 * (cancel, retry), and a recalculation of the stored opportunity scores. Realm role "admin" only.
 */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeading,
    RequestStatus,
    Pagination,
    LabelPipe,
  ],
  template: `<gz-heading
      eyebrow="ADMIN"
      title="Valuation operations"
      subtitle="Follow revaluation requests and keep opportunity scores current."
    >
      @if (allowed()) {
        <button
          type="button"
          class="btn"
          [disabled]="s().refreshes.loading"
          (click)="load(s().refreshPage)"
        >
          {{ s().refreshes.loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      }
    </gz-heading>
    @if (!w.auth.isLoggedIn()) {
      <div class="panel section guest-notice">
        <h3>Sign in as an administrator.</h3>
        <p class="sub spacer">Valuation operations are only visible to administrators.</p>
        <button type="button" class="btn primary spacer" (click)="w.signIn()">Sign in</button>
      </div>
    } @else if (!allowed()) {
      <div class="empty">
        Your account does not have the admin role, so valuation operations are not available.
        <a class="btn spacer" routerLink="/dashboard">Back to overview</a>
      </div>
    } @else {
      <section class="panel section" aria-labelledby="scores-title">
        <div class="panelhead">
          <div>
            <h3 id="scores-title">Opportunity scores</h3>
            <p class="smalltext muted">
              Scores are stored per valuation run and read by the Opportunities page.
            </p>
          </div>
        </div>
        <div class="actions">
          <button
            type="button"
            class="btn primary"
            [disabled]="scores().loading"
            (click)="rescore('INCREMENTAL')"
          >
            {{ scores().loading ? 'Recalculating…' : 'Update missing and stale scores' }}
          </button>
          <button type="button" class="btn" [disabled]="scores().loading" (click)="rescore('FULL')">
            Rescore every property
          </button>
        </div>
        <gz-request-status [error]="scores().error" [showRetry]="false" />
        @if (scores().value; as r) {
          <p class="insight section" role="status">
            {{ r.mode | label }} run of {{ r.scoreVersion }}: {{ r.processed | number }} scored ({{
              r.scored | number
            }}
            with a score, {{ r.unavailable | number }} without enough evidence),
            {{ r.removed | number }} removed, in {{ r.durationMillis / 1000 | number: '1.0-1' }} s.
          </p>
        }
        <p class="sourcedata">
          The run is synchronous; a full rescore can take a while on a large county.
        </p>
      </section>

      <section class="panel section" aria-labelledby="refresh-title">
        <div class="panelhead">
          <div>
            <h3 id="refresh-title">Revaluation requests</h3>
            <p class="smalltext muted">Raised when a sale or a property record changes</p>
          </div>
          <div class="inline-filter">
            <label for="refresh-status">Status</label>
            <select
              id="refresh-status"
              class="field"
              [ngModel]="s().refreshStatus"
              (ngModelChange)="filter($event)"
            >
              <option [ngValue]="null">All</option>
              @for (st of statuses; track st) {
                <option [ngValue]="st">{{ st | label }}</option>
              }
            </select>
          </div>
        </div>
        <gz-request-status
          [loading]="s().refreshes.loading && !s().refreshes.value"
          loadingText="Loading requests…"
          [error]="s().refreshes.error"
          (retry)="load(s().refreshPage)"
        />
        @if (s().actionError; as error) {
          <p class="insight danger" role="alert">{{ error }}</p>
        }
        @if (s().refreshes.value; as page) {
          @if (page.content.length) {
            <div class="tablewrap" #list tabindex="-1" aria-label="Revaluation requests">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Change</th>
                    <th scope="col">Status</th>
                    <th scope="col">Attempts</th>
                    <th scope="col">Updated</th>
                    <th scope="col"><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of page.content; track r.requestId) {
                    <tr>
                      <td>
                        <b>{{ r.triggerType | label }}</b>
                        <div class="smalltext muted">
                          {{ r.scopeType === 'FULL_MARKET' ? 'Whole market' : '' }}
                          @if (r.propertyId) {
                            <a [routerLink]="['/property', r.propertyId]"
                              >Property #{{ r.propertyId }}</a
                            >
                          }
                          @if (r.saleId) {
                            · sale #{{ r.saleId }}
                          }
                        </div>
                      </td>
                      <td>
                        <span [class]="'tag ' + tone(r.status)">{{ r.status | label }}</span>
                        @if (r.lastErrorCode) {
                          <div class="smalltext muted">{{ r.lastErrorCode }}</div>
                        } @else if (r.outcome) {
                          <div class="smalltext muted">{{ r.outcome | label }}</div>
                        }
                      </td>
                      <td>
                        {{ r.attempts }} of {{ r.maxAttempts }}
                        @if (r.nextAttemptAt && r.status === 'PENDING') {
                          <div class="smalltext muted">
                            Next {{ r.nextAttemptAt | date: 'MMM d, h:mm a' }}
                          </div>
                        }
                      </td>
                      <td class="smalltext">{{ r.updatedAt | date: 'MMM d, h:mm a' }}</td>
                      <td class="actions-cell">
                        @if (canRetry(r)) {
                          <button
                            type="button"
                            class="btn small"
                            [disabled]="!!s().acting[r.requestId]"
                            (click)="retry(r)"
                          >
                            {{ s().acting[r.requestId] === 'retry' ? 'Retrying…' : 'Retry' }}
                          </button>
                        }
                        @if (canCancel(r)) {
                          <button
                            type="button"
                            class="btn small"
                            [disabled]="!!s().acting[r.requestId]"
                            (click)="cancel(r)"
                          >
                            {{ s().acting[r.requestId] === 'cancel' ? 'Cancelling…' : 'Cancel' }}
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <gz-pagination
              [page]="page.page"
              [pages]="page.totalPages"
              [total]="page.totalElements"
              [loading]="s().refreshes.loading"
              (changed)="load($event)"
            />
          } @else {
            <p class="sub">
              {{
                s().refreshStatus
                  ? 'No request has this status.'
                  : 'No revaluation request has been raised yet.'
              }}
            </p>
          }
        }
      </section>
    }`,
  styles: `
    .actions-cell {
      text-align: right;
      white-space: nowrap;
    }
    .actions-cell .btn + .btn {
      margin-left: 6px;
    }
  `,
})
export class ValuationOperations implements OnInit {
  w = inject(Workspace);
  private confirmation = inject(ConfirmationService);
  s = this.w.store.selectSignal(selectAdmin);
  private opportunities = this.w.store.selectSignal(selectOpportunities);
  scores = computed(() => this.opportunities().refresh);
  readonly statuses = VALUATION_REFRESH_STATUSES;
  allowed = computed(() => this.w.auth.isLoggedIn() && this.w.auth.hasRealmRole('admin'));
  canCancel = canCancelRefresh;
  canRetry = canRetryRefresh;
  ngOnInit() {
    if (this.allowed() && !this.s().refreshes.value) this.load(0);
  }
  load(page: number) {
    this.w.store.dispatch(A.loadRefreshRequests({ status: this.s().refreshStatus, page }));
  }
  filter(status: ValuationRefreshStatus | null) {
    this.w.store.dispatch(A.loadRefreshRequests({ status, page: 0 }));
  }
  /** One key per click: if the request is resent, the server still queues a single retry. */
  retry(r: ValuationRefreshRequestDTO) {
    this.w.store.dispatch(A.retryRefresh({ id: r.requestId, idempotencyKey: crypto.randomUUID() }));
  }
  async cancel(r: ValuationRefreshRequestDTO) {
    if (
      await this.confirmation.confirm({
        title: 'Cancel this revaluation?',
        message: 'The property keeps its current valuation until another change is recorded.',
      })
    )
      this.w.store.dispatch(A.cancelRefresh({ id: r.requestId }));
  }
  async rescore(mode: OpportunityRefreshMode) {
    if (
      mode === 'FULL' &&
      !(await this.confirmation.confirm({
        title: 'Rescore every property?',
        message:
          'Every property with a valuation is scored again. This runs until it finishes and can take several minutes.',
      }))
    )
      return;
    this.w.store.dispatch(O.refreshScores({ mode }));
  }
  tone(status: string) {
    return status === 'COMPLETED'
      ? 'green'
      : status === 'FAILED'
        ? 'red'
        : status === 'PENDING' || status === 'LEASED'
          ? 'amber'
          : '';
  }
}
