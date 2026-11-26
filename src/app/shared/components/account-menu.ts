import { Component, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Workspace } from '../data/workspace';
import { HOME_BUYER, ROLE_LABELS } from '../../core/models/account';
import { Icon } from './icon/icon';

/**
 * The avatar in the top bar and its menu: Settings and Sign out. A disclosure (button plus panel),
 * closed by Escape, a click outside or navigation; focus returns to the avatar.
 */
@Component({
  selector: 'gz-account-menu',
  imports: [RouterLink, Icon],
  host: {
    '(document:keydown.escape)': 'escape()',
    '(document:click)': 'outside($event)',
  },
  template: `
    <button
      type="button"
      class="account-trigger avatar"
      #trigger
      [attr.aria-expanded]="open()"
      aria-controls="account-menu"
      [attr.aria-label]="'Account: ' + (name() || 'signed in')"
      (click)="open.set(!open())"
    >
      @if (initial(); as i) {
        {{ i }}
      } @else {
        <gz-icon name="user" />
      }
    </button>
    @if (open()) {
      <div id="account-menu" class="menu-panel account-menu" #panel>
        <div class="menu-meta">
          <b>{{ name() || 'Signed in' }}</b>
          @if (accountLabel(); as label) {
            {{ label }}
          }
        </div>
        <a routerLink="/settings" (click)="open.set(false)"><gz-icon name="settings" />Settings</a>
        <button type="button" (click)="w.signOut()"><gz-icon name="sign-out" />Sign out</button>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }
    .account-trigger {
      border: 0;
      padding: 0;
    }
    .account-trigger:hover {
      background: var(--rule-strong);
    }
  `,
})
export class AccountMenu {
  readonly w = inject(Workspace);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly open = signal(false);
  readonly name = computed(() => {
    const p = this.w.account().profile;
    return [p?.firstName, p?.lastName].filter(Boolean).join(' ') || p?.username || '';
  });
  readonly initial = computed(() => this.name().slice(0, 1).toUpperCase());
  /** The account type (from the entitlements), and a role waiting for approval. */
  readonly accountLabel = computed(() => {
    if (!this.w.access().entitlements.value) return null;
    const type = this.w.accountType();
    const pending = this.w.pendingRoles()[0];
    const label = type ? ROLE_LABELS[type] : HOME_BUYER;
    return pending && !type ? label + ' · ' + ROLE_LABELS[pending] + ' pending approval' : label;
  });
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  constructor() {
    afterRenderEffect(() => {
      if (this.open()) this.panel()?.nativeElement.querySelector<HTMLElement>('a, button')?.focus();
    });
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e instanceof NavigationStart) this.open.set(false);
      });
  }
  escape() {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }
  outside(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
