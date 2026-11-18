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
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
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
 * Comparable sales on a map: the current home highlighted, each comparable as a price pill whose
 * popup shows the facts that drove the match. The list below carries the same information for
 * anyone not using the map, and stays in sync with it (hover or select either side).
 */
@Component({
  selector: 'gz-comparables-map',
  imports: [RequestStatus, LoadingSpinner, RouterLink, CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <div class="panel">
      <div class="panelhead">
        <h3>Comparable homes</h3>
        @if (response(); as r) {
          <span class="smalltext muted"
            >{{ r.returnedCount }} recent sales within
            {{ (r.search.radiusMeters ?? 0) / 1609.344 | number: '1.0-1' }} mi ·
            {{ r.search.months }} months</span
          >
        }
      </div>
      <gz-request-status [error]="error()" retryLabel="Retry comparables" (retry)="reload()" />
      @if (loading()) {
        <gz-loading-spinner label="Finding comparable sales" />
      } @else if (!error() && response() && !comps().length) {
        <div class="empty-state spacer">
          <p>
            No comparable sales were found near this home in the last
            {{ response()!.search.months }} months.
          </p>
        </div>
      }
      <div class="mapwrap" [hidden]="loading() || !!error() || !comps().length">
        <div class="map" #mapEl aria-hidden="true"></div>
        @if (placing()) {
          <div class="placing">
            <gz-loading-spinner [compact]="true" label="Placing homes on the map" />
          </div>
        }
        <div class="legend" aria-hidden="true">
          <span><i class="dot subject"></i>This home</span>
          <span><i class="dot top"></i>Top match</span>
          <span><i class="dot other"></i>Comparable</span>
        </div>
      </div>
      @if (unplaced() > 0 && !placing()) {
        <p class="smalltext muted note" role="status">
          {{ unplaced() }} {{ unplaced() === 1 ? 'comparable' : 'comparables' }} could not be placed
          on the map; {{ unplaced() === 1 ? 'it is' : 'they are' }} still listed below.
        </p>
      }
      @if (!subjectPlaced() && !placing() && comps().length) {
        <p class="smalltext muted note">
          This home's parcel boundary is not on record, so it isn't marked.
        </p>
      }
      @if (comps().length) {
        <ol class="complist" aria-label="Comparable sales">
          @for (c of comps(); track c.candidate.propertyId) {
            <li
              [class.active]="active() === c.candidate.propertyId"
              (mouseenter)="highlight(c.candidate.propertyId)"
              (mouseleave)="highlight(null)"
            >
              <button
                type="button"
                class="row"
                (click)="select(c.candidate.propertyId)"
                [attr.aria-label]="rowLabel(c)"
              >
                <span class="rank" [class.top]="c.rank <= topMatches">{{ c.rank }}</span>
                <span class="addr">
                  <b>{{ c.candidate.address || 'Folio ' + c.candidate.folio }}</b>
                  <small
                    >{{ facts(c) }} · {{ miles(c.candidate.distanceMeters) }}
                    @if (!placed()[c.candidate.propertyId] && !placing()) {
                      · not on map
                    }
                  </small>
                </span>
                <span class="price">
                  <b>{{ c.candidate.salePrice | currency: 'USD' : 'symbol' : '1.0-0' }}</b>
                  <small>{{ c.candidate.saleDate | date: 'MMM y' }} · {{ score(c) }}% match</small>
                </span>
              </button>
              <a class="smalltext" [routerLink]="['/property', c.candidate.propertyId]"
                >Full record</a
              >
            </li>
          }
        </ol>
      }
    </div>
  `,
  styles: `
    .mapwrap {
      position: relative;
      margin-top: 12px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--line);
    }
    .map {
      height: 460px;
      background: #f5f6f7;
    }
    @media (max-width: 650px) {
      .map {
        height: 340px;
      }
    }
    .placing {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 500;
      background: white;
      padding: 4px 12px;
      border-radius: 20px;
      box-shadow: 0 2px 10px #17273526;
    }
    .legend {
      position: absolute;
      left: 10px;
      bottom: 10px;
      z-index: 500;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      padding: 6px 10px;
      background: #ffffffe8;
      border-radius: 8px;
      font-size: 12px;
      color: var(--ink);
      box-shadow: 0 1px 6px #17273520;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot.subject {
      background: #172735;
      box-shadow: 0 0 0 2px #ad724c;
    }
    .dot.top {
      background: #ad724c;
    }
    .dot.other {
      background: #526773;
    }
    .note {
      margin: 10px 0 0;
    }
    .complist {
      list-style: none;
      margin: 14px 0 0;
      padding: 0;
    }
    .complist li {
      display: flex;
      align-items: center;
      gap: 8px;
      border-top: 1px solid var(--line);
      padding-right: 6px;
    }
    .complist li.active {
      background: #faf7f4;
    }
    .row {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 6px;
      background: transparent;
      border: 0;
      text-align: left;
      cursor: pointer;
      color: inherit;
    }
    .rank {
      width: 26px;
      height: 26px;
      flex-shrink: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
      color: white;
      background: #526773;
    }
    .rank.top {
      background: #ad724c;
    }
    .addr,
    .price {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .addr {
      flex: 1;
    }
    .addr b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .price {
      text-align: right;
      flex-shrink: 0;
    }
    small {
      color: var(--muted);
      font-size: 12px;
    }
    @media (max-width: 650px) {
      .price small {
        display: none;
      }
    }
    /* Leaflet adds marker and popup markup outside Angular's view, so these selectors are global. */
    :host ::ng-deep .gz-pill {
      display: inline-block;
      transform: translate(-50%, -50%);
      padding: 3px 8px;
      border-radius: 14px;
      background: #526773;
      color: white;
      font:
        700 12px/1.3 'DM Sans',
        system-ui,
        sans-serif;
      white-space: nowrap;
      border: 2px solid white;
      box-shadow: 0 2px 6px #17273559;
      cursor: pointer;
      transition: transform 0.12s ease;
    }
    :host ::ng-deep .gz-pill.top {
      background: #ad724c;
    }
    :host ::ng-deep .gz-pill.active {
      background: #172735;
      transform: translate(-50%, -50%) scale(1.15);
      z-index: 1000;
    }
    :host ::ng-deep .gz-subject {
      transform: translate(-50%, -100%);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    :host ::ng-deep .gz-subject b {
      padding: 3px 9px;
      border-radius: 14px;
      background: #172735;
      color: white;
      font:
        700 12px/1.3 'DM Sans',
        system-ui,
        sans-serif;
      white-space: nowrap;
      box-shadow:
        0 0 0 2px #ad724c,
        0 3px 8px #17273566;
    }
    :host ::ng-deep .gz-subject i {
      width: 2px;
      height: 10px;
      background: #172735;
    }
    :host ::ng-deep .gz-comp-popup {
      font:
        13px/1.45 'DM Sans',
        system-ui,
        sans-serif;
      color: var(--ink);
      min-width: 210px;
    }
    :host ::ng-deep .gz-comp-popup h4 {
      margin: 0 0 2px;
      font-size: 14px;
    }
    :host ::ng-deep .gz-comp-popup .pp {
      font-size: 17px;
      font-weight: 700;
    }
    :host ::ng-deep .gz-comp-popup .muted {
      color: var(--muted);
    }
    :host ::ng-deep .gz-comp-popup ul {
      margin: 6px 0;
      padding-left: 16px;
      color: var(--ink-2);
    }
    :host ::ng-deep .gz-comp-popup a {
      color: #ad724c;
      font-weight: 600;
    }
    @media (prefers-reduced-motion: reduce) {
      :host ::ng-deep .gz-pill {
        transition: none;
      }
    }
  `,
})
export class ComparablesMap {
  private store = inject(Store);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  propertyId = input.required<number>();
  subject = input<ComparablesMapSubject | null>(null);

  readonly topMatches = TOP_MATCHES;
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
        style: { color: '#ad724c', weight: 2, fillColor: '#ad724c', fillOpacity: 0.15 },
        interactive: false,
      }).addTo(layer);
      L.marker(subject.point, {
        icon: L.divIcon({
          className: '',
          html: '<div class="gz-subject" title="This home"><b>This home</b><i></i></div>',
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
      pill.className = 'gz-pill' + (c.rank <= TOP_MATCHES ? ' top' : '');
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
  /** List row → open the matching pin's popup and bring it into view. */
  select(id: number) {
    this.active.set(id);
    const marker = this.markers.get(id);
    if (!marker || !this.map) return;
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
