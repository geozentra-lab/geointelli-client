import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PropertyService } from './property.service';
import { RecommendationService } from './recommendation.service';
import { DashboardService } from './dashboard.service';
import { InvestmentAnalysisService } from './investment-analysis.service';
import { NotificationService } from './notification.service';
import { propertyCompareReducer } from '../store/property-compare/property-compare.reducer';
import { PropertyCompareActions } from '../store/property-compare/property-compare.actions';
import { dashboardReducer } from '../store/dashboard/dashboard.reducer';
import { DashboardActions } from '../store/dashboard/dashboard.actions';
import { FavoritesCard } from '../core/models/api';
describe('Insight API contracts', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('POSTs internal property IDs in order for side-by-side comparison', () => {
    TestBed.inject(PropertyService).compare([34, 12]).subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/properties/compare'));
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ propertyIds: [34, 12] });
    r.flush({});
  });
  it('reads location intelligence by numeric property ID', () => {
    const service = TestBed.inject(PropertyService);
    service.schoolContext(7).subscribe();
    service.transportContext(7).subscribe();
    http
      .expectOne((r) => r.url.endsWith('/properties/id/7/location-intelligence/schools'))
      .flush({});
    http
      .expectOne((r) => r.url.endsWith('/properties/id/7/location-intelligence/transport'))
      .flush({});
  });
  it('requests recommendations with a bounded limit and no user ID', () => {
    TestBed.inject(RecommendationService).list(20).subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/recommendations'));
    expect(r.request.params.get('limit')).toBe('20');
    expect(r.request.params.has('userId')).toBe(false);
    r.flush({ content: [] });
  });
  it('reads the three current-user dashboard cards', () => {
    const service = TestBed.inject(DashboardService);
    service.favorites().subscribe();
    service.savedSearches().subscribe();
    service.alerts().subscribe();
    for (const path of ['favorites', 'saved-searches', 'alerts']) {
      const r = http.expectOne((r) => r.url.endsWith('/dashboards/user/' + path));
      expect(r.request.params.get('limit')).toBe('5');
      r.flush({});
    }
  });
  it('omits unknown optional costs from the affordability request', () => {
    TestBed.inject(InvestmentAnalysisService)
      .affordability({
        annualGrossIncome: 120000,
        monthlyDebtPayments: 0,
        downPayment: 50000,
        annualInterestRate: 6.5,
        loanTermYears: 30,
        annualPropertyTax: undefined,
      })
      .subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/calculations/affordability'));
    expect(r.request.method).toBe('POST');
    expect(JSON.parse(JSON.stringify(r.request.body))).toEqual({
      annualGrossIncome: 120000,
      monthlyDebtPayments: 0,
      downPayment: 50000,
      annualInterestRate: 6.5,
      loanTermYears: 30,
    });
    r.flush({});
  });
  it('PUTs complete notification preferences without a recipient address', () => {
    TestBed.inject(NotificationService)
      .updatePreferences({
        inAppEnabled: true,
        emailEnabled: true,
        enabledEventTypes: ['NEW_MATCH'],
        emailCadence: 'WEEKLY',
      })
      .subscribe();
    const r = http.expectOne((r) => r.url.endsWith('/notifications/preferences'));
    expect(r.request.method).toBe('PUT');
    expect(r.request.url.startsWith('/notification-api/')).toBe(true);
    expect(r.request.body.emailAddress).toBeUndefined();
    r.flush({});
  });
  it('keeps the comparison selection unique and within backend bounds', () => {
    let s = propertyCompareReducer(
      undefined,
      PropertyCompareActions.setSelection({
        propertyIds: [1, 1, 2, -3, 4, 5, 6, 7],
      }),
    );
    expect(s.selection).toEqual([1, 2, 4, 5, 6]);
    s = propertyCompareReducer(s, PropertyCompareActions.toggle({ propertyId: 9 }));
    expect(s.selection).toEqual([1, 2, 4, 5, 6]);
    s = propertyCompareReducer(s, PropertyCompareActions.toggle({ propertyId: 2 }));
    expect(s.selection).toEqual([1, 4, 5, 6]);
  });
  it('surfaces a dashboard card that loaded with status ERROR as a card error', () => {
    const card = {
      status: 'ERROR',
      error: 'Favorites unavailable',
      recent: [],
    } as unknown as FavoritesCard;
    const s = dashboardReducer(undefined, DashboardActions.favoritesLoaded({ card }));
    expect(s.favorites.error).toBe('Favorites unavailable');
    expect(s.alerts.error).toBeNull();
  });
});
