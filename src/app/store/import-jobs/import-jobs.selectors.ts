import { createFeatureSelector } from '@ngrx/store';
import { importJobsReducer } from './import-jobs.reducer';
export const selectImportJobs =
  createFeatureSelector<ReturnType<typeof importJobsReducer>>('importJobs');
