import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PropertyService } from './property.service';
import { UserService } from './user.service';
import { SavedSearchService } from './saved-search.service';
import { AlertService } from './alert.service';
import { PortfolioService } from './portfolio.service';
import { InvestmentAnalysisService } from './investment-analysis.service';
import { ComparableService } from './comparable.service';
describe('Backend master API contracts', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('preserves numeric county IDs, zero filters and backend pagination without price filters', () => {
    TestBed.inject(PropertyService)
      .search({ countyId: 17, minBedrooms: 0, page: 2, size: 20, direction: 'desc' })
      .subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/properties/search'));
    expect(r.request.params.get('countyId')).toBe('17');
    expect(r.request.params.get('minBedrooms')).toBe('0');
    expect(r.request.params.get('page')).toBe('2');
    expect(r.request.params.has('maxPrice')).toBe(false);
    r.flush({ content: [] });
  });
  it('PATCHes the name and PUTs complete preferences to separate resources', () => {
    const service = TestBed.inject(UserService);
    service.updateProfile({ firstName: 'Ana' }).subscribe();
    let r = http.expectOne((r) => r.url.endsWith('/users/me'));
    expect(r.request.method).toBe('PATCH');
    expect(r.request.body).toEqual({ firstName: 'Ana' });
    r.flush({});
    const preferences = {
      minBudget: null,
      maxBudget: 900000,
      targetLocations: [{ countyId: 17 }],
      investmentGoals: ['Rental income'],
    };
    service.updatePreferences(preferences).subscribe();
    r = http.expectOne((r) => r.url.endsWith('/users/me/preferences'));
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual(preferences);
    r.flush(preferences);
  });
  it('keeps saved-search filters canonical and alert targets immutable on PATCH', () => {
    TestBed.inject(SavedSearchService)
      .create({ name: 'County records', filters: { countyId: 17 }, paused: false })
      .subscribe();
    let r = http.expectOne((r) => r.url.endsWith('/saved-searches'));
    expect(r.request.body.filters).toEqual({ countyId: 17 });
    expect(r.request.body.paused).toBe(false);
    r.flush({});
    TestBed.inject(AlertService).update(4, { paused: true, cadence: 'WEEKLY' }).subscribe();
    r = http.expectOne((r) => r.url.endsWith('/alerts/4'));
    expect(r.request.method).toBe('PATCH');
    expect(r.request.body).toEqual({ paused: true, cadence: 'WEEKLY' });
    r.flush({});
  });
  it('uses full-property dollars and explicit nulls for holding facts', () => {
    const body = {
      purchasePrice: null,
      ownershipSharePercent: 50,
      financing: {
        type: 'FINANCED' as const,
        outstandingBalance: 200000,
        balanceAsOfDate: '2026-10-01',
      },
    };
    TestBed.inject(PortfolioService).updateHolding(2, 8, body).subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/portfolios/2/holdings/8'));
    expect(r.request.method).toBe('PATCH');
    expect(r.request.body).toEqual(body);
    expect(r.request.body.propertyId).toBeUndefined();
    r.flush({});
  });
  it('scopes financial records and sends dates independently from current exposure', () => {
    TestBed.inject(PortfolioService)
      .records(2, 8, 3, { fromDate: '2026-01-01', toDate: '2026-09-30', category: 'RENT' })
      .subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/portfolios/2/holdings/8/financial-records'));
    expect(r.request.params.get('page')).toBe('3');
    expect(r.request.params.get('category')).toBe('RENT');
    expect(r.request.params.get('toDate')).toBe('2026-09-30');
    r.flush({ content: [] });
  });
  it('sends absolute down payment and annual optional costs without invented zero costs', () => {
    const body = {
      price: 500000,
      downPayment: 100000,
      annualInterestRate: 0,
      loanTermYears: 30,
      annualPropertyTax: 6000,
    };
    TestBed.inject(InvestmentAnalysisService).calculate(body).subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/calculations/mortgage'));
    expect(r.request.body).toEqual(body);
    expect(r.request.body.annualHomeInsurance).toBeUndefined();
    r.flush({});
  });
  it('requests ranked comparable sales with meters and months', () => {
    TestBed.inject(ComparableService).get(42, { radiusMeters: 2000, months: 24 }).subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/properties/id/42/comparables'));
    expect(r.request.params.get('radiusMeters')).toBe('2000');
    expect(r.request.params.get('months')).toBe('24');
    r.flush({});
  });
});
