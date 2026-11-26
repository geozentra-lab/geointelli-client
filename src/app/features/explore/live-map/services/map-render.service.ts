import { Injectable } from '@angular/core';
import L from 'leaflet';
import { Parcel } from '../../../../core/models/parcel';
import { GrowthCell, GrowthMetricDef, MIN_RELIABLE_HOMES, cellKeyAt } from './growth-grid';

@Injectable()
export class MapRenderService {
  private map!: L.Map;
  private geoJsonLayer?: L.GeoJSON;
  private heatmapLayer: L.LayerGroup | null = null;
  private selectedLayer: any;
  private streetLayer!: L.TileLayer;
  private satelliteLayer!: L.TileLayer;
  private terrainLayer!: L.TileLayer;

  highlightedFolio: string | null = null;

  // ── Init ──────────────────────────────────────────────────────────────────

  /** Under reduced motion the map jumps instead of gliding (DESIGN.md §4 motion). */
  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  initMap(): void {
    this.map = L.map('map', {
      minZoom: 10,
      maxZoom: 22, // ← allow deep zoom
      zoomSnap: 0.5, // ← smoother zoom steps
      zoomControl: false,
      zoomAnimation: !this.reduceMotion,
      inertia: !this.reduceMotion,
      fadeAnimation: !this.reduceMotion,
      markerZoomAnimation: !this.reduceMotion,
    }).setView([25.7617, -80.1918], 12);
    // DESIGN.md §10: zoom at top right; the layer switches take the top left.
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.setMiamiBounds();

    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      // Drawn in greyscale (CSS) so the data carries the colour; satellite and terrain stay as is.
      className: 'gz-greyscale',
      maxZoom: 22,
      maxNativeZoom: 19, // ← tiles exist up to 19, Leaflet upscales beyond
    });

    this.satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 22,
        maxNativeZoom: 19,
      },
    );

    this.terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap contributors',
      maxZoom: 22,
      maxNativeZoom: 17, // ← terrain tiles only go to 17
    });

    this.setBaseLayer('street');
  }

  getMap(): L.Map {
    return this.map;
  }

  destroy(): void {
    this.map?.remove();
  }

  private setMiamiBounds(): void {
    const bounds = L.latLngBounds([25.138, -80.878], [25.996, -80.118]);
    this.map.setMaxBounds(bounds);
  }

  // ── Base layers ───────────────────────────────────────────────────────────

  setBaseLayer(layer: 'street' | 'satellite' | 'terrain'): void {
    [this.streetLayer, this.satelliteLayer, this.terrainLayer]
      .filter(Boolean)
      .forEach((l) => this.map.removeLayer(l));

    if (layer === 'street') {
      this.streetLayer.addTo(this.map);
      return;
    }
    if (layer === 'terrain') {
      this.terrainLayer.addTo(this.map);
      return;
    }
    this.satelliteLayer.addTo(this.map);
  }

  resetView(): void {
    this.map.fitBounds(L.latLngBounds([25.138, -80.878], [25.996, -80.118]));
  }

  // ── Parcels ───────────────────────────────────────────────────────────────

  renderParcels(parcels: Parcel[], onClickFn: (layer: any, feature: any) => void): void {
    this.clearParcels();

    const geoJson = {
      type: 'FeatureCollection',
      features: parcels.map((p) => ({
        type: 'Feature',
        properties: { folio: p.folio, propertyId: p.propertyId, countyId: p.countyId },
        geometry: p.geom,
      })),
    };

    this.geoJsonLayer = L.geoJSON(geoJson as any, {
      style: () => this.parcelStyle,
      onEachFeature: (feature, layer) => {
        layer.on('click', () => onClickFn(layer, feature));
      },
    }).addTo(this.map);

    // Re-apply persistent highlight
    if (this.highlightedFolio) {
      this.geoJsonLayer.eachLayer((layer: any) => {
        if (layer.feature?.properties?.folio === this.highlightedFolio) {
          this.markSelected(layer, true);
          this.selectedLayer = layer;
        }
      });
    }
  }

  clearParcels(): void {
    if (this.geoJsonLayer) this.map.removeLayer(this.geoJsonLayer);
    this.geoJsonLayer = undefined;
    this.selectedLayer = null;
  }

  // ── Growth heatmap ────────────────────────────────────────────────────────

  /** Parcel centres of the rendered boundaries, one per property. */
  parcelCenters(): { propertyId: number; lat: number; lng: number }[] {
    if (!this.geoJsonLayer) return [];
    const seen = new Set<number>();
    const centers: { propertyId: number; lat: number; lng: number }[] = [];
    this.geoJsonLayer.eachLayer((layer: any) => {
      const id = Number(layer.feature?.properties?.propertyId);
      const center = layer.getBounds?.()?.getCenter?.();
      if (!Number.isFinite(id) || seen.has(id) || !center) return;
      seen.add(id);
      centers.push({ propertyId: id, lat: center.lat, lng: center.lng });
    });
    return centers;
  }

  /**
   * Draws the squares in their own pane under the parcel outlines. They take no pointer events, so
   * parcels stay clickable; the hover tooltip is found from the cursor position instead.
   */
  renderGrowthGrid(
    cells: GrowthCell[],
    def: GrowthMetricDef,
    cellMeters: number,
    describe: (cell: GrowthCell) => string,
  ): void {
    this.clearHeatmap();
    if (!this.map.getPane('growth')) {
      const pane = this.map.createPane('growth');
      pane.style.zIndex = '390';
      pane.style.pointerEvents = 'none';
    }
    const layer = L.layerGroup();
    for (const cell of cells) {
      const reliable = cell.count >= MIN_RELIABLE_HOMES;
      // 1 px white gaps come from CSS (.gz-cell, src/map.css); faint squares hold too few homes (DESIGN.md §10).
      L.rectangle(cell.bounds, {
        pane: 'growth',
        interactive: false,
        stroke: true,
        className: 'gz-cell',
        weight: 1,
        fillColor: def.classes[cell.classIndex].color,
        fillOpacity: reliable ? 0.85 : 0.45,
      }).addTo(layer);
    }
    this.heatmapLayer = layer.addTo(this.map);
    this.gridCells = new Map(cells.map((c) => [c.key, c]));
    this.gridCellMeters = cellMeters;
    this.gridDescribe = describe;
    this.muteParcels(true);
    if (!this.hoverBound) {
      this.hoverBound = true;
      this.map.on('mousemove', (e: L.LeafletMouseEvent) => this.hoverCell(e.latlng));
      this.map.on('mouseout', () => this.hoverCell(null));
    }
  }

  private gridCells = new Map<string, GrowthCell>();
  private gridCellMeters = 0;
  private gridDescribe: ((cell: GrowthCell) => string) | null = null;
  private hoverBound = false;
  private hoverKey: string | null = null;
  private hoverOutline: L.Rectangle | null = null;
  private hoverTip: L.Tooltip | null = null;

  private hoverCell(latlng: L.LatLng | null): void {
    const key =
      latlng && this.heatmapLayer ? cellKeyAt(latlng.lat, latlng.lng, this.gridCellMeters) : null;
    const cell = key ? this.gridCells.get(key) : undefined;
    if ((cell?.key ?? null) === this.hoverKey) return;
    this.hoverKey = cell?.key ?? null;
    this.hoverOutline?.remove();
    this.hoverTip?.remove();
    this.hoverOutline = this.hoverTip = null;
    if (!cell || !this.gridDescribe) return;
    this.hoverOutline = L.rectangle(cell.bounds, {
      pane: 'growth',
      interactive: false,
      className: 'gz-cell-hover',
      weight: 2,
      fill: false,
    }).addTo(this.map);
    const b = L.latLngBounds(cell.bounds);
    this.hoverTip = L.tooltip({ direction: 'top', className: 'gz-tip', offset: [0, -4] })
      .setLatLng([b.getNorth(), b.getCenter().lng])
      .setContent(this.gridDescribe(cell));
    this.map.openTooltip(this.hoverTip);
  }

  /** Centres a square at a zoom where its parcels are easy to inspect. */
  focusCell(cell: GrowthCell): void {
    const center = L.latLngBounds(cell.bounds).getCenter();
    this.map.setView(center, Math.max(this.map.getZoom(), 17), { animate: !this.reduceMotion });
  }

  clearHeatmap(): void {
    if (this.heatmapLayer) {
      this.map.removeLayer(this.heatmapLayer);
      this.heatmapLayer = null;
    }
    this.gridCells.clear();
    this.hoverCell(null);
    this.muteParcels(false);
  }

  isHeatmapActive(): boolean {
    return !!this.heatmapLayer;
  }

  /**
   * Thin white outlines while the squares are shown, so the colours read clearly. Colours live in
   * CSS (.gz-parcel, .gz-muted in src/map.css): SVG attributes can't read the colour tokens.
   */
  private muteParcels(muted: boolean): void {
    this.map?.getContainer().classList.toggle('gz-muted', muted);
  }
  /** Ink outline, no fill; the fill stays (transparent) so a click inside the parcel hits it. */
  private parcelStyle: L.PathOptions = {
    className: 'gz-parcel',
    weight: 1,
    opacity: 1,
    fillOpacity: 0,
  };
  /** The found or clicked parcel: copper outline and 12% fill (DESIGN.md §10). */
  private markSelected(layer: any, selected: boolean): void {
    layer?.getElement?.()?.classList.toggle('is-sel', selected);
    if (selected) layer?.bringToFront?.();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Returns all propertyIds currently visible in the rendered GeoJSON layer.
   * Used to build the prediction request body.
   */
  getVisiblePropertyIds(): number[] {
    if (!this.geoJsonLayer) return [];
    const ids: number[] = [];
    this.geoJsonLayer.eachLayer((layer: any) => {
      const id = layer.feature?.properties?.propertyId;
      if (id != null) ids.push(Number(id));
    });
    return ids;
  }

  // Only zoom when explicitly searching — never on passive parcel load
  highlightAndZoomToFolio(folio: string): void {
    if (!this.geoJsonLayer) return;
    this.geoJsonLayer.eachLayer((layer: any) => {
      if (layer.feature?.properties?.folio === folio) {
        this.highlightLayer(layer);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          // setView instead of fitBounds — respects current zoom level
          // only zooms IN if needed, never zooms OUT
          const currentZoom = this.map.getZoom();
          const targetZoom = Math.max(currentZoom, 18);
          this.map.setView(bounds.getCenter(), targetZoom, {
            animate: !this.reduceMotion,
            duration: 0.5,
          });
        }
      }
    });
  }

  highlightLayer(layer: any): void {
    if (this.selectedLayer) this.markSelected(this.selectedLayer, false);
    this.markSelected(layer, true);
    this.selectedLayer = layer;
    if (this.highlightedFolio !== null) {
      this.highlightedFolio = layer.feature?.properties?.folio ?? null;
    }
  }

  onMoveEnd(fn: () => void): void {
    this.map.on('moveend', fn);
  }

  getBounds(): L.LatLngBounds {
    return this.map.getBounds();
  }

  getZoom(): number {
    return this.map.getZoom();
  }
}
