import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { actAs } from '../../store/account/account.testing';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { MortgageActions } from '../../store/mortgage/mortgage.actions';
import { AffordabilityActions } from '../../store/affordability/affordability.actions';
import { InvestmentActions } from '../../store/investment/investment.actions';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import {
  InvestmentAnalysisRequest,
  InvestmentAnalysisResponse,
  ScenarioDTO,
} from '../../core/models/investment';
import { InvestmentStudio } from './investment-studio';
import { money, percent, polarity, signedMoney } from './studio-format';

const operating = (over: Partial<NonNullable<InvestmentAnalysisResponse['operating']>> = {}) => ({
  monthlyGrossRent: 3250,
  annualGrossRent: 39000,
  monthlyVacancyLoss: 162.5,
  annualVacancyLoss: 1950,
  monthlyEffectiveIncome: 3087.5,
  annualEffectiveIncome: 37050,
  annualMaintenance: 3120,
  annualManagement: 3705,
  annualPropertyTax: 6200,
  annualInsurance: 2900,
  annualHoaFees: null,
  annualOtherExpenses: null,
  monthlyOperatingExpenses: 1327.08,
  annualOperatingExpenses: 15925,
  monthlyNetOperatingIncome: 1760.42,
  annualNetOperatingIncome: 21125,
  notes: ['Not supplied, so not included in operating costs: HOA, other costs.'],
  ...over,
});
const financed: InvestmentAnalysisResponse = {
  operating: operating(),
  financing: {
    loanAmount: 372000,
    monthlyDebtService: 2412.79,
    annualDebtService: 28953.48,
    monthlyCashFlow: -652.37,
    annualCashFlow: -7828.48,
    capRatePercent: 4.54,
    cashInvested: 102000,
    cashOnCashPercent: -7.67,
    notes: [],
  },
  grossYieldPercent: 8.39,
  projection: null,
  notes: ['Calculated only from the figures you entered. Not a market estimate, an appraisal or advice.'],
};
const scenario = (id: number, name: string, propertyId: number | null = null): ScenarioDTO => ({
  id,
  name,
  scenarioType: 'INVESTMENT',
  inputVersion: 1,
  propertyId,
  assumptions: { operating: { monthlyRent: 2800 }, financing: { purchasePrice: 400000 } },
  createdAt: '2026-11-10T12:00:00Z',
  updatedAt: '2026-11-15T12:00:00Z',
});

describe('Investment studio', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: true };
  beforeEach(() => (auth.loggedIn = true));

  async function setup(url = '/', route?: { mode?: string; id?: string }) {
    TestBed.configureTestingModule({
      imports: [InvestmentStudio],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: () => false } },
        ...(route
          ? [
              {
                provide: ActivatedRoute,
                useValue: {
                  snapshot: { queryParamMap: convertToParamMap(route.mode ? { mode: route.mode } : {}) },
                  queryParamMap: of(convertToParamMap(route.mode ? { mode: route.mode } : {})),
                  paramMap: of(convertToParamMap(route.id ? { id: route.id } : {})),
                },
              },
            ]
          : []),
      ],
    });
    if (!route) await TestBed.inject(Router).navigateByUrl(url);
    store = TestBed.inject(Store);
    // Rental analysis and Top scored are the investor's (features.investment).
    if (auth.loggedIn) actAs(store, 'investor');
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const fixture = TestBed.createComponent(InvestmentStudio);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    return { fixture, el };
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  /** Text as read: each text node apart (a label and its figure are separate blocks). */
  const spaced = (el: Element | null) => {
    const walk = document.createTreeWalker(el!, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    while (walk.nextNode()) out.push(walk.currentNode.textContent!);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  const of_ = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  async function type(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }, values: Record<string, number | string>) {
    for (const [id, v] of Object.entries(values)) {
      const input = document.getElementById(id) as HTMLInputElement;
      input.value = String(v);
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const visible = (el: HTMLElement, selector: string) =>
    !el.querySelector<HTMLElement>(selector)!.hasAttribute('hidden');

  it('names the page plainly and shows one calculator at a time, kept in the address', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    expect(text(el.querySelector('h1'))).toBe('Investment studio');
    expect(el.textContent).not.toContain('Good decisions start with your numbers.');
    expect(el.textContent).not.toContain('INVESTMENT STUDIO');
    expect(visible(el, 'gz-rental-analysis')).toBe(true);
    expect(visible(el, 'gz-mortgage-calculator')).toBe(false);
    expect(visible(el, 'gz-affordability-calculator')).toBe(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('#studio-tab-affordability')!.click();
    fixture.detectChanges();
    expect(visible(el, 'gz-affordability-calculator')).toBe(true);
    expect(visible(el, 'gz-rental-analysis')).toBe(false);
    expect(navigate.mock.calls[0][1]).toMatchObject({ queryParams: { mode: 'affordability' }, replaceUrl: true });
  });

  it('mortgage: says why it can’t calculate yet, then sends only the costs supplied', async () => {
    const { fixture, el } = await setup('/');
    const calc = el.querySelector<HTMLButtonElement>('gz-mortgage-calculator button.primary')!;
    expect(text(el.querySelector('#mc-why'))).toBe('Enter the price, down payment and rate.');
    expect(calc.getAttribute('aria-disabled')).toBe('true');
    calc.click();
    expect(of_(MortgageActions.calculate.type)).toHaveLength(0);
    await type(fixture, { price: 650000, downPayment: 700000, rate: 6.5 });
    expect(text(el.querySelector('#mc-why'))).toBe('The down payment can’t be more than the price.');
    await type(fixture, { downPayment: 130000, tax: 9100, insurance: 4200 });
    expect(el.querySelector('#mc-why')).toBeNull();
    calc.click();
    expect(of_<ReturnType<typeof MortgageActions.calculate>>(MortgageActions.calculate.type)[0].request).toEqual({
      price: 650000,
      downPayment: 130000,
      annualInterestRate: 6.5,
      loanTermYears: 30,
      annualPropertyTax: 9100,
      annualHomeInsurance: 4200,
    });
  });

  it('mortgage: the result leads with the monthly cost and marks what was left blank', async () => {
    const { fixture, el } = await setup('/');
    await type(fixture, { price: 650000, downPayment: 130000, rate: 6.5, tax: 9100, insurance: 4200 });
    el.querySelector<HTMLButtonElement>('gz-mortgage-calculator button.primary')!.click();
    store.dispatch(
      MortgageActions.calculated({
        response: {
          loanAmount: 520000,
          monthlyPrincipalAndInterest: 3286.75,
          monthlyPropertyTax: 758.33,
          monthlyInsurance: 350,
          monthlyHoaFees: null,
          totalMonthlyKnownCosts: 4395.08,
        },
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const result = el.querySelector('gz-mortgage-calculator gz-record-section')!;
    expect(spaced(result.querySelector('.st-figure'))).toBe(
      'Each month $4,395.08 Principal and interest plus the costs you entered; leaves out HOA.',
    );
    const hoa = [...result.querySelectorAll('.record-row')].find((r) => text(r).startsWith('HOA'))!;
    expect(hoa.querySelector('.na-word')!.textContent).toBe('Unavailable');
    expect(text(result)).toContain('Unavailable: left blank, so the total leaves it out.');
    expect(spaced(result)).toContain('Loan amount $520,000');
    // The answer moves focus to the result's heading (read out; scrolled to below 1024 px).
    expect(document.activeElement).toBe(el.querySelector('#mc-result'));
  });

  it('affordability: shows the highest price and the limits used, in plain words', async () => {
    const { fixture, el } = await setup('/?mode=affordability');
    await type(fixture, { income: 145000, affDown: 90000, affRate: 6.5 });
    el.querySelector<HTMLButtonElement>('gz-affordability-calculator button.primary')!.click();
    expect(of_<ReturnType<typeof AffordabilityActions.calculate>>(AffordabilityActions.calculate.type)[0].request).toEqual({
      annualGrossIncome: 145000,
      monthlyDebtPayments: 0,
      downPayment: 90000,
      annualInterestRate: 6.5,
      loanTermYears: 30,
    });
    store.dispatch(
      AffordabilityActions.calculated({
        response: {
          monthlyGrossIncome: 12083.33,
          maxMonthlyHousingPayment: 3383.33,
          maxMonthlyPrincipalAndInterest: 2733.33,
          maxLoanAmount: 432000,
          maxHomePrice: 522000,
          assumptions: {
            frontEndRatioPercent: 28,
            backEndRatioPercent: 36,
            annualInterestRate: 6.5,
            loanTermYears: 30,
            rateSource: 'Rate supplied by the caller.',
          },
          notes: ['Uses maxMonthlyHousingPayment as the cap.'],
          disclaimer: 'An estimate, not a loan offer.',
        },
      }),
    );
    fixture.detectChanges();
    const result = spaced(el.querySelector('gz-affordability-calculator gz-record-section'));
    expect(result).toContain('Highest home price $522,000 With a loan of up to $432,000.');
    expect(result).toContain('Housing costs, of income up to 28%');
    expect(result).toContain('Rate source Rate supplied by the caller.');
    expect(result).toContain('An estimate, not a loan offer.');
    // A backend note naming a field is left out (DESIGN.md §13).
    expect(result).not.toContain('maxMonthlyHousingPayment');
  });

  it('rental: needs the rent, then sends only what was typed', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    expect(text(el.querySelector('#ra-why'))).toBe('Enter the rent first.');
    await type(fixture, { 'ra-rent': 3250, 'ra-vacancy': 5, 'ra-price': 465000, 'ra-growth': 3 });
    expect(text(el.querySelector('#ra-why'))).toBe('Enter the years to hold for the value change to count.');
    await type(fixture, { 'ra-horizon': 10 });
    el.querySelector<HTMLButtonElement>('gz-rental-analysis button.primary')!.click();
    const sent = of_<ReturnType<typeof InvestmentActions.analyze>>(InvestmentActions.analyze.type)[0].request;
    expect(sent).toEqual({
      operating: { monthlyRent: 3250, vacancyRatePercent: 5 },
      financing: { purchasePrice: 465000 },
      projection: { horizonYears: 10, annualAppreciationRatePercent: 3 },
    });
  });

  it('rental: income and costs by month and year, losses with a true minus, blanks marked', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    await type(fixture, { 'ra-rent': 3250 });
    const request: InvestmentAnalysisRequest = { operating: { monthlyRent: 3250 } };
    store.dispatch(InvestmentActions.analyzed({ request, response: financed }));
    fixture.detectChanges();
    const result = el.querySelector('gz-rental-analysis gz-record-section')!;
    expect(spaced(result.querySelector('.st-figure'))).toBe(
      'Cash flow, each month −$652 After the loan payment of $2,413.',
    );
    expect(result.querySelector('.st-figure-value')!.classList).toContain('negative');
    const rows = [...result.querySelectorAll('.st-table tbody tr')].map((r) => spaced(r));
    expect(rows[0]).toBe('Gross rent $3,250 $39,000');
    // Costs given by the year: the monthly cell is blank (not applicable), never a worked-out figure.
    expect(rows[3]).toBe('Maintenance Given by the year $3,120');
    expect(rows[7]).toContain('HOA Given by the year Unavailable');
    expect(rows.at(-1)).toBe('Net operating income +$1,760 +$21,125');
    expect(spaced(result)).toContain('Cash-on-cash return −7.67%');
    expect(text(result)).toContain('Not supplied, so not included in operating costs: HOA, other costs.');
    // The form changed after this result: the page says so.
    expect(text(result)).not.toContain('changed since this result');
    await type(fixture, { 'ra-rent': 3400 });
    expect(text(result)).toContain('The figures above changed since this result');
  });

  it('rental: without financing, the returns collapse to one sentence', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    store.dispatch(
      InvestmentActions.analyzed({
        request: { operating: { monthlyRent: 2800 } },
        response: { ...financed, financing: null, grossYieldPercent: null },
      }),
    );
    fixture.detectChanges();
    const result = spaced(el.querySelector('gz-rental-analysis gz-record-section'));
    expect(result).toContain('Net operating income, each month +$1,760 Before any loan payment.');
    expect(result).toContain('Add the purchase price, down payment, rate and term to see the loan payment');
    expect(result).not.toContain('Cap rate');
  });

  it('rental: saved scenarios as a table; opening one fills the form and calculates it', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    expect(of_(InvestmentActions.loadScenarios.type)).toHaveLength(1);
    store.dispatch(
      InvestmentActions.scenariosLoaded({
        page: { content: [scenario(1, 'Quick rent check'), scenario(2, 'SW 186th St', 48)], page: 0, size: 20, totalElements: 2, totalPages: 1 },
      }),
    );
    fixture.detectChanges();
    const rows = [...el.querySelectorAll('.sc-table tbody tr')];
    expect(spaced(rows[0])).toBe('Quick rent check $2,800 Nov 15 Open Delete');
    expect(rows[1].querySelector('a')!.getAttribute('href')).toBe('/property/48');
    rows[0].querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(of_<ReturnType<typeof InvestmentActions.analyze>>(InvestmentActions.analyze.type)[0].request).toEqual(
      scenario(1, '').assumptions,
    );
    expect((document.getElementById('ra-rent') as HTMLInputElement).value).toBe('2800');
    expect(text(el.querySelector('#ra-title'))).toBe('Quick rent check');
    expect(text(el.querySelector('.sc-table tbody tr'))).toContain('In the form above');
    // Saving needs a name and the rent, and says so beside the button.
    expect(el.querySelector('#sc-why')).toBeNull();
  });

  it('rental: a failed scenario list waits for Retry instead of asking again forever', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    store.dispatch(InvestmentActions.scenariosFailed({ error: 'Scenarios could not load.' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(of_(InvestmentActions.loadScenarios.type)).toHaveLength(1);
    expect(text(el.querySelector('.sc'))).toContain('Scenarios could not load.');
  });

  it('rental is the investor’s: without the investment feature it isn’t offered and nothing is loaded', async () => {
    auth.loggedIn = false;
    const { el } = await setup('/?mode=rental');
    // ?mode=rental falls back to the mortgage calculator; the tab isn't there at all.
    expect([...el.querySelectorAll('[role=tab]')].map((t) => text(t))).toEqual(['Mortgage', 'Affordability']);
    expect(el.querySelector('gz-rental-analysis')).toBeNull();
    expect(of_(InvestmentActions.loadScenarios.type)).toHaveLength(0);
  });

  it('opened from a property, names it with a link back and fills in nothing', async () => {
    const { fixture, el } = await setup('/', { mode: 'rental', id: '42' });
    expect(of_<ReturnType<typeof CatalogActions.loadDetail>>(CatalogActions.loadDetail.type)[0].id).toBe(42);
    store.dispatch(
      CatalogActions.detailLoaded({
        property: {
          id: 42,
          folio: '0141370120450',
          countyName: 'Miami-Dade',
          stateCode: 'FL',
          address: { address: '2847 SW 27th Ter', city: 'Miami', zip: '33133' },
        } as never,
      }),
    );
    fixture.detectChanges();
    expect(text(el.querySelector('.studio-for'))).toBe(
      'For 2847 SW 27th Ter, Miami, FL 33133. Enter your own price: assessments and past sales are not market values.',
    );
    expect(el.querySelector('.studio-for a')!.getAttribute('href')).toBe('/property/42');
    expect((document.getElementById('ra-price') as HTMLInputElement).value).toBe('');
  });

  it('saves only figures Calculate would take, and says why not', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    store.dispatch(InvestmentActions.scenariosLoaded({ page: { content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 } }));
    await type(fixture, { 'ra-rent': 2800, 'ra-growth': 3, 'scenario-name': 'Growth only' });
    expect(text(el.querySelector('#sc-why'))).toBe(
      'Enter the years to hold for the value change to count. Then save.',
    );
    el.querySelector<HTMLButtonElement>('.sc-save button')!.click();
    expect(of_(InvestmentActions.createScenario.type)).toHaveLength(0);
  });

  it('brings back the last figures with their result, and says when the form changes', async () => {
    const first = await setup('/');
    await type(first.fixture, { price: 650000, downPayment: 130000, rate: 6.5 });
    first.el.querySelector<HTMLButtonElement>('gz-mortgage-calculator button.primary')!.click();
    store.dispatch(
      MortgageActions.calculated({
        response: {
          loanAmount: 520000,
          monthlyPrincipalAndInterest: 3286.75,
          monthlyPropertyTax: null,
          monthlyInsurance: null,
          monthlyHoaFees: null,
          totalMonthlyKnownCosts: 3286.75,
        },
      }),
    );
    first.fixture.destroy();
    first.el.remove();
    // Back to the Studio: the result is shown with the figures it came from.
    const again = TestBed.createComponent(InvestmentStudio);
    again.detectChanges();
    await again.whenStable();
    const el = again.nativeElement as HTMLElement;
    document.body.appendChild(el);
    expect((document.getElementById('price') as HTMLInputElement).value).toBe('650000');
    expect(el.querySelector('#mc-why')).toBeNull();
    expect(text(el.querySelector('gz-mortgage-calculator gz-record-section'))).not.toContain('changed since');
    await type(again, { price: 700000 });
    expect(text(el.querySelector('gz-mortgage-calculator gz-record-section'))).toContain(
      'The figures beside it changed since this result',
    );
  });

  it('reads a rate source code as words and a 1-year term without a plural', async () => {
    const { fixture, el } = await setup('/?mode=affordability');
    store.dispatch(AffordabilityActions.calculate({ request: { annualGrossIncome: 1, monthlyDebtPayments: 0, downPayment: 0, annualInterestRate: 6, loanTermYears: 1 } }));
    store.dispatch(
      AffordabilityActions.calculated({
        response: {
          monthlyGrossIncome: 1,
          maxMonthlyHousingPayment: 1,
          maxMonthlyPrincipalAndInterest: 1,
          maxLoanAmount: 1,
          maxHomePrice: 1,
          assumptions: { frontEndRatioPercent: 28, backEndRatioPercent: 36, annualInterestRate: 6, loanTermYears: 1, rateSource: 'USER_SUPPLIED' },
          notes: [],
          disclaimer: '',
        },
      }),
    );
    fixture.detectChanges();
    const result = spaced(el.querySelector('gz-affordability-calculator gz-record-section'));
    expect(result).toContain('Rate source User supplied');
    expect(result).not.toContain('USER_SUPPLIED');
    expect(result).toContain('6% over 1 year');
  });

  it('collapses a holding period with nothing to project into one sentence', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    const empty = {
      horizonYears: 5,
      annualAppreciationRatePercent: null,
      projectedPropertyValue: null,
      remainingLoanBalance: null,
      equityFromDownPayment: null,
      equityFromLoanPaydown: null,
      equityFromAppreciation: null,
      totalEquity: null,
      cumulativeCashFlow: null,
      assumptions: [],
      notes: [],
    };
    store.dispatch(
      InvestmentActions.analyzed({
        request: { operating: { monthlyRent: 2800 }, projection: { horizonYears: 5 } },
        response: { ...financed, financing: null, grossYieldPercent: null, projection: empty },
      }),
    );
    fixture.detectChanges();
    const result = spaced(el.querySelector('gz-rental-analysis gz-record-section'));
    expect(result).toContain('After 5 years: add the purchase price and the loan');
    expect(result).not.toContain('Loan balance left');
  });

  it('Save as new keeps the open scenario’s property link; New scenario keeps the focus', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    store.dispatch(
      InvestmentActions.scenariosLoaded({
        page: { content: [scenario(2, 'SW 186th St', 48)], page: 0, size: 50, totalElements: 2, totalPages: 1 },
      }),
    );
    fixture.detectChanges();
    expect(text(el.querySelector('.sc .table-note'))).toBe('Listed: 1 of 2 scenarios.');
    el.querySelector<HTMLButtonElement>('.sc-table tbody tr button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    [...el.querySelectorAll<HTMLButtonElement>('.sc-save button')].find((b) => text(b) === 'Save as new')!.click();
    const created = of_<ReturnType<typeof InvestmentActions.createScenario>>(InvestmentActions.createScenario.type);
    expect(created[0].request.propertyId).toBe(48);
    const fresh = [...el.querySelectorAll<HTMLButtonElement>('.sc-head button')].find((b) => text(b) === 'New scenario')!;
    fresh.focus();
    fresh.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(document.getElementById('scenario-name'));
  });

  it('follows the address: the nav’s Studio link (no mode) brings back Mortgage', async () => {
    const { fixture, el } = await setup('/?mode=rental');
    expect(visible(el, 'gz-rental-analysis')).toBe(true);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    expect(visible(el, 'gz-mortgage-calculator')).toBe(true);
    expect(visible(el, 'gz-rental-analysis')).toBe(false);
  });
});

describe('Studio number formats', () => {
  it('never turns a missing value into zero, and signs with a true minus', () => {
    expect(money(null)).toBeNull();
    expect(money(522000)).toBe('$522,000');
    expect(money(4395.081, true)).toBe('$4,395.08');
    expect(signedMoney(-652.37)).toBe('−$652');
    expect(signedMoney(1760.42)).toBe('+$1,760');
    expect(signedMoney(0.001)).toBe('$0');
    expect(percent(-7.674)).toBe('−7.67%');
    expect(percent(undefined)).toBeNull();
    expect(polarity(-1)).toBe('negative');
    expect(polarity(0)).toBeNull();
  });
});
