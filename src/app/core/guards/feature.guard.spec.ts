import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../auth/keycloak.service';
import { entitlementsFor } from '../../store/account/account.testing';
import { featureGuard } from './feature.guard';

@Component({ template: '' })
class Page {}

describe('Feature guard (areas behind entitlements.features)', () => {
  const auth = { loggedIn: true };
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'crm', component: Page, canActivate: [featureGuard('realtorCrm')] },
          { path: 'no-access', component: Page },
          { path: '', component: Page },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: () => false } },
      ],
    });
    return { router: TestBed.inject(Router), http: TestBed.inject(HttpTestingController) };
  }
  beforeEach(() => (auth.loggedIn = true));

  it('waits for the entitlements, then opens the area for an account that has the feature', async () => {
    const { router, http } = setup();
    const going = router.navigateByUrl('/crm');
    await new Promise((r) => setTimeout(r));
    http.expectOne((r) => r.url.endsWith('/users/me/entitlements')).flush(entitlementsFor('realtor'));
    expect(await going).toBe(true);
    expect(router.url).toBe('/crm');
  });

  it('sends an account without the feature to No access, naming the area', async () => {
    const { router, http } = setup();
    const going = router.navigateByUrl('/crm');
    await new Promise((r) => setTimeout(r));
    http.expectOne((r) => r.url.endsWith('/users/me/entitlements')).flush(entitlementsFor('investor'));
    await going;
    expect(router.url).toBe('/no-access?area=realtorCrm');
  });

  it('lets guests through (the page asks them to sign in), and the backend decides if entitlements fail', async () => {
    auth.loggedIn = false;
    const { router } = setup();
    expect(await router.navigateByUrl('/crm')).toBe(true);
    TestBed.resetTestingModule();
    auth.loggedIn = true;
    const second = setup();
    TestBed.inject(Store);
    const going = second.router.navigateByUrl('/crm');
    await new Promise((r) => setTimeout(r));
    second.http
      .expectOne((r) => r.url.endsWith('/users/me/entitlements'))
      .flush('down', { status: 503, statusText: 'Unavailable' });
    expect(await going).toBe(true);
  });
});
