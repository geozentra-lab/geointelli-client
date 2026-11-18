export { geometryCentroid, parcelPoint } from '../../shared/data/parcel-geometry';
export type { LatLng, Placement } from '../../shared/data/parcel-geometry';
/** Short price label for a map pill: $950, $412K, $1.2M. */
export function compactPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  // 999,500 and up rounds to "1000K", so it reads better as "$1M".
  if (abs >= 999_500) {
    const m = value / 1_000_000;
    return '$' + (abs >= 10_000_000 ? Math.round(m) : trim(m.toFixed(1))) + 'M';
  }
  if (abs >= 1_000) return '$' + Math.round(value / 1_000) + 'K';
  return '$' + Math.round(value);
}
const trim = (s: string) => s.replace(/\.0$/, '');

export function metersToMiles(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters))
    return 'Distance unknown';
  const miles = meters / 1609.344;
  return (miles < 0.1 ? '< 0.1' : miles.toFixed(miles < 10 ? 1 : 0)) + ' mi';
}

export function pricePerSqft(price: number | null | undefined, sqft: number | null | undefined) {
  if (!price || !sqft || sqft <= 0) return null;
  return Math.round(price / sqft);
}
