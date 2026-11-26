import { inject } from '@angular/core';
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { catchError, retry, throwError, timer, timeout, TimeoutError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountActions } from '../../store/account/account.actions';
/** Per-attempt limits: reads fail fast so a spinner never hangs; writes (imports, saves) get longer. */
const READ_TIMEOUT_MS = 12000;
const WRITE_TIMEOUT_MS = 30000;
/**
 * A longer read limit for one request, for reports the server computes while you wait (the admin
 * data-quality scan counts every record on its first request). A read given more time than the
 * default is not retried after timing out: the server is still working on the first attempt.
 */
export const READ_TIMEOUT = new HttpContextToken<number>(() => READ_TIMEOUT_MS);
/** Bounded recovery for safe reads only. Writes are never replayed automatically. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  if (
    ![environment.apiUrl, environment.notificationApiUrl].some((base) =>
      request.url.startsWith(base + '/'),
    )
  )
    return next(request);
  // A 403 can mean the token predates a revocation: the account slice gets a new one and reads the
  // entitlements again, and the shell leaves an area that is no longer allowed.
  const store = inject(Store, { optional: true });
  const limit = request.method === 'GET' ? request.context.get(READ_TIMEOUT) : WRITE_TIMEOUT_MS;
  return next(request).pipe(
    timeout({ each: limit }),
    retry({
      count: 2,
      delay: (error, attempt) => {
        const transient =
          error instanceof TimeoutError ||
          (error instanceof HttpErrorResponse && [0, 429, 502, 503, 504].includes(error.status));
        if (request.method !== 'GET' || !transient) return throwError(() => error);
        // A timed-out server rarely recovers within seconds; retry it once (about 25s worst case).
        if (error instanceof TimeoutError && (attempt > 1 || limit > READ_TIMEOUT_MS))
          return throwError(() => error);
        const seconds =
          error instanceof HttpErrorResponse ? Number(error.headers.get('Retry-After')) : 0;
        return timer(
          seconds > 0 && Number.isFinite(seconds) ? Math.min(seconds * 1000, 5000) : 400 * attempt,
        );
      },
    }),
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 403)
        store?.dispatch(AccountActions.forbidden());
      return throwError(() =>
        error instanceof TimeoutError
          ? new HttpErrorResponse({ status: 0, statusText: 'Request timed out' })
          : error,
      );
    }),
  );
};
