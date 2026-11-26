import { createReducer, on } from '@ngrx/store';
import { Placement } from '../../shared/data/parcel-geometry';
import { ExploreMapActions as A } from './explore-map.actions';

export interface ExploreMapState {
  /** Where each looked-up property sits; null when its folio has no parcel boundary on record. */
  placements: Record<number, Placement | null>;
  /**
   * The page being placed: its properties still to look up. A new request replaces it, as the
   * effect replaces the lookups of the page before.
   */
  placing: number[];
  /** Properties whose lookup failed (network or server error); placing them again retries. */
  failed: number[];
}

const initial: ExploreMapState = { placements: {}, placing: [], failed: [] };

export const exploreMapReducer = createReducer(
  initial,
  on(A.placeProperties, (s, { targets }) => {
    const ids = [...new Set(targets.map((t) => t.propertyId))].filter(
      (id) => !(id in s.placements),
    );
    return {
      ...s,
      placing: ids,
      failed: s.failed.filter((id) => !ids.includes(id)),
    };
  }),
  on(A.placementFound, (s, { propertyId, placement }) => ({
    ...s,
    placements: { ...s.placements, [propertyId]: placement },
    placing: s.placing.filter((id) => id !== propertyId),
  })),
  on(A.placementFailed, (s, { propertyId }) => ({
    ...s,
    placing: s.placing.filter((id) => id !== propertyId),
    failed: s.failed.includes(propertyId) ? s.failed : [...s.failed, propertyId],
  })),
);
