import { Injector, afterNextRender } from '@angular/core';
import { Event, NavigationEnd, NavigationError, Router } from '@angular/router';
import { filter, take } from 'rxjs';

/** After this long the app shows whatever it has; the shell's progress line takes over. */
export const SPLASH_MAX_MS = 6000;
/** Matches the fade in index.html; the splash is removed after it, transitionend or not. */
const FADE_MS = 200;

/**
 * The start-up splash (index.html, `#gz-boot`) covers the app until its first page has drawn, then
 * fades out, so the app appears whole: never a top bar over an empty page while the page's code
 * still loads (DESIGN.md §5, Start-up). The app is inert under it. Under reduced motion it goes at
 * once. Called once by the root component; does nothing when there is no splash (tests).
 */
export function revealWhenFirstPageIsDrawn(router: Router, injector: Injector, doc: Document) {
  const splash = doc.getElementById('gz-boot');
  if (!splash) return;
  let done = false;
  const reveal = () => {
    if (done) return;
    done = true;
    clearTimeout(latest);
    first.unsubscribe();
    doc.querySelector('app-root')?.removeAttribute('inert');
    const still = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      splash.remove();
      return;
    }
    splash.classList.add('is-done');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    setTimeout(() => splash.remove(), FADE_MS + 100);
  };
  // The first page in place (or a page that failed to open, which says so itself), once drawn.
  const first = router.events
    .pipe(
      filter((e: Event) => e instanceof NavigationEnd || e instanceof NavigationError),
      take(1),
    )
    .subscribe(() => afterNextRender(reveal, { injector }));
  const latest = setTimeout(reveal, SPLASH_MAX_MS);
}
