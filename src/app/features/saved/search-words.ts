import { SavedSearchDTO } from '../../core/models/api';

type Filters = SavedSearchDTO['filters'];
const n = (v: number) => v.toLocaleString('en-US');

/** "3+ beds", "Up to 2 beds", "2 beds", "2 to 4 beds"; null when neither end is set. */
function range(min: number | undefined, max: number | undefined, unit: string, one = unit) {
  const has = (v: number | undefined): v is number => v !== undefined && v !== null;
  const word = (v: number) => (v === 1 ? one : unit);
  if (has(min) && has(max))
    return min === max ? `${n(min)} ${word(min)}` : `${n(min)} to ${n(max)} ${unit}`;
  if (has(min)) return `${n(min)}+ ${unit}`;
  if (has(max)) return `Up to ${n(max)} ${word(max)}`;
  return null;
}
function years(min: number | undefined, max: number | undefined) {
  const has = (v: number | undefined): v is number => v !== undefined && v !== null;
  if (has(min) && has(max)) return min === max ? `Built in ${min}` : `Built ${min} to ${max}`;
  if (has(min)) return `Built ${min} or later`;
  if (has(max)) return `Built ${max} or earlier`;
  return null;
}

/**
 * A saved search's filters in words, in the order a buyer reads them: place, type, size, age.
 * Only what the search sets; the county by name when the location lists hold it (its id is never
 * shown). An empty list means the search matches every property.
 */
export function searchWords(f: Filters, countyName?: string | null): string[] {
  // A county the location lists don't hold is still a filter: said in words when it is the only
  // place the search names, so a county-only search never reads as "every property".
  const county = countyName
    ? `${countyName} County`
    : f.countyId !== undefined && f.countyId !== null && !f.city && !f.zip && !f.state
      ? 'One county (its name isn’t loaded)'
      : null;
  const place = [county, f.city, f.zip ? `ZIP ${f.zip}` : null, f.state]
    .filter((x): x is string => !!x);
  const box = [f.minLat, f.maxLat, f.minLon, f.maxLon].some((v) => v !== undefined && v !== null);
  return [
    ...place,
    f.neighborhood ? `Neighbourhood: ${f.neighborhood}` : null,
    f.address ? `Address contains “${f.address}”` : null,
    box ? 'Within a map area' : null,
    f.propertyType ?? null,
    range(f.minBedrooms, f.maxBedrooms, 'beds', 'bed'),
    range(f.minBathrooms, f.maxBathrooms, 'baths', 'bath'),
    range(f.minLivingAreaSqft, f.maxLivingAreaSqft, 'sq ft'),
    range(f.minLotSize, f.maxLotSize, 'sq ft lot'),
    years(f.minYearBuilt, f.maxYearBuilt),
  ].filter((x): x is string => !!x);
}
