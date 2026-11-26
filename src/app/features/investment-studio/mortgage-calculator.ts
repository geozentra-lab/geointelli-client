import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RequestStatus } from '../../shared/components/request-status';
import { RECORD_KIT } from '../../shared/components/record';
import { Workspace } from '../../shared/data/workspace';
import { MortgageActions as A } from '../../store/mortgage/mortgage.actions';
import { MortgageRequest } from '../../core/models/api';
import { selectMortgage } from '../../store/mortgage/mortgage.selectors';
import { joinList, money, sameFigures } from './studio-format';
import { resultArrived } from './studio-focus';

interface MortgageFields {
  price: number | null;
  downPayment: number | null;
  annualInterestRate: number | null;
  loanTermYears: number | null;
  annualPropertyTax: number | null;
  annualHomeInsurance: number | null;
  monthlyHoaFees: number | null;
}

/**
 * Mortgage payment (POST /calculations/mortgage): the monthly cost of a purchase on the user's own
 * price, down payment, rate and term, with the costs they know. A cost left blank is not assumed:
 * the backend leaves it out of the total, and the result says which ones it left out.
 */
@Component({
  selector: 'gz-mortgage-calculator',
  imports: [FormsModule, RequestStatus, ...RECORD_KIT],
  styleUrl: './studio.css',
  template: `
    <div class="st">
      <form class="st-form" (ngSubmit)="calculate()" aria-labelledby="mc-title">
        <h2 id="mc-title">Your assumptions</h2>
        <p class="st-lede">Leave a cost blank if you don't know it. Zero means a known zero cost.</p>
        <fieldset>
          <legend>Purchase and loan</legend>
          <div class="st-fields">
            <div class="formfield">
              <label for="price">Purchase price ($)</label>
              <input id="price" name="price" type="number" min="0" step="1000"
                [ngModel]="f().price" (ngModelChange)="set('price', $event)" />
            </div>
            <div class="formfield">
              <label for="downPayment">Down payment ($)</label>
              <input id="downPayment" name="downPayment" type="number" min="0" step="1000"
                [ngModel]="f().downPayment" (ngModelChange)="set('downPayment', $event)" />
            </div>
            <div class="formfield">
              <label for="rate">Interest rate (% a year)</label>
              <input id="rate" name="rate" type="number" min="0" max="100" step="0.01"
                [ngModel]="f().annualInterestRate" (ngModelChange)="set('annualInterestRate', $event)" />
            </div>
            <div class="formfield">
              <label for="term">Loan term (years)</label>
              <input id="term" name="term" type="number" min="1" max="50" step="1"
                [ngModel]="f().loanTermYears" (ngModelChange)="set('loanTermYears', $event)" />
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Costs you know <span class="optional">(optional)</span></legend>
          <div class="st-fields">
            <div class="formfield">
              <label for="tax">Property tax ($ a year)</label>
              <input id="tax" name="tax" type="number" min="0" step="100"
                [ngModel]="f().annualPropertyTax" (ngModelChange)="set('annualPropertyTax', $event)" />
            </div>
            <div class="formfield">
              <label for="insurance">Home insurance ($ a year)</label>
              <input id="insurance" name="insurance" type="number" min="0" step="100"
                [ngModel]="f().annualHomeInsurance" (ngModelChange)="set('annualHomeInsurance', $event)" />
            </div>
            <div class="formfield">
              <label for="hoa">HOA ($ a month)</label>
              <input id="hoa" name="hoa" type="number" min="0" step="10"
                [ngModel]="f().monthlyHoaFees" (ngModelChange)="set('monthlyHoaFees', $event)" />
            </div>
          </div>
        </fieldset>
        <div class="st-actions">
          <!-- aria-disabled, not disabled: it keeps its focus, and the reason sits beside it. -->
          <button
            class="btn primary"
            [attr.aria-disabled]="blocked() || state().loading ? 'true' : null"
            [attr.aria-describedby]="blocked() ? 'mc-why' : null"
          >
            {{ state().loading ? 'Calculating…' : 'Calculate' }}
          </button>
          @if (blocked(); as why) {
            <p class="st-why" id="mc-why">{{ why }}</p>
          }
        </div>
        <p class="st-note">
          These figures are sent only to work out the cost. They don't change any property record.
        </p>
      </form>

      <gz-record-section aria-labelledby="mc-result">
        <h2 id="mc-result" #resultTitle tabindex="-1">Monthly cost</h2>
        <gz-request-status
          [loading]="state().loading && !state().response"
          loadingText="Calculating…"
          [error]="state().error"
          (retry)="calculate()"
        />
        @if (state().response; as c) {
          @if (stale()) {
            <p class="st-note" role="status">
              The figures beside it changed since this result: Calculate to update it.
            </p>
          }
          <div class="st-figure" [attr.aria-busy]="state().loading ? 'true' : null">
            <span class="st-figure-label">Each month</span>
            <span class="st-figure-value">{{ money(c.totalMonthlyKnownCosts, true) }}</span>
            <span class="st-figure-caption">{{ caption() }}</span>
          </div>
          <gz-record-group
            heading="Each month"
            [note]="leftOut().length ? 'Unavailable: left blank, so the total leaves it out.' : ''"
          >
            <div gz-record-row label="Principal and interest" [numeric]="true">
              {{ money(c.monthlyPrincipalAndInterest, true) }}
            </div>
            <div gz-record-row label="Property tax" [numeric]="true"
              [missing]="c.monthlyPropertyTax === null" reason="Left blank">
              {{ money(c.monthlyPropertyTax, true) }}
            </div>
            <div gz-record-row label="Home insurance" [numeric]="true"
              [missing]="c.monthlyInsurance === null" reason="Left blank">
              {{ money(c.monthlyInsurance, true) }}
            </div>
            <div gz-record-row label="HOA" [numeric]="true"
              [missing]="c.monthlyHoaFees === null" reason="Left blank">
              {{ money(c.monthlyHoaFees, true) }}
            </div>
            <div gz-record-row label="Total" [numeric]="true">
              <b>{{ money(c.totalMonthlyKnownCosts, true) }}</b>
            </div>
          </gz-record-group>
          <gz-record-group heading="Loan">
            <div gz-record-row label="Loan amount" [numeric]="true">{{ money(c.loanAmount) }}</div>
          </gz-record-group>
        } @else if (!state().loading && !state().error) {
          <p class="st-empty">Enter the price, down payment, rate and term to see the monthly cost.</p>
        }
      </gz-record-section>
    </div>
  `,
})
export class MortgageCalculator {
  private readonly w = inject(Workspace);
  readonly state = this.w.store.selectSignal(selectMortgage);
  private readonly resultTitle = viewChild<ElementRef<HTMLElement>>('resultTitle');
  readonly money = money;

  /** What is typed; a signal, so the reason beside Calculate follows it (the app is zoneless). */
  // Coming back to the Studio: the figures of the result the slice still holds, so the result
  // never sits beside a form it wasn't calculated from.
  readonly f = signal<MortgageFields>({
    price: null,
    downPayment: null,
    annualInterestRate: null,
    loanTermYears: 30,
    annualPropertyTax: null,
    annualHomeInsurance: null,
    monthlyHoaFees: null,
    ...(this.state().request ?? {}),
  });
  set<K extends keyof MortgageFields>(key: K, value: MortgageFields[K] | '') {
    // An emptied number field reports '' or null: both mean "not supplied", never 0.
    this.f.update((f) => ({ ...f, [key]: value === '' ? null : value }));
  }

  /** Why Calculate can't run yet, written next to it (DESIGN.md §12); null when it can. */
  readonly blocked = computed(() => {
    const f = this.f();
    const missing = [
      f.price === null && 'price',
      f.downPayment === null && 'down payment',
      f.annualInterestRate === null && 'rate',
      f.loanTermYears === null && 'term',
    ].filter((x): x is string => !!x);
    if (missing.length) return `Enter the ${joinList(missing)}.`;
    if (f.price! <= 0) return 'The price must be above $0.';
    if (f.downPayment! < 0) return 'The down payment can’t be below $0.';
    if (f.downPayment! > f.price!) return 'The down payment can’t be more than the price.';
    if (f.annualInterestRate! < 0 || f.annualInterestRate! > 100)
      return 'The rate runs from 0% to 100%.';
    if (!Number.isInteger(f.loanTermYears) || f.loanTermYears! < 1 || f.loanTermYears! > 50)
      return 'The term is a whole number of years, 1 to 50.';
    const costs = [f.annualPropertyTax, f.annualHomeInsurance, f.monthlyHoaFees];
    if (costs.some((c) => c !== null && c < 0)) return 'A cost can’t be below $0.';
    return null;
  });

  /** The costs the backend left out of the total (sent back as null: left blank). */
  readonly leftOut = computed(() => {
    const c = this.state().response;
    if (!c) return [];
    return [
      c.monthlyPropertyTax === null && 'property tax',
      c.monthlyInsurance === null && 'home insurance',
      c.monthlyHoaFees === null && 'HOA',
    ].filter((x): x is string => !!x);
  });
  readonly caption = computed(() => {
    const m = this.leftOut();
    return m.length
      ? `Principal and interest plus the costs you entered; leaves out ${joinList(m)}.`
      : 'Principal and interest, property tax, home insurance and HOA.';
  });

  private readonly expectResult = resultArrived(this.state, this.resultTitle);

  /** The request the form would send; null while it can't be sent. */
  readonly request = computed<MortgageRequest | null>(() => {
    const f = this.f();
    if (this.blocked()) return null;
    return {
      price: f.price!,
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
