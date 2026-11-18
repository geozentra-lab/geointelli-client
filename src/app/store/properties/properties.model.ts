import { EntityState } from '@ngrx/entity';
import { Property } from '../../core/models/property';
import { Parcel } from '../../core/models/parcel';
import { PropertySearchItem } from '../../core/models/api';
import { MapLayerDTO } from '../../data-access/map-layer.service';
export interface PropertiesState extends EntityState<Property> {
  parcels: Parcel[];
  detail: Property | null;
  suggestions: string[];
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  detailError: string | null;
  searchFolio: string | null;
  /** Cards returned by the last address search (the backend caps them at 20); the first is shown on the map. */
  addressMatches: PropertySearchItem[];
  /** Neutral feedback for a search that succeeded but found nothing. */
  searchNotice: string | null;
  /** Supported map layers with source, coverage and freshness (GET /map/layers); null until read. */
  layers: MapLayerDTO[] | null;
}
