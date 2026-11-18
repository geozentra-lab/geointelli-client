/** Admin import jobs (property-service master, /api/admin/import-jobs; realm role "admin"). */
export type ImportJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'INTERRUPTED';
export interface ImportJobResultDTO {
  propertyId: number;
  status: string;
  reason: string | null;
  imageId: number | null;
}
/** A failed or skipped record of a CSV or property ingestion job (first 1000). */
export interface IngestionJobItemDTO {
  /** CSV row as file:row, or the folio for API ingestion. */
  itemKey: string;
  status: 'FAILED' | 'SKIPPED' | string;
  reason: string | null;
  message: string | null;
}
export interface ImportJobDTO {
  /** The numeric backfill job ID as text, or the UUID of an ingestion job. Use it for detail and retry. */
  id: string;
  jobType: 'MAPILLARY_IMAGE_BACKFILL' | 'CSV_IMPORT' | 'PROPERTY_INGESTION' | string;
  /** What the job loads (e.g. ADDRESSES); null for Mapillary backfill jobs. */
  dataset: string | null;
  /** Numeric Mapillary backfill job ID; null for CSV and property ingestion jobs. */
  jobId: number | null;
  countyId: number | null;
  sourceCounty?: string | null;
  sourceState?: string | null;
  status: ImportJobStatus | string;
  total: number;
  processed: number;
  completed: number;
  skipped: number;
  failed: number;
  currentStep?: string | null;
  errorCode: string | null;
  errorMessage?: string | null;
  inputStorage?: string | null;
  attempt?: number | null;
  retryOfJobId?: string | null;
  /** Whether POST /admin/import-jobs/{id}/retry is expected to succeed. */
  retryable?: boolean | null;
  retryBlockedReason?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt: string | null;
  /** Mapillary backfill outcomes; only returned by the detail endpoint. */
  results?: ImportJobResultDTO[];
  /** Ingestion failures and skips; only returned by the detail endpoint. */
  items?: IngestionJobItemDTO[];
}
export interface ImportJobPageDTO {
  jobs: {
    content: ImportJobDTO[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
  untrackedJobTypes: string[];
  note: string | null;
}
export const ACTIVE_JOB_STATUSES = ['QUEUED', 'RUNNING'];

/** Single-file CSV datasets accepted by POST /ingestion/import/{dataset}. */
export type ImportUploadKind = 'file' | 'owners' | 'folder';
/** One upload from the import form: one CSV, the owners pair, or a county folder. */
export interface ImportUpload {
  kind: ImportUploadKind;
  dataset: string;
  county: string;
  state: string;
  files: File[];
}
export const CSV_DATASETS = [
  'properties',
  'addresses',
  'assessments',
  'buildings',
  'lands',
  'sales',
  'taxes',
  'extra-features',
  'parcels',
  'property-value-predictions',
  'property-images',
] as const;
/** Reason codes the retry endpoint answers 409 with, in plain words. */
export const RETRY_REASONS: Record<string, string> = {
  JOB_NOT_FINISHED: 'the job is still running.',
  JOB_COMPLETED: 'the job already completed.',
  RETRY_ALREADY_ACTIVE: 'a retry of this job is already running.',
  INPUT_ON_OTHER_INSTANCE: 'its input files are on another server instance.',
  INPUT_UNAVAILABLE: 'its input files are no longer available.',
  INPUT_CHANGED: 'its input files changed since the job ran.',
  DATASET_JOB_ACTIVE: 'another import of this dataset is running.',
  RETRY_NOT_SUPPORTED: 'image backfill jobs cannot be retried.',
};
