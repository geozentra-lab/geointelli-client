import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, NavigationStart } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Workspace } from '../data/workspace';
import { NotificationsActions as A } from '../../store/notifications/notifications.actions';
import { notificationUrl } from '../../core/models/notification';
import { RequestStatus } from './request-status';
import { Icon } from './icon/icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bell button with a popup of recent notifications. The popup is a plain positioned panel with its
 * own focus trap: the shell loads on every page, and the CDK overlay it replaced was the largest
 * avoidable part of the initial bundle.
 */
@Component({
  selector: 'gz-notification-menu',
  imports: [RequestStatus, DatePipe, RouterLink, Icon],
  host: { '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <button
      type="button"
      class="iconbtn notification-trigger"
      #trigger
      (click)="open.set(!open())"
      [attr.aria-label]="unread() ? 'Notifications, ' + unread() + ' unread' : 'Notifications'"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? 'notification-popup' : null"
    >
      <gz-icon name="bell" />
      @if (unread()) {
        <span class="notification-dot" aria-hidden="true"></span>
      }
    </button>
    @if (open()) {
      <div class="notification-backdrop" (click)="close()"></div>
      <section
        id="notification-popup"
        class="notification-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-title"
        #popup
        (keydown)="trapFocus($event)"
      >
        <div class="notification-header">
          <div>
            <h2 id="notification-title">Notifications</h2>
            <p>Your latest notifications</p>
          </div>
          <button
            type="button"
            class="iconbtn"
            aria-label="Close notifications"
            (click)="close()"
            #closeButton
          >
            &times;
          </button>
        </div>
        @if (w.auth.isLoggedIn()) {
          <gz-request-status
            [loading]="state().loading && !state().loaded"
            [error]="state().error"
            (retry)="refresh()"
          />
          @if (state().readError) {
            <p class="notification-error" role="alert">
              Could not mark the notification read. Open its details again to retry.
            </p>
          }
        }
        @if (items().length) {
          <ul>
            @for (item of items(); track item.id) {
              <li [class.unread]="!item.read">
                <span class="activity-icon"><gz-icon name="bell" /></span>
                <div class="notification-body">
                  <h3>{{ item.title }}</h3>
                  <p>{{ item.message }}</p>
                  <div class="notification-meta">
                    <time [attr.datetime]="item.createdAt">{{
                      item.createdAt
                        | date: (isToday(item.createdAt) ? 'shortTime' : 'MMM d, h:mm a')
                    }}</time>
                    <a
                      [routerLink]="url(item)"
                      (click)="read(item.id)"
                      [attr.aria-label]="'View details: ' + item.title"
                      >View details <gz-icon name="arrow"
                    /></a>
                  </div>
                </div>
              </li>
            }
          </ul>
        } @else if (!state().loading && !state().error) {
          <div class="notification-empty">
            <gz-icon name="bell" />
            <h3>You're all caught up</h3>
            <p>
              {{
                w.auth.isLoggedIn()
                  ? 'You have no notifications yet.'
                  : 'Sign in to receive updates about your activity.'
              }}
            </p>
          </div>
        }
        <a class="notification-footer" routerLink="/alerts" (click)="open.set(false)"
          >Manage alert rules <gz-icon name="arrow"
        /></a>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        position: relative;
      }
      .notification-trigger {
        position: relative;
      }
      .notification-dot {
        position: absolute;
        right: 8px;
        top: 8px;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #ad724c;
        border: 1px solid #fff;
      }
      .notification-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
      }
      .notification-popup {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        z-index: 1001;
        width: min(380px, calc(100vw - 24px));
        max-height: calc(100dvh - 100px);
        overflow-y: auto;
        background: white;
        border: 1px solid var(--line);
        border-radius: var(--radius-xl);
        box-shadow: 0 12px 40px #17273526;
        color: var(--ink);
      }
      @media (max-width: 650px) {
        .notification-popup {
          position: fixed;
          top: 70px;
          left: 12px;
          right: 12px;
          width: auto;
        }
      }
      .notification-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px;
        border-bottom: 1px solid var(--line);
      }
      h2 {
        font-size: 16px;
        margin: 0;
      }
      h3 {
        font-size: 13px;
        margin: 0 0 5px;
        font-weight: 600;
      }
      p {
        font-size: 12px;
        line-height: 1.5;
        margin: 0;
        color: var(--ink-2);
      }
      .notification-header p {
        margin-top: 4px;
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      li {
        display: flex;
        gap: 12px;
        padding: 14px 18px;
        border-bottom: 1px solid #edf0f2;
      }
      li.unread {
        background: #faf7f4;
      }
      .activity-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #edf1f4;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .notification-body {
        min-width: 0;
        flex: 1;
        overflow-wrap: anywhere;
      }
      .notification-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 8px;
      }
      time {
        font-size: 11px;
        color: var(--muted);
      }
      .notification-meta a {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 600;
        min-height: 28px;
      }
      .notification-error {
        padding: 12px 18px;
        color: var(--danger);
      }
      .notification-empty {
        text-align: center;
        padding: 30px 24px;
      }
      .notification-empty > gz-icon {
        color: var(--muted);
        margin-bottom: 12px;
      }
      .notification-empty h3 {
        font-size: 14px;
      }
      .notification-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px;
        font-size: 12px;
        font-weight: 600;
      }
      .notification-footer:hover,
      .notification-meta a:hover {
        color: #ad724c;
      }
    `,
  ],
})
export class NotificationMenu {
  readonly w = inject(Workspace);
  readonly open = signal(false);
  readonly state = this.w.notifications;
  readonly items = computed(() => this.state().items);
  readonly url = notificationUrl;
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popup = viewChild<ElementRef<HTMLElement>>('popup');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  isToday(value: string) {
    return new Date(value).toDateString() === new Date().toDateString();
  }
  readonly unread = computed(() => this.items().filter((item) => !item.read).length);
  constructor() {
    effect(() => {
      if (this.open()) this.refresh();
    });
    // Focus lands on the close button once the popup exists, so keyboard users start inside it.
    afterRenderEffect(() => {
      if (this.open()) this.closeButton()?.nativeElement.focus();
    });
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.open.set(false);
      });
  }
  close() {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }
  onEscape(event: Event) {
    if (!this.open()) return;
    event.preventDefault();
    this.close();
  }
  /** Keeps Tab inside the popup while it is open, like a modal dialog. */
  trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const popup = this.popup()?.nativeElement;
    if (!popup) return;
    const focusable = Array.from(popup.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  refresh() {
    if (this.w.auth.isLoggedIn()) this.w.store.dispatch(A.load());
  }
  read(id: number) {
    if (!this.items().find((item) => item.id === id)?.read && !this.state().pending.includes(id))
      this.w.store.dispatch(A.markRead({ id }));
    this.open.set(false);
  }
}
