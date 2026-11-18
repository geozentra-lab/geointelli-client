import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, catchError, exhaustMap, map, of, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { RETRY_REASONS } from '../../core/models/import-job';
import { ImportJobService } from '../../data-access/import-job.service';
import { ImportJobsActions as A } from './import-jobs.actions';
import { apiError } from '../../core/models/api-error';
@Injectable()
export class ImportJobsEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(ImportJobService);
  /** exhaustMap: a second click while a file is uploading never sends it twice. */
  upload = createEffect(() =>
    this.actions.pipe(
      ofType(A.upload),
      exhaustMap(({ upload: u }) => {
        const request =
          u.kind === 'owners'
            ? this.service.importOwners(u.files[0], u.files[1], u.county, u.state)
            : u.kind === 'folder'
              ? this.service.importFolder(u.files, u.county, u.state)
              : this.service.importCsv(u.dataset, u.files[0], u.county, u.state);
        return request.pipe(
          map((job) => A.queued({ job })),
          catchError((e) => of(A.uploadFailed({ error: apiError(e) }))),
        );
      }),
    ),
  );
  load = createEffect(() =>
    this.actions.pipe(
      ofType(A.load),
      switchMap(({ page, silent }) =>
        this.service.list(page).pipe(
          map((p) => A.loaded({ page: p })),
          // A failed background refresh keeps the last good table instead of replacing it.
          catchError((e) => (silent ? EMPTY : of(A.failed({ error: apiError(e) })))),
        ),
      ),
    ),
  );
  job = createEffect(() =>
    this.actions.pipe(
      ofType(A.openJob),
      switchMap(({ id, silent }) =>
        this.service.get(id).pipe(
          map((job) => A.jobLoaded({ job })),
          catchError((e) => (silent ? EMPTY : of(A.jobFailed({ error: apiError(e) })))),
        ),
      ),
    ),
  );
  retry = createEffect(() =>
    this.actions.pipe(
      ofType(A.retry),
      exhaustMap(({ id }) =>
        this.service.retry(id).pipe(
          map((job) => A.retried({ job })),
          catchError((e) => of(A.retryFailed({ id, error: retryError(e) }))),
        ),
      ),
    ),
  );
  /** A new job (retry or upload) shows up at the top of the first page. */
  refresh = createEffect(() =>
    this.actions.pipe(
      ofType(A.retried, A.queued),
      map(() => A.load({ page: 0, silent: true })),
    ),
  );
}

/** 409 answers start with a reason code; show it in plain words. */
export function retryError(e: unknown): string {
  if (e instanceof HttpErrorResponse && e.status === 409) {
    const message = String(e.error?.message ?? '');
    const code = Object.keys(RETRY_REASONS).find((c) => message.startsWith(c));
    if (code) return 'Retry refused: ' + RETRY_REASONS[code];
  }
  return apiError(e);
}
