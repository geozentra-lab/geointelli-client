import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { RequestStatus } from '../../shared/components/request-status';
import { PropertyRef } from '../../shared/components/property-ref';
import { formatLocalDate, plainNote } from '../../shared/data/format';
import {
  LTV_REASONS,
  LenderApplicationDTO,
  LenderApplicationStage,
  LenderCollateralAnalysisDTO,
  lenderStageLabels,
  loanTypeLabels,
} from '../../core/models/lender';
import { LenderActions as A } from '../../store/lender/lender.actions';
import { selectLender } from '../../store/lender/lender.selectors';
import { Remote } from '../../store/remote';

const usd = (v: number | null | undefined, cents = true) =>
  v === null || v === undefined
    ? null
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: 0 }).format(v);
/** Two decimals at most, as the backend stores USD amounts. */
export const isAmount = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && Math.round(v * 100) === v * 100;

/**
 * A loan application in the record pane (DESIGN.md §5 Register, the lender pane): the amounts and
 * dates as ruled rows (the import source as a Source field, never prose), Collateral with the LTV
 * the backend works out from the linked property's ZentraValue (asked for on Check LTV), and, when
 * the stage chosen in the header needs one, the approved or funded amount. Recording a stage does
 * not approve credit or move funds.
 */
@Component({
  selector: 'gz-application-record',
  imports: [FormsModule, RequestStatus, PropertyRef, ...RECORD_KIT],
  template: `
    @let a = app();
    @if (amountFor(); as stage) {
      <gz-record-section [heading]="stage === 'APPROVED' ? 'Approve' : 'Fund'">
        <form class="ar-form" (ngSubmit)="confirmAmount()">
          <div class="formfield">
            <label for="ar-amount">{{ stage === 'APPROVED' ? 'Approved amount ($)' : 'Funded amount ($)' }}</label>
            <input id="ar-amount" name="amount" type="number" min="0.01" step="0.01" aria-describedby="ar-amount-hint"
              [ngModel]="amount()" (ngModelChange)="amount.set($event === '' ? null : $event)" />
            <p class="smalltext muted" id="ar-amount-hint">
              Up to {{ stage === 'APPROVED' ? money(a.requestedAmount) + ' requested' : money(a.approvedAmount) + ' approved' }}.
            </p>
          </div>
          <div class="ar-actions">
            <button class="btn primary" [attr.aria-disabled]="amountWhy() || saving() ? 'true' : null"
              [attr.aria-describedby]="amountWhy() ? 'ar-amount-why' : null">
              Mark {{ label(stage).toLowerCase() }}
            </button>
            <button type="button" class="btn" (click)="cancelAmount()">Cancel</button>
            @if (amountWhy(); as why) {
              <p class="ar-why" id="ar-amount-why">{{ why }}</p>
            }
          </div>
        </form>
      </gz-record-section>
    }
    <gz-record-section heading="Application">
      <gz-record-group>
        <div gz-record-row label="Stage">{{ label(a.stage) }}</div>
        <div gz-record-row label="Loan type" [missing]="!a.loanType || a.loanType === 'UNKNOWN'" [showReason]="true" reason="Not recorded">{{ loanType(a) }}</div>
        <div gz-record-row label="Requested" [numeric]="true">{{ money(a.requestedAmount) }}</div>
        @if (a.approvedAmount !== null) {
          <div gz-record-row label="Approved" [numeric]="true">{{ money(a.approvedAmount) }}{{ a.approvedAt ? ' · ' + day(a.approvedAt) : '' }}</div>
        }
        @if (a.fundedAmount !== null) {
          <div gz-record-row label="Funded" [numeric]="true">{{ money(a.fundedAmount) }}{{ a.fundedAt ? ' · ' + day(a.fundedAt) : '' }}</div>
        }
        @if (a.applicantEmail) {
          <div gz-record-row label="Email">{{ a.applicantEmail }}</div>
        }
        <div gz-record-row label="Recorded">{{ day(a.createdAt) }}</div>
        <div gz-record-row label="Changed">{{ day(a.updatedAt) }}</div>
        @if (a.source) {
          <div gz-record-row label="Source">{{ a.source }}{{ a.externalId ? ' · ' + a.externalId : '' }}</div>
        }
      </gz-record-group>
      @if (a.notes) {
        <p class="ar-text">{{ a.notes }}</p>
      }
    </gz-record-section>

    <gz-record-section heading="Collateral">
      @if (!a.propertyId) {
        <p class="ar-text muted">No property is linked, so there is no collateral value or LTV.</p>
      } @else {
        <gz-record-group>
          <div gz-record-row label="Property"><gz-property-ref [propertyId]="a.propertyId" /></div>
        </gz-record-group>
        <gz-request-status [loading]="!!collateral()?.loading && !collateral()?.value" loadingText="Checking the LTV…"
          [error]="collateral()?.error" (retry)="checkLtv()" />
        @if (collateral()?.value; as v) {
          <gz-record-group heading="Loan-to-value">
            <div gz-record-row label="LTV" [numeric]="true" [missing]="v.ltv.percent === null" [showReason]="true" [reason]="ltvWhy(v)">
              <b>{{ percent(v.ltv.percent) }}</b>
              @if (v.ltv.status === 'LIMITED') {
                <span class="attention"> · Limited valuation</span>
              }
            </div>
            <div gz-record-row [label]="basis(v)" [numeric]="true" [missing]="v.loanAmount === null">{{ money(v.loanAmount) }}</div>
            <div gz-record-row label="ZentraValue" [numeric]="true" [missing]="!v.collateral?.value" reason="No supported valuation">
              {{ money(v.collateral?.value ?? null, false) }}{{ v.collateral?.valuationDate ? ' · ' + day(v.collateral!.valuationDate) : '' }}
            </div>
          </gz-record-group>
          @if (plain(v.disclaimer); as d) {
            <p class="ar-why">{{ d }}</p>
          }
        }
        <div class="ar-actions">
          <button type="button" class="btn" [attr.aria-disabled]="collateral()?.loading ? 'true' : null" (click)="checkLtv()">
            {{ collateral()?.loading ? 'Checking…' : collateral()?.value ? 'Check again' : 'Check LTV' }}
          </button>
        </div>
      }
    </gz-record-section>
    <p class="ar-why ar-foot">Recording a stage doesn’t approve credit or move any funds.</p>
  `,
  styles: `
    :host {
      display: block;
    }
    gz-record-section + gz-record-section {
      margin-top: var(--sp-16);
    }
    .ar-text {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .ar-form {
      display: grid;
      gap: var(--sp-12);
      margin-top: var(--sp-8);
    }
    .ar-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
      margin-top: var(--sp-12);
    }
    .ar-why {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .ar-actions .ar-why {
      margin: 0;
    }
    .ar-foot {
      margin-top: var(--sp-16);
    }
  `,
})
export class ApplicationRecord {
  readonly app = input.required<LenderApplicationDTO>();
  /** Approved or Funded chosen in the pane's header: its amount is asked for here. */
  readonly amountFor = input<LenderApplicationStage | null>(null);
  /** The amount was confirmed (the page asks to confirm a final stage, then sends it). */
  readonly confirmed = output<number>();
  readonly cancelled = output<void>();
  private readonly w = inject(Workspace);
  private readonly lender = this.w.store.selectSignal(selectLender);
  readonly saving = computed(() => this.lender().saving > 0);
  /** The LTV asked for this application; undefined until Check LTV. */
  readonly collateral = computed<Remote<LenderCollateralAnalysisDTO> | undefined>(
    () => this.lender().collateral[this.app().id],
  );
  readonly amount = signal<number | null>(null);
  readonly plain = plainNote;

  constructor() {
    // The amount starts from what the application holds: approved from requested, funded from approved.
    effect(() => {
      const stage = this.amountFor();
      const a = this.app();
      untracked(() => {
        if (stage === 'APPROVED') this.amount.set(a.approvedAmount ?? a.requestedAmount);
        if (stage === 'FUNDED') this.amount.set(a.fundedAmount ?? a.approvedAmount);
      });
    });
  }

  readonly amountWhy = computed(() => {
    const a = this.app();
    const v = this.amount();
    if (!isAmount(v)) return 'Enter the amount, above $0 with up to two decimals.';
    if (this.amountFor() === 'APPROVED' && v > a.requestedAmount) return 'The approved amount can’t be more than the requested amount.';
    if (this.amountFor() === 'FUNDED' && a.approvedAmount !== null && v > a.approvedAmount)
      return 'The funded amount can’t be more than the approved amount.';
    return null;
  });
  confirmAmount() {
    if (this.amountWhy() || this.saving()) return;
    this.confirmed.emit(this.amount()!);
  }
  cancelAmount() {
    this.cancelled.emit();
  }
  checkLtv() {
    if (!this.collateral()?.loading) this.w.store.dispatch(A.loadCollateral({ applicationId: this.app().id }));
  }

  label(stage: LenderApplicationStage) {
    return lenderStageLabels[stage];
  }
  loanType(a: LenderApplicationDTO) {
    return loanTypeLabels[a.loanType ?? 'UNKNOWN'] ?? a.loanType;
  }
  money(v: number | null | undefined, cents = true) {
    return usd(v, cents);
  }
  percent(v: number | null) {
    return v === null ? null : v.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
  }
  basis(v: LenderCollateralAnalysisDTO) {
    return { FUNDED: 'Funded amount', APPROVED: 'Approved amount', REQUESTED: 'Requested amount' }[v.loanAmountBasis] ?? 'Loan amount';
  }
  ltvWhy(v: LenderCollateralAnalysisDTO) {
    return v.ltv.reasons.map((r) => LTV_REASONS[r] ?? 'The LTV can’t be worked out.').join(' ') || 'The LTV can’t be worked out.';
  }
  day(v: string | null | undefined) {
    return formatLocalDate(v);
  }
}
