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
import { RequestStatus } from '../../shared/components/request-status';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT } from '../../shared/table';
import { formatLocalDate, formatRecordDate, utcTodayIso } from '../../shared/data/format';
import { RealtorLicenseActions as A } from '../../store/realtor-license/realtor-license.actions';
import { selectRealtorLicense } from '../../store/realtor-license/realtor-license.selectors';
import { LICENSE_STATUS_LABELS, RealtorLicenseVerificationDTO } from '../../core/models/realtor-license';

const STATES: Record<string, string> = { FL: 'Florida' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Settings, Realtor license (SCRUM-200), applicant side: the latest submission as ruled rows with its
 * status in words, a rejection's reason as a sentence, the form when a submission is allowed (none
 * yet, or after a rejection: prefilled from the rejected one), and earlier submissions as a table.
 * An administrator takes the decision.
 */
@Component({
  selector: 'gz-realtor-license',
  imports: [FormsModule, RequestStatus, ...RECORD_KIT, ...TABLE_KIT],
  styleUrl: './settings.css',
  template: `
    <section id="license" class="se" aria-labelledby="license-title">
      <div class="se-head">
        <h2 id="license-title">Realtor license</h2>
        <p>An administrator checks it against the Florida record. The CRM opens once it is verified.</p>
        @if (latest(); as l) {
          <p class="se-meta" [class.attention]="l.status === 'REJECTED'">{{ statusLabel(l.status) }}</p>
        }
      </div>
      <div class="se-body">
        <gz-request-status
          [loading]="s().history.loading && !s().history.value"
          loadingText="Loading your license…"
          [error]="s().history.error"
          (retry)="load()"
        />
        @if (latest(); as l) {
          @if (l.status === 'PENDING_REVIEW') {
            <p class="se-text">Waiting for an administrator’s review. You can submit again only if it is rejected.</p>
          } @else if (l.status === 'REJECTED') {
            <p class="se-text attention" role="status">
              Not verified{{ l.decidedAt ? ' on ' + day(l.decidedAt) : '' }}:
              {{ l.rejectionReason ? l.rejectionReason + '.' : 'no reason was given.' }}
              Correct the details below and submit again.
            </p>
          } @else if (canSubmit()) {
            <p class="se-text attention" role="status">
              This license expired on {{ calendar(l.licenseExpirationDate!) }}. Submit the renewed license below.
            </p>
          }
          <gz-record-group heading="Latest submission">
            <div gz-record-row label="Status">{{ statusLabel(l.status) }}</div>
            <div gz-record-row label="License number">{{ l.licenseNumber }}</div>
            <div gz-record-row label="State">{{ stateName(l.licensingState) }}</div>
            <div gz-record-row label="Name on the license">{{ l.licenseHolderName }}</div>
            @if (l.brokerageName) {
              <div gz-record-row label="Brokerage">{{ l.brokerageName }}</div>
            }
            @if (l.workEmail) {
              <div gz-record-row label="Work email">{{ l.workEmail }}</div>
            }
            @if (l.licenseExpirationDate) {
              <div gz-record-row label="Expires">{{ calendar(l.licenseExpirationDate) }}</div>
            }
            <div gz-record-row label="Submitted">{{ day(l.submittedAt) }}</div>
            @if (l.decidedAt) {
              <div gz-record-row label="Decided">{{ day(l.decidedAt) }}</div>
            }
          </gz-record-group>
        }
        @if (canSubmit()) {
          @if (!latest()) {
            <p class="se-text">Submit your Florida license for review. An administrator checks it against the state record.</p>
          }
          <form (ngSubmit)="submit()" aria-label="Submit your license for verification">
            <fieldset>
              <legend>{{ latest() ? 'Submit again' : 'Your license' }}</legend>
              <div class="se-fields">
                <div class="formfield">
                  <label for="lic-holder">Name on the license</label>
                  <input id="lic-holder" name="holder" maxlength="160" autocomplete="name" [ngModel]="holder()" (ngModelChange)="holder.set($event)" />
                </div>
                <div class="formfield">
                  <label for="lic-number">License number</label>
                  <input id="lic-number" name="number" maxlength="40" [ngModel]="number()" (ngModelChange)="number.set($event)" />
                </div>
                <div class="formfield">
                  <label for="lic-expires">Expires on <span class="optional">(optional)</span></label>
                  <input id="lic-expires" name="expires" type="date" [min]="minDate" max="9999-12-31" [ngModel]="expires()" (ngModelChange)="expires.set($event ?? '')" />
                </div>
                <div class="formfield">
                  <label for="lic-brokerage">Brokerage <span class="optional">(optional)</span></label>
                  <input id="lic-brokerage" name="brokerage" maxlength="160" [ngModel]="brokerage()" (ngModelChange)="brokerage.set($event)" />
                </div>
                <div class="formfield se-wide">
                  <label for="lic-email">Work email <span class="optional">(optional)</span></label>
                  <input id="lic-email" name="email" type="email" maxlength="254" autocomplete="email" [ngModel]="email()" (ngModelChange)="email.set($event)" />
                </div>
              </div>
              <p class="se-hint">State: Florida. Only Florida licenses can be verified today.</p>
            </fieldset>
            <div class="se-actions">
              <button class="btn primary" [attr.aria-disabled]="why() || s().submitting ? 'true' : null"
                [attr.aria-describedby]="why() ? 'lic-why' : null">
                {{ s().submitting ? 'Submitting…' : 'Submit for verification' }}
              </button>
              @if (why(); as reason) {
                <p class="se-why" id="lic-why">{{ reason }}</p>
              }
            </div>
            @if (tried() && !s().submitting && s().submitError; as error) {
              <p class="field-error se-error" role="alert">The license could not be submitted: {{ error }}</p>
            }
          </form>
        }
        @if (earlier().length) {
          <div class="se-block">
            <h3 class="se-legend">Earlier submissions</h3>
            <table gz-table sticky="none" class="lic-table">
              <caption class="sr-only">Earlier license submissions, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Submitted</th>
                  <th scope="col">License number</th>
                  <th scope="col">Status</th>
                  <th scope="col" data-priority="2">Reason</th>
                </tr>
              </thead>
              <tbody>
                @for (h of earlier(); track h.id) {
                  <tr>
                    <td class="nowrap">{{ day(h.submittedAt) }}</td>
                    <td>{{ h.licenseNumber }}</td>
                    <td>
                      {{ statusLabel(h.status) }}
                      @if (h.rejectionReason) {
                        <span class="m-only cell-sub">{{ h.rejectionReason }}</span>
                      }
                    </td>
                    <td data-priority="2">{{ h.rejectionReason }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class RealtorLicense {
  readonly w = inject(Workspace);
  readonly s = this.w.store.selectSignal(selectRealtorLicense);
  readonly latest = computed(() => this.s().history.value?.[0] ?? null);
  readonly earlier = computed(() => this.s().history.value?.slice(1) ?? []);
  /**
   * Allowed with no submission yet, after a rejection, or once a verified license has expired (the
   * expiry run revokes the realtor role; the renewed license is submitted here). As the backend
   * counts it: a verified license with no expiry date, or one expiring today (UTC) or later, blocks.
   */
  readonly canSubmit = computed(() => {
    if (this.s().history.value === null) return false;
    const l = this.latest();
    if (!l || l.status === 'REJECTED') return true;
    return l.status === 'VERIFIED' && !!l.licenseExpirationDate && l.licenseExpirationDate < utcTodayIso();
  });
  /** The backend refuses an expiry before today in UTC (already tomorrow in a US evening). */
  readonly minDate = utcTodayIso();
  readonly holder = signal('');
  readonly number = signal('');
  readonly expires = signal('');
  readonly brokerage = signal('');
  readonly email = signal('');
  /** Submit was pressed on this visit, so a failed submission is this form's to show. */
  readonly tried = signal(false);
  /** The rejected submission the form was filled from. */
  private filledFrom: number | null = null;

  constructor() {
    // The overview links here with #license; the router doesn't scroll to fragments itself.
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    const host = inject(ElementRef<HTMLElement>);
    afterNextRender(() => {
      if (fragment === 'license') host.nativeElement.scrollIntoView({ block: 'start' });
    });
    effect(() => {
      if (this.w.auth.isLoggedIn()) untracked(() => !this.s().history.value && !this.s().history.loading && this.load());
    });
    // A resubmission starts from the rejected or expired details, so only what changed needs typing
    // (an expired license's date is in the past, so it is left empty).
    effect(() => {
      const l = this.latest();
      if (!l || !this.canSubmit() || l.id === this.filledFrom) return;
      untracked(() => {
        this.filledFrom = l.id;
        this.holder.set(l.licenseHolderName);
        this.number.set(l.licenseNumber);
        this.brokerage.set(l.brokerageName ?? '');
        this.email.set(l.workEmail ?? '');
        this.expires.set(l.licenseExpirationDate && l.licenseExpirationDate >= this.minDate ? l.licenseExpirationDate : '');
      });
    });
  }

  readonly why = computed(() => {
    if (!this.holder().trim() || !this.number().trim()) return 'Enter the name on the license and its number.';
    if (this.expires() && this.expires() < this.minDate) return 'The expiry date can’t be in the past.';
    if (this.email().trim() && !EMAIL.test(this.email().trim())) return 'Check the work email.';
    return null;
  });
  load() {
    this.w.store.dispatch(A.load());
  }
  submit() {
    if (this.why() || this.s().submitting || !this.w.requireAccount('verify your license')) return;
    this.tried.set(true);
    this.w.store.dispatch(
      A.submit({
        request: {
          licenseHolderName: this.holder().trim(),
          licensingState: 'FL',
          licenseNumber: this.number().trim(),
          ...(this.expires() ? { licenseExpirationDate: this.expires() } : {}),
          ...(this.brokerage().trim() ? { brokerageName: this.brokerage().trim() } : {}),
          ...(this.email().trim() ? { workEmail: this.email().trim() } : {}),
        },
      }),
    );
  }
  statusLabel(status: RealtorLicenseVerificationDTO['status']) {
    return LICENSE_STATUS_LABELS[status] ?? status;
  }
  stateName(code: string) {
    return STATES[code] ?? code;
  }
  day(v: string) {
    return formatLocalDate(v);
  }
  calendar(v: string) {
    return formatRecordDate(v);
  }
}
