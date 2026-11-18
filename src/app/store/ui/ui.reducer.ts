import { createReducer, on } from '@ngrx/store';
import { Filters, ToastKind, UiActions } from './ui.actions';
export interface UiState {
  filters: Filters;
  radius: number;
  toast: string;
  toastKind: ToastKind;
}
export const uiReducer = createReducer<UiState>(
  {
    filters: { search: '', type: '', max: 0, beds: 0, sort: 'recommended', view: 'map' },
    radius: 5,
    toast: '',
    toastKind: 'info',
  },
  on(UiActions.setFilters, (s, { filters }) => ({ ...s, filters: { ...s.filters, ...filters } })),
  on(UiActions.setRadius, (s, { radius }) => ({ ...s, radius })),
  on(UiActions.toast, (s, { message, kind }) => ({
    ...s,
    toast: message,
    toastKind: kind ?? 'info',
  })),
  on(UiActions.clearToast, (s, { message }) => (s.toast === message ? { ...s, toast: '' } : s)),
);
