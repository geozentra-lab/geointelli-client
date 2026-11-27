import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WRITE_TIMEOUT } from '../core/interceptors/error.interceptor';

/** An upload (up to 1 GB) is answered once the server has the whole file: 30 minutes, not 30 s. */
const UPLOAD = () => ({ context: new HttpContext().set(WRITE_TIMEOUT, 30 * 60_000) });
import { ImportJobDTO, ImportJobPageDTO } from '../core/models/import-job';
/** Admin import jobs and CSV ingestion (realm role "admin"). */
@Injectable({ providedIn: 'root' })
export class ImportJobService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/admin/import-jobs';
  private ingestion = environment.apiUrl + '/ingestion/import';
  list(page = 0, size = 20) {
    return this.http.get<ImportJobPageDTO>(this.base, { params: { page, size } });
  }
  /** id is the job's `id`: a numeric backfill ID or an ingestion UUID. */
  get(id: string) {
    return this.http.get<ImportJobDTO>(`${this.base}/${encodeURIComponent(id)}`);
  }
  /** Queues a new job resuming a FAILED, PARTIAL or INTERRUPTED ingestion job from its checkpoint. */
  retry(id: string) {
    return this.http.post<ImportJobDTO>(`${this.base}/${encodeURIComponent(id)}/retry`, null);
  }
  /** Uploads one county CSV (POST /ingestion/import/{dataset}); answers 202 with the queued job. */
  importCsv(dataset: string, file: File, county: string, sourceState: string) {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('county', county);
    body.append('sourceState', sourceState);
    return this.http.post<ImportJobDTO>(`${this.ingestion}/${encodeURIComponent(dataset)}`, body, UPLOAD());
  }
  /** owners.csv and property_owner.csv load together in one transaction. */
  importOwners(owners: File, propertyOwners: File, county: string, sourceState: string) {
    const body = new FormData();
    body.append('ownersFile', owners, owners.name);
    body.append('propertyOwnersFile', propertyOwners, propertyOwners.name);
    body.append('county', county);
    body.append('sourceState', sourceState);
    return this.http.post<ImportJobDTO>(`${this.ingestion}/owners`, body, UPLOAD());
  }
  /** A whole county folder: files named as in a county export (properties.csv, sales.csv...). */
  importFolder(files: File[], county: string, sourceState: string) {
    const body = new FormData();
    for (const f of files) body.append('files', f, f.name);
    body.append('county', county);
    body.append('sourceState', sourceState);
    return this.http.post<ImportJobDTO>(`${this.ingestion}/folder`, body, UPLOAD());
  }
}
