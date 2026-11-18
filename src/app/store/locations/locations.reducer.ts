import { createReducer, on } from '@ngrx/store';
import { LocationsState } from './locations.model';
import { LocationsActions as A } from './locations.actions';
export const locationsReducer = createReducer<LocationsState>(
  {
    states: [],
    counties: [],
    stateId: null,
    countyId: null,
    loading: false,
    error: null,
    countiesByState: {},
  },
  on(A.loadStates, (s) => ({ ...s, loading: true, error: null })),
  on(A.statesLoaded, (s, { states }) => ({ ...s, states, loading: false })),
  on(A.selectState, (s, { stateId }) => ({
    ...s,
    stateId,
    countyId: null,
    counties: [],
    loading: stateId !== null,
    error: null,
  })),
  // The shared picker's counties also fill the per-state cache, and the other way round.
  on(A.countiesLoaded, (s, { counties }) => ({
    ...s,
    counties,
    loading: false,
    countiesByState:
      s.stateId === null
        ? s.countiesByState
        : { ...s.countiesByState, [s.stateId]: { counties, loading: false, error: null } },
  })),
  on(A.loadCountiesFor, (s, { stateId }) => ({
    ...s,
    countiesByState: {
      ...s.countiesByState,
      [stateId]: {
        counties: s.countiesByState[stateId]?.counties ?? [],
        loading: true,
        error: null,
      },
    },
  })),
  on(A.countiesForLoaded, (s, { stateId, counties }) => ({
    ...s,
    countiesByState: { ...s.countiesByState, [stateId]: { counties, loading: false, error: null } },
  })),
  on(A.countiesForFailed, (s, { stateId, error }) => ({
    ...s,
    countiesByState: { ...s.countiesByState, [stateId]: { counties: [], loading: false, error } },
  })),
  on(A.selectCounty, (s, { countyId }) => ({ ...s, countyId })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
);
