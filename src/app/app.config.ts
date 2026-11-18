import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withNavigationErrorHandler } from '@angular/router';
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
