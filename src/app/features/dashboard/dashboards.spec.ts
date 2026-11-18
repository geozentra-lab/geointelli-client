import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { UserActions } from '../../store/user/user.actions';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { UserDTO } from '../../core/models/api';
import { RealtorDashboard } from './realtor-dashboard/realtor-dashboard';
import { LenderDashboard } from './lender-dashboard/lender-dashboard';
import { InvestorDashboard } from './investor-dashboard/investor-dashboard';
import { usdCompact } from './dash-ui';

const page = <T>(content: T[], totalElements = content.length) => ({
  content,
  page: 0,
  size: 20,
  totalElements,
  totalPages: 1,
});

function signedIn(persona: UserDTO['persona']) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      ...provideTestStore(),
      { provide: KeycloakService, useValue: { isLoggedIn: () => true, hasRealmRole: () => false } },
    ],
  });
  TestBed.inject(Store).dispatch(
    UserActions.profileSaved({
      profile: {
        id: 7,
        firstName: 'Ana',
        lastName: 'Ruiz',
        email: 'a@example.test',
        persona,
      } as UserDTO,
    }),
  );
  return TestBed.inject(HttpTestingController);
}
const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');
/** Answers every request the test does not care about, so nothing is left pending. */
const failRest = (http: HttpTestingController) =>
  http
    .match(() => true)
    .forEach((r) => r.flush('unavailable', { status: 503, statusText: 'Unavailable' }));
const kpiValues = (el: HTMLElement) =>
  [...el.querySelectorAll('.kpi-value')].map((k) => k.textContent!.trim());

describe('Persona dashboards', () => {
  it('formats money compactly and keeps a missing amount unavailable', () => {
    expect([
      usdCompact(1_250_000),
      usdCompact(845_200),
      usdCompact(920),
      usdCompact(-12_500),
    ]).toEqual(['$1.25M', '$845K', '$920', '−$13K']);
    expect(usdCompact(null)).toBeNull();
  });

  it('realtor: fills the KPIs from the realtor cards and links each stage to the filtered deals', () => {
    const http = signedIn('REALTOR');
    const fixture = TestBed.createComponent(RealtorDashboard);
    fixture.detectChanges();
    // The two realtor cards replace one request per CRM list.
    expect(http.match((r) => r.url.endsWith('/crm/leads')).length).toBe(0);
    http
      .expectOne((r) => r.url.endsWith('/dashboards/realtor/clients-leads'))
      .flush({
        scope: 'CURRENT_USER',
        generatedAt: '2026-11-16T09:00:00',
        status: 'OK',
        error: null,
        limit: 5,
        clients: {
          total: 14,
          recent: [{ id: 2, name: 'Ana Ruiz', email: null, phone: '305', createdAt: '2026-11-10' }],
        },
        leads: {
          total: 9,
          open: 6,
          byStage: { NEW: 4, CONTACTED: 1, QUALIFIED: 1, CONVERTED: 2, LOST: 1 },
          recent: [
            {
              id: 1,
              clientId: 2,
              clientName: 'Ana Ruiz',
              propertyId: null,
              title: 'Brickell 2BR',
              source: 'WEBSITE',
              stage: 'NEW',
              createdAt: '2026-11-10',
            },
          ],
        },
      });
    http
      .expectOne(
        (r) =>
          r.url.endsWith('/dashboards/realtor/tasks-pipeline') &&
          r.params.get('days') === '7' &&
          r.params.get('limit') === '5',
      )
      .flush({
        scope: 'CURRENT_USER',
        generatedAt: '2026-11-16T09:00:00',
        status: 'OK',
        error: null,
        limit: 5,
        tasks: {
          summary: { total: 5, open: 3, inProgress: 1, completed: 1, cancelled: 0, overdue: 2 },
          window: { days: 7, from: '2026-11-16T09:00:00Z', to: '2026-11-23T09:00:00Z' },
          dueSoonCount: 3,
          overdue: [{ id: 3, title: 'Call seller', status: 'OPEN', dueAt: '2026-11-01T10:00:00Z' }],
          dueSoon: [
            { id: 4, title: 'Send offer', status: 'IN_PROGRESS', dueAt: '2026-11-18T10:00:00Z' },
          ],
        },
        pipeline: {
          total: 6,
          open: 5,
          byStage: {
            PROSPECT: 1,
            VIEWING: 2,
            OFFER: 1,
            UNDER_CONTRACT: 1,
            CLOSED: 1,
            CANCELLED: 0,
          },
        },
      });
    http.expectOne((r) => r.url.endsWith('/crm/activities')).flush(page([]));
    failRest(http);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(kpiValues(el)).toEqual(['4', '14', '4', '5']);
    expect(text(el)).toContain('2 overdue');
    expect(text(el)).toContain('Brickell 2BR');
    expect(text(el)).toContain('Ana Ruiz · Website');
    expect(text(el)).toContain('Call seller');
    // Three are due soon and one is listed.
    expect(text(el)).toContain('2 more due soon');
    const offer = [...el.querySelectorAll<HTMLAnchorElement>('.stages a')].find((a) =>
      a.textContent!.includes('Offer'),
    )!;
    expect(offer.getAttribute('href')).toBe('/crm/deals?stage=OFFER');
    // Without a license submission the dashboard asks for one.
    expect(text(el)).toContain('Verify your license');
  });

  it('lender: without an organization, asks to set one up instead of showing zeros', () => {
    const http = signedIn('BANK_LENDER');
    const fixture = TestBed.createComponent(LenderDashboard);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/lender/organizations')).flush([]);
    failRest(http);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toContain('Create your lending organization');
    expect(text(el)).not.toContain('$0');
    expect(el.querySelectorAll('.kpi-value.na').length).toBe(4);
    expect(http.match((r) => r.url.includes('/approved-funded')).length).toBe(0);
  });

  it("lender: shows this month's approved and funded loans and the LTV of recent collateral", () => {
    const http = signedIn('BANK_LENDER');
    const fixture = TestBed.createComponent(LenderDashboard);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/lender/organizations'))
      .flush([{ id: 42, name: 'Coral Bank', ownerUserId: 7 }]);
    http
      .expectOne((r) => r.url.endsWith('/lender/pipeline'))
      .flush({
        organizationId: 42,
        currency: 'USD',
        total: 2,
        stages: {
          UNDER_REVIEW: { count: 1, requestedAmount: 300000 },
          FUNDED: { count: 1, requestedAmount: 250000 },
        },
        approvedCount: 1,
        approvedAmount: 250000,
        fundedCount: 1,
        fundedAmount: 240000,
        asOf: '2026-11-16T09:00:00Z',
        scope: 'ORGANIZATION',
      });
    const card = http.expectOne((r) => r.url.endsWith('/dashboards/lender/approved-funded'));
    // Without dates the server reports the current month.
    expect(card.request.params.get('organizationId')).toBe('42');
    expect(card.request.params.has('fromDate')).toBe(false);
    card.flush({
      organizationId: 42,
      currency: 'USD',
      status: 'OK',
      error: null,
      generatedAt: '2026-11-16T09:00:00Z',
      period: { fromDate: '2026-11-01', toDate: '2026-11-30', timeZone: 'UTC' },
      approved: { count: 1, totalAmount: 250000 },
      funded: { count: 1, totalAmount: 240000 },
      fundedLoanMix: [
        { loanType: 'CONVENTIONAL', count: 0, totalAmount: 0 },
        { loanType: 'FHA', count: 1, totalAmount: 240000 },
      ],
      note: null,
    });
    http
      .expectOne((r) => r.url.endsWith('/lender/applications'))
      .flush(
        page([
          {
            id: 15,
            organizationId: 42,
            applicantName: 'Jordan Rivera',
            propertyId: 100,
            requestedAmount: 300000,
            currency: 'USD',
            stage: 'UNDER_REVIEW',
            loanType: 'FHA',
            updatedAt: '2026-11-15T10:00:00',
          },
        ]),
      );
    http
      .expectOne(
        (r) =>
          r.url.endsWith('/lender/applications/15/collateral-analysis') &&
          r.params.get('organizationId') === '42',
      )
      .flush({
        applicationId: 15,
        organizationId: 42,
        propertyId: 100,
        currency: 'USD',
        loanAmount: 300000,
        loanAmountBasis: 'REQUESTED',
        collateral: { valuationStatus: 'supported', value: 400000, reasons: [] },
        ltv: { status: 'AVAILABLE', percent: 75, reasons: [] },
        disclaimer: 'Informational only; not a credit decision or approval.',
      });
    failRest(http);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(kpiValues(el)).toEqual(['2', '$300K', '$250K', '$240K']);
    expect(text(el)).toContain('1 loans · This month');
    expect(text(el)).toContain('FHA');
    expect(text(el)).toContain('75%');
    expect(text(el)).toContain('of $300K requested');
    expect(text(el)).toContain('not a credit decision');
  });

  it('investor: without a portfolio, offers to create one', () => {
    const http = signedIn('RESIDENTIAL_INVESTOR');
    const fixture = TestBed.createComponent(InvestorDashboard);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/portfolios')).flush(page([]));
    failRest(http);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toContain('Create a portfolio');
    expect(text(el)).toContain('Create a portfolio to start');
    expect(http.match((r) => r.url.includes('/summary')).length).toBe(0);
  });

  it('investor: shows every portfolio at once, then one portfolio with its income and expenses', () => {
    const http = signedIn('RESIDENTIAL_INVESTOR');
    const fixture = TestBed.createComponent(InvestorDashboard);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/portfolios'))
      .flush(
        page([
          { id: 1, name: 'Miami rentals', holdingCount: 3 },
          { id: 2, name: 'Keys', holdingCount: 2 },
        ]),
      );
    const metric = (total: number | null, knownTotal: number, covered: number) => ({
      status: 'OK',
      total,
      knownTotal,
      coveredHoldings: covered,
      totalHoldings: 5,
    });
    // No portfolioId: the cards cover all of them.
    http
      .expectOne((r) => r.url.endsWith('/value-equity-debt') && !r.params.has('portfolioId'))
      .flush({
        scope: 'ALL_PORTFOLIOS',
        portfolioId: null,
        status: 'OK',
        error: null,
        totalHoldings: 5,
        asOfDate: '2026-11-16',
        value: metric(null, 1_200_000, 3),
        debt: metric(400_000, 400_000, 5),
        equity: metric(null, 500_000, 2),
        valueCoveragePercent: 60,
        debtCoveragePercent: 100,
        equityCoveragePercent: 40,
        debtSource: 'OWNER_REPORTED_FINANCING',
        valuationSources: [],
        note: 'By ownership share.',
      });
    http
      .expectOne((r) => r.url.endsWith('/occupancy-exposure') && !r.params.has('portfolioId'))
      .flush({
        scope: 'ALL_PORTFOLIOS',
        portfolioId: null,
        status: 'OK',
        error: null,
        asOfDate: '2026-11-16',
        totalHoldings: 5,
        occupancyCounts: { RENTED: 2, VACANT: 1, OWNER_OCCUPIED: 1, UNKNOWN: 1 },
        rentalHoldings: 3,
        rentalOccupancyPercent: 66.67,
        occupancyCoveragePercent: 80,
        geographyCoveragePercent: 100,
        states: [],
        counties: [],
      });
    // Income and expenses are per portfolio: none is asked for while all are in view.
    expect(http.match((r) => r.url.includes('/summary')).length).toBe(0);
    failRest(http);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const kpis = kpiValues(el);
    // A partial total says so, and is never shown as the whole portfolio's value.
    expect(kpis[0]).toBe('$1.20M');
    expect(text(el)).toContain('Partial: 3 of 5 holdings valued');
    expect(kpis[3]).toBe('67%');
    expect(text(el)).toContain('Choose one portfolio');

    const select = el.querySelector<HTMLSelectElement>('#dash-portfolio')!;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    http.expectOne(
      (r) => r.url.endsWith('/value-equity-debt') && r.params.get('portfolioId') === '2',
    );
    http.expectOne(
      (r) => r.url.endsWith('/occupancy-exposure') && r.params.get('portfolioId') === '2',
    );
    http.expectOne((r) => r.url.endsWith('/portfolios/2/summary'));
  });
});
