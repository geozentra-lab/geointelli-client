import { createActionGroup, props } from '@ngrx/store';
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
export type InsightSection =
  | 'features'
  | 'units'
  | 'candidates'
  | 'history'
  | 'opportunity'
  | 'comparables';
/** The home itself, placed on the comparables map next to its comparable sales. */
export interface MapSubject {
  folio: string;
  countyId: number;
  address: string | null;
}
/**
 * Every action names its property: answers for a property the page has moved away from are
 * dropped by the reducer, so one home's evidence never shows under another.
 */
export const PropertyInsightsActions = createActionGroup({
  source: 'Property insights API',
  events: {
    'Load features': props<{ propertyId: number; history: boolean; page: number }>(),
    'Features loaded': props<{ propertyId: number; features: PropertyExtraFeatures }>(),
    'Load units': props<{ propertyId: number; page: number }>(),
    'Units loaded': props<{ propertyId: number; page: Page<Partial<Property>> }>(),
    'Load candidates': props<{ propertyId: number; query: ComparableRequest }>(),
    'Candidates loaded': props<{ propertyId: number; response: ComparableCandidateResponse }>(),
    'Load history': props<{ propertyId: number; page: number }>(),
    'History loaded': props<{ propertyId: number; page: Page<ValuationHistoryEntry> }>(),
    'Load opportunity': props<{ propertyId: number }>(),
    'Opportunity loaded': props<{ propertyId: number; score: OpportunityScoreDTO }>(),
    'Load comparables map': props<{ propertyId: number; subject: MapSubject | null }>(),
    'Comparables map loaded': props<{ propertyId: number; response: ComparableResponse }>(),
    /** One parcel looked up for a pin: the home ('subject') or a comparable's property ID. */
    'Placement found': props<{
      propertyId: number;
      key: number | 'subject';
      placement: Placement | null;
    }>(),
    Failed: props<{ propertyId: number; section: InsightSection; error: string }>(),
  },
});
