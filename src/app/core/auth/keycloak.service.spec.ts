import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Store } from '@ngrx/store';
import { vi } from 'vitest';
import Keycloak from 'keycloak-js';
import {
  KEYCLOAK_CLIENT,
  KEYCLOAK_REACHABLE,
  KeycloakService,
  SESSION_HINT_KEY,
} from './keycloak.service';
import { UserActions } from '../../store/user/user.actions';

describe('Keycloak session restoration and refresh', () => {
  let service: KeycloakService;
  let client: {
    init: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    updateToken: ReturnType<typeof vi.fn>;
    isTokenExpired: ReturnType<typeof vi.fn>;
    authenticated: boolean;
    token: string;
    refreshToken: string | undefined;
    onAuthLogout?: Keycloak['onAuthLogout'];
    onTokenExpired?: Keycloak['onTokenExpired'];
  };
  beforeEach(() => {
    vi.useFakeTimers();
    client = {
      init: vi.fn().mockResolvedValue(true),
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      updateToken: vi.fn().mockResolvedValue(false),
      isTokenExpired: vi.fn().mockReturnValue(false),
      authenticated: true,
      token: 'test-access-token',
      refreshToken: 'test-refresh-token',
    };
    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        { provide: KEYCLOAK_CLIENT, useValue: client },
        { provide: KEYCLOAK_REACHABLE, useValue: () => Promise.resolve(true) },
      ],
    });
    service = TestBed.inject(KeycloakService);
  });
  afterEach(() => {
    localStorage.removeItem(SESSION_HINT_KEY);
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('skips the session check for a browser with no remembered sign-in (single page load)', async () => {
    localStorage.removeItem(SESSION_HINT_KEY);
    expect(await service.init()).toBe(true);
    expect(client.init).toHaveBeenCalledWith({
      flow: 'standard',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
    await service.init();
    expect(client.init).toHaveBeenCalledTimes(1);
    expect(await service.getValidToken()).toBe('test-access-token');
    // A completed sign-in is remembered so the next visit restores it.
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
  });
  it('restores a remembered session silently in an iframe instead of reloading the page', async () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');
    expect(await service.init()).toBe(true);
    expect(client.init).toHaveBeenCalledWith({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
      flow: 'standard',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
  });
  it('forgets the hint when the remembered session has expired or the user signs out', async () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');
    client.authenticated = false;
    client.init.mockResolvedValue(false);
    expect(await service.init()).toBe(false);
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    localStorage.setItem(SESSION_HINT_KEY, '1');
    client.authenticated = true;
    await service.logout();
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
  });
  it('keeps anonymous browsing available when no SSO session exists', async () => {
    client.authenticated = false;
    client.init.mockResolvedValue(false);
    expect(await service.init()).toBe(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(client.updateToken).not.toHaveBeenCalled();
    expect(await service.getValidToken()).toBeUndefined();
  });
  it('refreshes proactively and on expiration, and resumes refresh when returning to the tab', async () => {
    await service.init();
    await vi.advanceTimersByTimeAsync(30000);
    expect(client.updateToken).toHaveBeenLastCalledWith(60);
    client.onTokenExpired?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(client.updateToken).toHaveBeenLastCalledWith(-1);
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    expect(client.updateToken).toHaveBeenLastCalledWith(60);
  });
  it('shares one refresh request across simultaneous API calls and returns the new token', async () => {
    let resolve!: (value: boolean) => void;
    client.updateToken.mockImplementation(() => new Promise<boolean>((r) => (resolve = r)));
    const first = service.getValidToken(),
      second = service.getValidToken();
    expect(client.updateToken).toHaveBeenCalledTimes(1);
    client.token = 'rotated-access-token';
    client.refreshToken = 'rotated-refresh-token';
    resolve(true);
    expect(await first).toBe('rotated-access-token');
    expect(await second).toBe('rotated-access-token');
  });
  it('preserves a valid session on a transient refresh error and retries later', async () => {
    client.updateToken.mockRejectedValueOnce(new Error('Temporary network failure'));
    expect(await service.getValidToken()).toBe('test-access-token');
    expect(service.isLoggedIn()).toBe(true);
    client.updateToken.mockResolvedValueOnce(true);
    await service.updateToken();
    expect(client.updateToken).toHaveBeenCalledTimes(2);
  });
  it('never returns an expired bearer if refresh is temporarily unavailable', async () => {
    client.updateToken.mockRejectedValue(new Error('Offline'));
    client.isTokenExpired.mockReturnValue(true);
    await expect(service.getValidToken()).rejects.toMatchObject({ status: 0 });
    expect(service.isLoggedIn()).toBe(true);
  });
  it('clears account state and stops refresh when the refresh token is rejected', async () => {
    await service.init();
    const dispatch = vi.spyOn(TestBed.inject(Store), 'dispatch');
    client.updateToken.mockImplementation(async () => {
      client.authenticated = false;
      client.refreshToken = undefined;
      client.onAuthLogout?.();
      throw new Error('Refresh token rejected');
    });
    await service.updateToken();
    expect(service.isLoggedIn()).toBe(false);
    expect(dispatch).toHaveBeenCalledWith(UserActions.signedOut());
    expect(dispatch).toHaveBeenCalledTimes(1);
    const calls = client.updateToken.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(client.updateToken).toHaveBeenCalledTimes(calls);
  });
  it('stops refreshing immediately on explicit logout and uses the server logout flow', async () => {
    await service.init();
    await service.logout();
    expect(service.isLoggedIn()).toBe(false);
    expect(client.logout).toHaveBeenCalledWith({ redirectUri: window.location.origin });
    await vi.advanceTimersByTimeAsync(60000);
    window.dispatchEvent(new Event('focus'));
    expect(client.updateToken).not.toHaveBeenCalled();
  });
  it('continues anonymously when the user cancels sign-in without restarting login', async () => {
    client.authenticated = false;
    client.init.mockRejectedValue({ error: 'access_denied', error_description: 'Login cancelled' });
    expect(await service.init()).toBe(false);
    expect(service.isLoggedIn()).toBe(false);
    expect(client.login).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(client.updateToken).not.toHaveBeenCalled();
  });
  it('starts as a guest without redirecting when the identity server is unreachable', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        { provide: KEYCLOAK_CLIENT, useValue: client },
        { provide: KEYCLOAK_REACHABLE, useValue: () => Promise.resolve(false) },
      ],
    });
    const guest = TestBed.inject(KeycloakService);
    client.authenticated = false;
    expect(await guest.init()).toBe(false);
    expect(client.init).not.toHaveBeenCalled();
    await expect(guest.login()).rejects.toThrow();
  });
});
