import { UserActions } from '../user/user.actions';
import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Page, PropertySearchItem, SavedSearchDTO } from '../../core/models/api';
import { Remote, done, failed, idle, pending } from '../remote';
import { savedSearchesActions as A } from './saved-searches.actions';
export const savedSearchesAdapter = createEntityAdapter<SavedSearchDTO>();
const extra = {
  loading: false,
  saving: 0,
  error: null as string | null,
  errorOperation: null as 'load' | 'save' | null,
  page: 0,
  totalElements: 0,
  totalPages: 0,
  options: idle<SavedSearchDTO[]>(),
  previewId: null as number | null,
  preview: idle<Page<PropertySearchItem>>(),
};
const initial = savedSearchesAdapter.getInitialState<EntityState<SavedSearchDTO> & typeof extra>(
  extra,
);
export const savedSearchesReducer = createReducer<typeof initial>(
  initial,
  on(UserActions.loaded, (s) => ({ ...s, loading: true, error: null })),
  on(A.load, (s: typeof initial, { page }) => ({ ...s, page, loading: true, error: null })),
  on(A.loaded, (s: typeof initial, { page }) =>
    savedSearchesAdapter.setAll(page.content, {
      ...s,
      page: page.page,
      totalElements: page.totalElements,
      totalPages: page.totalPages,
      loading: false,
    }),
  ),
  on(A.create, A.update, A.remove, (s: typeof initial) => ({
    ...s,
    saving: s.saving + 1,
    error: null,
  })),
  on(A.saved, (s: typeof initial, { item }) =>
    savedSearchesAdapter.upsertOne(item, {
      ...s,
      saving: Math.max(0, s.saving - 1),
      totalElements: s.totalElements + (s.entities[item.id] ? 0 : 1),
    }),
  ),
  on(A.removed, (s: typeof initial, { id }) =>
    savedSearchesAdapter.removeOne(id, {
      ...s,
      saving: Math.max(0, s.saving - 1),
      totalElements: Math.max(0, s.totalElements - 1),
    }),
  ),
  on(A.loadOptions, (s: typeof initial) => ({ ...s, options: pending(s.options) })),
  on(A.optionsLoaded, (s: typeof initial, { items }) => ({ ...s, options: done(items) })),
  on(A.optionsFailed, (s: typeof initial, { error }) => ({
    ...s,
    options: failed(s.options, error),
  })),
  // Another search's matches are cleared at once, so they never show under the wrong name.
  on(A.loadPreview, (s: typeof initial, { id }) => ({
    ...s,
    previewId: id,
    preview: pending(s.preview, id === s.previewId),
  })),
  on(A.previewLoaded, (s: typeof initial, { id, page }) =>
    id === s.previewId ? { ...s, preview: done(page) } : s,
  ),
  on(A.previewFailed, (s: typeof initial, { id, error }) =>
    id === s.previewId ? { ...s, preview: failed(s.preview, error) } : s,
  ),
  on(A.closePreview, (s: typeof initial) => ({ ...s, previewId: null, preview: idle() })),
  // A saved or deleted search changes the picker list; it reloads the next time it is needed.
  on(A.saved, A.removed, (s: typeof initial) => ({ ...s, options: idle() })),
  on(A.failed, (s: typeof initial, { error, operation }) => ({
    ...s,
    error,
    errorOperation: operation,
    loading: operation === 'load' ? false : s.loading,
    saving: operation === 'save' ? Math.max(0, s.saving - 1) : s.saving,
  })),
);
