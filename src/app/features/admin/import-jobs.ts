import { LabelPipe, labelFor } from '../../shared/pipes/label.pipe';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { ImportJobsActions as A } from '../../store/import-jobs/import-jobs.actions';
import { selectImportJobs } from '../../store/import-jobs/import-jobs.selectors';
import {
  ACTIVE_JOB_STATUSES,
  CSV_DATASETS,
  ImportJobDTO,
  ImportUploadKind,
  RETRY_REASONS,
} from '../../core/models/import-job';

const POLL_MS = 5000;
const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  PARTIAL: 'Partly completed',
  FAILED: 'Failed',
  INTERRUPTED: 'Interrupted',
};

/** Tracked import jobs: progress, failures, retries and CSV uploads. Realm role "admin" only. */
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
      title="Import jobs"
      subtitle="Load county data and follow background imports."
    >
      @if (allowed()) {
        <button type="button" class="btn" [disabled]="s().loading" (click)="load(s().pageIndex)">
          {{ s().loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      }
    </gz-heading>
    @if (!w.auth.isLoggedIn()) {
      <div class="panel section guest-notice">
        <h3>Sign in as an administrator.</h3>
        <p class="sub spacer">Import jobs are only visible to accounts with the admin role.</p>
        <button type="button" class="btn primary spacer" (click)="w.signIn()">Sign in</button>
      </div>
    } @else if (!allowed()) {
      <div class="empty">
        Your account does not have the admin role, so import jobs are not available.
        <a class="btn spacer" routerLink="/dashboard">Back to overview</a>
      </div>
    } @else {
      <form class="panel section upload" (ngSubmit)="submit()" #form="ngForm">
        <div class="panelhead">
          <h3>Import county data</h3>
          <div class="toggle" role="group" aria-label="What to upload">
            @for (k of kinds; track k[0]) {
              <button
                type="button"
                [class.active]="kind() === k[0]"
                [attr.aria-pressed]="kind() === k[0]"
                (click)="setKind(k[0])"
              >
                {{ k[1] }}
              </button>
            }
          </div>
        </div>
        <div class="formgrid">
          @if (kind() === 'file') {
            <div class="formfield">
              <label for="dataset">Dataset</label
              ><select id="dataset" name="dataset" [(ngModel)]="dataset">
                @for (d of datasets; track d) {
                  <option [value]="d">{{ d }}.csv</option>
                }
              </select>
            </div>
          }
          <div class="formfield">
            <label for="county">County</label
            ><input
              id="county"
              name="county"
              [(ngModel)]="county"
              required
              placeholder="Miami-Dade"
            />
          </div>
          <div class="formfield">
            <label for="state">State</label
            ><input id="state" name="state" [(ngModel)]="state" required placeholder="FL" />
          </div>
          @if (kind() === 'owners') {
            <div class="formfield">
              <label for="ownersFile">owners.csv</label
              ><input id="ownersFile" type="file" accept=".csv" (change)="pick($event, 0)" />
            </div>
            <div class="formfield">
              <label for="propertyOwnersFile">property_owner.csv</label
              ><input
                id="propertyOwnersFile"
                type="file"
                accept=".csv"
                (change)="pick($event, 1)"
              />
            </div>
          } @else {
            <div class="formfield">
              <label for="csvFiles">{{
                kind() === 'folder' ? 'County CSV files' : dataset + '.csv'
              }}</label
              ><input
                id="csvFiles"
                type="file"
                accept=".csv"
                [multiple]="kind() === 'folder'"
                (change)="pick($event)"
              />
            </div>
          }
        </div>
        <p class="sourcedata">
          @switch (kind()) {
            @case ('folder') {
              Needs properties, addresses, assessments, buildings, owners, property_owner, lands,
              sales, taxes and extra_features CSVs; parcels, predictions and images are optional.
              properties.csv loads first.
            }
            @case ('owners') {
              Both files load in one transaction.
            }
            @default {
              The county must already exist, except for properties.csv, which creates it. Existing
              properties are never overwritten: a duplicate folio fails the job.
            }
          }
        </p>
        <button
          class="btn primary spacer"
          [disabled]="form.invalid || !filesReady() || s().uploading"
        >
          {{ s().uploading ? 'Uploading…' : 'Start import' }}
        </button>
        <gz-request-status [error]="s().uploadError" [showRetry]="false" />
      </form>

      <gz-request-status
        [loading]="s().loading && !s().page"
        loadingText="Loading import jobs…"
        [error]="s().error"
        (retry)="load(s().pageIndex)"
      />
      <gz-request-status [error]="s().retryError" [showRetry]="false" />
      @if (s().page; as p) {
        @if (active()) {
          <p class="insight section" role="status">
            {{ active() }} {{ active() === 1 ? 'job is' : 'jobs are' }} still running. This page
            refreshes every few seconds.
          </p>
        }
        <div class="tablewrap section">
          <table>
            <caption class="sr-only">
              Tracked import jobs, newest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Status</th>
                <th scope="col">Progress</th>
                <th scope="col">Outcome</th>
                <th scope="col">Started</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (j of p.jobs.content; track j.id) {
                <tr [class.selected]="s().selectedId === j.id">
                  <td>
                    {{ jobTitle(j) }}
                    <div class="smalltext muted">
                      {{ shortId(j) }}
                      @if (j.sourceCounty) {
                        · {{ j.sourceCounty }}{{ j.sourceState ? ', ' + j.sourceState : '' }}
                      } @else if (j.countyId) {
                        · County {{ j.countyId }}
                      }
                      @if ((j.attempt ?? 1) > 1) {
                        · attempt {{ j.attempt }}
                      }
                    </div>
                  </td>
                  <td>
                    <span class="tag" [class]="tone(j.status)">{{ statusLabel(j.status) }}</span>
                    @if (j.errorCode) {
                      <div class="smalltext muted">{{ j.errorCode }}</div>
                    }
                  </td>
                  <td>
                    <progress
                      [value]="j.processed"
                      [max]="j.total || 1"
                      [attr.aria-label]="jobTitle(j) + ' progress'"
                    ></progress>
                    <div class="smalltext muted">
                      {{ j.processed | number }} / {{ j.total | number }}
                      @if (j.currentStep && isActive(j)) {
                        · {{ j.currentStep }}
                      }
                    </div>
                  </td>
                  <td class="smalltext">
                    {{ j.completed | number }}
                    {{ j.jobType === backfill ? 'with image' : 'written' }} ·
                    {{ j.skipped | number }} skipped · {{ j.failed | number }} failed
                  </td>
                  <td class="smalltext">
                    {{ j.createdAt | date: 'medium' }}
                    @if (j.finishedAt) {
                      <div class="muted">Finished {{ j.finishedAt | date: 'shortTime' }}</div>
                    }
                  </td>
                  <td class="actions">
                    <button
                      type="button"
                      class="btn small"
                      [attr.aria-expanded]="s().selectedId === j.id"
                      (click)="toggle(j.id)"
                    >
                      {{ s().selectedId === j.id ? 'Hide details' : 'Details' }}
                    </button>
                    @if (canRetry(j)) {
                      <button
                        type="button"
                        class="btn small"
                        [disabled]="s().retrying !== null || !j.retryable"
                        [title]="j.retryable ? 'Resume from the last checkpoint' : blocked(j)"
                        (click)="retry(j)"
                      >
                        {{ s().retrying === j.id ? 'Retrying…' : 'Retry' }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">No tracked import jobs yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <gz-pagination
          [page]="p.jobs.page"
          [pages]="p.jobs.totalPages"
          [total]="p.jobs.totalElements"
          [loading]="s().loading"
          (changed)="load($event)"
        />
        @if (s().selectedId !== null) {
          <section class="panel section" aria-labelledby="job-results-title">
            <div class="panelhead">
              <h3 id="job-results-title">
                {{ s().job ? jobTitle(s().job!) : 'Job' }} · {{ shortIdOf(s().selectedId!) }}
              </h3>
              <button type="button" class="btn small" (click)="close()">Close</button>
            </div>
            <gz-request-status
              [loading]="s().jobLoading"
              [error]="s().jobError"
              (retry)="open(s().selectedId!)"
            />
            @if (s().job; as job) {
              @if (job.errorMessage) {
                <p class="insight danger" role="alert">{{ job.errorMessage }}</p>
              }
              @if (job.retryOfJobId) {
                <p class="smalltext muted">
                  Resumes
                  <button type="button" class="linkbtn" (click)="open(job.retryOfJobId)">
                    {{ shortIdOf(job.retryOfJobId) }}
                  </button>
                </p>
              }
              @if (job.retryable === false && job.retryBlockedReason && canRetry(job)) {
                <p class="smalltext muted">Retry unavailable: {{ blocked(job) }}</p>
              }
              @if (job.jobType === backfill) {
                <div class="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Property</th>
                        <th scope="col">Result</th>
                        <th scope="col">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (r of job.results ?? []; track r.propertyId) {
                        <tr>
                          <td>
                            <a [routerLink]="['/property', r.propertyId]">#{{ r.propertyId }}</a>
                          </td>
                          <td>{{ r.status | label }}</td>
                          <td class="smalltext">{{ r.reason || '—' }}</td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="3">No per-property results recorded yet.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Record</th>
                        <th scope="col">Result</th>
                        <th scope="col">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (r of job.items ?? []; track r.itemKey + r.status) {
                        <tr>
                          <td class="smalltext">{{ r.itemKey }}</td>
                          <td>{{ r.status === 'FAILED' ? 'Failed' : 'Skipped' }}</td>
                          <td class="smalltext">
                            {{ r.reason || '—' }}
                            @if (r.message) {
                              <div class="muted">{{ r.message }}</div>
                            }
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="3">No failed or skipped records.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if ((job.items?.length ?? 0) >= 1000) {
                  <p class="sourcedata">
                    Only the first 1,000 failed or skipped records are listed.
                  </p>
                }
              }
            }
          </section>
        }
        @if (p.untrackedJobTypes.length) {
          <p class="sourcedata">
            Not tracked here: {{ untracked() }}.
            {{ p.note }}
          </p>
        }
      }
    }`,
  styles: `
    progress {
      width: 120px;
    }
    tr.selected {
      background: #f6f8f8;
    }
    td.actions {
      white-space: nowrap;
    }
    td.actions .btn + .btn {
      margin-left: 6px;
    }
    .upload .formgrid {
      margin-top: 12px;
    }
  `,
})
export class ImportJobs implements OnInit {
  w = inject(Workspace);
  s = this.w.store.selectSignal(selectImportJobs);
  readonly backfill = 'MAPILLARY_IMAGE_BACKFILL';
  readonly datasets = CSV_DATASETS;
  readonly kinds: [ImportUploadKind, string][] = [
    ['file', 'One CSV'],
    ['owners', 'Owners'],
    ['folder', 'County folder'],
  ];
  kind = signal<ImportUploadKind>('file');
  dataset: string = CSV_DATASETS[0];
  county = '';
  state = '';
  private files = signal<(File | null)[]>([]);
  filesReady = computed(() => {
    const f = this.files();
    return this.kind() === 'owners' ? !!f[0] && !!f[1] : f.length > 0 && f.every(Boolean);
  });
  allowed = computed(() => this.w.auth.isLoggedIn() && this.w.auth.hasRealmRole('admin'));
  active = computed(
    () =>
      this.s().page?.jobs.content.filter((j) => ACTIVE_JOB_STATUSES.includes(j.status)).length ?? 0,
  );
  untracked = computed(() =>
    (this.s().page?.untrackedJobTypes ?? []).map((t) => this.typeLabel(t)).join(', '),
  );
  constructor() {
    // Poll only while something is queued or running, and stop when the page is left.
    effect((onCleanup) => {
      if (!this.active()) return;
      const timer = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        this.w.store.dispatch(A.load({ page: this.s().pageIndex, silent: true }));
        const id = this.s().selectedId;
        if (id !== null) this.w.store.dispatch(A.openJob({ id, silent: true }));
      }, POLL_MS);
      onCleanup(() => clearInterval(timer));
    });
    inject(DestroyRef).onDestroy(() => this.w.store.dispatch(A.closeJob()));
  }
  ngOnInit() {
    if (this.allowed()) this.load(0);
  }
  load(page: number) {
    this.w.store.dispatch(A.load({ page }));
  }
  open(id: string) {
    this.w.store.dispatch(A.openJob({ id }));
  }
  toggle(id: string) {
    if (this.s().selectedId === id) this.close();
    else this.open(id);
  }
  close() {
    this.w.store.dispatch(A.closeJob());
  }
  retry(j: ImportJobDTO) {
    if (this.s().retrying === null) this.w.store.dispatch(A.retry({ id: j.id }));
  }
  /** Only finished ingestion jobs that did not fully complete can be resumed. */
  canRetry(j: ImportJobDTO) {
    return j.jobType !== this.backfill && ['FAILED', 'PARTIAL', 'INTERRUPTED'].includes(j.status);
  }
  blocked(j: ImportJobDTO) {
    const code = j.retryBlockedReason ?? '';
    const reason = RETRY_REASONS[code];
    return reason ? reason[0].toUpperCase() + reason.slice(1) : code || 'Retry is not available.';
  }
  isActive(j: ImportJobDTO) {
    return ACTIVE_JOB_STATUSES.includes(j.status);
  }
  setKind(kind: ImportUploadKind) {
    this.kind.set(kind);
    this.files.set([]);
  }
  pick(event: Event, slot?: number) {
    const picked = Array.from((event.target as HTMLInputElement).files ?? []);
    if (slot === undefined) this.files.set(picked);
    else
      this.files.update((f) => {
        const next = [...f];
        next[slot] = picked[0] ?? null;
        return next;
      });
  }
  submit() {
    if (!this.filesReady() || this.s().uploading) return;
    this.w.store.dispatch(
      A.upload({
        upload: {
          kind: this.kind(),
          dataset: this.dataset,
          county: this.county.trim(),
          state: this.state.trim(),
          files: this.files().filter((f): f is File => !!f),
        },
      }),
    );
  }
  jobTitle(j: ImportJobDTO) {
    const what = j.dataset ? this.typeLabel(j.dataset) : null;
    return what ? `${this.typeLabel(j.jobType)} · ${what}` : this.typeLabel(j.jobType);
  }
  shortId(j: ImportJobDTO) {
    return j.jobId !== null ? '#' + j.jobId : this.shortIdOf(j.id);
  }
  shortIdOf(id: string) {
    return /^\d+$/.test(id) ? '#' + id : id.slice(0, 8);
  }
  statusLabel(status: string) {
    return STATUS_LABELS[status] ?? status;
  }
  tone(status: string) {
    return status === 'COMPLETED'
      ? 'tag green'
      : status === 'FAILED' || status === 'INTERRUPTED'
        ? 'tag red'
        : status === 'PARTIAL'
          ? 'tag amber'
          : 'tag';
  }
  typeLabel(type: string) {
    return labelFor(type);
  }
}
