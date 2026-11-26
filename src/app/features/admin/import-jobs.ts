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
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { TABLE_KIT } from '../../shared/table';
import { countOf, formatLocalDateTime } from '../../shared/data/format';
import { labelFor } from '../../shared/pipes/label.pipe';
import { ImportJobDTO } from '../../core/models/import-job';
import { ImportJobsActions as A } from '../../store/import-jobs/import-jobs.actions';
import { selectImportJobs } from '../../store/import-jobs/import-jobs.selectors';
import { AdminGate, adminAccess } from './admin-gate';
import { ImportJobRecord } from './import-job-record';
import { ImportForm } from './import-form';
import {
  BACKFILL,
  jobActive,
  jobAttention,
  jobKind,
  jobName,
  jobPlace,
  jobRef,
  jobRetryable,
  jobStatus,
  retryBlocked,
} from './import-words';

const POLL_MS = 5000;
type Pane = 'job' | 'upload' | null;

/**
 * Import jobs (DESIGN.md §5 Register; the admin landing page): the tracked jobs as a table, newest
 * first, server pages of 20, refreshed every 5 seconds while one is queued or running. A row opens
 * the job in the record pane (progress, a failure in words, the records that failed or were
 * skipped, Retry with its reason); "Import county data" opens the upload form in the same pane.
 * Realm role "admin" only.
 */
@Component({
  imports: [DecimalPipe, PageHeading, RequestStatus, Desk, RecordPane, AdminGate, ImportJobRecord, ImportForm, ...TABLE_KIT],
  template: `<gz-desk [open]="pane() !== null" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading title="Import jobs" subtitle="County data loads and image backfills, newest first.">
        @if (access() === 'admin') {
          <button type="button" class="btn" [attr.aria-disabled]="s().loading ? 'true' : null" (click)="refresh()">
            {{ s().loading ? 'Refreshing…' : 'Refresh' }}
          </button>
          <button type="button" class="btn primary" #newButton (click)="openUpload()">Import county data</button>
        }
      </gz-heading>
      @if (access() !== 'admin') {
        <gz-admin-gate [access]="access()" what="the import jobs" />
      } @else {
        <gz-request-status
          [loading]="s().loading && !s().page"
          loadingText="Loading import jobs…"
          [error]="s().error"
          (retry)="load(s().pageIndex)"
        />
        @if (s().page; as p) {
          @if (p.jobs.content.length) {
            <p class="ij-count" #count tabindex="-1" role="status">{{ countText() }}</p>
            <table
              gz-table
              class="ij-table"
              [(selected)]="selectedId"
              (activated)="openJob($event)"
              (dismissed)="closePane()"
              [paneOpen]="pane() !== null"
              [attr.aria-busy]="s().loading ? 'true' : null"
            >
              <caption class="sr-only">Import jobs, newest first. Choose a row to see its progress and records.</caption>
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="num" data-priority="2">Processed</th>
                  <th scope="col" class="num" data-priority="3">Written</th>
                  <th scope="col" class="num" data-priority="3">Skipped</th>
                  <th scope="col" class="num" data-priority="2">Failed</th>
                  <th scope="col" class="num" data-priority="2">Queued</th>
                </tr>
              </thead>
              <tbody>
                @for (j of p.jobs.content; track j.id) {
                  <tr [gz-row]="j.id">
                    <td class="ij-job">
                      <span class="cell-main">{{ name(j) }}</span>
                      <span class="cell-sub">{{ sub(j) }}</span>
                      <span class="m-only cell-sub">{{ j.processed | number }} of {{ j.total | number }} processed · {{ j.failed | number }} failed</span>
                    </td>
                    <td [class.attention]="attention(j.status)">
                      {{ status(j.status) }}
                      @if (j.currentStep && active(j)) {
                        <span class="cell-sub">{{ j.currentStep }}</span>
                      }
                    </td>
                    <td class="num" data-priority="2">
                      <span class="ij-bar" aria-hidden="true"><i [style.width.%]="share(j)"></i></span>
                      {{ j.processed | number }} <span class="ij-of">of {{ j.total | number }}</span>
                    </td>
                    <td class="num" data-priority="3">
                      {{ j.completed | number }}
                      @if (j.jobType === backfill) {
                        <span class="cell-sub">images</span>
                      }
                    </td>
                    <td class="num" data-priority="3">{{ j.skipped | number }}</td>
                    <td class="num" data-priority="2">{{ j.failed | number }}</td>
                    <td class="num nowrap" data-priority="2">{{ when(j.createdAt) }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <gz-pager
              [page]="p.jobs.page"
              [size]="p.jobs.size"
              [total]="p.jobs.totalElements"
              [loading]="s().loading"
              (changed)="page($event)"
            />
            <p class="table-note">
              Times are your own clock. Written: records loaded, or images saved by an image backfill.
              @if (p.untrackedJobTypes.length) {
                Not tracked here: {{ untracked() }}.{{ p.note ? ' ' + p.note : '' }}
              }
            </p>
          } @else {
            <p class="ij-text">No import job has run yet. Jobs appear here once county data is uploaded.</p>
            <button type="button" class="btn primary" (click)="openUpload()">Import county data</button>
          }
        }
      }

      @if (pane() === 'upload') {
        <gz-record-pane deskSlot heading="Import county data" noun="import" backLabel="Import jobs" (closed)="closePane()">
          <gz-import-form />
        </gz-record-pane>
      } @else if (paneJob(); as j) {
        <gz-record-pane
          deskSlot
          [heading]="name(j)"
          noun="job"
          backLabel="Import jobs"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() >= 0 && paneIndex() < rows().length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          <span paneMeta>{{ status(j.status) }}{{ sub(j) ? ' · ' + sub(j) : '' }}</span>
          @if (retryable(j)) {
            <div paneActions class="ij-pane-actions">
              <button type="button" class="btn primary"
                [attr.aria-disabled]="blocked(j) || s().retrying !== null ? 'true' : null"
                [attr.aria-describedby]="blocked(j) ? 'ij-retry-why' : null"
                (click)="retry(j)">
                {{ s().retrying === j.id ? 'Retrying…' : 'Retry' }}
              </button>
              <p class="ij-why" id="ij-retry-why">{{ blocked(j) ?? 'Resumes from the last checkpoint.' }}</p>
            </div>
          }
          @if (retryError(); as error) {
            <p class="field-error ij-pane-error" role="alert">{{ error }}</p>
          }
          <gz-import-job-record
            [job]="j"
            [detail]="s().job?.id === j.id"
            [loading]="s().jobLoading && s().job?.id !== j.id"
            [error]="s().jobError"
            (openJob)="openFromPane($event)"
            (reload)="reloadJob()"
          />
        </gz-record-pane>
      } @else if (pane() === 'job') {
        <!-- A job that isn't on this page (an earlier attempt), while it loads or when it failed. -->
        <gz-record-pane deskSlot heading="Import job" noun="job" backLabel="Import jobs" (closed)="closePane()">
          <gz-request-status [loading]="s().jobLoading" loadingText="Loading the job…" [error]="s().jobError" (retry)="reloadJob()" />
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    .ij-count {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    .ij-text {
      margin: 0 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .ij-job {
      min-width: 200px;
      overflow-wrap: anywhere;
    }
    .ij-bar {
      display: block;
      width: 96px;
      height: 4px;
      margin: 6px 0 4px auto;
      background: var(--rule);
    }
    .ij-bar i {
      display: block;
      height: 100%;
      background: var(--ink);
    }
    .ij-of {
      color: var(--ink-2);
    }
    .ij-pane-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .ij-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .ij-pane-error {
      margin: var(--sp-8) 0;
    }
  `,
})
export class ImportJobs {
  readonly w = inject(Workspace);
  readonly s = this.w.store.selectSignal(selectImportJobs);
  readonly access = adminAccess();
  private readonly injector = inject(Injector);
  private readonly countEl = viewChild<ElementRef<HTMLElement>>('count');
  private readonly newButton = viewChild<ElementRef<HTMLElement>>('newButton');
  readonly backfill = BACKFILL;

  readonly rows = computed(() => this.s().page?.jobs.content ?? []);
  readonly selectedId = signal<unknown>(null);
  readonly pane = signal<Pane>(null);
  readonly paneIndex = computed(() => this.rows().findIndex((j) => j.id === this.selectedId()));
  /** The job in the pane: its detail answer, or its row while that loads. */
  readonly paneJob = computed<ImportJobDTO | null>(() => {
    if (this.pane() !== 'job') return null;
    const id = this.selectedId();
    const detail = this.s().job;
    if (detail && detail.id === id) return detail;
    return this.rows().find((j) => j.id === id) ?? null;
  });
  readonly paneLabel = computed(() =>
    this.pane() === 'upload' ? 'Import county data' : this.paneJob() ? 'Import job: ' + jobName(this.paneJob()!) : 'Import job',
  );
  readonly position = computed(() =>
    this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.rows().length} on this page`,
  );
  readonly active = jobActive;
  readonly running = computed(() => this.rows().filter(jobActive).length);
  readonly countText = computed(() => {
    const total = this.s().page?.jobs.totalElements ?? 0;
    const running = this.running();
    return countOf(total, 'job') + (running ? ` · ${running} queued or running, refreshed every 5 seconds` : '');
  });
  readonly untracked = computed(() => (this.s().page?.untrackedJobTypes ?? []).map((t) => labelFor(t)).join(', '));
  /** A retry sent from this pane that failed: shown in that job's pane only. */
  private readonly retriedFrom = signal<string | null>(null);
  readonly retryError = computed(() =>
    this.s().retryError && this.retriedFrom() !== null && this.retriedFrom() === this.selectedId() ? this.s().retryError : null,
  );
  private focusCount = false;

  constructor() {
    // The first page, once an admin is looking.
    effect(() => {
      if (this.access() === 'admin') untracked(() => this.load(0));
    });
    // Poll while something is queued or running, and stop when the page is left.
    effect((onCleanup) => {
      if (!this.running() || this.access() !== 'admin') return;
      const timer = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        this.w.store.dispatch(A.load({ page: this.s().pageIndex, silent: true }));
        const id = this.s().selectedId;
        if (id !== null) this.w.store.dispatch(A.openJob({ id, silent: true }));
      }, POLL_MS);
      onCleanup(() => clearInterval(timer));
    });
    inject(DestroyRef).onDestroy(() => this.w.store.dispatch(A.closeJob()));
    // Another job in the pane: a failed retry was the other's.
    effect(() => {
      const id = this.selectedId();
      untracked(() => {
        if (this.retriedFrom() !== null && this.retriedFrom() !== id) this.retriedFrom.set(null);
      });
    });
    // The pane follows the selection: the job's detail (with its records) is asked for.
    effect(() => {
      const id = this.selectedId();
      if (this.pane() !== 'job' || typeof id !== 'string') return;
      untracked(() => {
        if (this.s().selectedId !== id) this.w.store.dispatch(A.openJob({ id }));
      });
    });
    // A retry or an upload that queued a job selects it (the store does): the pane opens on it.
    let lastStore: string | null = null;
    effect(() => {
      const id = this.s().selectedId;
      untracked(() => {
        const was = lastStore;
        lastStore = id;
        if (id === null || id === was || id === this.selectedId()) return;
        this.selectedId.set(id);
        this.pane.set('job');
        this.focusPaneTitle();
      });
    });
    // After paging, the list starts from its count, which takes focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.s().loading || !this.focusCount) return;
      this.focusCount = false;
      untracked(() => {
        const el = this.countEl()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
  }

  name = jobName;
  status = jobStatus;
  attention = jobAttention;
  retryable = jobRetryable;
  blocked = retryBlocked;
  /** "CSV import · Miami-Dade, FL · attempt 2", "#214 · County ID 17". */
  sub(j: ImportJobDTO): string {
    return [jobKind(j) ?? jobRef(j.id), jobPlace(j), (j.attempt ?? 1) > 1 ? 'attempt ' + j.attempt : null]
      .filter(Boolean)
      .join(' · ');
  }
  share(j: ImportJobDTO) {
    return j.total > 0 ? Math.min(100, (j.processed / j.total) * 100) : 0;
  }
  when(v: string) {
    return formatLocalDateTime(v);
  }

  load(page: number) {
    this.w.store.dispatch(A.load({ page }));
  }
  refresh() {
    if (this.s().loading) return;
    this.load(this.s().pageIndex);
    const id = this.s().selectedId;
    if (id !== null && this.pane() === 'job') this.w.store.dispatch(A.openJob({ id }));
  }
  page(page: number) {
    this.focusCount = true;
    this.pane.set(null);
    this.w.store.dispatch(A.closeJob());
    this.load(page);
  }
  openJob(id: unknown) {
    if (typeof id !== 'string') return;
    this.selectedId.set(id);
    this.pane.set('job');
  }
  /** "Resumes": the earlier job opens in the pane; its title takes focus (the link is gone). */
  openFromPane(id: string) {
    this.openJob(id);
    this.focusPaneTitle();
  }
  openUpload() {
    this.selectedId.set(null);
    this.pane.set('upload');
  }
  reloadJob() {
    const id = this.selectedId();
    if (typeof id === 'string') this.w.store.dispatch(A.openJob({ id }));
  }
  closePane(toNew = false) {
    const was = this.pane();
    if (!was) return;
    this.pane.set(null);
    this.retriedFrom.set(null);
    this.w.store.dispatch(A.closeJob());
    // Once the register is back: focus goes to the row the pane showed, or to Import county data.
    afterNextRender(
      () => {
        const row = document.querySelector<HTMLElement>('.ij-table tr.gz-row.sel');
        (was === 'job' && row && !toNew ? row : this.newButton()?.nativeElement)?.focus({ preventScroll: false });
      },
      { injector: this.injector },
    );
  }
  step(by: number) {
    const next = this.rows()[this.paneIndex() + by];
    if (next) this.openJob(next.id);
  }
  retry(j: ImportJobDTO) {
    if (this.blocked(j) || this.s().retrying !== null || !this.w.requireAccount('retry imports')) return;
    this.retriedFrom.set(j.id);
    // The new attempt replaces this job in the pane: focus waits on the pane's title.
    document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus();
    this.w.store.dispatch(A.retry({ id: j.id }));
  }
  private focusPaneTitle() {
    afterNextRender(() => document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus(), {
      injector: this.injector,
    });
  }
}
