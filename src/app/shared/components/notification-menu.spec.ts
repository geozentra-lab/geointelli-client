import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore, Store } from '@ngrx/store';
import { NotificationMenu } from './notification-menu';
import { notificationsReducer } from '../../store/notifications/notifications.reducer';
import { NotificationsActions as A } from '../../store/notifications/notifications.actions';
import { KeycloakService } from '../../core/auth/keycloak.service';

describe('Notification popup', () => {
  it('toggles, displays only the latest five, links to details and marks an item read', async () => {
    TestBed.configureTestingModule({
      imports: [NotificationMenu],
      providers: [
        provideRouter([]),
        provideStore({ notifications: notificationsReducer }),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true } },
      ],
    });
    const store = TestBed.inject(Store);
    const items = Array.from({ length: 7 }, (_, i) => ({
      id: 7 - i,
      title: 'Activity ' + (6 - i),
      message: 'Match found',
      eventType: 'NEW_MATCH',
      propertyId: null,
      alertRuleId: 1,
      savedSearchId: 2,
      payload: null,
      occurredAt: '2026-10-30T12:00:00Z',
      createdAt: '2026-10-30T12:00:00Z',
      read: false,
      readAt: null,
    }));
    store.dispatch(
      A.loaded({
        page: {
          content: items,
          page: 0,
          size: 5,
          totalElements: 7,
          totalPages: 2,
          first: true,
          last: false,
        },
      }),
    );
    const fixture = TestBed.createComponent(NotificationMenu);
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();
    const panel = document.querySelector('#notification-popup')!;
    expect(panel.querySelectorAll('li')).toHaveLength(5);
    expect(panel.querySelector('h3')?.textContent).toBe('Activity 6');
    expect(panel.querySelector('.notification-meta a')?.getAttribute('href')).toBe('/alerts');
    fixture.componentInstance.read(7);
    expect(fixture.componentInstance.unread()).toBe(5);
    store.dispatch(
      A.readSaved({ item: { ...items[0], read: true, readAt: '2026-10-30T12:01:00Z' } }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.unread()).toBe(4);
    expect(document.querySelector('#notification-popup')).toBeNull();
    trigger.click();
    fixture.detectChanges();
    document
      .querySelector('.notification-backdrop')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    trigger.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    fixture.destroy();
  });
});
