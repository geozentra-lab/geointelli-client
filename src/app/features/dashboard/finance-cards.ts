import { Component, computed, effect, inject, untracked } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { DashboardActions } from '../../store/dashboard/dashboard.actions';
import { selectDashboard } from '../../store/dashboard/dashboard.selectors';
import { LoadingSpinner } from '../../shared/components/loading-spinner';
import { selectAffordability } from '../../store/affordability/affordability.selectors';
import { selectMortgage } from '../../store/mortgage/mortgage.selectors';

const INPUT_LABELS: Record<string, string> = {
  annualGrossIncome: 'annual income',
  monthlyDebtPayments: 'monthly debts',
  downPayment: 'down payment',
  annualInterestRate: 'interest rate',
  loanTermYears: 'loan term',
  price: 'price',
};
/** Matches the other dashboard cards (styles there are scoped to the overview). */
const CARD_STYLES = `
  :host {
    display: flex;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }
  .count {
    font-size: 30px;
    font-weight: 700;
    margin: 4px 0 8px;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
`;
export function missingText(inputs: string[]): string {
  const names = inputs.map((i) => INPUT_LABELS[i] ?? i);
  return names.length > 1
    ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
    : (names[0] ?? '');
}

/**
 * Dashboard affordability card (GET /dashboards/user/affordability). It is fed the inputs last
 * entered in Investment Studio this session, held in memory only; with none it is INCOMPLETE and
 * points there. The server assumes nothing, so no figure is shown without the user's own inputs.
 */
@Component({
  selector: 'gz-affordability-card',
  imports: [CurrencyPipe, DatePipe, RouterLink, LoadingSpinner],
  template: `<section class="panel card" aria-labelledby="card-affordability">
    <div class="panelhead">
      <h3 id="card-affordability">Your home budget</h3>
      <a
        class="smalltext"
        routerLink="/investment-studio"
        [queryParams]="{ mode: 'affordability' }"
        >{{ card().value?.status === 'OK' ? 'Adjust' : 'Add your finances' }}</a
      >
    </div>
    @if (card().loading && !card().value) {
      <gz-loading-spinner [compact]="true" label="Loading your budget" />
    } @else if (card().error) {
      <p class="sub" role="alert">{{ card().error }}</p>
      <button type="button" class="btn small" (click)="reload()">Retry</button>
    } @else if (card().value; as c) {
      @if (c.status === 'OK' && c.affordability; as a) {
        <p class="count">{{ a.maxHomePrice | currency: 'USD' : 'symbol' : '1.0-0' }}</p>
        <div class="lineitem">
          <span>Monthly housing budget</span
          ><strong>{{ a.maxMonthlyHousingPayment | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
        </div>
        <div class="lineitem">
          <span>Maximum loan</span
          ><strong>{{ a.maxLoanAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
        </div>
        <p class="sourcedata">
          {{ a.assumptions.frontEndRatioPercent }}/{{ a.assumptions.backEndRatioPercent }} rule at
          {{ a.assumptions.annualInterestRate }}% over {{ a.assumptions.loanTermYears }} years ·
          {{ a.assumptions.rateSource }}. {{ a.disclaimer }}
        </p>
      } @else if (c.status === 'INCOMPLETE') {
        <p class="sub">
          Enter your {{ missing(c.missingInputs) }} in Investment Studio to see the home price your
          budget supports. Nothing is assumed for you.
        </p>
      } @else {
        <p class="sub" role="alert">{{ c.error || 'Your budget could not be calculated.' }}</p>
        <button type="button" class="btn small" (click)="reload()">Retry</button>
      }
      <p class="smalltext muted">Updated {{ c.generatedAt | date: 'shortTime' }}</p>
    }
  </section>`,
  styles: CARD_STYLES,
})
export class AffordabilityCard {
  private w = inject(Workspace);
  private inputs = this.w.store.selectSignal(selectAffordability);
  private dashboard = this.w.store.selectSignal(selectDashboard);
  card = computed(() => this.dashboard().affordability);
  constructor() {
    // New inputs from Investment Studio refresh the card.
    effect(() => {
      this.inputs().request;
      untracked(() => this.reload());
    });
  }
  reload() {
    this.w.store.dispatch(
      DashboardActions.loadAffordability({ inputs: this.inputs().request ?? {} }),
    );
  }
  missing = missingText;
}

/**
 * Lender dashboard mortgage context card (GET /dashboards/lender/mortgage-context), fed the
 * scenario last run in the Investment Studio mortgage calculator this session. The rate is the
 * caller's, never a live market rate, and the card says so.
 */
@Component({
  selector: 'gz-mortgage-context-card',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, LoadingSpinner],
  template: `<section class="panel card" aria-labelledby="card-mortgage">
    <div class="panelhead">
      <h3 id="card-mortgage">Mortgage context</h3>
      <a class="smalltext" routerLink="/investment-studio">{{
        card().value?.status === 'OK' ? 'Change scenario' : 'Run a scenario'
      }}</a>
    </div>
    @if (card().loading && !card().value) {
      <gz-loading-spinner [compact]="true" label="Loading mortgage context" />
    } @else if (card().error) {
      <p class="sub" role="alert">{{ card().error }}</p>
      <button type="button" class="btn small" (click)="reload()">Retry</button>
    } @else if (card().value; as c) {
      @if (c.status === 'OK' && c.mortgage; as m) {
        <p class="count">
          {{ m.totalMonthlyKnownCosts | currency: 'USD' : 'symbol' : '1.0-0' }}
          <span class="smalltext muted">a month</span>
        </p>
        <div class="lineitem">
          <span>Loan amount</span
          ><strong>{{ m.loanAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
        </div>
        <div class="lineitem">
          <span>Principal & interest</span
          ><strong>{{
            m.monthlyPrincipalAndInterest | currency: 'USD' : 'symbol' : '1.0-0'
          }}</strong>
        </div>
        @if (c.assumptions; as a) {
          <p class="sourcedata">
            {{ a.annualInterestRate | number: '1.0-3' }}% over {{ a.loanTermYears }} years ·
            {{ a.rateSource }}.
          </p>
        }
      } @else if (c.status === 'UNAVAILABLE') {
        <p class="sub">
          Run a price, down payment, rate and term in Investment Studio to see the monthly cost of a
          loan here. No live mortgage rate is used.
        </p>
      } @else {
        <p class="sub" role="alert">{{ c.error || 'The mortgage context could not be built.' }}</p>
        <button type="button" class="btn small" (click)="reload()">Retry</button>
      }
      <p class="smalltext muted">Updated {{ c.generatedAt | date: 'shortTime' }}</p>
    }
  </section>`,
  styles: CARD_STYLES,
})
export class MortgageContextCard {
  private w = inject(Workspace);
  private inputs = this.w.store.selectSignal(selectMortgage);
  private dashboard = this.w.store.selectSignal(selectDashboard);
  card = computed(() => this.dashboard().mortgageContext);
  constructor() {
    effect(() => {
      this.inputs().request;
      untracked(() => this.reload());
    });
  }
  reload() {
    this.w.store.dispatch(
      DashboardActions.loadMortgageContext({ inputs: this.inputs().request ?? {} }),
    );
  }
}
