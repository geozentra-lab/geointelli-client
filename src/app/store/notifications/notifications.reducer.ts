import { createReducer, on } from '@ngrx/store';
import { NotificationsActions as A } from './notifications.actions';
import { NotificationsState } from './notifications.model';
export const notificationsReducer = createReducer<NotificationsState>(
  { items: [], loading: false, loaded: false, error: null, pending: [], readError: null },
  on(A.load, (s) => ({ ...s, loading: true, error: null })),
  on(A.loaded, (s, { page }) => ({
    ...s,
    items: page.content.slice(0, 5),
    loading: false,
    loaded: true,
    error: null,
  })),
  on(A.failed, (s, { error }) => ({ ...s, loading: false, error })),
  on(A.markRead, (s, { id }) => ({
    ...s,
    loading: false,
    pending: [...new Set([...s.pending, id])],
    readError: null,
  })),
  on(A.readSaved, (s, { item }) => ({
    ...s,
    loading: false,
    items: s.items.map((n) => (n.id === item.id ? item : n)),
    pending: s.pending.filter((id) => id !== item.id),
    readError: null,
  })),
  on(A.readFailed, (s, { id, error }) => ({
    ...s,
    pending: s.pending.filter((x) => x !== id),
    readError: error,
  })),
);
