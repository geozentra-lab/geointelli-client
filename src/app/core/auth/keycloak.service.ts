import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import Keycloak from 'keycloak-js';
import { environment } from '../../../environments/environment';
import { Store } from '@ngrx/store';
import { UserActions } from '../../store/user/user.actions';

/**
 * Marks that this browser had a signed-in session, so start-up only checks Keycloak when there
 * is a session to find. It holds no token or identity, just "1".
 */
export const SESSION_HINT_KEY = 'gz.signedIn';
function readSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}
function writeSessionHint(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Storage unavailable (private mode): start-up simply skips the session check.
  }
}

export const KEYCLOAK_CLIENT = new InjectionToken<Keycloak>('Keycloak client', {
  providedIn: 'root',
  factory: () => new Keycloak(environment.keycloak),
});

/**
 * Resolves false when the identity server does not answer quickly. check-sso navigates the whole
 * page to Keycloak, so starting it while Keycloak is down would leave even guests on a browser
 * error page instead of the app.
 */
export const KEYCLOAK_REACHABLE = new InjectionToken<() => Promise<boolean>>('Keycloak reachable', {
  providedIn: 'root',
  factory: () => async () => {
    const { url, realm } = environment.keycloak;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 4000);
    try {
      const res = await fetch(`${url}/realms/${realm}/.well-known/openid-configuration`, {
        signal: abort.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  },
});

@Injectable({ providedIn: 'root' })
export class KeycloakService {
  private readonly keycloak = inject(KEYCLOAK_CLIENT);
  private readonly reachable = inject(KEYCLOAK_REACHABLE);
  /** True when sign-in is unavailable because the identity server could not be reached. */
  unavailable = false;
  private readonly store = inject(Store);
  private readonly destroy = inject(DestroyRef);
  private initialization: Promise<boolean> | null = null;
  private refreshInFlight: Promise<boolean> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private endingSession = false;
  private readonly resume = () => {
    if (document.visibilityState !== 'hidden') void this.updateToken(60);
  };
  constructor() {
    this.destroy.onDestroy(() => this.stopRefreshing());
  }

  init(): Promise<boolean> {
    if (!environment.authenticationEnabled) return Promise.resolve(true);
    if (this.initialization) return this.initialization;
    this.keycloak.onAuthLogout = () => this.sessionEnded();
    this.keycloak.onTokenExpired = () => {
      void this.updateToken(-1);
    };
    // Checking for an existing session used to send the whole page to Keycloak and back on every
    // visit, so the app loaded twice. Now:
    // - no sign-in remembered in this browser (guests): no check at all, one load. The adapter
    //   still completes a login callback, because it parses the URL whatever onLoad says.
    // - a remembered sign-in: check in a hidden iframe without reloading. If the browser blocks
    //   third-party cookies the adapter falls back to the full-page check (silentCheckSsoFallback).
    const remembered = readSessionHint();
    this.initialization = this.reachable()
      .then((up) => {
        this.unavailable = !up;
        if (!up) return false;
        return this.keycloak.init({
          ...(remembered
            ? {
                onLoad: 'check-sso' as const,
                silentCheckSsoRedirectUri: `${window.location.origin}/assets/silent-check-sso.html`,
              }
            : {}),
          flow: 'standard',
          pkceMethod: 'S256',
          checkLoginIframe: false,
        });
      })
      .then((authenticated) => {
        writeSessionHint(authenticated);
        if (authenticated) {
          this.endingSession = false;
          this.startRefreshing();
        }
        return authenticated;
      })
      .catch(() => false);
    return this.initialization;
  }
  login(): Promise<void> {
    if (this.unavailable) return Promise.reject(new Error('Identity server unreachable'));
    return this.keycloak.login();
  }
  logout(): Promise<void> {
    this.sessionEnded();
    // Keep the ID token until the adapter has built the server logout request.
    return this.keycloak.logout({ redirectUri: window.location.origin });
  }
  getToken(): string | undefined {
    return this.isLoggedIn() ? this.keycloak.token : undefined;
  }
  isLoggedIn(): boolean {
    return !this.endingSession && !!this.keycloak.authenticated;
  }
  /** Realm roles from the token (e.g. "admin"); the backend enforces them, this only shapes the UI. */
  hasRealmRole(role: string): boolean {
    return this.isLoggedIn() && this.keycloak.hasRealmRole(role);
  }
  getUsername(): string | undefined {
    return this.keycloak.tokenParsed?.['preferred_username'];
  }

  updateToken(minValidity = 30): Promise<boolean> {
    if (!this.isLoggedIn()) return Promise.resolve(false);
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.keycloak
      .updateToken(minValidity)
      .catch(() => {
        // The adapter clears rejected/expired refresh tokens itself. A transient network failure
        // must not destroy a still-valid session; subsequent requests and the timer can retry.
        if (!this.keycloak.authenticated || !this.keycloak.refreshToken) this.sessionEnded();
        return false;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });
    return this.refreshInFlight;
  }
  async getValidToken(): Promise<string | undefined> {
    if (!this.isLoggedIn()) return undefined;
    await this.updateToken(30);
    if (!this.isLoggedIn()) return undefined;
    if (this.keycloak.isTokenExpired())
      throw new HttpErrorResponse({ status: 0, statusText: 'Session refresh unavailable' });
    return this.keycloak.token;
  }
  private startRefreshing() {
    this.stopRefreshing();
    this.refreshTimer = setInterval(() => {
      void this.updateToken(60);
    }, 30000);
    window.addEventListener('focus', this.resume);
    window.addEventListener('online', this.resume);
    document.addEventListener('visibilitychange', this.resume);
  }
  private stopRefreshing() {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    window.removeEventListener('focus', this.resume);
    window.removeEventListener('online', this.resume);
    document.removeEventListener('visibilitychange', this.resume);
  }
  private sessionEnded() {
    writeSessionHint(false);
    this.stopRefreshing();
    if (this.endingSession) return;
    this.endingSession = true;
    this.store.dispatch(UserActions.signedOut());
  }
}
