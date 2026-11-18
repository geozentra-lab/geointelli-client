import { createActionGroup, props } from '@ngrx/store';
import { Page, PropertySearchItem, PropertySearchRequest } from '../../core/models/api';
import { Property } from '../../core/models/property';
import { PropertyImage } from '../../core/models/property-image';
import { LookupSource, PropertyEvidence } from './catalog.model';
export const CatalogActions = createActionGroup({
  source: 'Property catalog API',
  events: {
    Search: props<{ query: PropertySearchRequest }>(),
    Loaded: props<{ page: Page<PropertySearchItem> }>(),
    Failed: props<{ error: string }>(),
    'Load detail': props<{ id: number }>(),
    'Detail loaded': props<{ property: Property }>(),
    'Detail failed': props<{ error: string }>(),
    'Cache property': props<{ property: Property }>(),
    'Cache items': props<{ items: PropertySearchItem[] }>(),
    /** Fetches a property that is referenced by ID only (CRM, holdings) so its address can show. */
    'Resolve property': props<{ id: number }>(),
    'Resolve failed': props<{ id: number }>(),
    'Photo loaded': props<{ id: number; images: PropertyImage[]; error?: string }>(),
    'Evidence loaded': props<{ id: number; evidence: PropertyEvidence }>(),
    /** A typeahead's query changed; the newest query of a key cancels its older one. */
    Lookup: props<{ key: string; source: LookupSource; query: string; immediate?: boolean }>(),
    'Lookup loaded': props<{ key: string; query: string; items: PropertySearchItem[] }>(),
    'Lookup failed': props<{ key: string; query: string; error: string }>(),
    /** The typeahead left the page: its results are dropped and its request cancelled. */
    'Lookup closed': props<{ key: string }>(),
  },
});
