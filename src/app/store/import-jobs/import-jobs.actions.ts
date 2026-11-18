import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ImportJobDTO, ImportJobPageDTO, ImportUpload } from '../../core/models/import-job';
export const ImportJobsActions = createActionGroup({
  source: 'Admin import jobs API',
  events: {
    Load: props<{ page: number; silent?: boolean }>(),
    Loaded: props<{ page: ImportJobPageDTO }>(),
    Failed: props<{ error: string }>(),
    'Open job': props<{ id: string; silent?: boolean }>(),
    'Job loaded': props<{ job: ImportJobDTO }>(),
    'Job failed': props<{ error: string }>(),
    'Close job': emptyProps(),
    Retry: props<{ id: string }>(),
    Retried: props<{ job: ImportJobDTO }>(),
    'Retry failed': props<{ id: string; error: string }>(),
    /** A job queued from the upload form; the list reloads and the job opens. */
    Queued: props<{ job: ImportJobDTO }>(),
    Upload: props<{ upload: ImportUpload }>(),
    'Upload failed': props<{ error: string }>(),
  },
});
