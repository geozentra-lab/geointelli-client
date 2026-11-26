import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import L from 'leaflet';
import { Store } from '@ngrx/store';
import { PropertySearchItem } from '../../core/models/api';
import { PredictionMap } from '../../core/models/property_prediction_value';
import { ExploreMapActions } from '../../store/explore-map/explore-map.actions';
import { selectExploreMap } from '../../store/explore-map/explore-map.selectors';
import { LatLng, Placement } from '../../shared/data/parcel-geometry';
import { joinParts } from '../../shared/data/format';
import { loadLeafletCss } from '../../shared/data/leaflet-css';
import { compactPrice } from '../property-detail/comparables-map.util';
import { rowTitle } from './explore-row';

/** The whole country, before a state is chosen. */
const START = { center: [39.5, -98.35] as LatLng, zoom: 4 };
/** Picking a property zooms in until its parcel boundary is plain to see. */
const PICK_MAX_ZOOM = 18;
/** Fitting a page of results stops here, so a single result isn't shown at rooftop zoom. */
const FIT_MAX_ZOOM = 16;
/** Outlines of the page's parcels appear from this zoom. */
const OUTLINE_ZOOM = 15;

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Explore's map (DESIGN.md §5, §10). Every result on the page is looked up by folio (the
 * exploreMap slice) and shown as a pill with its ZentraValue, or a hatched dot when it has none.
 * A page's results are fitted into view once they are placed. Picking one, from its card or its
 * pill, zooms to its parcel and draws the boundary in copper. The cards are the way through the
 * results for keyboard and screen-reader users; the map takes the arrow keys and plus and minus,
 * as Leaflet does, and its pills are not tab stops.
 */
@Component({
  selector: 'gz-explore-map',
  template: `
    <div class="em-map" #mapEl role="region" aria-label="Map"></div>
    @if (rows().length && placedCount()) {
      <button type="button" class="btn small em-all" (click)="fitAll()">Show all on this page</button>
    }
    <div class="em-legend">
      @if (!rows().length) {
        <p class="em-first">{{ prompt() }}</p>
      } @else {
        <div class="em-keys" aria-hidden="true">
          <span><i class="key pill">$985K</i>ZentraValue</span>
          <span><i class="key dot"></i>No ZentraValue</span>
          <span><i class="key sel"></i>Selected</span>
        </div>
        <p role="status">
          @if (placing()) {
            Placing properties on the map…
          } @else if (placedCount() === rows().length) {
            {{
              rows().length === 1
                ? 'The property on this page is on the map.'
                : 'All ' + rows().length + ' properties on this page are on the map.'
            }}
          } @else {
            {{ placedCount() }} of {{ rows().length }}
            {{ rows().length === 1 ? 'property' : 'properties' }} on this page
            {{ placedCount() === 1 ? 'is' : 'are' }} on the map.
          }
        </p>
        @if (valuesStatus() === 'error') {
          <p>ZentraValues could not load, so the pins show no values.</p>
        }
        @if (unplaced().length) {
          <p>Not on the map: {{ unplaced().join('; ') }}. No parcel boundary is on record.</p>
        }
        @if (failedCount()) {
          <p class="em-error" role="alert">
            {{ failedCount() }} {{ failedCount() === 1 ? 'property' : 'properties' }} could not be
            placed.
            <button type="button" class="btn small" (click)="retry()">Retry</button>
          </p>
        }
      }
    </div>
  `,
  styles: `
    /* Leaflet's panes and controls use z-index 400-1000: keep them inside the map, under the
       shell's bars, menus, sheet and toasts. */
    :host {
      position: relative;
      display: block;
      height: 100%;
      isolation: isolate;
    }
    .em-map {
      position: absolute;
      inset: 0;
      background: var(--paper);
    }
    .em-all {
      position: absolute;
      top: var(--sp-12);
      left: var(--sp-12);
      z-index: 500;
    }
    .em-legend {
      position: absolute;
      left: var(--sp-12);
      bottom: 26px;
      z-index: 500;
      max-width: min(400px, calc(100% - 24px));
      padding: 10px 12px;
      background: var(--surface);
      border: 1px solid var(--rule-strong);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .em-legend p {
      margin: 6px 0 0;
    }
    .em-legend .em-first {
      margin: 0;
      font-size: var(--fs-cell);
      color: var(--ink);
    }
    .em-keys {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      color: var(--ink);
    }
    .em-keys span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .key {
      display: inline-block;
      font-style: normal;
    }
    .key.pill {
      padding: 0 5px;
      border: 1px solid var(--ink);
      border-radius: 9px;
      background: var(--surface);
      font-size: 11px;
      line-height: 14px;
    }
    .key.dot {
      width: 11px;
      height: 11px;
      border-radius: var(--radius-round);
      border: 1.5px solid var(--ink);
      background: repeating-linear-gradient(135deg, var(--ink) 0 1px, var(--surface) 1px 3.5px);
    }
    .key.sel {
      width: 14px;
      height: 10px;
      border: 2px solid var(--copper);
      background: var(--copper-tint);
    }
    .em-error {
      color: var(--ink);
    }
    .em-error .btn {
      margin-left: 6px;
    }
  `,
})
export class ExploreMap {
  /** The results on screen, in card order. */
  readonly rows = input.required<PropertySearchItem[]>();
  /** ZentraValues for the page (POST /predictions/bulk), keyed by property ID. */
  readonly values = input<PredictionMap>({});
  /**
   * Whether the values have arrived: a pin is only drawn as "No ZentraValue" (the hatch) once they
   * have, never while they load or after they failed to load.
   */
  readonly valuesStatus = input<'loading' | 'error' | 'ready'>('ready');
  readonly selected = input<number | null>(null);
  /** The card under the pointer: its pill is raised. */
  readonly hovered = input<number | null>(null);
  /** A card was picked again: zoom to it once more. */
  readonly reveal = input<{ id: number } | null>(null);
  /** What the map says before there are results (no state chosen yet, or nothing matched). */
  readonly prompt = input('Choose a state to see its properties on the map.');
  /** A pill was clicked: select that property. */
  readonly picked = output<number>();

  private readonly store = inject(Store);
  private readonly slice = this.store.selectSignal(selectExploreMap);
  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('mapEl');
  private readonly destroyRef = inject(DestroyRef);
  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly ready = signal(false);
  private readonly zoom = signal(START.zoom);
  private map: L.Map | null = null;
  private outlines: L.LayerGroup | null = null;
  private pins: L.LayerGroup | null = null;
  private readonly markers = new Map<number, L.Marker>();
  /** The page of results last fitted into view, so a page is fitted once, not on every update. */
  private fittedKey = '';
  /** The selection the map last zoomed to. */
  private shownId: number | null = null;
  /** A fit or a zoom was due while the map was hidden (List chosen); it runs when the map shows. */
  private viewDue = false;
  /**
   * The results, unchanged while the same properties are listed: the catalog hands out a new array
   * whenever anything in it changes (photos arriving), which must not redraw every pin.
   */
  private readonly results = computed(() => this.rows(), {
    equal: (a, b) => a.length === b.length && a.every((r, i) => r.id === b[i].id),
  });

  readonly placing = computed(() => {
    const placing = this.slice().placing;
    return this.rows().some((r) => placing.includes(r.id));
  });
  readonly placedCount = computed(
    () => this.rows().filter((r) => this.slice().placements[r.id]).length,
  );
  /** Looked up and found to have no boundary on record (not merely not yet placed). */
  readonly unplaced = computed(() =>
    this.rows()
      .filter((r) => r.id in this.slice().placements && this.slice().placements[r.id] === null)
      .map(rowTitle),
  );
  readonly failedCount = computed(
    () => this.rows().filter((r) => this.slice().failed.includes(r.id)).length,
  );
  private readonly selectedPlace = computed(() => {
    const id = this.selected();
    return id === null ? null : (this.slice().placements[id] ?? null);
  });

  constructor() {
    loadLeafletCss();
    afterNextRender(() => this.createMap());

    // Pills for the page's placed results, redrawn when results, values or the selection change.
    effect(() => {
      const ready = this.ready();
      const rows = this.results();
      const placements = this.slice().placements;
      const values = this.values();
      const status = this.valuesStatus();
      const selected = this.selected();
      if (ready) untracked(() => this.drawPins(rows, placements, values, status, selected));
    });
    effect(() => {
      const ready = this.ready();
      const rows = this.results();
      const placements = this.slice().placements;
      const zoom = this.zoom();
      const selected = this.selected();
      if (ready) untracked(() => this.drawOutlines(rows, placements, zoom, selected));
    });
    // The card under the pointer raises its pill.
    effect(() => {
      const hovered = this.hovered();
      this.ready();
      untracked(() =>
        this.markers.forEach((m, id) =>
          m.getElement()?.querySelector('.xm-pin')?.classList.toggle('hov', id === hovered),
        ),
      );
    });
    // A new page of results is fitted into view once all of it has been looked up, unless a
    // picked property already has the map's attention.
    effect(() => {
      const ready = this.ready();
      const rows = this.results();
      const placing = this.placing();
      if (!ready || placing || !rows.length) return;
      const key = rows.map((r) => r.id).join(',');
      if (key === this.fittedKey) return;
      untracked(() => {
        if (this.selectedPlace()) return;
        if (!this.visible()) this.viewDue = true;
        else if (this.fitAll()) this.fittedKey = key;
      });
    });
    // Picking a property zooms to its parcel, as soon as its place is known.
    effect(() => {
      const ready = this.ready();
      const id = this.selected();
      const place = this.selectedPlace();
      if (id === null) {
        this.shownId = null;
        return;
      }
      if (!ready || !place || id === this.shownId) return;
      this.shownId = id;
      untracked(() => {
        if (this.visible()) this.zoomTo(place);
        else this.viewDue = true;
      });
    });
    // The same card picked again: zoom to it once more (the user may have moved the map).
    effect(() => {
      const again = this.reveal();
      if (!again) return;
      untracked(() => {
        const place = this.slice().placements[again.id];
        if (place && again.id === this.selected()) this.zoomTo(place);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.map?.remove();
      this.map = null;
    });
  }

  private visible() {
    return !!this.map && !!this.mapEl().nativeElement.clientWidth;
  }

  /** Fits the page's placed results into view; false when none is placed yet or the map is hidden. */
  fitAll() {
    const map = this.map;
    const points = this.rows()
      .map((r) => this.slice().placements[r.id]?.point)
      .filter((p): p is LatLng => !!p);
    if (!map || !points.length || !this.visible()) return false;
    map.fitBounds(L.latLngBounds(points), {
      padding: [56, 56],
      maxZoom: FIT_MAX_ZOOM,
      animate: !this.reduceMotion,
    });
    return true;
  }

  retry() {
    this.store.dispatch(
      ExploreMapActions.placeProperties({
        targets: this.rows()
          .filter((r) => r.folio)
          .map((r) => ({ propertyId: r.id, folio: r.folio, countyId: r.countyId })),
      }),
    );
  }

  private createMap() {
    const el = this.mapEl().nativeElement;
    // On phones and tablets the map starts hidden until Map is chosen; wait until it has a size.
    const tryCreate = () => {
      if (this.map || !el.clientWidth || !el.clientHeight) return;
      const map = L.map(el, { zoomControl: false, attributionControl: true });
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        // Greyscale street tiles, so the data carries the colour (src/map.css, DESIGN.md §10).
        className: 'gz-greyscale',
      }).addTo(map);
      this.outlines = L.layerGroup().addTo(map);
      this.pins = L.layerGroup().addTo(map);
      map.on('zoomend', () => this.zoom.set(map.getZoom()));
      map.setView(START.center, START.zoom);
      this.map = map;
      this.ready.set(true);
    };
    tryCreate();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      tryCreate();
      this.map?.invalidateSize();
      // Shown again after List: catch up only with what was picked or loaded meanwhile, so a
      // switch back and forth keeps the view the user left.
      if (!this.viewDue || !this.visible()) return;
      this.viewDue = false;
      const place = this.selectedPlace();
      if (place) this.zoomTo(place);
      else if (this.fitAll()) this.fittedKey = this.results().map((r) => r.id).join(',');
    });
    observer.observe(el);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** Zooms in until the parcel fills a good part of the map. */
  private zoomTo(place: Placement) {
    const map = this.map;
    if (!map || !this.visible()) return;
    const bounds = L.geoJSON(place.geom as unknown as GeoJSON.GeoJsonObject).getBounds();
    if (bounds.isValid())
      map.fitBounds(bounds, {
        maxZoom: PICK_MAX_ZOOM,
        padding: [80, 80],
        animate: !this.reduceMotion,
      });
    else map.setView(place.point, PICK_MAX_ZOOM, { animate: !this.reduceMotion });
  }

  private drawPins(
    rows: PropertySearchItem[],
    placements: Record<number, Placement | null>,
    values: PredictionMap,
    status: 'loading' | 'error' | 'ready',
    selected: number | null,
  ) {
    const layer = this.pins;
    if (!layer) return;
    layer.clearLayers();
    this.markers.clear();
    const hovered = this.hovered();
    for (const row of rows) {
      const place = placements[row.id];
      if (!place) continue;
      const value = values[String(row.id)]?.predictedPrice;
      const isSelected = row.id === selected;
      const pin = document.createElement('span');
      // The hatch means "no ZentraValue" (DESIGN.md §6), so it waits until the values are in.
      pin.className =
        'xm-pin' +
        (value ? ' pill' : status === 'ready' ? ' dot' : ' dot plain') +
        (isSelected ? ' sel' : '') +
        (row.id === hovered ? ' hov' : '');
      // A price label is text, never HTML.
      if (value) pin.textContent = compactPrice(value);
      const marker = L.marker(place.point, {
        icon: L.divIcon({ className: 'xm-hit', html: pin, iconSize: [0, 0] }),
        keyboard: false,
        zIndexOffset: isSelected ? 1000 : value ? 100 : 0,
      })
        .bindTooltip(this.label(row, value, status), {
          direction: 'top',
          offset: [0, -14],
          className: 'gz-tip',
          permanent: isSelected,
        })
        .on('click', () => this.picked.emit(row.id))
        .addTo(layer);
      if (isSelected) marker.openTooltip();
      this.markers.set(row.id, marker);
    }
  }

  private drawOutlines(
    rows: PropertySearchItem[],
    placements: Record<number, Placement | null>,
    zoom: number,
    selected: number | null,
  ) {
    const layer = this.outlines;
    if (!layer) return;
    layer.clearLayers();
    // Colours come from CSS (src/map.css): SVG attributes can't read the colour tokens.
    if (zoom >= OUTLINE_ZOOM) {
      for (const row of rows) {
        const place = placements[row.id];
        if (!place || row.id === selected) continue;
        L.geoJSON(place.geom as unknown as GeoJSON.GeoJsonObject, {
          style: { className: 'gz-parcel', weight: 1, fill: false },
          interactive: false,
        }).addTo(layer);
      }
    }
    // The picked property's boundary, in copper, at every zoom.
    const place = selected === null ? null : placements[selected];
    if (place) {
      L.geoJSON(place.geom as unknown as GeoJSON.GeoJsonObject, {
        style: { className: 'gz-parcel-pick', weight: 3, fillOpacity: 0.2 },
        interactive: false,
      }).addTo(layer);
    }
  }

  /** Tooltip content as DOM, so values from the record are text, never HTML. */
  private label(
    row: PropertySearchItem,
    value: number | undefined,
    status: 'loading' | 'error' | 'ready',
  ) {
    const root = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = rowTitle(row);
    root.appendChild(title);
    const line = value
      ? 'ZentraValue ' + usd.format(value)
      : status === 'ready'
        ? 'ZentraValue unavailable'
        : status === 'error'
          ? 'ZentraValues could not load'
          : joinParts(', ', row.city, row.propertyType);
    if (line) root.appendChild(document.createTextNode(line));
    return root;
  }
}
