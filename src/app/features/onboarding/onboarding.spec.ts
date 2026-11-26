import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { AccountActions } from '../../store/account/account.actions';
import { entitlementsFor } from '../../store/account/account.testing';
import { Onboarding, readableErrors } from './onboarding';

@Component({ template: 'Overview' })
class OverviewStub {}

describe('Onboarding page (SCRUM-204)', () => {
  let http: HttpTestingController;
  async function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'onboarding', component: Onboarding },
          { path: 'dashboard', component: OverviewStub },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true, hasRealmRole: () => false, refreshNow: () => Promise.resolve(true) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(Store).dispatch(
      AccountActions.entitlementsLoaded({ entitlements: entitlementsFor('buyer', [], false) }),
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/onboarding', Onboarding);
    const el = harness.routeNativeElement as HTMLElement;
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    return { el, settle };
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  const button = (root: Element, words: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === words)!;
  const type = (el: Element, selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('offers four account types, never Admin', async () => {
    const { el } = await setup();
    expect([...el.querySelectorAll('.ob-choices h2')].map(text)).toEqual(['Home buyer', 'Investor', 'Realtor', 'Lender']);
    expect(el.textContent).not.toContain('Admin');
  });

  it('home buyer: completes onboarding and opens the overview', async () => {
    const { el, settle } = await setup();
    button(el, 'Continue as a home buyer').click();
    await settle();
    const done = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/onboarding/complete'));
    done.flush(entitlementsFor('buyer'));
    await settle();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('lender: sends the organization and note, and shows a 409 as the backend wrote it', async () => {
    const { el, settle } = await setup();
    button(el, 'Request lender access').click();
    await settle();
    type(el, '#ob-lender-org', ' Bayline Credit Union ');
    type(el, '#ob-lender-note', 'Mortgage desk');
    await settle();
    button(el, 'Send request').click();
    await settle();
    const sent = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/me/role-requests'));
    expect(sent.request.body).toEqual({ role: 'lender', organizationName: 'Bayline Credit Union', note: 'Mortgage desk' });
    const message = 'A lender request is already pending for this account.';
    sent.flush({ status: 409, error: 'Conflict', message }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(text(el.querySelector('.ob-error'))).toBe(message);
    expect(TestBed.inject(Router).url).toBe('/onboarding');
  });

  it('names the form fields in a 400 message', () => {
    expect(readableErrors('note: size must be between 0 and 1000; organizationName: too long')).toBe(
      'Note: size must be between 0 and 1000; Organization: too long',
    );
  });
});
