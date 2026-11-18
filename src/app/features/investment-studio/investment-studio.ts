import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AffordabilityCalculator } from './affordability-calculator';
import { RentalAnalysis } from './rental-analysis';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Workspace } from '../../shared/data/workspace';
import { MortgageActions as A } from '../../store/mortgage/mortgage.actions';
import { selectMortgage } from '../../store/mortgage/mortgage.selectors';
type StudioMode = 'mortgage' | 'affordability' | 'rental';
const modeFrom = (value: string | null): StudioMode =>
  value === 'affordability' || value === 'rental' ? value : 'mortgage';
@Component({
  imports: [
    FormsModule,
    CurrencyPipe,
    RouterLink,
    PageHeading,
    RequestStatus,
    AffordabilityCalculator,
    RentalAnalysis,
  ],
  templateUrl: './investment-studio.html',
})
export class InvestmentStudio {
  w = inject(Workspace);
  state = this.w.store.selectSignal(selectMortgage);
  readonly tabs = [
    ['mortgage', 'Mortgage payment'],
    ['affordability', 'Affordability'],
    ['rental', 'Rental investment'],
  ] as const;
  private route = inject(ActivatedRoute);
  /** ?mode=affordability (or rental) opens that tab, e.g. from the dashboard affordability card. */
  mode = signal<StudioMode>(modeFrom(this.route.snapshot.queryParamMap.get('mode')));
  private params = toSignal(this.route.paramMap);
  propertyId = computed(() => {
    const id = Number(this.params()?.get('id'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  constructor() {
    effect(() => {
      const id = this.propertyId();
      if (id !== null && untracked(() => this.w.catalog().detail?.id) !== id)
        this.w.store.dispatch(CatalogActions.loadDetail({ id }));
    });
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const order = this.tabs.map((t) => t[0]);
    const index = order.indexOf(this.mode());
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? order.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length;
    this.mode.set(order[next]);
    document.getElementById('studio-tab-' + order[next])?.focus();
  }
  price: number | null = null;
  downPayment: number | null = null;
  annualInterestRate: number | null = null;
  loanTermYears = 30;
  annualPropertyTax: number | null = null;
  annualHomeInsurance: number | null = null;
  monthlyHoaFees: number | null = null;
  calculate() {
    if (
      this.price === null ||
      this.price <= 0 ||
      this.downPayment === null ||
      this.downPayment < 0 ||
      this.downPayment > this.price ||
      this.annualInterestRate === null ||
      this.annualInterestRate < 0 ||
      this.annualInterestRate > 100 ||
      this.loanTermYears < 1 ||
      this.loanTermYears > 50
    ) {
      this.w.toast('Check the price, down payment, interest rate and term.');
      return;
    }
    this.w.store.dispatch(
      A.calculate({
        request: {
          price: this.price,
          downPayment: this.downPayment,
          annualInterestRate: this.annualInterestRate,
          loanTermYears: this.loanTermYears,
          ...(this.annualPropertyTax === null ? {} : { annualPropertyTax: this.annualPropertyTax }),
          ...(this.annualHomeInsurance === null
            ? {}
            : { annualHomeInsurance: this.annualHomeInsurance }),
          ...(this.monthlyHoaFees === null ? {} : { monthlyHoaFees: this.monthlyHoaFees }),
        },
      }),
    );
  }
}
