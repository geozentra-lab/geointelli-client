import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { UserActions } from '../../store/user/user.actions';
import { selectUserState } from '../../store/user/user.selectors';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { UserDTO } from '../../core/models/api';
import { Settings } from './settings';
describe('Profile form recovery', () => {
  it('keeps edited fields and the canonical profile when saving fails, then accepts a retry', () => {
    TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true } },
      ],
    });
    const store = TestBed.inject(Store),
      http = TestBed.inject(HttpTestingController);
    const profile = {
      id: 1,
      firstName: 'Original',
      lastName: 'Name',
      email: 'test@example.test',
      persona: 'USER',
    } as UserDTO;
    store.dispatch(UserActions.profileSaved({ profile }));
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/notifications/preferences'))
      .flush({
        inAppEnabled: true,
        emailEnabled: false,
        enabledEventTypes: ['NEW_MATCH'],
        emailCadence: 'DAILY',
        emailAddress: null,
        nextEmailAt: null,
        updatedAt: null,
        emailDeliveryEnabled: false,
      });
    fixture.componentInstance.firstName = 'Edited';
    fixture.componentInstance.saveProfile();
    http
      .expectOne((r) => r.url.endsWith('/users/me'))
      .flush({ message: 'Please retry' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.componentInstance.firstName).toBe('Edited');
    expect(store.selectSignal(selectUserState)().profile?.firstName).toBe('Original');
    expect(store.selectSignal(selectUserState)().profileError).toBeTruthy();
    fixture.componentInstance.saveProfile();
    http.expectOne((r) => r.url.endsWith('/users/me')).flush({ ...profile, firstName: 'Edited' });
    fixture.detectChanges();
    expect(store.selectSignal(selectUserState)().profile?.firstName).toBe('Edited');
    expect(store.selectSignal(selectUserState)().profileError).toBeNull();
    http.verify();
  });
  it('saves notification preferences without dropping contact requests or unknown event types', () => {
    TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true } },
      ],
    });
    const store = TestBed.inject(Store),
      http = TestBed.inject(HttpTestingController);
    store.dispatch(
      UserActions.profileSaved({
        profile: { id: 1, email: 'a@b.test', persona: 'USER' } as UserDTO,
      }),
    );
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const prefs = {
      inAppEnabled: true,
      emailEnabled: false,
      enabledEventTypes: ['NEW_MATCH', 'CONTACT_REQUEST', 'FUTURE_EVENT'],
      emailCadence: 'DAILY',
      emailAddress: null,
      nextEmailAt: null,
      updatedAt: null,
      emailDeliveryEnabled: false,
    };
    http.expectOne((r) => r.url.endsWith('/notifications/preferences')).flush(prefs);
    fixture.detectChanges();
    fixture.componentInstance.delivery.newMatch = false;
    fixture.componentInstance.saveDelivery();
    const put = http.expectOne(
      (r) => r.method === 'PUT' && r.url.endsWith('/notifications/preferences'),
    );
    expect([...put.request.body.enabledEventTypes].sort()).toEqual([
      'CONTACT_REQUEST',
      'FUTURE_EVENT',
    ]);
    put.flush({ ...prefs, enabledEventTypes: ['CONTACT_REQUEST', 'FUTURE_EVENT'] });
    http.verify();
  });
});
