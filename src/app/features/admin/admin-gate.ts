import { Component, Signal, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';

export type AdminAccess = 'guest' | 'denied' | 'admin';

/**
 * Who is looking: a guest, a signed-in account without the administration feature (entitlements,
 * backend SCRUM-204), or an admin. Until the entitlements arrive the token's admin role decides, so
 * an admin never sees "no access" flash by.
 */
export function adminAccess(): Signal<AdminAccess> {
  const w = inject(Workspace);
  return computed(() => {
    if (!w.auth.isLoggedIn()) return 'guest';
    const known = w.access().entitlements.value;
    const admin = known ? known.features.administration : w.auth.hasRealmRole('admin');
    return admin ? 'admin' : 'denied';
  });
}

/** What a guest or a non-admin sees on an admin page: one section that says why, and a way on. */
@Component({
  selector: 'gz-admin-gate',
  imports: [RouterLink],
  template: `
    <section class="ag" aria-labelledby="ag-title">
      @if (access() === 'guest') {
        <h2 id="ag-title">Sign in as an administrator</h2>
        <p>Only accounts with the admin role can open {{ what() }}.</p>
        <button type="button" class="btn primary" (click)="w.signIn()">Sign in</button>
      } @else {
        <h2 id="ag-title">Admin role needed</h2>
        <p>Your account doesn’t have the admin role, so it can’t open {{ what() }}.</p>
        <a class="btn" routerLink="/dashboard">Back to overview</a>
      }
    </section>
  `,
  styles: `
    .ag {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
      max-width: 720px;
    }
    h2 {
      margin: 0;
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    p {
      margin: var(--sp-8) 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    @media (max-width: 700px) {
      .ag {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
    }
  `,
})
export class AdminGate {
  readonly w = inject(Workspace);
  readonly access = input.required<AdminAccess>();
  /** The page as an object of a sentence: "the import jobs", "the data-quality report". */
  readonly what = input.required<string>();
}
