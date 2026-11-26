import { labelFor } from '../../shared/pipes/label.pipe';
import { formatFolio } from '../../shared/data/format';
import { ACTIVE_JOB_STATUSES, ImportJobDTO, RETRY_REASONS } from '../../core/models/import-job';

/** Import jobs in words (DESIGN.md §13): statuses, names, places and retry reasons, never codes. */

export const BACKFILL = 'MAPILLARY_IMAGE_BACKFILL';
const STATUS: Record<string, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  PARTIAL: 'Partly completed',
  FAILED: 'Failed',
  INTERRUPTED: 'Interrupted',
};
export const jobStatus = (status: string) => STATUS[status] ?? labelFor(status);
/** Statuses that need someone to look: the job stopped short. */
export const jobAttention = (status: string) => ['FAILED', 'INTERRUPTED', 'PARTIAL'].includes(status);
export const jobActive = (j: ImportJobDTO) => ACTIVE_JOB_STATUSES.includes(j.status);
/** Only finished ingestion jobs that did not fully complete can be resumed. */
export const jobRetryable = (j: ImportJobDTO) =>
  j.jobType !== BACKFILL && ['FAILED', 'PARTIAL', 'INTERRUPTED'].includes(j.status);

/** What the job loads ("Sales"), or what it is when it loads no dataset ("Mapillary image backfill"). */
export const jobName = (j: ImportJobDTO) => (j.dataset ? labelFor(j.dataset) : labelFor(j.jobType));
/** The kind of job when the name is its dataset ("CSV import"). */
export const jobKind = (j: ImportJobDTO) => (j.dataset ? labelFor(j.jobType) : null);
/** "Miami-Dade, FL", or the county's ID when the job names no county (never a bare "County 17"). */
export function jobPlace(j: ImportJobDTO): string | null {
  if (j.sourceCounty) return j.sourceCounty + (j.sourceState ? ', ' + j.sourceState : '');
  return j.countyId !== null ? 'County ID ' + j.countyId : null;
}
/** The job's ID as people quote it: "#214" for an image backfill, the UUID's first 8 characters otherwise. */
export const jobRef = (id: string) => (/^\d+$/.test(id) ? '#' + id : id.slice(0, 8));
/** Records the job wrote, or images it saved (an image backfill). */
export const writtenWord = (j: ImportJobDTO) => (j.jobType === BACKFILL ? 'Images saved' : 'Written');

/** Why Retry can't run, as a sentence ("Its input files are no longer available."). */
export function retryBlocked(j: ImportJobDTO): string | null {
  if (j.retryable !== false) return null;
  const reason = RETRY_REASONS[j.retryBlockedReason ?? ''];
  return reason ? reason[0].toUpperCase() + reason.slice(1) : 'The server says this job can’t be retried.';
}

/** A failed or skipped record: "sales.csv, row 1,200", or the folio an API ingestion read. */
export function itemWhere(key: string): string {
  const row = /^(.+):(\d+)$/.exec(key);
  if (row) return `${row[1]}, row ${Number(row[2]).toLocaleString('en-US')}`;
  return /^\d{13}$/.test(key) ? 'Folio ' + formatFolio(key) : key;
}
