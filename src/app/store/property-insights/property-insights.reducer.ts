import { createReducer, on } from '@ngrx/store';
import {
  ComparableCandidateResponse,
  ComparableRequest,
  ComparableResponse,
  Page,
} from '../../core/models/api';
import { PropertyExtraFeatures } from '../../core/models/extra_features';
import { Property } from '../../core/models/property';
import { ValuationHistoryEntry } from '../../core/models/property-valuation';
import { OpportunityScoreDTO } from '../../core/models/opportunity';
import { Placement } from '../../shared/data/parcel-geometry';
import { Remote, done, failed, idle, pending } from '../remote';
import { MapSubject, PropertyInsightsActions as A } from './property-insights.actions';
/** Evidence of the property page beyond the record itself, all for one property at a time. */
export interface PropertyInsightsState {
  propertyId: number | null;
  features: Remote<PropertyExtraFeatures>;
  featuresQuery: { history: boolean; page: number };
  units: Remote<Page<Partial<Property>>>;
  unitsPage: number;
  candidates: Remote<ComparableCandidateResponse>;
  candidatesQuery: ComparableRequest | null;
  history: Remote<Page<ValuationHistoryEntry>>;
  opportunity: Remote<OpportunityScoreDTO>;
  comparables: Remote<ComparableResponse>;
  mapSubject: MapSubject | null;
  /** Map point per comparable property ID; a missing entry could not be placed. */
  placements: Record<number, Placement>;
  subjectPlacement: Placement | null;
  /** Parcel lookups still running for the map pins. */
  placing: number;
}
const initial: PropertyInsightsState = {
  propertyId: null,
  features: idle(),
  featuresQuery: { history: false, page: 0 },
  units: idle(),
  unitsPage: 0,
  candidates: idle(),
  candidatesQuery: null,
  history: idle(),
  opportunity: idle(),
  comparables: idle(),
  mapSubject: null,
  placements: {},
  subjectPlacement: null,
  placing: 0,
};
/** Opening another property starts from nothing, so no section shows the previous home. */
const forProperty = (s: PropertyInsightsState, propertyId: number): PropertyInsightsState =>
  s.propertyId === propertyId ? s : { ...initial, propertyId };
/** Applies an answer only while it still belongs to the property in view. */
const current =
  <P extends { propertyId: number }>(
    apply: (s: PropertyInsightsState, payload: P) => PropertyInsightsState,
  ) =>
  (s: PropertyInsightsState, payload: P) =>
    payload.propertyId === s.propertyId ? apply(s, payload) : s;
export const propertyInsightsReducer = createReducer<PropertyInsightsState>(
  initial,
  on(A.loadFeatures, (s, { propertyId, history, page }) => {
    const n = forProperty(s, propertyId);
    // The next page keeps the current one on screen; switching current/history does not.
    const keep = n.featuresQuery.history === history;
    return { ...n, featuresQuery: { history, page }, features: pending(n.features, keep) };
  }),
  on(
    A.featuresLoaded,
    current((s, { features }) => ({ ...s, features: done(features) })),
  ),
  on(A.loadUnits, (s, { propertyId, page }) => {
    const n = forProperty(s, propertyId);
    return { ...n, unitsPage: page, units: pending(n.units) };
  }),
  on(
    A.unitsLoaded,
    current((s, { page }) => ({ ...s, units: done(page) })),
  ),
  on(A.loadCandidates, (s, { propertyId, query }) => {
    const n = forProperty(s, propertyId);
    return { ...n, candidatesQuery: query, candidates: pending(n.candidates, false) };
  }),
  on(
    A.candidatesLoaded,
    current((s, { response }) => ({ ...s, candidates: done(response) })),
  ),
  on(A.loadHistory, (s, { propertyId }) => {
    const n = forProperty(s, propertyId);
    return { ...n, history: pending(n.history) };
  }),
  on(
    A.historyLoaded,
    current((s, { page }) => ({ ...s, history: done(page) })),
  ),
  on(A.loadOpportunity, (s, { propertyId }) => {
    const n = forProperty(s, propertyId);
    return { ...n, opportunity: pending(n.opportunity) };
  }),
  on(
    A.opportunityLoaded,
    current((s, { score }) => ({ ...s, opportunity: done(score) })),
  ),
  on(A.loadComparablesMap, (s, { propertyId, subject }) => ({
    ...forProperty(s, propertyId),
    comparables: pending(idle<ComparableResponse>(), false),
    mapSubject: subject,
    placements: {},
    subjectPlacement: null,
    placing: 0,
  })),
  on(
    A.comparablesMapLoaded,
    current((s, { response }) => ({
      ...s,
      comparables: done(response),
      placing: response.comparables.length + (s.mapSubject ? 1 : 0),
    })),
  ),
  on(
    A.placementFound,
    current((s, { key, placement }) => ({
      ...s,
      placing: Math.max(0, s.placing - 1),
      ...(placement
        ? key === 'subject'
          ? { subjectPlacement: placement }
          : { placements: { ...s.placements, [key]: placement } }
        : {}),
    })),
  ),
  on(
    A.failed,
    current((s, { section, error }) => {
      if (section === 'comparables')
        return { ...s, comparables: failed(s.comparables, error), placing: 0 };
      return { ...s, [section]: failed(s[section], error) };
    }),
  ),
);
