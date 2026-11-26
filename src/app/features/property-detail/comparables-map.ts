import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import L from 'leaflet';
import { Store } from '@ngrx/store';
import { ComparableDTO } from '../../core/models/api';
import {
  MapSubject,
  PropertyInsightsActions,
} from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';
import { RequestStatus } from '../../shared/components/request-status';
import { LoadingSpinner } from '../../shared/components/loading-spinner';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT } from '../../shared/table';
import { formatRecordDate } from '../../shared/data/format';
import { loadLeafletCss } from '../../shared/data/leaflet-css';
import {
  LatLng,
  Placement,
  compactPrice,
  metersToMiles,
  pricePerSqft,
} from './comparables-map.util';

export { COMPARABLES_MAP_QUERY } from '../../store/property-insights/property-insights.effects';
const TOP_MATCHES = 3;

export type ComparablesMapSubject = MapSubject;

/**
 * Comparable sales: a ranked table beside a sticky map (DESIGN.md §5, Comparables tab). The home is
 * the copper "Subject" marker, each comparable a price pill whose popup shows the facts that drove
 * the match. The table carries the same information for anyone not using the map and stays in
 * sync with it (hover, arrow keys or a click on either side). On phones a List / Map toggle picks
 * one; the map is only created, and its tiles only load, once it is shown.
 */
@Component({
  selector: 'gz-comparables-map',
  imports: [
    RequestStatus,
    LoadingSpinner,
    RouterLink,
    CurrencyPipe,
    DecimalPipe,
    ...RECORD_KIT,
    ...TABLE_KIT,
  ],
  template: `
    <gz-record-section heading="Comparable sales">
      <div class="cm-head">
        <p class="cm-lede">
          @if (response(); as r) {
            {{ r.returnedCount }} recent {{ r.returnedCount === 1 ? 'sale' : 'sales' }}
            @if (r.search.radiusMeters) {
              within {{ r.search.radiusMeters / 1609.344 | number: '1.0-1' }} mi
            }
            @if (r.search.months) {
              in the last {{ r.search.months }} months,
            }
            ranked by similarity to this home.
          } @else {
            Recent sales of similar homes nearby, ranked by similarity.
          }
        </p>
        <a class="cm-compare" [routerLink]="['/compare', propertyId()]">Open in Compare</a>
        @if (comps().length && !loading() && !error()) {
          <div class="toggle cm-view" role="group" aria-label="Show">
            <button
              type="button"
              [class.active]="phoneView() === 'list'"
              [attr.aria-pressed]="phoneView() === 'list'"
              (click)="phoneView.set('list')"
            >
              List
            </button>
            <button
              type="button"
              [class.active]="phoneView() === 'map'"
              [attr.aria-pressed]="phoneView() === 'map'"
              (click)="phoneView.set('map')"
            >
              Map
            </button>
          </div>
        }
      </div>
      <gz-request-status [error]="error()" retryLabel="Retry comparables" (retry)="reload()" />
      @if (loading()) {
        <gz-loading-spinner label="Finding comparable sales" />
      } @else if (!error() && response() && !comps().length) {
        <p class="cm-empty">
          No comparable sales were found near this home in the last
          {{ response()!.search.months }} months.
        </p>
      }
      <div class="cm-grid" [class.show-map]="phoneView() === 'map'" [hidden]="loading() || !!error() || !comps().length">
        <div class="cm-list">
          @if (comps().length) {
            <table
              gz-table
              sticky="none"
              class="complist"
              [selected]="active()"
              (selectedChange)="highlight($any($event))"
              (activated)="selectRow($event)"
            >
              <caption class="sr-only">
                Comparable sales, most similar first. Choose a row to show it on the map.
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="num">Rank</th>
                  <th scope="col">Address</th>
                  <th scope="col" class="num" data-priority="2">Sold</th>
                  <th scope="col" class="num">Price</th>
                  <th scope="col" class="num" data-priority="3">Match</th>
                </tr>
              </thead>
              <tbody>
                @for (c of comps(); track c.candidate.propertyId) {
                  <tr
                    [gz-row]="c.candidate.propertyId"
                    [attr.aria-label]="rowLabel(c)"
                    (mouseenter)="highlight(c.candidate.propertyId)"
                    (mouseleave)="highlight(null)"
                  >
                    <td class="num">{{ c.rank }}</td>
                    <td>
                      <a [routerLink]="['/property', c.candidate.propertyId]">{{
                        c.candidate.address || 'Folio ' + c.candidate.folio
                      }}</a>
                      <span class="cell-sub"
                        >{{ facts(c) }} · {{ miles(c.candidate.distanceMeters) }}
                        @if (!placed()[c.candidate.propertyId] && !placing()) {
                          · not on map
                        }
                      </span>
                    </td>
                    <td class="num nowrap" data-priority="2">{{ month(c.candidate.saleDate) }}</td>
                    <td class="num nowrap">
                      {{ c.candidate.salePrice | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </td>
                    <td class="num" data-priority="3">{{ score(c) }}%</td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @if (unplaced() > 0 && !placing()) {
            <p class="table-note" role="status">
              {{ unplaced() }} {{ unplaced() === 1 ? 'comparable' : 'comparables' }} could not be
              placed on the map; {{ unplaced() === 1 ? 'it is' : 'they are' }} still listed here.
            </p>
          }
          @if (!subjectPlaced() && !placing() && comps().length) {
            <p class="table-note">
              This home's parcel boundary is not on record, so it isn't marked on the map.
            </p>
          }
        </div>
        <div class="mapwrap">
          <div class="map" #mapEl role="region" aria-label="Map of comparable sales"></div>
          @if (placing()) {
            <div class="placing">
              <gz-loading-spinner [compact]="true" label="Placing homes on the map" />
            </div>
          }
          <div class="legend" aria-hidden="true">
            <span><i class="key subject"></i>Subject</span>
            <span><i class="key pill"></i>Comparable sale</span>
          </div>
        </div>
      </div>
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .cm-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-8) var(--sp-16);
      margin-bottom: var(--sp-12);
    }
    .cm-lede {
      margin: 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .cm-compare {
      margin-left: auto;
      font-size: var(--fs-cell);
      font-weight: 500;
    }
    /* List and Map only choose a view on phones; wider screens show both. */
    .cm-view {
      display: none;
    }
    .cm-empty {
      margin: 0;
      font-size: var(--fs-body);
      color: var(--ink-2);
    }
    .cm-grid {
      display: grid;
      grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
      gap: var(--sp-24);
      align-items: start;
    }
    .cm-grid[hidden] {
      display: none;
    }
    .cm-list {
      min-width: 0;
    }
    .complist a {
      font-weight: 500;
    }
    /* The map slot: no card around it, sticky beside the table. */
    .mapwrap {
      position: sticky;
      top: calc(var(--topbar-h) + 44px + var(--sp-24));
      border: 1px solid var(--rule-strong);
    }
    .map {
      height: 480px;
      background: var(--paper);
    }
    .placing {
      position: absolute;
      top: var(--sp-8);
      left: 50%;
      transform: translateX(-50%);
      z-index: 500;
      padding: 4px 12px;
      background: var(--surface);
      border: 1px solid var(--rule-strong);
    }
    .legend {
      position: absolute;
      left: var(--sp-8);
      bottom: var(--sp-8);
      z-index: 500;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      padding: 6px 10px;
      background: var(--surface);
      border: 1px solid var(--rule-strong);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink);
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .key {
      display: inline-block;
    }
    .key.subject {
      width: 10px;
      height: 10px;
      border-radius: var(--radius-round);
      background: var(--copper);
      box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--copper);
    }
    .key.pill {
      width: 18px;
      height: 10px;
      border-radius: 5px;
      background: var(--surface);
      border: 1px solid var(--ink);
    }
    @media (max-width: 1023px) {
      .cm-grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .mapwrap {
        position: relative;
        top: auto;
        order: -1;
      }
      .map {
        height: 400px;
      }
    }
    @media (max-width: 700px) {
      .cm-view {
        display: inline-flex;
      }
      .cm-grid:not(.show-map) .mapwrap,
      .cm-grid.show-map .cm-list {
        display: none;
      }
      .map {
        height: 60dvh;
        min-height: 320px;
      }
    }

    /* Leaflet adds marker, tile and popup markup outside Angular's view, so these are global.
       DESIGN.md §10: greyscale street tiles, white price pills with an ink border, the selected
       pill filled ink, the subject a copper marker labelled "Subject" over a copper parcel. */
    :host ::ng-deep .leaflet-tile-pane {
      filter: grayscale(1) contrast(0.9) brightness(1.05);
    }
    :host ::ng-deep .leaflet-control-attribution {
      font-size: var(--fs-caption);
    }
    /* Zoom: 32 px white squares with a control border, top right. */
    :host ::ng-deep .leaflet-top.leaflet-left {
      left: auto;
      right: 0;
    }
    :host ::ng-deep .leaflet-control-zoom {
      margin: var(--sp-8) var(--sp-8) 0 0;
      border: 0;
      box-shadow: none;
    }
    :host ::ng-deep .leaflet-control-zoom a {
      width: 32px;
      height: 32px;
      line-height: 30px;
      color: var(--ink);
      background: var(--surface);
      border: 1px solid var(--control);
      border-radius: var(--radius-control);
    }
    :host ::ng-deep .leaflet-control-zoom a + a {
      margin-top: 4px;
    }
    :host ::ng-deep .gz-pill {
      display: inline-block;
      transform: translate(-50%, -50%);
      padding: 2px 7px;
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      border: 1px solid var(--ink);
      font: 500 12px/16px var(--font);
      font-variant-numeric: tabular-nums lining-nums;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--dur-color) ease,
        color var(--dur-color) ease;
    }
    :host ::ng-deep .gz-pill.active {
      background: var(--ink);
      color: var(--surface);
      position: relative;
      z-index: 1000;
    }
    :host ::ng-deep .gz-subject {
      transform: translate(-50%, -100%);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    :host ::ng-deep .gz-subject b {
      padding: 2px 8px;
      background: var(--copper);
      color: var(--surface);
      border: 1px solid var(--surface);
      font: 600 12px/16px var(--font);
      white-space: nowrap;
    }
    :host ::ng-deep .gz-subject i {
      width: 2px;
      height: 10px;
      background: var(--copper);
    }
    :host ::ng-deep .gz-subject-parcel {
      stroke: var(--copper);
      fill: var(--copper);
    }
    :host ::ng-deep .leaflet-popup-content-wrapper {
      border-radius: 0;
      border: 1px solid var(--rule-strong);
      box-shadow: var(--shadow-menu);
    }
    :host ::ng-deep .gz-comp-popup {
      font: 13px/18px var(--font);
      color: var(--ink);
      min-width: 210px;
      font-variant-numeric: tabular-nums lining-nums;
    }
    :host ::ng-deep .gz-comp-popup h4 {
      margin: 0 0 2px;
      font-size: var(--fs-body);
      font-weight: 600;
    }
    :host ::ng-deep .gz-comp-popup .pp {
      font-size: var(--fs-section);
      font-weight: 600;
    }
    :host ::ng-deep .gz-comp-popup .muted {
      color: var(--ink-2);
    }
    :host ::ng-deep .gz-comp-popup ul {
      margin: 6px 0;
      padding-left: 16px;
      color: var(--ink-2);
    }
    :host ::ng-deep .gz-comp-popup a {
      color: var(--copper);
      font-weight: 500;
    }
  `,
})
export class ComparablesMap {
  private store = inject(Store);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  propertyId = input.required<number>();
  subject = input<ComparablesMapSubject | null>(null);

  private readonly insights = this.store.selectSignal(selectPropertyInsights);
  /** The store's map state, only while it belongs to this property. */
  private readonly mine = computed(() =>
    this.insights().propertyId === this.propertyId() ? this.insights() : null,
  );
  readonly loading = computed(() => this.mine()?.comparables.loading ?? true);
  readonly error = computed(() => this.mine()?.comparables.error ?? null);
  readonly response = computed(() => this.mine()?.comparables.value ?? null);
  /** Geometry found per comparable property ID; missing entries could not be placed. */
  readonly placed = computed<Record<number, Placement>>(() => this.mine()?.placements ?? {});
  readonly subjectPlacement = computed(() => this.mine()?.subjectPlacement ?? null);
  readonly placing = computed(() => (this.mine()?.placing ?? 0) > 0);
  /** The pin or row the user is pointing at; a view concern, so it stays in the component. */
  readonly active = signal<number | null>(null);
  /** Phones show the list or the map; the map (and its tiles) starts only when Map is chosen. */
  readonly phoneView = signal<'list' | 'map'>('list');

  readonly comps = computed(() => this.response()?.comparables ?? []);
  readonly subjectPlaced = computed(() => this.subjectPlacement() !== null);
  readonly unplaced = computed(
    () => this.comps().filter((c) => !this.placed()[c.candidate.propertyId]).length,
  );

  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('mapEl');
  private map: L.Map | null = null;
  private layer: L.LayerGroup | null = null;
  private markers = new Map<number, L.Marker>();
  private readonly mapReady = signal(false);
  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    // Leaflet's stylesheet is not global; it loads with the first map (shared/data/leaflet-css.ts).
    loadLeafletCss();
    // Reload only when the home really changes, not when an equal subject object is passed again.
    const loadKey = computed(() => {
      const s = this.subject();
      return this.propertyId() + '|' + (s ? s.countyId + ':' + s.folio : '');
    });
    effect(() => {
      loadKey();
      untracked(() => this.reload());
    });

    afterNextRender(() => this.createMap());
    // Redraw whenever data arrives; the map is created only once its container has a size.
    effect(() => {
      const ready = this.mapReady();
      const comps = this.comps();
      const placed = this.placed();
      const subject = this.subjectPlacement();
      if (ready) untracked(() => this.render(comps, placed, subject));
    });
    effect(() => {
      const id = this.active();
      untracked(() =>
        this.markers.forEach((m, key) =>
          m
            .getElement()
            ?.querySelector('.gz-pill')
            ?.classList.toggle('active', key === id),
        ),
      );
    });
    this.destroyRef.onDestroy(() => {
      this.map?.remove();
      this.map = null;
    });
  }

  reload() {
    this.active.set(null);
    this.store.dispatch(
      PropertyInsightsActions.loadComparablesMap({
        propertyId: this.propertyId(),
        subject: this.subject(),
      }),
    );
  }

  private createMap() {
    const el = this.mapEl().nativeElement;
    // The container starts hidden while comparables load; wait until it is laid out.
    const tryCreate = () => {
      if (this.map || !el.clientWidth || !el.clientHeight) return;
      this.map = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);
      this.map.setView([25.76, -80.19], 12);
      this.mapReady.set(true);
    };
    tryCreate();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      tryCreate();
      this.map?.invalidateSize();
    });
    observer.observe(el);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private render(
    comps: ComparableDTO[],
    placed: Record<number, Placement>,
    subject: Placement | null,
  ) {
    const map = this.map,
      layer = this.layer;
    if (!map || !layer) return;
    layer.clearLayers();
    this.markers.clear();
    const points: LatLng[] = [];
    if (subject) {
      L.geoJSON(subject.geom as unknown as GeoJSON.GeoJsonObject, {
        // Colour comes from CSS (.gz-subject-parcel): SVG attributes can't read the tokens.
        style: { className: 'gz-subject-parcel', weight: 2, fillOpacity: 0.12 },
        interactive: false,
      }).addTo(layer);
      L.marker(subject.point, {
        icon: L.divIcon({
          className: '',
          html: '<div class="gz-subject" title="This home"><b>Subject</b><i></i></div>',
          iconSize: [0, 0],
        }),
        zIndexOffset: 1000,
        keyboard: false,
      }).addTo(layer);
      points.push(subject.point);
    }
    for (const c of comps) {
      const p = placed[c.candidate.propertyId];
      if (!p) continue;
      const id = c.candidate.propertyId;
      const pill = document.createElement('div');
      pill.className = 'gz-pill';
      pill.textContent = compactPrice(c.candidate.salePrice);
      pill.title = this.rowLabel(c);
      const marker = L.marker(p.point, {
        icon: L.divIcon({ className: '', html: pill, iconSize: [0, 0] }),
        zIndexOffset: c.rank <= TOP_MATCHES ? 500 : 0,
        keyboard: false,
      })
        .bindPopup(() => this.popup(c), { maxWidth: 280, offset: [0, -8] })
        .on('mouseover', () => this.active.set(id))
        .on('mouseout', () => this.active.set(null))
        .on('click', () => this.active.set(id))
        .addTo(layer);
      this.markers.set(id, marker);
      points.push(p.point);
    }
    if (points.length === 1) map.setView(points[0], 16);
    else if (points.length > 1)
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
  }

  /** Popup DOM built directly so values are text, not HTML, and the link uses the router. */
  private popup(c: ComparableDTO) {
    const cand = c.candidate;
    const root = document.createElement('div');
    root.className = 'gz-comp-popup';
    const add = (tag: string, text: string, cls?: string) => {
      const el = document.createElement(tag);
      el.textContent = text;
      if (cls) el.className = cls;
      root.appendChild(el);
      return el;
    };
    add('h4', cand.address || 'Folio ' + cand.folio);
    add('div', [cand.city, cand.zip].filter(Boolean).join(' ') || 'Folio ' + cand.folio, 'muted');
    add('div', '$' + Math.round(cand.salePrice).toLocaleString('en-US'), 'pp');
    const sold = new Date(cand.saleDate);
    add(
      'div',
      'Sold ' +
        (isNaN(sold.getTime())
          ? cand.saleDate
          : sold.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })),
      'muted',
    );
    add('div', this.facts(c));
    const ppsf = pricePerSqft(cand.salePrice, cand.livingAreaSqft);
    add(
      'div',
      [
        cand.yearBuilt ? 'Built ' + cand.yearBuilt : null,
        ppsf ? '$' + ppsf.toLocaleString('en-US') + '/sqft' : null,
        metersToMiles(cand.distanceMeters) + ' away',
      ]
        .filter(Boolean)
        .join(' · '),
    );
    add('div', this.score(c) + '% match · rank ' + c.rank, 'muted');
    const reasons = (c.selectionReasons ?? []).slice(0, 3);
    if (reasons.length) {
      const ul = document.createElement('ul');
      for (const r of reasons) {
        const li = document.createElement('li');
        li.textContent = r;
        ul.appendChild(li);
      }
      root.appendChild(ul);
    }
    const link = add('a', 'Full record →') as HTMLAnchorElement;
    const url = '/property/' + cand.propertyId;
    link.href = url;
    link.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      void this.router.navigateByUrl(url);
    });
    return root;
  }

  highlight(id: number | null) {
    this.active.set(id);
  }
  /** Enter or a click on a table row: show that sale on the map. */
  selectRow(id: unknown) {
    if (typeof id === 'number') this.select(id);
  }
  month(value: string | null | undefined) {
    return formatRecordDate(value);
  }
  /** List row → open the matching pin's popup and bring it into view. */
  select(id: number) {
    this.active.set(id);
    const marker = this.markers.get(id);
    // On phones with List chosen the map is hidden (0 x 0) and can't be moved; the row stays selected.
    if (!marker || !this.map || !this.mapEl().nativeElement.clientWidth) return;
    const target = marker.getLatLng();
    if (this.reduceMotion) this.map.setView(target, Math.max(this.map.getZoom(), 15));
    else this.map.flyTo(target, Math.max(this.map.getZoom(), 15), { duration: 0.5 });
    marker.openPopup();
  }

  facts(c: ComparableDTO) {
    const x = c.candidate;
    return (
      [
        x.bedrooms !== null ? x.bedrooms + ' bd' : null,
        x.bathrooms !== null ? x.bathrooms + ' ba' : null,
        x.livingAreaSqft !== null
          ? Math.round(x.livingAreaSqft).toLocaleString('en-US') + ' sqft'
          : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Size unknown'
    );
  }
  miles(meters: number | null) {
    return metersToMiles(meters);
  }
  score(c: ComparableDTO) {
    // The API reports similarity as 0–1 or 0–100 depending on version; show a percentage.
    const s = c.similarityScore;
    return Math.round(s <= 1 ? s * 100 : s);
  }
  rowLabel(c: ComparableDTO) {
    const x = c.candidate;
    return (
      'Rank ' +
      c.rank +
      ': ' +
      (x.address || 'folio ' + x.folio) +
      ', sold for ' +
      compactPrice(x.salePrice) +
      ', ' +
      this.facts(c) +
      ', ' +
      metersToMiles(x.distanceMeters)
    );
  }
}
