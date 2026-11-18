import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideStore, Store } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { NotificationsEffects } from './notifications.effects';
import { notificationsReducer } from './notifications.reducer';
import { NotificationsActions as A } from './notifications.actions';
import { selectNotifications } from './notifications.selectors';
import { UserActions } from '../user/user.actions';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { SessionEvents } from '../../core/auth/session-events';
import { environment } from '../../../environments/environment';
import { UserDTO } from '../../core/models/api';
import { NotificationDTO } from '../../core/models/notification';
const item: NotificationDTO = {
  id: 41,
  eventType: 'NEW_MATCH',
  title: 'New matches',
  message: 'Two properties match your search',
  propertyId: 42,
  alertRuleId: 1,
  savedSearchId: 2,
  payload: {},
  occurredAt: '2026-10-30T12:00:00Z',
  createdAt: '2026-10-30T12:01:00Z',
  readAt: null,
  read: false,
};
const page = {
  content: [item],
  page: 0,
  size: 5,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};
describe('Notification inbox API and effects', () => {
  let http: HttpTestingController, store: Store;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore({ notifications: notificationsReducer }),
        provideEffects(NotificationsEffects),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });
  it('requests five owned notifications and acknowledges read only after PATCH succeeds', () => {
    store.dispatch(A.load());
    const request = http.expectOne(
      (r) => r.url === environment.notificationApiUrl + '/notifications',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('size')).toBe('5');
    expect(request.request.params.get('page')).toBe('0');
    request.flush(page);
    store.dispatch(A.markRead({ id: 41 }));
    expect(store.selectSignal(selectNotifications)().items[0].read).toBe(false);
    const patch = http.expectOne(environment.notificationApiUrl + '/notifications/41');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ read: true });
    patch.flush({ ...item, read: true, readAt: '2026-10-30T12:02:00Z' });
    expect(store.selectSignal(selectNotifications)().items[0].read).toBe(true);
  });
  it('preserves unread state after write failure and cancels stale inbox reads before a write', () => {
    store.dispatch(A.loaded({ page }));
    store.dispatch(A.load());
    const stale = http.expectOne((r) => r.url.endsWith('/notifications'));
    store.dispatch(A.markRead({ id: 41 }));
    expect(stale.cancelled).toBe(true);
    http
      .expectOne(environment.notificationApiUrl + '/notifications/41')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(store.selectSignal(selectNotifications)().items[0].read).toBe(false);
    expect(store.selectSignal(selectNotifications)().readError).toBeTruthy();
    store.dispatch(A.markRead({ id: 41 }));
    http
      .expectOne(environment.notificationApiUrl + '/notifications/41')
      .flush({ ...item, read: true });
    expect(store.selectSignal(selectNotifications)().readError).toBeNull();
  });
  it('polls after account restoration and cancels reads and timers at session end', () => {
    store.dispatch(UserActions.loaded({ profile: {} as UserDTO }));
    vi.advanceTimersByTime(0);
    http.expectOne((r) => r.url.endsWith('/notifications')).flush(page);
    vi.advanceTimersByTime(30000);
    const active = http.expectOne((r) => r.url.endsWith('/notifications'));
    TestBed.inject(SessionEvents).end();
    store.dispatch(UserActions.signedOut());
    expect(active.cancelled).toBe(true);
    vi.advanceTimersByTime(60000);
    http.expectNone((r) => r.url.endsWith('/notifications'));
  });
});
