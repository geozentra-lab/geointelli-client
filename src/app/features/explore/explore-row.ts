import { PropertySearchItem } from '../../core/models/api';
import { formatFolio } from '../../shared/data/format';

/**
 * How a search row is named: its address, else its folio as the county prints it. Kept apart from
 * the map component so the Explore page can use it without pulling Leaflet into its own chunk
 * (the map is behind @defer).
 */
export const rowTitle = (r: PropertySearchItem) =>
  r.address || (formatFolio(r.folio) ? 'Folio ' + formatFolio(r.folio) : 'Address unavailable');
