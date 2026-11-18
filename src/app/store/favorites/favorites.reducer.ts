import { UserActions } from '../user/user.actions';
import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { FavoriteDTO } from '../../core/models/api';
import { favoritesActions as A } from './favorites.actions';
export const favoritesAdapter = createEntityAdapter<FavoriteDTO>({ selectId: (f) => f.propertyId });
const extra = {
  loading: false,
  loaded: false,
  error: null as string | null,
  pending: [] as number[],
  desired: {} as Record<number, boolean>,
  errors: {} as Record<number, string>,
  detailsPending: [] as number[],
  detailsErrors: {} as Record<number, string>,
  lastFailure: null as { propertyId: number; desired: boolean } | null,
};
const initial = favoritesAdapter.getInitialState<EntityState<FavoriteDTO> & typeof extra>(extra);
function omit<T>(values: Record<number, T>, id: number): Record<number, T> {
  const next = { ...values };
  delete next[id];
  return next;
}
export const favoritesReducer = createReducer(
  initial,
  on(A.load, UserActions.loaded, (s) => ({ ...s, loading: true, error: null })),
  on(A.loaded, (s, { items }) =>
    favoritesAdapter.setAll(
      items.filter((i) => i.favorite),
      { ...s, loading: false, loaded: true, error: null },
    ),
  ),
  on(A.add, A.remove, (s, { propertyId, type }) => ({
    ...s,
    loading: false,
    pending: [...new Set([...s.pending, propertyId])],
    desired: { ...s.desired, [propertyId]: type === A.add.type },
    errors: omit(s.errors, propertyId),
    error: null,
    lastFailure: null,
  })),
  on(A.saved, (s, { item }) => {
    const next = {
      ...s,
      loading: false,
      pending: s.pending.filter((id) => id !== item.propertyId),
      desired: omit(s.desired, item.propertyId),
      errors: omit(s.errors, item.propertyId),
    };
    return item.favorite
      ? favoritesAdapter.upsertOne(item, next)
      : favoritesAdapter.removeOne(item.propertyId, next);
  }),
  on(A.removed, (s, { propertyId }) =>
    favoritesAdapter.removeOne(propertyId, {
      ...s,
      loading: false,
      pending: s.pending.filter((id) => id !== propertyId),
      desired: omit(s.desired, propertyId),
      errors: omit(s.errors, propertyId),
    }),
  ),
  on(A.failed, (s, { error, propertyId }) => ({
    ...s,
    error,
    loading: false,
    pending: s.pending.filter((id) => id !== propertyId),
    desired: propertyId === undefined ? s.desired : omit(s.desired, propertyId),
    errors: propertyId === undefined ? s.errors : { ...s.errors, [propertyId]: error },
    lastFailure:
      propertyId === undefined
        ? null
        : { propertyId, desired: s.desired[propertyId] ?? !s.entities[propertyId] },
  })),
  on(A.loadProperty, (s, { propertyId }) => ({
    ...s,
    detailsPending: [...new Set([...s.detailsPending, propertyId])],
    detailsErrors: omit(s.detailsErrors, propertyId),
  })),
  on(A.propertyLoaded, (s, { propertyId }) => ({
    ...s,
    detailsPending: s.detailsPending.filter((id) => id !== propertyId),
    detailsErrors: omit(s.detailsErrors, propertyId),
  })),
  on(A.propertyFailed, (s, { propertyId, error }) => ({
    ...s,
    detailsPending: s.detailsPending.filter((id) => id !== propertyId),
    detailsErrors: { ...s.detailsErrors, [propertyId]: error },
  })),
);
