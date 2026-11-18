import { createEntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Property } from '../../core/models/property';
import { PropertiesState } from './properties.model';
import { PropertiesActions as A } from './properties.actions';
export const propertiesAdapter = createEntityAdapter<Property>({
  selectId: (p) => `${p.countyId}:${p.folio}`,
});
const initial = propertiesAdapter.getInitialState<PropertiesState>({
  parcels: [],
  detail: null,
  suggestions: [],
  loading: false,
  detailLoading: false,
  error: null,
  detailError: null,
  searchFolio: null,
  addressMatches: [],
  searchNotice: null,
  layers: null,
});
export const propertiesReducer = createReducer(
  initial,
  on(A.layersLoaded, (s, { layers }) => ({ ...s, layers })),
  on(A.loadParcels, (s) => ({ ...s, loading: true, error: null })),
  on(A.search, (s) => ({
    ...s,
    loading: true,
    error: null,
    searchNotice: null,
    addressMatches: [],
  })),
  // With matches the boundary request is still running, so loading stays on until it answers.
  on(A.addressMatched, (s, { matches }) => ({
    ...s,
    addressMatches: matches,
    loading: matches.length > 0,
    // A card picked from the typeahead arrives without a prior Search; drop any earlier error.
    error: matches.length ? null : s.error,
    parcels: matches.length ? s.parcels : [],
    searchFolio: matches.length ? s.searchFolio : null,
    searchNotice: matches.length
      ? null
      : 'No property was found at that address. Check the spelling or pick a suggestion.',
  })),
  on(A.folioNotFound, (s, { folio }) => ({
    ...s,
    parcels: [],
    searchFolio: null,
    loading: false,
    searchNotice: 'No parcel was found for folio ' + folio + '. Check the number and county.',
  })),
  on(A.chooseMatch, (s) => ({ ...s, loading: true, error: null, searchNotice: null })),
  on(A.matchBoundaryMissing, (s, { match }) => ({
    ...s,
    parcels: [],
    searchFolio: null,
    loading: false,
    searchNotice:
      'No parcel boundary is on record for ' +
      (match.address || 'folio ' + match.folio) +
      ', so it cannot be drawn on the map.',
  })),
  on(A.parcelsLoaded, (s, { parcels, folio }) => ({
    ...s,
    parcels,
    searchFolio: folio,
    loading: false,
  })),
  on(A.failed, (s, { error }) => ({ ...s, error, loading: false })),
  on(A.clearParcels, (s) => ({
    ...s,
    parcels: [],
    searchFolio: null,
    loading: false,
    addressMatches: [],
    searchNotice: null,
  })),
  on(A.loadDetail, (s) => ({ ...s, detail: null, detailLoading: true, detailError: null })),
  on(A.detailLoaded, (s, { property }) =>
    propertiesAdapter.upsertOne(property, { ...s, detail: property, detailLoading: false }),
  ),
  on(A.detailFailed, (s, { error }) => ({ ...s, detailError: error, detailLoading: false })),
  on(A.suggested, (s, { suggestions }) => ({ ...s, suggestions })),
);
