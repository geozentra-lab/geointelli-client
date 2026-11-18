import { MultiPolygonGeoJSON, Parcel } from '../../core/models/parcel';

/** Latitude/longitude pair for Leaflet. */
export type LatLng = [number, number];

/** Where a parcel sits on a map: its marker point and outline. */
export interface Placement {
  point: LatLng;
  geom: MultiPolygonGeoJSON;
}

/** Signed area and centroid of a ring of [lon, lat] points (shoelace formula). */
function ringCentroid(ring: number[][]): { area: number; point: LatLng } | null {
  if (ring.length < 3) return null;
  let area = 0,
    cx = 0,
    cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j],
      [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (area === 0) {
    // Degenerate ring (all points on a line): fall back to the vertex average.
    const n = ring.length;
    const lon = ring.reduce((s, p) => s + p[0], 0) / n,
      lat = ring.reduce((s, p) => s + p[1], 0) / n;
    return { area: 0, point: [lat, lon] };
  }
  area /= 2;
  return { area: Math.abs(area), point: [cy / (6 * area), cx / (6 * area)] };
}

/** Marker point for a parcel: the centroid of its largest polygon's outer ring. */
export function geometryCentroid(geom: MultiPolygonGeoJSON | null | undefined): LatLng | null {
  let best: { area: number; point: LatLng } | null = null;
  for (const polygon of geom?.coordinates ?? []) {
    const c = polygon?.[0] ? ringCentroid(polygon[0]) : null;
    if (c && (!best || c.area > best.area)) best = c;
  }
  if (!best) return null;
  const [lat, lon] = best.point;
  return Number.isFinite(lat) && Number.isFinite(lon) ? best.point : null;
}

/** First parcel with usable geometry from a /parcels/byfolio response. */
export function parcelPoint(parcels: Parcel[] | Parcel | null | undefined) {
  const list = (Array.isArray(parcels) ? parcels : [parcels]).filter(Boolean) as Parcel[];
  for (const parcel of list) {
    const point = geometryCentroid(parcel.geom);
    if (point) return { point, geom: parcel.geom };
  }
  return null;
}
