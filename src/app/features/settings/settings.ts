import { Component, computed, effect, inject, untracked } from '@angular/core';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { ProfileForm } from './profile-form';
import { PreferencesForm } from './preferences-form';
import { NotificationForm } from './notification-form';
import { RealtorLicense } from './realtor-license';
import { AccountType } from './account-type';

/**
 * Settings (DESIGN.md §5 Record, Settings): h1 "Settings" with Sign out on the right, then one
 * section each for the profile (name), the account type (backend SCRUM-204), property preferences,
 * notifications and, for realtors or anyone with a submission, the realtor license.
 * Each section is its own form with its own Save; none of them reloads the others.
 */
@Component({
  imports: [PageHeading, RequestStatus, ProfileForm, AccountType, PreferencesForm, NotificationForm, RealtorLicense],
  template: `
    <div class="se-page">
      <gz-heading title="Settings" [subtitle]="subtitle()">
        @if (w.auth.isLoggedIn()) {
          <button type="button" class="btn" (click)="w.signOut()">Sign out</button>
        }
      </gz-heading>
      @if (!w.auth.isLoggedIn()) {
        <section class="se-guest" aria-labelledby="se-guest-title">
          <h2 id="se-guest-title">Sign in to change your settings</h2>
          <p>Your profile, property preferences and notifications are kept with your account.</p>
          <div class="se-buttons">
            <button type="button" class="btn primary" (click)="w.signIn()">Sign in</button>
            <button type="button" class="btn" (click)="w.signUp()">Create account</button>
          </div>
        </section>
      } @else if (w.account().profile) {
        <div class="se-sections">
          <gz-profile-form />
          <gz-account-type />
          <gz-preferences-form />
          <gz-notification-form />
          @if (showLicense()) {
            <gz-realtor-license />
          }
        </div>
      } @else {
        <gz-request-status
          [loading]="w.account().loading || !w.account().error"
          loadingText="Loading your profile…"
          [error]="w.account().error"
          (retry)="w.reloadUser()"
        />
      }
    </div>
  `,
  styles: `
    .se-page {
      max-width: 1200px;
    }
    .se-sections {
      display: grid;
      gap: var(--sp-24);
    }
    .se-guest {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
      max-width: 720px;
    }
    .se-guest h2 {
      margin: 0;
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .se-guest p {
      margin: var(--sp-8) 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .se-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-8);
    }
    @media (max-width: 700px) {
      .se-sections {
        gap: var(--sp-16);
      }
    }
  `,
})
export class Settings {
  readonly w = inject(Workspace);
  /** Realtors, and anyone who has submitted a license (the profile carries its latest status). */
  readonly showLicense = computed(() => {
    const p = this.w.account().profile;
    return this.w.accountType() === 'realtor' || !!p?.realtorLicenseStatus;
  });
  readonly subtitle = computed(() =>
    this.w.auth.isLoggedIn()
      ? 'Your profile, account type, property preferences and notifications' + (this.showLicense() ? ', and your realtor license.' : '.')
      : '',
  );

  constructor() {
    // The profile, once signed in, when nothing has asked for it yet.
    effect(() => {
      if (!this.w.auth.isLoggedIn()) return;
      untracked(() => {
        const a = this.w.account();
        if (!a.profile && !a.loading) this.w.reloadUser();
      });
    });
  }
}
