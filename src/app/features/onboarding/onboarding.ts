import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { RealtorLicense } from '../settings/realtor-license';
import { AccountActions } from '../../store/account/account.actions';
import { RequestableRole } from '../../core/models/account';

type Choice = 'buyer' | 'investor' | 'realtor' | 'lender';
const FIELD_LABELS: Record<string, string> = {
  note: 'Note',
  organizationName: 'Organization',
  role: 'Account type',
};
/** "note: size must be between 0 and 1000; role: …" in the words of the form. */
export const readableErrors = (message: string) =>
  message.replace(/\b(note|organizationName|role):/g, (_, field: string) => FIELD_LABELS[field] + ':');

/**
 * The onboarding page (backend SCRUM-204), shown once to a new account. Four choices; every one
 * answers the page. Home buyer opens the app at once. Investor and lender send a role request and
 * realtor a license, which an administrator approves; meanwhile the home-buyer pages work and a
 * banner says what is pending. Admin is never offered: it isn't an account type.
 */
@Component({
  imports: [FormsModule, PageHeading, RequestStatus, RealtorLicense],
  template: `
    <div class="ob-page">
      <gz-heading
        title="Choose your account type"
        subtitle="Every account can search, save and compare properties. A professional account adds its own tools once an administrator approves it."
      />
      @if (!entitlements().value) {
        <gz-request-status
          [loading]="entitlements().loading || !entitlements().error"
          loadingText="Loading your account…"
          [error]="entitlements().error"
          (retry)="reload()"
        />
      } @else {
        <ol class="ob-choices">
          <li [class.open]="chosen() === 'buyer'">
            <div class="ob-row">
              <div class="ob-what">
                <h2>Home buyer</h2>
                <p>Search the map, save properties and searches, get matches and alerts, and use the mortgage and affordability calculators.</p>
              </div>
              <button type="button" class="btn primary" [attr.aria-disabled]="busy() ? 'true' : null" (click)="continueAsBuyer()">
                {{ a().choosing === 'buyer' ? 'Opening…' : 'Continue as a home buyer' }}
              </button>
            </div>
          </li>
          <li [class.open]="chosen() === 'investor'">
            <div class="ob-row">
              <div class="ob-what">
                <h2>Investor</h2>
                <p>Adds portfolios with holdings and records, scenarios, rental analysis and opportunity scores.</p>
              </div>
              @if (chosen() !== 'investor') {
                <button type="button" class="btn" (click)="choose('investor')">Request investor access</button>
              }
            </div>
            @if (chosen() === 'investor') {
              <form class="ob-form" (ngSubmit)="request('investor')" aria-label="Request investor access">
                <div class="formfield">
                  <label for="ob-investor-note">Note for the administrator <span class="optional">(optional)</span></label>
                  <textarea id="ob-investor-note" name="note" rows="3" maxlength="1000" [ngModel]="note()" (ngModelChange)="note.set($event)"></textarea>
                </div>
                <p class="ob-hint">An administrator approves it. Until then you use the home buyer pages.</p>
                <div class="ob-actions">
                  <button class="btn primary" [attr.aria-disabled]="busy() ? 'true' : null">
                    {{ a().choosing === 'investor' ? 'Sending…' : 'Send request' }}
                  </button>
                  <button type="button" class="btn" (click)="choose(null)">Back</button>
                </div>
              </form>
            }
          </li>
          <li [class.open]="chosen() === 'realtor'">
            <div class="ob-row">
              <div class="ob-what">
                <h2>Realtor</h2>
                <p>Adds a CRM for clients, leads, tasks and deals. Once approved, home buyers can choose you in “Contact a realtor”.</p>
              </div>
              @if (chosen() !== 'realtor') {
                <button type="button" class="btn" (click)="choose('realtor')">Verify your license</button>
              }
            </div>
            @if (chosen() === 'realtor') {
              <div class="ob-license">
                <gz-realtor-license />
                <button type="button" class="btn" (click)="choose(null)">Back</button>
              </div>
            }
          </li>
          <li [class.open]="chosen() === 'lender'">
            <div class="ob-row">
              <div class="ob-what">
                <h2>Lender</h2>
                <p>Adds loan applications, the pipeline and collateral checks for your organization.</p>
              </div>
              @if (chosen() !== 'lender') {
                <button type="button" class="btn" (click)="choose('lender')">Request lender access</button>
              }
            </div>
            @if (chosen() === 'lender') {
              <form class="ob-form" (ngSubmit)="request('lender')" aria-label="Request lender access">
                <div class="formfield">
                  <label for="ob-lender-org">Organization <span class="optional">(optional)</span></label>
                  <input id="ob-lender-org" name="organizationName" maxlength="160" autocomplete="organization" [ngModel]="organization()" (ngModelChange)="organization.set($event)" />
                </div>
                <div class="formfield">
                  <label for="ob-lender-note">Note for the administrator <span class="optional">(optional)</span></label>
                  <textarea id="ob-lender-note" name="note" rows="3" maxlength="1000" [ngModel]="note()" (ngModelChange)="note.set($event)"></textarea>
                </div>
                <p class="ob-hint">An administrator approves it. Until then you use the home buyer pages.</p>
                <div class="ob-actions">
                  <button class="btn primary" [attr.aria-disabled]="busy() ? 'true' : null">
                    {{ a().choosing === 'lender' ? 'Sending…' : 'Send request' }}
                  </button>
                  <button type="button" class="btn" (click)="choose(null)">Back</button>
                </div>
              </form>
            }
          </li>
        </ol>
        @if (a().chooseError; as error) {
          <p class="field-error ob-error" role="alert">{{ readable(error) }}</p>
        }
      }
    </div>
  `,
  styles: `
    .ob-page {
      max-width: 880px;
    }
    .ob-choices {
      margin: 0;
      padding: 0;
      list-style: none;
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    .ob-choices > li {
      padding: var(--sp-16) var(--sp-24);
      border-bottom: 1px solid var(--rule);
    }
    .ob-choices > li.open {
      box-shadow: inset 3px 0 0 var(--copper);
    }
    .ob-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-16);
    }
    .ob-what h2 {
      margin: 0;
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .ob-what p {
      margin: var(--sp-4) 0 0;
      max-width: 60ch;
      color: var(--ink-2);
      font-size: var(--fs-body);
    }
    .ob-row > .btn {
      flex: none;
    }
    .ob-form,
    .ob-license {
      display: grid;
      gap: var(--sp-12);
      margin-top: var(--sp-16);
      max-width: 640px;
    }
    .ob-license {
      max-width: none;
      justify-items: start;
    }
    .ob-license gz-realtor-license {
      justify-self: stretch;
    }
    .ob-hint {
      margin: 0;
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .ob-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-8);
    }
    .ob-error {
      margin-top: var(--sp-12);
    }
    @media (max-width: 700px) {
      .ob-choices > li {
        padding: var(--sp-16);
      }
      .ob-row {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `,
})
export class Onboarding {
  readonly w = inject(Workspace);
  private readonly router = inject(Router);
  readonly a = this.w.access;
  readonly entitlements = computed(() => this.a().entitlements);
  readonly chosen = signal<Choice | null>(null);
  readonly note = signal('');
  readonly organization = signal('');
  readonly busy = computed(() => this.a().choosing !== null);
  readonly readable = readableErrors;

  constructor() {
    // Answered (by any choice), or nothing to answer: the app opens on the overview.
    effect(() => {
      const e = this.entitlements().value;
      const guest = !this.w.auth.isLoggedIn();
      if (guest || e?.onboardingCompleted)
        untracked(() => void this.router.navigate(['/dashboard'], { replaceUrl: true }));
    });
  }
  reload() {
    this.w.store.dispatch(AccountActions.loadEntitlements());
  }
  choose(choice: Choice | null) {
    if (this.busy()) return;
    this.chosen.set(choice);
  }
  continueAsBuyer() {
    if (this.busy()) return;
    this.chosen.set('buyer');
    this.w.store.dispatch(AccountActions.continueAsHomeBuyer());
  }
  request(role: RequestableRole) {
    if (this.busy()) return;
    const note = this.note().trim();
    const organizationName = role === 'lender' ? this.organization().trim() : '';
    this.w.store.dispatch(
      AccountActions.requestRole({
        request: {
          role,
          ...(organizationName ? { organizationName } : {}),
          ...(note ? { note } : {}),
        },
      }),
    );
  }
}
