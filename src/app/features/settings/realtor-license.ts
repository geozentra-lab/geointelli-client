import {
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RequestStatus } from '../../shared/components/request-status';
import { RealtorLicenseActions as A } from '../../store/realtor-license/realtor-license.actions';
import { selectRealtorLicense } from '../../store/realtor-license/realtor-license.selectors';
import { LICENSE_STATUS_LABELS } from '../../core/models/realtor-license';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Realtor license verification (SCRUM-200), applicant side: submit a Florida license for review,
 * follow its status and see earlier submissions. A new submission is possible only after a
 * rejection; an administrator takes the decision.
 */
@Component({
  selector: 'gz-realtor-license',
  imports: [DatePipe, FormsModule, RequestStatus],
  template: `
    <section id="license" class="panel section" aria-labelledby="license-title">
      <div class="panelhead">
        <div>
          <h3 id="license-title">Realtor license</h3>
          <p class="smalltext muted">
            Verification is separate from the experience you choose above.
          </p>
        </div>
        @if (latest(); as l) {
          <span
            class="tag"
            [class.green]="l.status === 'VERIFIED'"
            [class.amber]="l.status === 'PENDING_REVIEW'"
            [class.red]="l.status === 'REJECTED'"
            >{{ statusLabel(l.status) }}</span
          >
        }
      </div>
      <gz-request-status
        [loading]="s().history.loading && !s().history.value"
        loadingText="Loading your license…"
        [error]="s().history.error"
        (retry)="load()"
      />
      @if (latest(); as l) {
        <div class="lineitem">
          <span>License</span><strong>{{ l.licensingState }} {{ l.licenseNumber }}</strong>
        </div>
        <div class="lineitem">
          <span>Holder</span><strong>{{ l.licenseHolderName }}</strong>
        </div>
        @if (l.brokerageName) {
          <div class="lineitem">
            <span>Brokerage</span><strong>{{ l.brokerageName }}</strong>
          </div>
        }
        <div class="lineitem">
          <span>Submitted</span><strong>{{ l.submittedAt | date: 'medium' }}</strong>
        </div>
        @if (l.status === 'PENDING_REVIEW') {
          <p class="insight section">
            Your license is waiting for review. You will be able to submit again only if it is
            rejected.
          </p>
        } @else if (l.status === 'REJECTED') {
          <p class="insight warning section" role="status">
            Not verified{{ l.decidedAt ? ' on ' + (l.decidedAt | date: 'mediumDate') : '' }}:
            {{ l.rejectionReason || 'no reason was given' }}. Correct the details and submit again.
          </p>
        }
      }
      @if (canSubmit()) {
        <form class="section" #lf="ngForm" (ngSubmit)="lf.valid && submit()">
          <fieldset class="formgrid" [disabled]="s().submitting">
            <div class="formfield">
              <label for="lic-holder">Name on the license</label
              ><input id="lic-holder" name="holder" maxlength="160" required [(ngModel)]="holder" />
            </div>
            <div class="formfield">
              <label for="lic-state">State</label
              ><select id="lic-state" name="state" [(ngModel)]="state">
                <option value="FL">Florida</option>
              </select>
            </div>
            <div class="formfield">
              <label for="lic-number">License number</label
              ><input id="lic-number" name="number" maxlength="40" required [(ngModel)]="number" />
            </div>
            <div class="formfield">
              <label for="lic-expires">Expires on (optional)</label
              ><input
                id="lic-expires"
                name="expires"
                type="date"
                [min]="minDate"
                max="9999-12-31"
                [(ngModel)]="expires"
              />
            </div>
            <div class="formfield">
              <label for="lic-brokerage">Brokerage (optional)</label
              ><input id="lic-brokerage" name="brokerage" maxlength="160" [(ngModel)]="brokerage" />
            </div>
            <div class="formfield">
              <label for="lic-email">Work email (optional)</label
              ><input
                id="lic-email"
                name="email"
                type="email"
                maxlength="254"
                email
                [(ngModel)]="email"
              />
            </div>
            <div class="actions full">
              <button class="btn primary" [disabled]="lf.invalid || s().submitting">
                {{ s().submitting ? 'Submitting…' : 'Submit for verification' }}
              </button>
            </div>
          </fieldset>
        </form>
        @if (s().submitError; as error) {
          <p class="field-error" role="alert">{{ error }}</p>
        }
        <p class="sourcedata">Only Florida licenses can be verified today.</p>
      }
      @if (earlier().length) {
        <details class="spacer">
          <summary>Earlier submissions ({{ earlier().length }})</summary>
          <ul class="list">
            @for (h of earlier(); track h.id) {
              <li>
                <span class="feed-row">
                  <span class="list-main">
                    <b>{{ h.licensingState }} {{ h.licenseNumber }}</b>
                    <small class="muted"
                      >{{ h.submittedAt | date: 'mediumDate' }}
                      @if (h.rejectionReason) {
                        · {{ h.rejectionReason }}
                      }
                    </small>
                  </span>
                  <span class="tag">{{ statusLabel(h.status) }}</span>
                </span>
              </li>
            }
          </ul>
        </details>
      }
    </section>
  `,
})
export class RealtorLicense implements OnInit {
  w = inject(Workspace);
  s = this.w.store.selectSignal(selectRealtorLicense);
  latest = computed(() => this.s().history.value?.[0] ?? null);
  earlier = computed(() => this.s().history.value?.slice(1) ?? []);
  /** Allowed with no submission yet, or after a rejection. */
  canSubmit = computed(
    () =>
      this.s().history.value !== null && (!this.latest() || this.latest()!.status === 'REJECTED'),
  );
  readonly minDate = today();
  holder = '';
  state = 'FL';
  number = '';
  expires = '';
  brokerage = '';
  email = '';
  constructor() {
    // The dashboard links here with #license; the router does not scroll to fragments itself.
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    const host = inject(ElementRef<HTMLElement>);
    afterNextRender(() => {
      if (fragment === 'license') host.nativeElement.scrollIntoView({ block: 'start' });
    });
    // Start a resubmission from the rejected details, so only the wrong field needs fixing.
    effect(() => {
      const l = this.latest();
      if (l && l.status === 'REJECTED' && !this.holder) {
        this.holder = l.licenseHolderName;
        this.number = l.licenseNumber;
        this.brokerage = l.brokerageName ?? '';
        this.email = l.workEmail ?? '';
      }
    });
  }
  ngOnInit() {
    if (!this.s().history.value) this.load();
  }
  load() {
    this.w.store.dispatch(A.load());
  }
  submit() {
    if (!this.w.requireAccount('verify your license')) return;
    this.w.store.dispatch(
      A.submit({
        request: {
          licenseHolderName: this.holder.trim(),
          licensingState: this.state,
          licenseNumber: this.number.trim(),
          ...(this.expires ? { licenseExpirationDate: this.expires } : {}),
          ...(this.brokerage.trim() ? { brokerageName: this.brokerage.trim() } : {}),
          ...(this.email.trim() ? { workEmail: this.email.trim() } : {}),
        },
      }),
    );
  }
  statusLabel(status: string) {
    return LICENSE_STATUS_LABELS[status as keyof typeof LICENSE_STATUS_LABELS] ?? status;
  }
}
