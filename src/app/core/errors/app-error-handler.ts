import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { UiActions } from '../../store/ui/ui.actions';

/** Matches the errors browsers raise when a lazy route chunk no longer exists (after a deploy). */
export function isChunkLoadError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    message,
  );
}

const RELOAD_KEY = 'gz.chunkReloadAt';
/**
 * Reloads the app once to pick up the new build. A timestamp guard prevents a reload loop when the
 * chunk is genuinely missing or the network is down.
 */
export function reloadForNewVersion(url?: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  if (url) window.location.assign(url);
  else window.location.reload();
  return true;
}

/**
 * Keeps unexpected errors from failing silently: logs them and tells the user once (throttled)
 * instead of leaving a page that quietly stopped responding.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private store = inject(Store);
  private lastToast = 0;
  handleError(error: unknown): void {
    console.error(error);
    if (isChunkLoadError(error) && reloadForNewVersion()) return;
    const now = Date.now();
    if (now - this.lastToast < 10000) return;
    this.lastToast = now;
    this.store.dispatch(
      UiActions.toast({
        message: isChunkLoadError(error)
          ? 'Part of the app could not be loaded. Check your connection and reload the page.'
          : 'Something went wrong. If the page stops responding, reload it.',
        kind: 'error',
      }),
    );
  }
}
