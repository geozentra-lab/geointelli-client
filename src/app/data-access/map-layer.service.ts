import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/** GET /api/map/layers: a supported layer with its source, coverage and freshness. */
export interface MapLayerDTO {
  id: string;
  name: string;
  type: string;
  source: string;
  /** Counties with data for this layer; empty when none. */
  coverage: string[];
  featureCount: number;
  /** Latest update of the layer data; null when it has none. */
  lastUpdated: string | null;
}

@Injectable({ providedIn: 'root' })
export class MapLayerService {
  private http = inject(HttpClient);
  layers() {
    return this.http.get<MapLayerDTO[]>(environment.apiUrl + '/map/layers');
  }
}
