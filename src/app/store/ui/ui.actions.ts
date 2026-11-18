import { createActionGroup, props } from '@ngrx/store';
export interface Filters {
  search: string;
  type: string;
  max: number;
  beds: number;
  sort: string;
  view: 'map' | 'grid';
}
export type ToastKind = 'info' | 'error';
export const UiActions = createActionGroup({
  source: 'UI',
  events: {
    'Set filters': props<{ filters: Partial<Filters> }>(),
    'Set radius': props<{ radius: number }>(),
    /** `error` toasts are announced assertively by screen readers; everything else waits its turn. */
    Toast: props<{ message: string; kind?: ToastKind }>(),
    'Clear toast': props<{ message: string }>(),
  },
});
