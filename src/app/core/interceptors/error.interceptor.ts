import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timer, timeout, TimeoutError } from 'rxjs';
import { environment } from '../../../environments/environment';
/** Per-attempt limits: reads fail fast so a spinner never hangs; writes (imports, saves) get longer. */
const READ_TIMEOUT_MS = 12000;
const WRITE_TIMEOUT_MS = 30000;
/** Bounded recovery for safe reads only. Writes are never replayed automatically. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  if (
    ![environment.apiUrl, environment.notificationApiUrl].some((base) =>
      request.url.startsWith(base + '/'),
    )
  )
    return next(request);
  return next(request).pipe(
    timeout({ each: request.method === 'GET' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS }),
    retry({
      count: 2,
      delay: (error, attempt) => {
        const transient =
          error instanceof TimeoutError ||
          (error instanceof HttpErrorResponse && [0, 429, 502, 503, 504].includes(error.status));
        if (request.method !== 'GET' || !transient) return throwError(() => error);
        // A timed-out server rarely recovers within seconds; retry it once (about 25s worst case).
        if (error instanceof TimeoutError && attempt > 1) return throwError(() => error);
        const seconds =
          error instanceof HttpErrorResponse ? Number(error.headers.get('Retry-After')) : 0;
        return timer(
          seconds > 0 && Number.isFinite(seconds) ? Math.min(seconds * 1000, 5000) : 400 * attempt,
        );
      },
    }),
    catchError((error) =>
      throwError(() =>
        error instanceof TimeoutError
          ? new HttpErrorResponse({ status: 0, statusText: 'Request timed out' })
          : error,
      ),
    ),
  );
};
