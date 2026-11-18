import { createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { PropertySearchItem } from '../../core/models/api';
import { CatalogState, IDLE_LOOKUP, MIN_LOOKUP_QUERY } from './catalog.model';
import { CatalogActions as A } from './catalog.actions';
import { propertySearchItem } from '../../shared/data/property-adapter';
export const catalogAdapter = createEntityAdapter<PropertySearchItem>();
const initial = catalogAdapter.getInitialState<CatalogState>({
  query: { page: 0, size: 20, sortBy: 'id', direction: 'asc' },
  visibleIds: [],
  page: null,
  loading: false,
  error: null,
  selectedId: null,
  detail: null,
  detailLoading: false,
  detailError: null,
  details: {},
  photos: {},
  photoErrors: {},
  unresolved: {},
  evidence: null,
  evidenceLoading: false,
  lookups: {},
});
export const catalogReducer = createReducer(
  initial,
  on(A.search, (s, { query }) => ({ ...s, query, loading: true, error: null })),
  on(A.loaded, (s, { page }) =>
    catalogAdapter.upsertMany(page.content, {
      ...s,
      page,
      visibleIds: page.content.map((p) => p.id),
      loading: false,
    }),
  ),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
  on(A.loadDetail, (s, { id }) => ({
    ...s,
    selectedId: id,
    detail: null,
    detailLoading: true,
    detailError: null,
    evidence: null,
    evidenceLoading: true,
  })),
  on(A.detailLoaded, (s, { property }) =>
    catalogAdapter.upsertOne(propertySearchItem(property), {
      ...s,
      details: { ...s.details, [property.id!]: property },
      detail: property,
      detailLoading: false,
    }),
  ),
  on(A.detailFailed, (s, { error }) => ({
    ...s,
    detailError: error,
    detailLoading: false,
    evidenceLoading: false,
  })),
  on(A.cacheProperty, (s, { property }) =>
    catalogAdapter.upsertOne(propertySearchItem(property), {
      ...s,
      details: { ...s.details, [property.id!]: property },
    }),
  ),
  on(A.cacheItems, (s, { items }) => catalogAdapter.upsertMany(items, s)),
  // A query too short to send clears the list; a longer one keeps the last list while it loads.
  on(A.lookup, (s, { key, query }) => {
    const q = query.trim();
    const prev = s.lookups[key] ?? IDLE_LOOKUP;
    const next =
      q.length < MIN_LOOKUP_QUERY
        ? { ...IDLE_LOOKUP, query: q }
        : { ...prev, query: q, loading: true, error: null };
    return { ...s, lookups: { ...s.lookups, [key]: next } };
  }),
  on(A.lookupLoaded, (s, { key, query, items }) =>
    s.lookups[key]?.query === query
      ? { ...s, lookups: { ...s.lookups, [key]: { query, items, loading: false, error: null } } }
      : s,
  ),
  on(A.lookupFailed, (s, { key, query, error }) =>
    s.lookups[key]?.query === query
      ? { ...s, lookups: { ...s.lookups, [key]: { query, items: [], loading: false, error } } }
      : s,
  ),
  on(A.lookupClosed, (s, { key }) => {
    if (!s.lookups[key]) return s;
    const { [key]: _, ...lookups } = s.lookups;
    return { ...s, lookups };
  }),
  on(A.resolveProperty, (s, { id }) => {
    if (!s.unresolved[id]) return s;
    const { [id]: _, ...unresolved } = s.unresolved;
    return { ...s, unresolved };
  }),
  on(A.resolveFailed, (s, { id }) => ({ ...s, unresolved: { ...s.unresolved, [id]: true } })),
  on(A.photoLoaded, (s, { id, images, error }) => ({
    ...s,
    photos: { ...s.photos, [id]: images },
    photoErrors: { ...s.photoErrors, [id]: error ?? '' },
  })),
  on(A.evidenceLoaded, (s, { id, evidence }) =>
    s.selectedId === id ? { ...s, evidence, evidenceLoading: false } : s,
  ),
);
