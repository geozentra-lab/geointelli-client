import { Property } from '../../core/models/property';
import { PropertySearchItem } from '../../core/models/api';
/** Physical characteristics only: this DTO has no listing price, rent or market-value field. */
export function propertySearchItem(p: Property): PropertySearchItem {
  return {
    id: p.id!,
    folio: p.folio,
    countyId: p.countyId,
    countyName: p.countyName ?? null,
    stateCode: p.stateCode ?? null,
    stateName: p.stateName ?? null,
    address: p.address?.address ?? null,
    city: p.address?.city ?? p.municipality ?? null,
    zip: p.address?.zip ?? null,
    dorCode: p.dorCode ?? null,
    propertyType: p.dorDescription ?? null,
    bedrooms: p.bedroomCount ?? null,
    bathrooms: p.bathroomCount ?? null,
    livingAreaSqft: p.buildingActualArea ?? null,
    lotSize: p.lotSize ?? null,
    yearBuilt: p.yearBuilt ?? null,
    neighborhood: p.neighborhood === null ? null : String(p.neighborhood),
    neighborhoodDescription: p.neighborhoodDescription ?? null,
  };
}
