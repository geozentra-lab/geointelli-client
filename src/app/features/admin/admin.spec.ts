import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { Type } from '@angular/core';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { ImportJobsActions as J } from '../../store/import-jobs/import-jobs.actions';
import { AdminActions as A } from '../../store/admin/admin.actions';
import { OpportunitiesActions as O } from '../../store/opportunities/opportunities.actions';
import { ImportJobDTO } from '../../core/models/import-job';
import { DataQualityIssue, DataQualityReportDTO, ValuationRefreshRequestDTO } from '../../core/models/admin';
import { ImportJobs } from './import-jobs';
import { DataQuality } from './data-quality';
import { ValuationOperations } from './valuation-operations';

const job = (id: string, over: Partial<ImportJobDTO> = {}): ImportJobDTO => ({
  id,
  jobType: 'CSV_IMPORT',
  dataset: 'SALES',
  jobId: null,
  countyId: 17,
  sourceCounty: 'Miami-Dade',
  sourceState: 'FL',
  status: 'COMPLETED',
  total: 100,
  processed: 100,
  completed: 98,
  skipped: 1,
  failed: 1,
  errorCode: null,
  createdAt: '2026-11-18T15:00:00Z',
  finishedAt: '2026-11-18T16:00:00Z',
  ...over,
});
const jobsPage = (jobs: ImportJobDTO[]) => ({
  jobs: { content: jobs, page: 0, size: 20, totalElements: jobs.length, totalPages: 1 },
  untrackedJobTypes: ['SCHOOL_ANALYSIS'],
  note: 'These run on the analysis worker.',
});
const page = <T>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });
const issue = (n: number, over: Partial<DataQualityIssue> = {}): DataQualityIssue => ({
  reference: 'SALE_DUPLICATE:SALE:' + n,
  rule: 'SALE_DUPLICATE',
  category: 'DUPLICATE',
  entityType: 'SALE',
  entityId: n,
  propertyId: 42,
  folio: '0141370120450',
  detail: 'Sale recorded twice on Mar 3.',
  sourceCounty: 'Miami-Dade',
  sourceState: 'FL',
  sourcePropertyId: 1234,
  ...over,
});
const report = (over: Partial<DataQualityReportDTO> = {}): DataQualityReportDTO => ({
  generatedAt: '2026-11-18T15:57:00Z',
  summary: [
    { rule: 'SALE_DUPLICATE', category: 'DUPLICATE', entityType: 'SALE', source: 'sale', description: 'Sale recorded twice', issueCount: 6 },
    { rule: 'ASSESSMENT_DUPLICATE', category: 'DUPLICATE', entityType: 'ASSESSMENT', source: 'assessment', description: 'Assessment recorded twice', issueCount: 0 },
  ],
  note: 'Counts are reused for up to 5 minutes.',
  ...over,
});
const request = (id: string, over: Partial<ValuationRefreshRequestDTO> = {}): ValuationRefreshRequestDTO => ({
  requestId: id,
  eventKey: 'k-' + id,
  triggerType: 'SALE_CHANGE',
  scopeType: 'PROPERTY',
  propertyId: null,
  saleId: 88377,
  sourceVersion: '2',
  sourceChangedAt: '2026-11-18T08:00:00Z',
  status: 'FAILED',
  outcome: null,
  attempts: 5,
  maxAttempts: 5,
  nextAttemptAt: null,
  runId: null,
  lastErrorCode: 'COMPARABLES_QUERY_TIMEOUT',
  leaseExpiresAt: null,
  createdAt: '2026-11-18T08:00:00Z',
  updatedAt: '2026-11-18T13:00:00Z',
  startedAt: null,
  completedAt: null,
  ...over,
});

describe('Admin pages', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: true, admin: true };
  const confirm = vi.fn(async () => true);
  beforeEach(() => {
    auth.loggedIn = true;
    auth.admin = true;
    confirm.mockClear();
  });

  async function setup(url: string, component: Type<unknown>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/import-jobs', component: ImportJobs },
          { path: 'admin/data-quality', component: DataQuality },
          { path: 'admin/valuations', component: ValuationOperations },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        {
          provide: KeycloakService,
          useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: (r: string) => auth.admin && r === 'admin' },
        },
        { provide: ConfirmationService, useValue: { confirm } },
      ],
    });
    store = TestBed.inject(Store);
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, component);
    const el = harness.routeNativeElement as HTMLElement;
    document.body.appendChild(harness.fixture.nativeElement);
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    await settle();
    return { el, harness, settle };
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  const spaced = (el: Element | null) => {
    const walk = document.createTreeWalker(el!, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    while (walk.nextNode()) out.push(walk.currentNode.textContent!);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  const of = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  const button = (root: Element, words: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === words)!;
  const pane = () => document.querySelector('.desk-slot gz-record-pane');

  it('asks a guest to sign in, tells a non-admin why, and loads nothing for either', async () => {
    auth.loggedIn = false;
    const guest = await setup('/admin/import-jobs', ImportJobs);
    expect(text(guest.el.querySelector('gz-admin-gate h2'))).toBe('Sign in as an administrator');
    TestBed.resetTestingModule();
    auth.loggedIn = true;
    auth.admin = false;
    const other = await setup('/admin/data-quality', DataQuality);
    expect(text(other.el.querySelector('gz-admin-gate'))).toContain(
      'Your account doesn’t have the admin role, so it can’t open the data-quality report.',
    );
    expect(of(A.loadDataQuality.type)).toHaveLength(0);
  });

  it('lists import jobs as a table with statuses in words, no codes, and the untracked kinds under it', async () => {
    const { el, settle } = await setup('/admin/import-jobs', ImportJobs);
    expect(of(J.load.type)[0]).toMatchObject({ page: 0 });
    store.dispatch(
      J.loaded({
        page: jobsPage([
          job('a1b2c3d4-0000', { status: 'RUNNING', currentStep: 'Writing rows', attempt: 2, finishedAt: null }),
          job('e5f6a7b8-0000', { status: 'FAILED', errorCode: 'DATABASE_UNAVAILABLE', retryable: false, retryBlockedReason: 'INPUT_UNAVAILABLE' }),
          job('214', { jobType: 'MAPILLARY_IMAGE_BACKFILL', dataset: null, jobId: 214, sourceCounty: null, sourceState: null }),
        ]),
      }),
    );
    await settle();
    expect(text(el.querySelector('.ij-count'))).toBe('3 jobs · 1 queued or running, refreshed every 5 seconds');
    const rows = [...el.querySelectorAll('.ij-table tbody tr')];
    expect(spaced(rows[0])).toContain('Sales CSV import · Miami-Dade, FL · attempt 2');
    expect(spaced(rows[0])).toContain('Running Writing rows');
    expect(spaced(rows[1])).toContain('Failed');
    expect(spaced(rows[2])).toContain('Mapillary image backfill #214 · County ID 17');
    expect(text(el.querySelector('.ij-table'))).not.toContain('DATABASE_UNAVAILABLE');
    expect(text(el.querySelector('.table-note'))).toContain('Not tracked here: School analysis. These run on the analysis worker.');
  });

  it('opens a job in the pane with its failure in words, the code under Details, its records and why Retry can’t run', async () => {
    const { el, settle } = await setup('/admin/import-jobs', ImportJobs);
    const failed = job('e5f6a7b8-0000', { status: 'FAILED', errorCode: 'DATABASE_UNAVAILABLE', retryable: false, retryBlockedReason: 'INPUT_UNAVAILABLE' });
    store.dispatch(J.loaded({ page: jobsPage([failed]) }));
    await settle();
    el.querySelector<HTMLElement>('.ij-table tbody tr td')!.click();
    await settle();
    expect(of<ReturnType<typeof J.openJob>>(J.openJob.type)[0]).toMatchObject({ id: 'e5f6a7b8-0000' });
    expect(text(pane()!.querySelector('.pane-title'))).toBe('Sales');
    const retry = button(pane()!, 'Retry');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    expect(text(pane()!.querySelector('#ij-retry-why'))).toBe('Its input files are no longer available.');
    retry.click();
    expect(of(J.retry.type)).toHaveLength(0);
    store.dispatch(
      J.jobLoaded({
        job: {
          ...failed,
          errorMessage: 'The database was unavailable.',
          items: [{ itemKey: 'sales.csv:1200', status: 'FAILED', reason: 'INVALID_NUMBER', message: 'sale_price "N/A" is not a number' }],
        },
      }),
    );
    await settle();
    const body = pane()!;
    expect(spaced(body)).toContain('What went wrong The database was unavailable.');
    expect(spaced(body.querySelector('details'))).toContain('Code DATABASE_UNAVAILABLE');
    expect(spaced(body.querySelector('.jr-table tbody'))).toContain('sales.csv, row 1,200 Failed Invalid number sale_price "N/A" is not a number');
  });

  it('opens the upload form in the pane, says why Start import can’t run, then opens the queued job', async () => {
    const { el, settle } = await setup('/admin/import-jobs', ImportJobs);
    store.dispatch(J.loaded({ page: jobsPage([job('a1b2c3d4-0000')]) }));
    await settle();
    button(el, 'Import county data').click();
    await settle();
    expect(text(pane()!.querySelector('.pane-title'))).toBe('Import county data');
    expect(text(pane()!.querySelector('#if-why'))).toBe('Enter the county and its state.');
    button(pane()!, 'Start import').click();
    expect(of(J.upload.type)).toHaveLength(0);
    store.dispatch(J.queued({ job: job('99999999-0000', { dataset: 'LANDS', status: 'QUEUED', finishedAt: null }) }));
    await settle();
    expect(text(pane()!.querySelector('.pane-title'))).toBe('Lands');
    expect(document.activeElement).toBe(pane()!.querySelector('.pane-title'));
  });

  it('says a failed retry in that job’s pane only', async () => {
    const { el, settle } = await setup('/admin/import-jobs', ImportJobs);
    store.dispatch(
      J.loaded({ page: jobsPage([job('a1', { status: 'PARTIAL', retryable: true }), job('b2', { dataset: 'LANDS' })]) }),
    );
    await settle();
    el.querySelector<HTMLElement>('.ij-table tbody tr td')!.click();
    await settle();
    button(pane()!, 'Retry').click();
    expect(of<ReturnType<typeof J.retry>>(J.retry.type)[0]).toMatchObject({ id: 'a1' });
    store.dispatch(J.retryFailed({ id: 'a1', error: 'Retry refused: a retry of this job is already running.' }));
    await settle();
    expect(text(el.querySelector('.ij-pane-error'))).toBe('Retry refused: a retry of this job is already running.');
    el.querySelector('.ij-table tbody tr')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(text(pane()!.querySelector('.pane-title'))).toBe('Lands');
    expect(el.querySelector('.ij-pane-error')).toBeNull();
  });

  it('lists a rule’s issues from the address, with the source property ID named, and an honest empty rule', async () => {
    const { el, harness, settle } = await setup('/admin/data-quality?rule=SALE_DUPLICATE', DataQuality);
    expect(of(A.loadDataQuality.type)[0]).toMatchObject({ rule: 'SALE_DUPLICATE', page: 0 });
    store.dispatch(A.dataQualityLoaded({ report: report({ rule: 'SALE_DUPLICATE', issues: page([issue(1)]) }) }));
    await settle();
    expect(text(el.querySelector('.dq-count'))).toMatch(/^6 issues across 2 rules · counted at \d/);
    expect(text(el.querySelector('.dq-rules'))).not.toContain('SALE_DUPLICATE');
    expect(text(el.querySelector('#dq-issues-title'))).toBe('Sale recorded twice');
    const row = spaced(el.querySelector('.dq-issue-table tbody tr'));
    expect(row).toContain('Folio 01-4137-012-0450');
    expect(row).toContain('Source property ID 1234');
    expect(row).not.toContain('row 1234');
    // Another rule, picked in the table: the address follows, and its (empty) issues load.
    el.querySelectorAll<HTMLElement>('.dq-rules tbody tr')[1].querySelector('td')!.click();
    await settle();
    await harness.fixture.whenStable();
    await settle();
    expect(of(A.loadDataQuality.type).at(-1)).toMatchObject({ rule: 'ASSESSMENT_DUPLICATE', page: 0 });
    store.dispatch(A.dataQualityLoaded({ report: report({ rule: 'ASSESSMENT_DUPLICATE', issues: page([]) }) }));
    await settle();
    expect(text(el.querySelector('.dq-issue-table tbody'))).toContain('No record breaks this rule in the latest count.');
  });

  it('says so when every record passes', async () => {
    const { el, settle } = await setup('/admin/data-quality', DataQuality);
    const r = report();
    store.dispatch(A.dataQualityLoaded({ report: { ...r, summary: r.summary.map((x) => ({ ...x, issueCount: 0 })) } }));
    await settle();
    expect(text(el.querySelector('.dq-count'))).toMatch(/^No issues: every record passes the 2 rules/);
  });

  it('opens a failed revaluation with Retry and Cancel, keeps its code under Details, and moves to the retry', async () => {
    const { el, settle } = await setup('/admin/valuations?status=FAILED', ValuationOperations);
    expect(of(A.loadRefreshRequests.type)[0]).toMatchObject({ status: 'FAILED', page: 0 });
    store.dispatch(
      A.refreshRequestsLoaded({
        page: page([request('r1'), request('r2', { triggerType: 'MODEL_PUBLICATION', scopeType: 'FULL_MARKET', saleId: null, lastErrorCode: 'PUBLICATION_CHECKSUM_MISMATCH' })]),
      }),
    );
    await settle();
    expect(text(el.querySelector('.vo-table'))).not.toContain('COMPARABLES_QUERY_TIMEOUT');
    expect(text(el.querySelector('.vo-count'))).toBe('2 requests · Failed');
    el.querySelector<HTMLElement>('.vo-table tbody tr td')!.click();
    await settle();
    expect(text(pane()!.querySelector('.pane-title'))).toBe('Sale change');
    expect(spaced(pane()!.querySelector('details'))).toContain('Code COMPARABLES_QUERY_TIMEOUT');
    expect(button(pane()!, 'Cancel')).toBeTruthy();
    // A model publication is retried by the worker: Retry says so.
    el.querySelector('.vo-table tbody tr')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(text(pane()!.querySelector('.pane-title'))).toBe('Model publication');
    expect(button(pane()!, 'Retry').getAttribute('aria-disabled')).toBe('true');
    expect(text(pane()!.querySelector('#vo-retry-why'))).toBe('A model publication is retried by the valuation worker.');
    el.querySelectorAll('.vo-table tbody tr')[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await settle();
    button(pane()!, 'Retry').click();
    const sent = of<ReturnType<typeof A.retryRefresh>>(A.retryRefresh.type)[0];
    expect(sent.id).toBe('r1');
    store.dispatch(A.refreshRequestChanged({ id: 'r1', request: request('r3', { status: 'PENDING', attempts: 0, lastErrorCode: null }) }));
    await settle();
    expect(text(pane()!.querySelector('[paneMeta]'))).toBe('Pending');
  });

  it('asks before rescoring every property and shows the run’s result', async () => {
    const { el, settle } = await setup('/admin/valuations', ValuationOperations);
    button(el, 'Rescore every property…').click();
    await settle();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(of(O.refreshScores.type)[0]).toMatchObject({ mode: 'FULL' });
    store.dispatch(
      O.scoresRefreshed({
        result: {
          mode: 'FULL',
          scoreVersion: 'opportunity-v1',
          processed: 1204,
          scored: 1150,
          unavailable: 54,
          removed: 3,
          startedAt: '2026-11-18T15:00:00Z',
          finishedAt: '2026-11-18T15:02:00Z',
          durationMillis: 12400,
        },
      }),
    );
    await settle();
    const run = spaced(el.querySelector('.vo-scores'));
    expect(run).toContain('1,204');
    expect(run).toContain('1,150 with a score · 54 without enough evidence');
    expect(run).toContain('12.4 s');
  });

  it('keeps Show all when the polled job is answered again, and focuses the earlier job opened from Resumes', async () => {
    const { el, settle } = await setup('/admin/import-jobs', ImportJobs);
    const items = Array.from({ length: 60 }, (_, i) => ({ itemKey: `lands.csv:${1200 + i}`, status: 'SKIPPED', reason: 'DUPLICATE_ROW', message: null }));
    const running = job('a1', { dataset: 'LANDS', status: 'RUNNING', finishedAt: null, attempt: 2, retryOfJobId: 'b2' });
    store.dispatch(J.loaded({ page: jobsPage([running, job('b2', { dataset: 'LANDS', status: 'FAILED' })]) }));
    await settle();
    el.querySelector<HTMLElement>('.ij-table tbody tr td')!.click();
    await settle();
    store.dispatch(J.jobLoaded({ job: { ...running, items } }));
    await settle();
    expect(pane()!.querySelectorAll('.jr-table tbody tr')).toHaveLength(50);
    button(pane()!, 'Show all 60').click();
    await settle();
    expect(pane()!.querySelectorAll('.jr-table tbody tr')).toHaveLength(60);
    // The 5-second poll answers with the same job: the list stays open.
    store.dispatch(J.jobLoaded({ job: { ...running, processed: 99, items } }));
    await settle();
    expect(pane()!.querySelectorAll('.jr-table tbody tr')).toHaveLength(60);
    button(pane()!, 'Job ID b2').click();
    await settle();
    await settle();
    expect(of<ReturnType<typeof J.openJob>>(J.openJob.type).at(-1)).toMatchObject({ id: 'b2' });
    expect(document.activeElement).toBe(pane()!.querySelector('.pane-title'));
  });

  it('sends one revaluation change at a time and says why the others wait', async () => {
    const { el, settle } = await setup('/admin/valuations', ValuationOperations);
    store.dispatch(A.refreshRequestsLoaded({ page: page([request('r1', { status: 'PENDING', lastErrorCode: null }), request('r2')]) }));
    await settle();
    el.querySelector<HTMLElement>('.vo-table tbody tr td')!.click();
    await settle();
    button(pane()!, 'Cancel').click();
    await settle();
    await settle();
    expect(of(A.cancelRefresh.type)).toHaveLength(1);
    el.querySelector('.vo-table tbody tr')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(button(pane()!, 'Retry').getAttribute('aria-disabled')).toBe('true');
    expect(text(pane()!.querySelector('#vo-retry-why'))).toBe('Another request’s retry or cancel is still being sent.');
    button(pane()!, 'Retry').click();
    expect(of(A.retryRefresh.type)).toHaveLength(0);
  });

  it('hides a rule’s issues again', async () => {
    const { el, harness, settle } = await setup('/admin/data-quality?rule=SALE_DUPLICATE', DataQuality);
    store.dispatch(A.dataQualityLoaded({ report: report({ rule: 'SALE_DUPLICATE', issues: page([issue(1)]) }) }));
    await settle();
    button(el, 'Hide issues').click();
    await harness.fixture.whenStable();
    await settle();
    expect(of(A.loadDataQuality.type).at(-1)).toMatchObject({ rule: null, page: 0 });
    expect(el.querySelector('.dq-issues')).toBeNull();
  });
});

