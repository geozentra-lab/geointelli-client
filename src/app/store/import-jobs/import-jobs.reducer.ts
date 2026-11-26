import { createReducer, on } from '@ngrx/store';
import { ImportJobDTO, ImportJobPageDTO } from '../../core/models/import-job';
import { ImportJobsActions as A } from './import-jobs.actions';
export const importJobsReducer = createReducer(
  {
    page: null as ImportJobPageDTO | null,
    pageIndex: 0,
    loading: false,
    error: null as string | null,
    selectedId: null as string | null,
    job: null as ImportJobDTO | null,
    jobLoading: false,
    jobError: null as string | null,
    /** The job a retry was requested for, while the request runs. */
    retrying: null as string | null,
    retryError: null as string | null,
    uploading: false,
    uploadError: null as string | null,
  },
  // Silent refreshes (polling running jobs) keep the current table and error banner steady.
  on(A.load, (s, { page, silent }) =>
    silent ? s : { ...s, pageIndex: page, loading: true, error: null },
  ),
  on(A.loaded, (s, { page }) => ({
    ...s,
    page,
    pageIndex: page.jobs.page,
    loading: false,
    error: null,
  })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
  // A silent refresh replaces any request still in flight (switchMap). When it fails, the table
  // stays as it was; but a visible load it cancelled (loading is only set by a visible load) would
  // otherwise wait for ever, so that wait ends with the error.
  on(A.refreshFailed, (s, { error }) => (s.loading ? { ...s, error, loading: false } : s)),
  on(A.openJob, (s, { id, silent }) =>
    silent
      ? s
      : {
          ...s,
          selectedId: id,
          job: s.job?.id === id ? s.job : null,
          jobLoading: true,
          jobError: null,
        },
  ),
  on(A.jobLoaded, (s, { job }) =>
    job.id === s.selectedId ? { ...s, job, jobLoading: false, jobError: null } : s,
  ),
  on(A.jobFailed, (s, { error }) => ({ ...s, jobError: error, jobLoading: false })),
  on(A.jobRefreshFailed, (s, { error }) =>
    s.jobLoading ? { ...s, jobError: error, jobLoading: false } : s,
  ),
  on(A.closeJob, (s) => ({ ...s, selectedId: null, job: null, jobError: null, jobLoading: false })),
  on(A.retry, (s, { id }) => ({ ...s, retrying: id, retryError: null })),
  // The new attempt replaces the old one in the details panel.
  on(A.retried, A.queued, (s, { job }) => ({
    ...s,
    retrying: null,
    selectedId: job.id,
    job,
    jobLoading: false,
    jobError: null,
  })),
  on(A.retryFailed, (s, { error }) => ({ ...s, retrying: null, retryError: error })),
  on(A.upload, (s) => ({ ...s, uploading: true, uploadError: null })),
  on(A.queued, (s) => ({ ...s, uploading: false })),
  on(A.uploadFailed, (s, { error }) => ({ ...s, uploading: false, uploadError: error })),
);
