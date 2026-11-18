import { KeycloakService } from './core/auth/keycloak.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideTestStore } from './store';
import { App } from './app';
describe('Workspace shell', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: KeycloakService,
          useValue: {
            isLoggedIn: () => true,
            hasRealmRole: () => false,
            login: () => Promise.resolve(),
            logout: () => Promise.resolve(),
          },
        },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
      ],
    }),
  );
  it('renders the approved workspace navigation', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/users/me'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('GeoZentra');
    expect(fixture.nativeElement.textContent).toContain('Explore properties');
  });
  it('keeps the menu toggle inside the open menu and in the top bar only while it is hidden', async () => {
    localStorage.removeItem('gz.navHidden');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/users/me'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const inside = el.querySelector<HTMLButtonElement>('.sidebar #nav-toggle-inside')!;
    expect(inside).toBeTruthy();
    expect(el.querySelector('#nav-toggle-top')).toBeNull();
    inside.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const top = el.querySelector<HTMLButtonElement>('.topbar #nav-toggle-top');
    expect(top).toBeTruthy();
    expect(document.activeElement).toBe(top);
    top!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('#nav-toggle-top')).toBeNull();
    localStorage.removeItem('gz.navHidden');
  });
});
