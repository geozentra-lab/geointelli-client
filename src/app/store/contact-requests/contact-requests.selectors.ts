import { createFeatureSelector } from '@ngrx/store';
import { contactRequestsReducer } from './contact-requests.reducer';
export const selectContactRequests =
  createFeatureSelector<ReturnType<typeof contactRequestsReducer>>('contactRequests');
