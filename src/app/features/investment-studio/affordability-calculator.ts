import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RequestStatus } from '../../shared/components/request-status';
import { RECORD_KIT } from '../../shared/components/record';
import { Workspace } from '../../shared/data/workspace';
import { countOf, plainNote, plainNotes } from '../../shared/data/format';
import { labelFor } from '../../shared/pipes/label.pipe';
import { AffordabilityRequest } from '../../core/models/api';
import { AffordabilityActions as A } from '../../store/affordability/affordability.actions';
import { selectAffordability } from '../../store/affordability/affordability.selectors';
import { joinList, money, percent, sameFigures } from './studio-format';
import { resultArrived } from './studio-focus';

interface AffordabilityFields {
  annualGrossIncome: number | null;
  monthlyDebtPayments: number | null;
  downPayment: number | null;
  annualInterestRate: number | null;
  loanTermYears: number | null;
  annualPropertyTax: number | null;
  annualHomeInsurance: number | null;
  monthlyHoaFees: number | null;
}

/**
 * Affordability (POST /calculations/affordability): the highest home price the user's income,
 * debts, down payment and loan terms allow under standard debt-to-income limits. The figures are
 * sent only to calculate; nothing is saved.
 */
@Component({
  selector: 'gz-affordability-calculator',
  imports: [FormsModule, RouterLink, RequestStatus, ...RECORD_KIT],
  styleUrl: './studio.css',
  template: `
    <div class="st">
      <form class="st-form" (ngSubmit)="calculate()" aria-labelledby="af-title">
        <h2 id="af-title">Your finances</h2>
        <p class="st-lede">Sent only to work out the estimate; nothing is saved to your profile.</p>
        <fieldset>
          <legend>Income and debts</legend>
          <div class="st-fields">
            <div class="formfield">
              <label for="income">Gross income ($ a year)</label>
              <input id="income" name="income" type="number" min="0" step="1000"
                [ngModel]="f().annualGrossIncome" (ngModelChange)="set('annualGrossIncome', $event)" />
            </div>
            <div class="formfield">
              <label for="debts">Debt payments ($ a month)</label>
              <input id="debts" name="debts" type="number" min="0" step="10" aria-describedby="debts-hint"
                [ngModel]="f().monthlyDebtPayments" (ngModelChange)="set('monthlyDebtPayments', $event)" />
              <p id="debts-hint" class="smalltext muted">Car, student loan, card minimums. 0 if none.</p>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Purchase and loan</legend>
          <div class="st-fields">
            <div class="formfield">
              <label for="affDown">Down payment ($)</label>
              <input id="affDown" name="downPayment" type="number" min="0" step="1000"
                [ngModel]="f().downPayment" (ngModelChange)="set('downPayment', $event)" />
            </div>
            <div class="formfield">
              <label for="affRate">Interest rate (% a year)</label>
              <input id="affRate" name="rate" type="number" min="0" max="100" step="0.01"
                [ngModel]="f().annualInterestRate" (ngModelChange)="set('annualInterestRate', $event)" />
            </div>
            <div class="formfield">
              <label for="affTerm">Loan term (years)</label>
              <input id="affTerm" name="term" type="number" min="1" max="50" step="1"
                [ngModel]="f().loanTermYears" (ngModelChange)="set('loanTermYears', $event)" />
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Costs you know <span class="optional">(optional)</span></legend>
          <div class="st-fields">
            <div class="formfield">
              <label for="affTax">Property tax ($ a year)</label>
              <input id="affTax" name="tax" type="number" min="0" step="100"
                [ngModel]="f().annualPropertyTax" (ngModelChange)="set('annualPropertyTax', $event)" />
            </div>
            <div class="formfield">
              <label for="affInsurance">Home insurance ($ a year)</label>
              <input id="affInsurance" name="insurance" type="number" min="0" step="100"
                [ngModel]="f().annualHomeInsurance" (ngModelChange)="set('annualHomeInsurance', $event)" />
            </div>
            <div class="formfield">
              <label for="affHoa">HOA ($ a month)</label>
              <input id="affHoa" name="hoa" type="number" min="0" step="10"
                [ngModel]="f().monthlyHoaFees" (ngModelChange)="set('monthlyHoaFees', $event)" />
            </div>
          </div>
        </fieldset>
        <div class="st-actions">
          <button
            class="btn primary"
            [attr.aria-disabled]="blocked() || state().loading ? 'true' : null"
            [attr.aria-describedby]="blocked() ? 'af-why' : null"
          >
            {{ state().loading ? 'Calculating…' : 'Estimate' }}
          </button>
          @if (blocked(); as why) {
            <p class="st-why" id="af-why">{{ why }}</p>
          }
        </div>
      </form>

      <gz-record-section aria-labelledby="af-result">
        <h2 id="af-result" #resultTitle tabindex="-1">What you could afford</h2>
        <gz-request-status
          [loading]="state().loading && !state().response"
          loadingText="Calculating…"
          [error]="state().error"
          (retry)="calculate()"
        />
        <!-- After a failed request, the error alone: an older result would sit beside new figures. -->
        @if (!state().error && state().response; as r) {
          @if (stale()) {
            <p class="st-note" role="status">
              The figures beside it changed since this result: Estimate to update it.
            </p>
          }
          <div class="st-figure" [attr.aria-busy]="state().loading ? 'true' : null">
            <span class="st-figure-label">Highest home price</span>
            <span class="st-figure-value">{{ money(r.maxHomePrice) }}</span>
            <span class="st-figure-caption">With a loan of up to {{ money(r.maxLoanAmount) }}.</span>
          </div>
          <gz-record-group heading="Each month">
            <div gz-record-row label="Gross income" [numeric]="true">{{ money(r.monthlyGrossIncome) }}</div>
            <div gz-record-row label="Housing budget" [numeric]="true">
              {{ money(r.maxMonthlyHousingPayment) }}
            </div>
            <div gz-record-row label="Of which principal and interest" [numeric]="true">
              {{ money(r.maxMonthlyPrincipalAndInterest) }}
            </div>
          </gz-record-group>
          <gz-record-group heading="Limits used">
            <div gz-record-row label="Housing costs, of income" [numeric]="true">
              up to {{ percent(r.assumptions.frontEndRatioPercent, 1) }}
            </div>
            <div gz-record-row label="All debts, of income" [numeric]="true">
              up to {{ percent(r.assumptions.backEndRatioPercent, 1) }}
            </div>
            <div gz-record-row label="Rate and term" [numeric]="true">
              {{ percent(r.assumptions.annualInterestRate, 3) }} over {{ countOf(r.assumptions.loanTermYears, 'year') }}
            </div>
            @if (rateSource(r.assumptions.rateSource); as source) {
              <div gz-record-row label="Rate source">{{ source }}</div>
            }
          </gz-record-group>
          @for (note of notes(); track note) {
            <p class="st-note">{{ note }}</p>
          }
          <div class="st-links">
            <a class="btn" routerLink="/settings">Save a budget in your preferences</a>
            <a class="btn" routerLink="/explore">Explore properties</a>
          </div>
        } @else if (!state().loading && !state().error) {
          <p class="st-empty">
            Enter your income, debts, down payment, rate and term to see the highest price they
            allow under standard debt-to-income limits.
          </p>
        }
      </gz-record-section>
    </div>
  `,
})
export class AffordabilityCalculator {
  private readonly w = inject(Workspace);
  readonly state = this.w.store.selectSignal(selectAffordability);
  private readonly resultTitle = viewChild<ElementRef<HTMLElement>>('resultTitle');
  readonly money = money;
  readonly percent = percent;
  readonly countOf = countOf;
  /** "USER_SUPPLIED" reads "User supplied"; a sentence is kept, in plain words (DESIGN.md §13). */
  rateSource(source: string | null | undefined) {
    if (!source) return null;
    return /^[A-Z][A-Z0-9_]*$/.test(source.trim()) ? labelFor(source) : plainNote(source);
  }

  // Coming back: the figures of the result the slice still holds.
  readonly f = signal<AffordabilityFields>({
    annualGrossIncome: null,
    monthlyDebtPayments: 0,
    downPayment: null,
    annualInterestRate: null,
    loanTermYears: 30,
    annualPropertyTax: null,
    annualHomeInsurance: null,
    monthlyHoaFees: null,
    ...(this.state().request ?? {}),
  });
  set<K extends keyof AffordabilityFields>(key: K, value: AffordabilityFields[K] | '') {
    this.f.update((f) => ({ ...f, [key]: value === '' ? null : value }));
  }

  readonly blocked = computed(() => {
    const f = this.f();
    const missing = [
      f.annualGrossIncome === null && 'income',
      f.monthlyDebtPayments === null && 'debt payments (0 if none)',
      f.downPayment === null && 'down payment',
      f.annualInterestRate === null && 'rate',
      f.loanTermYears === null && 'term',
    ].filter((x): x is string => !!x);
    if (missing.length) return `Enter the ${joinList(missing)}.`;
    if (f.annualGrossIncome! <= 0) return 'The income must be above $0.';
    if (f.monthlyDebtPayments! < 0 || f.downPayment! < 0) return 'An amount can’t be below $0.';
    if (f.annualInterestRate! < 0 || f.annualInterestRate! > 100)
      return 'The rate runs from 0% to 100%.';
    if (!Number.isInteger(f.loanTermYears) || f.loanTermYears! < 1 || f.loanTermYears! > 50)
      return 'The term is a whole number of years, 1 to 50.';
    const costs = [f.annualPropertyTax, f.annualHomeInsurance, f.monthlyHoaFees];
    if (costs.some((c) => c !== null && c < 0)) return 'A cost can’t be below $0.';
    return null;
  });

  /** The backend's notes and disclaimer, in plain words (DESIGN.md §13). */
  readonly notes = computed(() => {
    const r = this.state().response;
    return r ? [...new Set(plainNotes([...r.notes, r.disclaimer]))] : [];
  });

  private readonly expectResult = resultArrived(this.state, this.resultTitle);

  /** The request the form would send; null while it can't be sent. */
  readonly request = computed<AffordabilityRequest | null>(() => {
    const f = this.f();
    if (this.blocked()) return null;
    return {
      annualGrossIncome: f.annualGrossIncome!,
      monthlyDebtPayments: f.monthlyDebtPayments!,
      downPayment: f.downPayment!,
      annualInterestRate: f.annualInterestRate!,
      loanTermYears: f.loanTermYears!,
      ...(f.annualPropertyTax === null ? {} : { annualPropertyTax: f.annualPropertyTax }),
      ...(f.annualHomeInsurance === null ? {} : { annualHomeInsurance: f.annualHomeInsurance }),
      ...(f.monthlyHoaFees === null ? {} : { monthlyHoaFees: f.monthlyHoaFees }),
    };
  });
  /** The result on screen came from other figures than the form's. */
  readonly stale = computed(() => {
    const done = this.state().request;
    const s = this.state();
    return !!done && !!s.response && !s.loading && !sameFigures(done, this.request());
  });

  calculate() {
    const request = this.request();
    if (!request || this.state().loading) return;
    this.w.store.dispatch(A.calculate({ request }));
    this.expectResult();
  }
}
