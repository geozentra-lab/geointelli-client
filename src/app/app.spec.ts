import { KeycloakService } from './core/auth/keycloak.service';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideTestStore } from './store';
import { ProfessionalRole } from './core/models/account';
import { TestAccount, entitlementsFor } from './store/account/account.testing';
import { ShellLayer } from './shared/layout/shell-layer';
import { App } from './app';
import { Store } from '@ngrx/store';
import { UiActions } from './store/ui/ui.actions';

type Account = TestAccount;

async function setup(opts: {
  signedIn?: boolean;
  /** The account type; null: the account can't be read (401). */
  account?: Account | null;
  pending?: ProfessionalRole[];
  onboarded?: boolean;
  routes?: Routes;
}) {
  const signedIn = opts.signedIn ?? true;
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      {
        provide: KeycloakService,
        useValue: {
          isLoggedIn: () => signedIn,
          hasRealmRole: (role: string) => signedIn && role === 'admin' && opts.account === 'admin',
          login: () => Promise.resolve(),
          register: () => Promise.resolve(),
          logout: () => Promise.resolve(),
          refreshNow: () => Promise.resolve(true),
        },
      },
      provideRouter(opts.routes ?? []),
      provideHttpClient(),
      provideHttpClientTesting(),
      ...provideTestStore(),
    ],
  }).compileComponents();
  try {
    localStorage.removeItem('gz.shell');
  } catch {
    // ignore
  }
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  if (signedIn) {
    const http = TestBed.inject(HttpTestingController);
    const me = http.expectOne((r) => r.url.endsWith('/users/me'));
    const entitlements = http.expectOne((r) => r.url.endsWith('/users/me/entitlements'));
    if (opts.account) {
      me.flush({ id: 7, username: 'lee', firstName: 'Lee', lastName: 'Ortiz' });
      entitlements.flush(entitlementsFor(opts.account, opts.pending, opts.onboarded ?? true));
    } else {
      me.flush({}, { status: 401, statusText: 'Unauthorized' });
      entitlements.flush({}, { status: 401, statusText: 'Unauthorized' });
    }
  }
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}const labels = (el: HTMLElement, selector: string) =>
  [...el.querySelectorAll(selector)].map((a) => a.textContent!.trim());

describe('Desk shell', () => {
  it('gives buyers the public top bar: search first, their links, no rail and no account-type select', async () => {
    const { el } = await setup({ account: 'buyer' });
    expect(el.querySelector('.shell.public')).toBeTruthy();
    expect(el.querySelector('.rail')).toBeNull();
    expect(el.querySelector('.brand')?.textContent).toContain('GeoZentra');
    expect(labels(el, '.topnav a')).toEqual([
      'Explore',
      'Opportunities',
      'Compare',
      'Studio',
      'Saved',
      'Alerts',
    ]);
    expect(el.querySelector('select')).toBeNull();
    expect(labels(el, '.bottombar a, .bottombar button')).toEqual([
      'Explore',
      'For you',
      'Saved',
      'Alerts',
      'More',
    ]);
  });

  it('gives guests Sign in and Create account, and only the public links', async () => {
    const { el } = await setup({ signedIn: false });
    expect(labels(el, '.topnav a')).toEqual(['Explore', 'Opportunities', 'Compare']);
    expect(labels(el, '.topbar-tools button')).toEqual(['Sign in', 'Create account']);
  });

  it('gives lenders the navy rail: the home-buyer pages, then the Lending section, Settings last', async () => {
    const { el } = await setup({ account: 'lender' });
    expect(el.querySelector('.shell.pro')).toBeTruthy();
    expect(labels(el, '.rail a:not(.rail-mark)')).toEqual([
      'Overview',
      'Explore',
      'For you',
      'Compare',
      'Studio',
      'Saved',
      'Alerts',
      'Overview',
      'Pipeline',
      'Applications',
      'Import',
      'Team',
      'Settings',
    ]);
    expect(labels(el, '.rail .rail-section')).toEqual(['Lending']);
    expect(el.querySelectorAll('.rail hr')).toHaveLength(1);
    // The loan-review tabs are reached through the existing route and a query parameter.
    const apps = [...el.querySelectorAll<HTMLAnchorElement>('.rail a')].find(
      (a) => a.textContent!.trim() === 'Applications',
    )!;
    expect(apps.getAttribute('href')).toBe('/loan-review?tab=applications');
    expect(el.querySelector('.topnav')).toBeNull();
  });

  it('gives an admin every area the backend grants, then the Admin section', async () => {
    const { el } = await setup({ account: 'admin' });
    expect(el.querySelector('.shell.pro')).toBeTruthy();
    expect(labels(el, '.rail .rail-section')).toEqual(['Investments', 'CRM', 'Lending', 'Admin']);
    expect(labels(el, '.rail a:not(.rail-mark)').slice(-7)).toEqual([
      'Import jobs',
      'Data quality',
      'Valuations',
      'Role requests',
      'Licenses',
      'Users',
      'Settings',
    ]);
  });

  it('shows a pending role locked in the menu and the pending banner, with the home pages open', async () => {
    const { el } = await setup({ account: 'buyer', pending: ['investor'] });
    expect(el.querySelector('.shell.public')).toBeTruthy();
    const locked = el.querySelector('.topnav .topnav-locked')!;
    expect(locked.textContent).toContain('Investments');
    expect(locked.textContent).toContain('Waiting for approval');
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(locked.tagName).toBe('SPAN');
    // The status check goes out at once (on load); the banner says what is pending.
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/users/me/role-requests'));
    const banner = el.querySelector('gz-access-banner')!.textContent!;
    expect(banner).toContain('Your investor access is waiting for approval.');
    expect(banner).toContain('Check status');
  });

  it('sends an account that has not answered the onboarding page there first', async () => {
    @Component({ template: '' })
    class Blank {}
    const { fixture } = await setup({
      account: 'buyer',
      onboarded: false,
      routes: [
        { path: 'onboarding', component: Blank },
        { path: '**', component: Blank },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/saved');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/onboarding');
  });
  it('makes the shell inert while a dialog holds the layer, and wakes it when released', async () => {
    const { fixture, el } = await setup({ account: 'investor' });
    const release = TestBed.inject(ShellLayer).holdModal();
    fixture.detectChanges();
    expect(el.querySelector('.shell')!.hasAttribute('inert')).toBe(true);
    // Toasts and live regions stay outside the inert shell.
    expect(el.querySelector('.shell #toast')).toBeNull();
    release();
    fixture.detectChanges();
    expect(el.querySelector('.shell')!.hasAttribute('inert')).toBe(false);
  });

  it('opens the rest of the navigation in the More sheet and closes it with Escape', async () => {
    const { fixture, el } = await setup({ account: 'lender' });
    el.querySelector<HTMLButtonElement>('.bottombar .more')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const sheet = el.querySelector('.more-sheet')!;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(labels(el, '.more-sheet nav a')).toEqual([
      'Overview',
      'For you',
      'Compare',
      'Studio',
      'Saved',
      'Alerts',
      'Import',
      'Team',
      'Settings',
    ]);
    expect(el.querySelector('.shell')!.hasAttribute('inert')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.more-sheet')).toBeNull();
    expect(document.activeElement).toBe(el.querySelector('.bottombar .more'));
  });

  it('keeps an error toast until it is dismissed, while an info toast goes with the store', async () => {
    const { fixture, el } = await setup({ account: 'buyer' });
    document.body.appendChild(el);
    const store = TestBed.inject(Store);
    const toast = () => el.querySelector('#toast > span')!.textContent!.trim();
    store.dispatch(UiActions.toast({ message: 'Saved.' }));
    fixture.detectChanges();
    expect(toast()).toBe('Saved.');
    store.dispatch(UiActions.clearToast({ message: 'Saved.' }));
    fixture.detectChanges();
    expect(toast()).toBe('');
    store.dispatch(UiActions.toast({ message: 'Changes could not be saved.', kind: 'error' }));
    fixture.detectChanges();
    // The store's 5-second clear: the error stays on screen.
    store.dispatch(UiActions.clearToast({ message: 'Changes could not be saved.' }));
    fixture.detectChanges();
    expect(toast()).toBe('Changes could not be saved.');
    expect(el.querySelector('#toast')!.classList).toContain('error');
    el.querySelector<HTMLButtonElement>('.toast-close')!.click();
    fixture.detectChanges();
    expect(toast()).toBe('');
    expect(el.querySelector('.toast-close')).toBeNull();
    // The close button went with it: focus is back on the page, not on the document body.
    expect(document.activeElement).toBe(el.querySelector('#main-content'));
    el.remove();
  });

  it('treats the lender\u2019s rail items as pages, and keeps the error through a redirect back', async () => {
    @Component({ template: '' })
    class Blank {}
    const { fixture, el } = await setup({
      account: 'lender',
      routes: [
        { path: 'loan-review', component: Blank },
        { path: 'dashboard', component: Blank },
        // A page the account may not open sends it back where it was.
        { path: 'restricted', component: Blank, canActivate: [() => inject(Router).parseUrl('/dashboard')] },
      ],
    });
    const store = TestBed.inject(Store);
    const router = TestBed.inject(Router);
    const toast = () => el.querySelector('#toast > span')!.textContent!.trim();
    await router.navigateByUrl('/dashboard');
    store.dispatch(UiActions.toast({ message: 'Not saved. The stage changed.', kind: 'error' }));
    fixture.detectChanges();
    // Sent back to the page it was on: still there.
    await router.navigateByUrl('/restricted');
    fixture.detectChanges();
    expect(router.url).toBe('/dashboard');
    expect(toast()).toBe('Not saved. The stage changed.');
    // Applications, then a filter on it: the same page.
    await router.navigateByUrl('/loan-review?tab=applications');
    fixture.detectChanges();
    expect(toast()).toBe('');
    store.dispatch(UiActions.toast({ message: 'Not saved. The stage changed.', kind: 'error' }));
    fixture.detectChanges();
    await router.navigateByUrl('/loan-review?tab=applications&stage=SUBMITTED');
    fixture.detectChanges();
    expect(toast()).toBe('Not saved. The stage changed.');
    // Team is another item in the rail: another page.
    await router.navigateByUrl('/loan-review?tab=team');
    fixture.detectChanges();
    expect(toast()).toBe('');
  });

  it('drops a held error toast when the page changes, not when only the address query does', async () => {
    @Component({ template: '' })
    class Blank {}
    const failing = 'That page could not be opened. Check your connection and try again.';
    const { fixture, el } = await setup({
      account: 'buyer',
      routes: [
        { path: 'saved', component: Blank },
        { path: 'alerts', component: Blank },
        // A page whose opening raises an error (as the router's error handler does).
        {
          path: 'broken',
          component: Blank,
          canActivate: [
            () => {
              inject(Store).dispatch(UiActions.toast({ message: failing, kind: 'error' }));
              // The page takes a moment to open, long enough for the shell to show the error.
              return new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 20));
            },
          ],
        },
      ],
    });
    const store = TestBed.inject(Store);
    const router = TestBed.inject(Router);
    const toast = () => el.querySelector('#toast > span')!.textContent!.trim();
    const stored = () => {
      let message = '';
      store.select((s: { ui: { toast: string } }) => s.ui.toast).subscribe((t) => (message = t)).unsubscribe();
      return message;
    };
    await router.navigateByUrl('/saved');
    store.dispatch(UiActions.toast({ message: 'Changes could not be saved.', kind: 'error' }));
    fixture.detectChanges();
    // A tab or filter on the same page keeps it.
    await router.navigateByUrl('/saved?view=searches');
    fixture.detectChanges();
    expect(toast()).toBe('Changes could not be saved.');
    // Another page drops it, and the store's copy with it.
    await router.navigateByUrl('/alerts');
    fixture.detectChanges();
    expect(toast()).toBe('');
    expect(el.querySelector('.toast-close')).toBeNull();
    expect(stored()).toBe('');
    // An error raised while the next page opens is that page's: it replaces the held one and stays.
    store.dispatch(UiActions.toast({ message: 'Changes could not be saved.', kind: 'error' }));
    fixture.detectChanges();
    const opening = router.navigateByUrl('/broken');
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(toast()).toBe(failing);
    await opening;
    fixture.detectChanges();
    expect(toast()).toBe(failing);
    expect(el.querySelector('#toast')!.classList).toContain('error');
  });
});
