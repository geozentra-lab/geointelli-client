import { EntityState } from '@ngrx/entity';
import {
  Page,
  PropertySearchItem,
  PropertySearchRequest,
  ComparableResponse,
  SchoolContextDTO,
  TransportContextDTO,
} from '../../core/models/api';
import { Property } from '../../core/models/property';
import { PropertyImage } from '../../core/models/property-image';
/** One typeahead's results; each picker on a page has its own key. */
export interface PropertyLookup {
  query: string;
  items: PropertySearchItem[];
  loading: boolean;
  error: string | null;
}
/**
 * address: the address search behind the map (cards, 404 when none match);
 * catalog: the property search filtered by address, used by the property pickers.
 */
export type LookupSource = 'address' | 'catalog';
export const MIN_LOOKUP_QUERY = 3;
/** Matches a property-picker lookup returns at most. */
export const LOOKUP_PAGE = 8;
export const IDLE_LOOKUP: PropertyLookup = { query: '', items: [], loading: false, error: null };
export interface PropertyEvidence {
  schools: SchoolContextDTO | null;
  transportation: TransportContextDTO | null;
  errors: string[];
}
export interface CatalogState extends EntityState<PropertySearchItem> {
  query: PropertySearchRequest;
  visibleIds: number[];
  page: Page<PropertySearchItem> | null;
  loading: boolean;
  error: string | null;
  selectedId: number | null;
  detail: Property | null;
  detailLoading: boolean;
  detailError: string | null;
  details: Record<number, Property>;
  photos: Record<number, PropertyImage[]>;
  photoErrors: Record<number, string>;
  /** Properties referenced by ID whose lookup failed (shown as unavailable with a retry). */
  unresolved: Record<number, true>;
  evidence: PropertyEvidence | null;
  evidenceLoading: boolean;
  lookups: Record<string, PropertyLookup>;
}
