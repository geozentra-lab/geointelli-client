import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { FavoriteButton } from './favorite-button';
import { provideTestStore } from '../../store';
import { favoritesActions as A } from '../../store/favorites/favorites.actions';
import { selectFavorites, selectVisibleFavorites } from '../../store/favorites/favorites.selectors';
import { KeycloakService } from '../../core/auth/keycloak.service';

describe('Favorite interactions', () => {
  let http: HttpTestingController;
  let store: Store;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FavoriteButton],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
    store.dispatch(A.loaded({ items: [] }));
  });
  afterEach(() => http.verify());
  it('fills immediately, blocks duplicate writes, and rolls back a failed removal across views', () => {
    const fixture = TestBed.createComponent(FavoriteButton);
    fixture.componentRef.setInput('propertyId', 42);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('path').getAttribute('fill')).toBe('currentColor');
    expect(store.selectSignal(selectFavorites)()).toHaveLength(0);
    expect(store.selectSignal(selectVisibleFavorites)()).toHaveLength(1);
    button.click();
    const write = http.expectOne((r) => r.url.endsWith('/properties/42/favorite'));
    expect(write.request.method).toBe('POST');
    write.flush({ propertyId: 42, favorite: true, createdAt: '2026-10-01' });
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(store.selectSignal(selectVisibleFavorites)()).toHaveLength(0);
    http
      .expectOne((r) => r.url.endsWith('/properties/42/favorite'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(store.selectSignal(selectVisibleFavorites)()).toHaveLength(1);
    button.click();
    http.expectOne((r) => r.url.endsWith('/properties/42/favorite')).flush(null);
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(fixture.nativeElement.querySelector('path').getAttribute('fill')).toBe('none');
    expect(store.selectSignal(selectFavorites)()).toHaveLength(0);
  });
  it('cancels stale list snapshots instead of allowing them to overwrite a completed save', () => {
    store.dispatch(A.add({ propertyId: 42 }));
    const write = http.expectOne((r) => r.url.endsWith('/properties/42/favorite'));
    store.dispatch(A.load());
    const snapshot = http.expectOne((r) => r.url.endsWith('/properties/favorites'));
    write.flush({ propertyId: 42, favorite: true });
    expect(snapshot.cancelled).toBe(true);
    expect(store.selectSignal(selectVisibleFavorites)()[0].propertyId).toBe(42);
  });
});
