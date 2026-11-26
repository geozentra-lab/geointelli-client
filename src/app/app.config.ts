import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  Router,
  provideRouter,
  withNavigationErrorHandler,
  withViewTransitions,
} from '@angular/router';
import { UiActions } from './store/ui/ui.actions';
import { Store } from '@ngrx/store';
import {
  AppErrorHandler,
  isChunkLoadError,
  reloadForNewVersion,
} from './core/errors/app-error-handler';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';

import { routes } from './app.routes';
import { KeycloakService } from './core/auth/keycloak.service';
import { SessionEvents } from './core/auth/session-events';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { provideAppStore } from './store';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export function initializeKeycloak(keycloak: KeycloakService) {
  return () => keycloak.init();
}

/** Page transitions running now (a quick second click can start one before the first ends). */
let pageChanges = 0;

export const appConfig: ApplicationConfig = {
  providers: [
    ...provideAppStore(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // A page whose code fails to load (stale build after a deploy, flaky network) would otherwise
      // make the nav link silently do nothing.
      withNavigationErrorHandler((e) => {
        if (isChunkLoadError(e.error) && reloadForNewVersion(e.url)) return;
        inject(Store).dispatch(
          UiActions.toast({
            message: 'That page could not be opened. Check your connection and try again.',
            kind: 'error',
          }),
        );
      }),
      // A new page cross-fades in (styles.css, "Page transitions"; the shell stays still). A change
      // of query parameters only (filters, tabs, paging) keeps the page still, and so does reduced
      // motion.
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          const router = inject(Router);
          const target = router.currentNavigation()?.finalUrl;
          const samePage =
            !!target &&
            router.isActive(target, {
              paths: 'exact',
              matrixParams: 'exact',
              fragment: 'ignored',
              queryParams: 'ignored',
            });
          if (samePage || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            transition.skipTransition();
            return;
          }
          // The page area is named for the transition only while it runs: a named element is its
          // own stacking context, and a lasting one kept the record sheet (fixed, inside main)
          // under the shell scrim, so nothing in it could be clicked. The class is set before the
          // old page is captured, on the next frame.
          pageChanges++;
          document.documentElement.classList.add('page-changing');
          const done = () => {
            if (--pageChanges === 0) document.documentElement.classList.remove('page-changing');
          };
          transition.finished.then(done, done);
        },
      }),
    ),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideAnimationsAsync(),

    provideHttpClient(withInterceptorsFromDi(), withInterceptors([errorInterceptor])),

    KeycloakService,

    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
      deps: [KeycloakService, SessionEvents],
    },

    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      deps: [KeycloakService],
      multi: true,
    },
  ],
};
