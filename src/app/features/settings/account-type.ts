import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { RequestStatus } from '../../shared/components/request-status';
import { formatLocalDate } from '../../shared/data/format';
import { AccountActions } from '../../store/account/account.actions';
import { selectPendingRoleRequest } from '../../store/account/account.selectors';
import {
  AREA_LABELS,
  HOME_BUYER,
  ProfessionalRole,
  ROLE_LABELS,
  RequestableRole,
} from '../../core/models/account';
import { RealtorLicense } from './realtor-license';
import { readableErrors } from '../onboarding/onboarding';

/**
 * Settings, Account type (backend SCRUM-204, section 4). One professional role per account, and an
 * administrator approves it:
 * - a professional role: shown, with no change option (support changes it);
 * - a pending role request: "Pending approval" and Cancel (a pending license can't be withdrawn);
 * - a home buyer with nothing pending: investor, lender or realtor, as on the onboarding page.
 * The backend's 409 message is shown as it is.
 */
@Component({
  selector: 'gz-account-type',
  imports: [FormsModule, RequestStatus, RealtorLicense, ...RECORD_KIT],
  styleUrl: './settings.css',
  template: `
    <section id="account-type" class="se" aria-labelledby="se-type-title">
      <div class="se-head">
        <h2 id="se-type-title">Account type</h2>
        <p>What your account adds to the home buyer pages.</p>
      </div>
      <div class="se-body">
        <gz-request-status
          [loading]="a().entitlements.loading && !a().entitlements.value"
          loadingText="Loading your account type…"
          [error]="a().entitlements.value ? null : a().entitlements.error"
          (retry)="reload()"
        />
        @if (a().entitlements.value) {
          <gz-record-group>
            <div gz-record-row label="Account type">{{ type() ? label(type()!) : home }}</div>
            @if (type(); as t) {
              <div gz-record-row label="Adds">{{ area(t) }}</div>
            } @else if (pendingRequest(); as r) {
              <div gz-record-row label="Requested">
                {{ label(r.role) }} · Pending approval since {{ day(r.createdAt) }}
              </div>
              @if (r.organizationName) {
                <div gz-record-row label="Organization">{{ r.organizationName }}</div>
              }
            } @else if (licensePending()) {
              <div gz-record-row label="Requested">Realtor · License under review</div>
            }
          </gz-record-group>

          @if (type()) {
            <p class="se-text">To change your account type, contact support.</p>
          } @else if (pendingRequest(); as r) {
            <p class="se-text">You keep the home buyer pages while you wait. You can cancel the request until an administrator decides.</p>
            <div class="se-actions">
              <button type="button" class="btn" [attr.aria-disabled]="a().cancelling ? 'true' : null" (click)="cancel(r.id)">
                {{ a().cancelling === r.id ? 'Cancelling…' : 'Cancel request' }}
              </button>
            </div>
            @if (a().cancelError; as error) {
              <p class="field-error se-error" role="alert">{{ error }}</p>
            }
          } @else if (licensePending()) {
            <p class="se-text">Your license is with an administrator. A license under review can’t be withdrawn; you’ll see the decision here and in the banner.</p>
          } @else {
            @if (lastRejection(); as r) {
              <p class="se-text attention" role="status">
                Your {{ word(r.role) }} request was declined{{ r.decidedAt ? ' on ' + day(r.decidedAt) : '' }}:
                {{ r.decisionReason ? r.decisionReason : 'no reason was given.' }}
              </p>
            }
            <fieldset>
              <legend>Add a professional account type</legend>
              @for (o of options; track o.role) {
                <label class="se-choice">
                  <input type="radio" name="account-type" [value]="o.role" [ngModel]="choice()" (ngModelChange)="choice.set($event)" />
                  <span>{{ o.label }}</span>
                  <small>{{ o.what }}</small>
                </label>
              }
              <p class="se-hint">An administrator approves it. One professional type per account.</p>
            </fieldset>
            @if (choice() === 'realtor') {
              @if (w.account().profile?.realtorLicenseStatus) {
                <!-- Settings already shows the license section (an earlier submission): one form only. -->
                <p class="se-text">Submit your license again in Realtor license, below.</p>
              } @else {
                <gz-realtor-license />
              }
            } @else if (choice(); as role) {
              <form class="se-block" (ngSubmit)="request(role)" [attr.aria-label]="'Request ' + word(role) + ' access'">
                <div class="se-fields">
                  @if (role === 'lender') {
                    <div class="formfield">
                      <label for="at-org">Organization <span class="optional">(optional)</span></label>
                      <input id="at-org" name="organizationName" maxlength="160" autocomplete="organization" [ngModel]="organization()" (ngModelChange)="organization.set($event)" />
                    </div>
                  }
                  <div class="formfield se-wide">
                    <label for="at-note">Note for the administrator <span class="optional">(optional)</span></label>
                    <textarea id="at-note" name="note" rows="3" maxlength="1000" [ngModel]="note()" (ngModelChange)="note.set($event)"></textarea>
                  </div>
                </div>
                <div class="se-actions">
                  <button class="btn primary" [attr.aria-disabled]="a().choosing ? 'true' : null">
                    {{ a().choosing === role ? 'Sending…' : 'Request ' + word(role) + ' access' }}
                  </button>
                </div>
              </form>
            }
            @if (a().chooseError; as error) {
              <p class="field-error se-error" role="alert">{{ readable(error) }}</p>
            }
          }
        }
      </div>
    </section>
  `,
})
export class AccountType {
  readonly w = inject(Workspace);
  readonly a = this.w.access;
  readonly home = HOME_BUYER;
  readonly type = this.w.accountType;
  readonly pendingRequest = this.w.store.selectSignal(selectPendingRoleRequest);
  readonly licensePending = computed(() => this.w.pendingRoles().includes('realtor'));
  /** The newest request, when it was rejected: its reason is shown above the choices. */
  readonly lastRejection = computed(() => {
    const newest = this.a().roleRequests.value?.[0];
    return newest?.status === 'REJECTED' ? newest : null;
  });
  readonly options: { role: ProfessionalRole; label: string; what: string }[] = [
    { role: 'investor', label: 'Investor', what: 'Portfolios, scenarios, rental analysis and opportunity scores.' },
    { role: 'lender', label: 'Lender', what: 'Loan applications, the pipeline and collateral checks for your organization.' },
    { role: 'realtor', label: 'Realtor', what: 'A CRM for clients, leads, tasks and deals, after your Florida license is verified.' },
  ];
  readonly choice = signal<ProfessionalRole | null>(null);
  readonly note = signal('');
  readonly organization = signal('');
  readonly readable = readableErrors;

  constructor() {
    // The overview and the banner link here with #account-type.
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    const host = inject(ElementRef<HTMLElement>);
    afterNextRender(() => {
      if (fragment === 'account-type') host.nativeElement.scrollIntoView({ block: 'start' });
    });
    // The requests say which one Cancel acts on, and why the last one was declined.
    effect(() => {
      if (this.w.auth.isLoggedIn())
        untracked(() => {
          const r = this.a().roleRequests;
          if (!r.value && !r.loading) this.w.store.dispatch(AccountActions.loadRoleRequests());
        });
    });
  }
  label(role: ProfessionalRole) {
    return ROLE_LABELS[role];
  }
  word(role: ProfessionalRole) {
    return ROLE_LABELS[role].toLowerCase();
  }
  area(role: ProfessionalRole) {
    return AREA_LABELS[role];
  }
  day(iso: string) {
    return formatLocalDate(iso);
  }
  reload() {
    this.w.store.dispatch(AccountActions.loadEntitlements());
  }
  cancel(id: number) {
    if (this.a().cancelling) return;
    this.w.store.dispatch(AccountActions.cancelRoleRequest({ id }));
  }
  request(role: RequestableRole | ProfessionalRole) {
    if (role === 'realtor' || this.a().choosing) return;
    const note = this.note().trim();
    const organizationName = role === 'lender' ? this.organization().trim() : '';
    this.w.store.dispatch(
      AccountActions.requestRole({
        request: { role, ...(organizationName ? { organizationName } : {}), ...(note ? { note } : {}) },
      }),
    );
  }
}
