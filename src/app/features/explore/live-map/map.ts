import { RequestStatus } from '../../../shared/components/request-status';
import { LoadingSpinner } from '../../../shared/components/loading-spinner';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { MapRenderService } from './services/map-render.service';
import { SearchBar } from './components/search-bar/search-bar';
import { PropertyDetailComponent } from '../../property-detail/property-detail-dialog/property-detail-component';
import { PageHeading } from '../../../shared/components/page-heading';
import { PropertiesActions as A } from '../../../store/properties/properties.actions';
import { selectProperties } from '../../../store/properties/properties.selectors';
import { ValuationActions as V } from '../../../store/valuation/valuation.actions';
import { selectValuation } from '../../../store/valuation/valuation.selectors';
import { selectCatalog } from '../../../store/catalog/catalog.selectors';
import { SearchQuery } from '../../../core/models/search-query';
import { PropertySearchItem } from '../../../core/models/api';
import { Icon } from '../../../shared/components/icon/icon';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PredictionMap } from '../../../core/models/property_prediction_value';
import { isoDate } from '../../../shared/components/value-forecast';
import { compactPrice } from '../../property-detail/comparables-map.util';
import {
  Exclusion,
  GROWTH_METRICS,
  GrowthCell,
  GrowthMetric,
  GrowthPoint,
  GrowthSummary,
  MIN_RELIABLE_HOMES,
  buildGrid,
  cellMetersForZoom,
  formatGrowth,
  growthValue,
  summarize,
} from './services/growth-grid';
/** The backend returns at most this many address matches (AddressServiceImpl.RESULT_LIMIT). */
const ADDRESS_MATCH_LIMIT = 20;
@Component({
  selector: 'gz-parcel-explorer',
  imports: [
    RequestStatus,
    LoadingSpinner,
    FormsModule,
    RouterLink,
    SearchBar,
    PageHeading,
    Icon,
    DatePipe,
    DecimalPipe,
  ],
  providers: [MapRenderService],
  templateUrl: './map.html',
})
export class Map implements AfterViewInit, OnDestroy {
  embedded = input(false);
  private store = inject(Store);
  private destroy = inject(DestroyRef);
  private render = inject(MapRenderService);
  private dialog = inject(MatDialog);
  private timeout?: ReturnType<typeof setTimeout>;
  private lastKey = '';
  private lastSearch: SearchQuery | null = null;
  readonly properties = this.store.selectSignal(selectProperties);
  readonly valuation = this.store.selectSignal(selectValuation);
  private readonly catalog = this.store.selectSignal(selectCatalog);
  /** Source, coverage and freshness of the parcel layer (GET /map/layers); hidden if unavailable. */
  readonly parcelLayer = computed(
    () => this.properties().layers?.find((l) => l.id === 'parcels') ?? null,
  );
  heatmapActive = false;
  readonly metrics = Object.values(GROWTH_METRICS);
  readonly minReliable = MIN_RELIABLE_HOMES;
  metric = signal<GrowthMetric>('annual');
  /** What the squares currently show; null while the heatmap is off or has nothing to draw. */
  growth = signal<GrowthSummary | null>(null);
  /** Homes in view with a 1-year forecast: the forecast view is offered only when there are some. */
  forecastHomes = signal(0);
  private chosen = signal<number | null>(null);
  private broken = signal<Set<number>>(new Set());
  base: 'street' | 'satellite' | 'terrain' = 'satellite';
  ngAfterViewInit() {
    this.render.initMap();
    // The layer catalog rarely changes: read it once per session.
    if (this.properties().layers === null) this.store.dispatch(A.loadLayers());
    this.store
      .select(selectProperties)
      .pipe(
        map((s) => ({ parcels: s.parcels, folio: s.searchFolio })),
        distinctUntilChanged((a, b) => a.parcels === b.parcels && a.folio === b.folio),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe(({ parcels, folio }) => {
        if (folio || !parcels.length) this.render.highlightedFolio = folio;
        this.render.renderParcels(parcels, (layer, feature) => {
          this.render.highlightedFolio = null;
          this.render.highlightLayer(layer);
          this.dialog.open(PropertyDetailComponent, {
            data: {
              folio: feature.properties.folio,
              propertyId: feature.properties.propertyId,
              countyId: feature.properties.countyId,
            },
            width: '1040px',
            maxWidth: '96vw',
            maxHeight: '92dvh',
            panelClass: 'property-details-panel',
            // Move focus into the dialog so keyboard and screen-reader users land on its content.
            autoFocus: 'dialog',
          });
        });
        if (folio) this.render.highlightAndZoomToFolio(folio);
        if (this.heatmapActive) this.loadHeatmap();
      });
    this.store
      .select(selectValuation)
      .pipe(
        map((s) => s.predictions),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((predictions) => {
        if (this.heatmapActive && this.render.getZoom() >= 14) this.drawHeatmap(predictions);
      });
    this.render.onMoveEnd(() => {
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => this.loadVisible(), 300);
    });
  }
  search(query: SearchQuery) {
    this.chosen.set(null);
    this.lastSearch = query;
    this.lastKey = '';
    this.store.dispatch(A.search({ query }));
  }
  /** A card picked from the address typeahead: fetch its boundary and zoom to it. */
  showProperty(card: PropertySearchItem) {
    this.chosen.set(null);
    this.lastSearch = { mode: 'address', value: card.address || card.folio };
    this.lastKey = '';
    this.store.dispatch(A.addressMatched({ matches: [card] }));
  }
  private loadVisible() {
    if (this.render.getZoom() < 14) {
      this.lastKey = '';
      this.store.dispatch(A.clearParcels());
      this.render.clearHeatmap();
      this.heatmapActive = false;
      this.growth.set(null);
      return;
    }
    const b = this.render.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      .map((v) => v.toFixed(5))
      .join(',');
    const key = bbox + '|' + this.render.getZoom();
    if (key === this.lastKey && !this.properties().error) return;
    this.lastKey = key;
    this.store.dispatch(A.loadParcels({ bbox }));
  }
  retry() {
    if (this.lastSearch) {
      this.store.dispatch(A.search({ query: this.lastSearch }));
      return;
    }
    this.lastKey = '';
    this.loadVisible();
  }
  isChosen(match: PropertySearchItem, index: number) {
    return this.chosen() === null ? index === 0 : this.chosen() === match.id;
  }
  chooseMatch(match: PropertySearchItem) {
    if (this.isChosen(match, this.properties().addressMatches.indexOf(match))) return;
    this.chosen.set(match.id);
    this.store.dispatch(A.chooseMatch({ match }));
  }
  /** True when the backend may have cut the match list short, so the user should narrow the search. */
  matchesCapped() {
    return this.properties().addressMatches.length >= ADDRESS_MATCH_LIMIT;
  }
  matchPlace(m: PropertySearchItem) {
    return [m.city, m.zip, m.countyName].filter(Boolean).join(' · ');
  }
  photo(id: number) {
    if (this.broken().has(id)) return null;
    const images = this.catalog().photos[id];
    return (images?.find((p) => p.primaryImage) || images?.[0])?.storagePath || null;
  }
  failedImage(id: number) {
    this.broken.update((ids) => new Set([...ids, id]));
  }
  setLayer() {
    this.render.setBaseLayer(this.base);
  }
  toggleHeatmap() {
    this.heatmapActive = !this.heatmapActive;
    if (this.heatmapActive) this.loadHeatmap();
    else {
      this.render.clearHeatmap();
      this.growth.set(null);
    }
  }
  setMetric(metric: GrowthMetric) {
    this.metric.set(metric);
    if (this.heatmapActive) this.drawHeatmap(this.valuation().predictions);
  }
  /** Groups the visible homes into squares for the chosen measure and draws them. */
  private drawHeatmap(predictions: PredictionMap) {
    const def = GROWTH_METRICS[this.metric()];
    const excluded: Record<Exclusion, number> = {
      noEstimate: 0,
      noSale: 0,
      recentSale: 0,
      noForecast: 0,
    };
    const points: GrowthPoint[] = [];
    const sources = new globalThis.Map<string, GrowthSummary['sources'][number]>();
    let forecastHomes = 0;
    for (const c of this.render.parcelCenters()) {
      const p = predictions[String(c.propertyId)];
      if (p?.forecast1y) forecastHomes++;
      const r = growthValue(p, def.id);
      if ('excluded' in r) {
        excluded[r.excluded]++;
        continue;
      }
      points.push({ ...c, value: r.value, estimate: p.predictedPrice });
      const date = isoDate(p.predictionDate);
      const key = p.modelVersion + '|' + date;
      const s = sources.get(key) ?? {
        modelVersion: p.modelVersion,
        predictionDate: date,
        count: 0,
      };
      s.count++;
      sources.set(key, s);
    }
    this.forecastHomes.set(forecastHomes);
    const meters = cellMetersForZoom(this.render.getZoom());
    const cells = buildGrid(points, meters, def);
    this.cellMeters = meters;
    this.growth.set(summarize(points, excluded, cells, def, [...sources.values()]));
    if (!cells.length) {
      this.render.clearHeatmap();
      return;
    }
    this.render.renderGrowthGrid(cells, def, meters, (cell) => this.describeCell(cell));
  }
  cellMeters = 0;
  private describeCell(cell: GrowthCell) {
    const def = GROWTH_METRICS[this.metric()];
    const homes = cell.count === 1 ? '1 home' : cell.count + ' homes';
    const range =
      cell.count > 1
        ? `<br>Range ${formatGrowth(cell.min, def)} to ${formatGrowth(cell.max, def)}`
        : '';
    const caution = cell.count < MIN_RELIABLE_HOMES ? '<br><i>Few homes: read with care</i>' : '';
    return (
      `<b>${formatGrowth(cell.median, def)}</b> median · ${homes}${range}` +
      `<br>Median estimate ${compactPrice(cell.medianEstimate)}${caution}`
    );
  }
  focusCell(cell: GrowthCell) {
    this.render.focusCell(cell);
  }
  fmt(value: number | null) {
    return value === null ? '—' : formatGrowth(value, GROWTH_METRICS[this.metric()]);
  }
  histogramMax() {
    return Math.max(1, ...(this.growth()?.histogram ?? []));
  }
  excludedText(s: GrowthSummary) {
    const e = s.excluded;
    return [
      e.noSale && `${e.noSale} with no recorded sale`,
      e.recentSale && `${e.recentSale} sold within the last year`,
      e.noForecast && `${e.noForecast} without a forecast`,
      e.noEstimate && `${e.noEstimate} without an estimate`,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  excludedCount(s: GrowthSummary) {
    const e = s.excluded;
    return e.noSale + e.recentSale + e.noForecast + e.noEstimate;
  }
  loadHeatmap() {
    const propertyIds = [
      ...new Set(
        this.properties()
          .parcels.map((p) => p.propertyId)
          .filter(Number.isFinite),
      ),
    ];
    if (!propertyIds.length) {
      this.heatmapActive = false;
      return;
    }
    this.store.dispatch(V.loadBulk({ propertyIds }));
  }
  ngOnDestroy() {
    clearTimeout(this.timeout);
    this.store.dispatch(A.clearParcels());
    this.render.destroy();
  }
}
