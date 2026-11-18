import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RequestStatus } from '../../shared/components/request-status';
import { Workspace } from '../../shared/data/workspace';
import { AffordabilityActions as A } from '../../store/affordability/affordability.actions';
import { selectAffordability } from '../../store/affordability/affordability.selectors';
@Component({
  selector: 'gz-affordability-calculator',
  imports: [FormsModule, CurrencyPipe, DecimalPipe, RouterLink, RequestStatus],
  template: `<div class="grid cols2">
    <form class="panel" #form="ngForm" (ngSubmit)="form.valid && calculate()">
      <h3>Your finances</h3>
      <div class="formgrid section">
        <div class="formfield">
          <label for="income">Annual gross income ($)</label
          ><input
            id="income"
            name="income"
            type="number"
            min="0.01"
            step="0.01"
            [(ngModel)]="annualGrossIncome"
            required
          />
        </div>
        <div class="formfield">
          <label for="debts">Monthly debt payments ($)</label
          ><input
            id="debts"
            name="debts"
            type="number"
            min="0"
            step="0.01"
            [(ngModel)]="monthlyDebtPayments"
            required
            aria-describedby="debts-hint"
          />
          <p id="debts-hint" class="smalltext muted">
            Car, student loan, card minimums. Use 0 if none.
          </p>
        </div>
        <div class="formfield">
          <label for="affDown">Down payment available ($)</label
          ><input
            id="affDown"
            name="downPayment"
            type="number"
            min="0"
            step="0.01"
            [(ngModel)]="downPayment"
            required
          />
        </div>
        <div class="formfield">
          <label for="affRate">Annual interest rate (%)</label
          ><input
            id="affRate"
            name="rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            [(ngModel)]="annualInterestRate"
            required
          />
        </div>
        <div class="formfield">
          <label for="affTerm">Loan term (years)</label
          ><input
            id="affTerm"
            name="term"
            type="number"
            min="1"
            max="50"
            step="1"
            [(ngModel)]="loanTermYears"
            required
          />
        </div>
        <div class="formfield">
          <label for="affTax">Annual property tax ($, optional)</label
          ><input
            id="affTax"
            name="tax"
            type="number"
            min="0"
            step="0.01"
            [(ngModel)]="annualPropertyTax"
          />
        </div>
        <div class="formfield">
          <label for="affInsurance">Annual home insurance ($, optional)</label
          ><input
            id="affInsurance"
            name="insurance"
            type="number"
            min="0"
            step="0.01"
            [(ngModel)]="annualHomeInsurance"
          />
        </div>
        <div class="formfield">
          <label for="affHoa">Monthly HOA ($, optional)</label
          ><input
            id="affHoa"
            name="hoa"
            type="number"
            min="0"
            step="0.01"
            [(ngModel)]="monthlyHoaFees"
          />
        </div>
      </div>
      <button class="btn primary spacer" [disabled]="form.invalid || state().loading">
        {{ state().loading ? 'Calculating…' : 'Estimate budget' }}
      </button>
      <p class="sourcedata">
        Your figures are sent only to calculate this estimate and are not saved to your profile.
      </p>
    </form>
    <div aria-live="polite">
      <gz-request-status
        [loading]="state().loading"
        [error]="state().error"
        (retry)="calculate()"
      />
      @if (state().response; as r) {
        <div class="panel darkpanel">
          <h3>Estimated maximum home price</h3>
          <div class="bigvalue">{{ r.maxHomePrice | currency: 'USD' : 'symbol' : '1.0-0' }}</div>
          <div class="lineitem">
            <span>Maximum loan amount</span
            ><strong>{{ r.maxLoanAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
          </div>
          <div class="lineitem">
            <span>Monthly housing budget</span
            ><strong>{{
              r.maxMonthlyHousingPayment | currency: 'USD' : 'symbol' : '1.0-0'
            }}</strong>
          </div>
          <div class="lineitem">
            <span>Of which principal & interest</span
            ><strong>{{
              r.maxMonthlyPrincipalAndInterest | currency: 'USD' : 'symbol' : '1.0-0'
            }}</strong>
          </div>
          <div class="lineitem">
            <span>Monthly gross income</span
            ><strong>{{ r.monthlyGrossIncome | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
          </div>
          <p class="sourcedata">
            Front-end {{ r.assumptions.frontEndRatioPercent | number: '1.0-1' }}% · back-end
            {{ r.assumptions.backEndRatioPercent | number: '1.0-1' }}% ·
            {{ r.assumptions.annualInterestRate | number: '1.0-3' }}% over
            {{ r.assumptions.loanTermYears }} years. {{ r.assumptions.rateSource }}
          </p>
        </div>
        @for (note of r.notes; track note) {
          <p class="insight section">{{ note }}</p>
        }
        <p class="sourcedata">{{ r.disclaimer }}</p>
        <div class="row spacer">
          <a class="btn" routerLink="/settings">Set your budget in preferences</a
          ><a class="btn" routerLink="/explore">Explore properties</a>
        </div>
      } @else if (!state().loading) {
        <div class="panel">
          <h3>How much home can you afford?</h3>
          <p class="sub spacer">
            Enter your income, debts and financing terms to estimate a price range using standard
            debt-to-income limits.
          </p>
        </div>
      }
    </div>
  </div>`,
})
export class AffordabilityCalculator {
  w = inject(Workspace);
  state = this.w.store.selectSignal(selectAffordability);
  annualGrossIncome: number | null = null;
  monthlyDebtPayments: number | null = 0;
  downPayment: number | null = null;
  annualInterestRate: number | null = null;
  loanTermYears = 30;
  annualPropertyTax: number | null = null;
  annualHomeInsurance: number | null = null;
  monthlyHoaFees: number | null = null;
  calculate() {
    if (
      this.annualGrossIncome === null ||
      this.annualGrossIncome <= 0 ||
      this.monthlyDebtPayments === null ||
      this.monthlyDebtPayments < 0 ||
      this.downPayment === null ||
      this.downPayment < 0 ||
      this.annualInterestRate === null ||
      this.annualInterestRate < 0 ||
      this.annualInterestRate > 100 ||
      !Number.isInteger(this.loanTermYears) ||
      this.loanTermYears < 1 ||
      this.loanTermYears > 50
    ) {
      this.w.toast('Check the income, debts, down payment, interest rate and loan term.');
      return;
    }
    const optional = (value: number | null) => (value === null || value < 0 ? undefined : value);
    this.w.store.dispatch(
      A.calculate({
        request: {
          annualGrossIncome: this.annualGrossIncome,
          monthlyDebtPayments: this.monthlyDebtPayments,
          downPayment: this.downPayment,
          annualInterestRate: this.annualInterestRate,
          loanTermYears: this.loanTermYears,
          annualPropertyTax: optional(this.annualPropertyTax),
          annualHomeInsurance: optional(this.annualHomeInsurance),
          monthlyHoaFees: optional(this.monthlyHoaFees),
        },
      }),
    );
  }
}
