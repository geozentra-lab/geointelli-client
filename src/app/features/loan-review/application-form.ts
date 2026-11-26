import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { PropertyPicker } from '../../shared/components/property-picker';
import { LOAN_TYPES, LenderLoanType, loanTypeLabels } from '../../core/models/lender';
import { LenderActions as A } from '../../store/lender/lender.actions';
import { selectLender } from '../../store/lender/lender.selectors';
import { isAmount } from './application-record';

/**
 * New application, in the record pane (DESIGN.md §5): applicant, requested amount, loan type,
 * email, property and notes. It is saved as a draft; Save as draft says what is missing until it
 * can be sent. Once saved, the page closes the pane (the list and pipeline reload with it).
 */
@Component({
  selector: 'gz-application-form',
  imports: [FormsModule, PropertyPicker, ...RECORD_KIT],
  template: `
    <gz-record-section>
      <form class="af" (ngSubmit)="create()">
        <div class="formfield af-wide">
          <label for="appName">Applicant name</label>
          <input id="appName" name="applicantName" maxlength="160" [ngModel]="f().applicantName" (ngModelChange)="set('applicantName', $event)" />
        </div>
        <div class="formfield">
          <label for="appAmount">Requested amount ($)</label>
          <input id="appAmount" name="requestedAmount" type="number" min="0.01" step="0.01"
            [ngModel]="f().requestedAmount" (ngModelChange)="set('requestedAmount', $event === '' ? null : $event)" />
        </div>
        <div class="formfield">
          <label for="appLoanType">Loan type</label>
          <select id="appLoanType" name="loanType" [ngModel]="f().loanType" (ngModelChange)="set('loanType', $event)">
            @for (t of loanTypes; track t) {
              <option [value]="t">{{ loanTypeLabel(t) }}</option>
            }
          </select>
        </div>
        <div class="formfield af-wide">
          <label for="appEmail">Applicant email (optional)</label>
          <input id="appEmail" name="applicantEmail" type="email" maxlength="254" [ngModel]="f().applicantEmail" (ngModelChange)="set('applicantEmail', $event)" />
        </div>
        <gz-property-picker class="af-wide" label="Property (optional)" [propertyId]="f().propertyId" (selected)="set('propertyId', $event)" />
        <div class="formfield af-wide">
          <label for="appNotes">Notes (optional)</label>
          <textarea id="appNotes" name="notes" rows="3" maxlength="2000" [ngModel]="f().notes" (ngModelChange)="set('notes', $event)"></textarea>
        </div>
        <div class="af-actions af-wide">
          <button class="btn primary" [attr.aria-disabled]="why() || saving() ? 'true' : null" [attr.aria-describedby]="why() ? 'af-why' : null">
            {{ saving() ? 'Saving…' : 'Save as draft' }}
          </button>
          @if (why(); as reason) {
            <p class="af-why" id="af-why">{{ reason }}</p>
          }
        </div>
        @if (tried() && lender().pendingWrite === 'application' && lender().saveError; as error) {
          <p class="field-error af-wide" role="alert">{{ error }}</p>
        }
        <p class="af-why af-wide">Recording an application doesn’t approve credit or move any funds.</p>
      </form>
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
    }
    .af {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-12) var(--sp-16);
    }
    .af-wide {
      grid-column: 1 / -1;
    }
    .af-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
    }
    .af-why {
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
  `,
})
export class ApplicationForm {
  readonly done = output<void>();
  private readonly w = inject(Workspace);
  readonly lender = this.w.store.selectSignal(selectLender);
  readonly loanTypes = LOAN_TYPES;
  readonly saving = computed(() => this.lender().saving > 0);
  readonly tried = signal(false);
  private submitted = false;
  readonly f = signal({
    applicantName: '',
    requestedAmount: null as number | null,
    loanType: 'UNKNOWN' as LenderLoanType,
    applicantEmail: '',
    propertyId: null as number | null,
    notes: '',
  });
  set(key: 'applicantName' | 'requestedAmount' | 'loanType' | 'applicantEmail' | 'propertyId' | 'notes', value: unknown) {
    this.f.update((f) => ({ ...f, [key]: value }));
  }

  constructor() {
    effect(() => {
      const s = this.lender();
      if (!this.submitted || s.saving) return;
      this.submitted = false;
      if (!s.saveError) this.done.emit();
    });
  }

  readonly why = computed(() => {
    const f = this.f();
    if (!f.applicantName.trim()) return 'Enter the applicant’s name.';
    if (!isAmount(f.requestedAmount)) return 'Enter the requested amount, above $0 with up to two decimals.';
    if (f.applicantEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.applicantEmail.trim())) return 'Check the email address.';
    return null;
  });
  loanTypeLabel(t: LenderLoanType) {
    return t === 'UNKNOWN' ? 'Not recorded' : loanTypeLabels[t];
  }
  create() {
    if (this.why() || this.saving() || !this.w.requireAccount('record applications')) return;
    const f = this.f();
    this.submitted = true;
    this.tried.set(true);
    this.w.store.dispatch(
      A.createApplication({
        request: {
          applicantName: f.applicantName.trim(),
          requestedAmount: f.requestedAmount!,
          currency: 'USD',
          applicantEmail: f.applicantEmail.trim() || undefined,
          propertyId: f.propertyId ?? undefined,
          notes: f.notes.trim() || undefined,
          loanType: f.loanType,
        },
      }),
    );
  }
}
