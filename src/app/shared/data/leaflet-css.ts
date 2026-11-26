/**
 * Leaflet's stylesheet, followed by the map look in src/map.css, is built as its own file,
 * `leaflet.css` (angular.json: bundleName "leaflet", inject false), so it is not part of the global
 * styles every page downloads. Each map host calls this when it is created; the first call adds the
 * stylesheet, later calls do nothing. Without it, tiles and panes lose their positioning.
 */
export const LEAFLET_CSS = 'leaflet.css';

export function loadLeafletCss(doc: Document | null = typeof document === 'undefined' ? null : document) {
  if (!doc || doc.querySelector('link[data-leaflet-css]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  // Relative to <base href>, where the build writes the file.
  link.href = LEAFLET_CSS;
  link.setAttribute('data-leaflet-css', '');
  // First in <head>, where it sat as a global style: component styles that override Leaflet with
  // equal specificity (the comparables map's zoom buttons) must still come after it.
  doc.head.prepend(link);
}
