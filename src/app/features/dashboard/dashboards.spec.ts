import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { UserActions } from '../../store/user/user.actions';
import { DashboardActions } from '../../store/dashboard/dashboard.actions';
import { InvestorDashboardActions } from '../../store/investor-dashboard/investor-dashboard.actions';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { RecommendationResponse, UserDTO } from '../../core/models/api';
import { RealtorDashboard } from './realtor-dashboard/realtor-dashboard';
import { LenderDashboard } from './lender-dashboard/lender-dashboard';
import { InvestorDashboard } from './investor-dashboard/investor-dashboard';
import { BuyerDashboard } from './buyer-dashboard/buyer-dashboard';
import { Dashboard } from './dashboard';
import { usdCompact } from './dash-ui';

const page = <T>(content: T[], totalElements = content.length) => ({
  content,
  page: 0,
  size: 20,
  totalElements,
  totalPages: 1,
});

@Component({ template: 'Import jobs page' })
class ImportJobsStub {}

function signedIn(options: { admin?: boolean } = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'admin/import-jobs', component: ImportJobsStub }]),
      ...provideTestStore(),
      {
        provide: KeycloakService,
        useValue: {
          isLoggedIn: () => true,
          hasRealmRole: (role: string) => !!options.admin && role === 'admin',
        },
      },
    ],
  });
  TestBed.inject(Store).dispatch(
    UserActions.profileSaved({
      profile: {
        id: 7,
        firstName: 'Ana',
        lastName: 'Ruiz',
        email: 'a@example.test',
      } as UserDTO,
    }),
  );
  return TestBed.inject(HttpTestingController);
}
const text = (el: Element) => el.textContent!.replace(/\s+/g, ' ');
/**
 * Answers every request the test does not care about, so nothing is left pending (a request an
 * effect's switchMap already cancelled can't be answered, and needs none).
 */
const failRest = (http: HttpTestingController) =>
  http
    .match(() => true)
    .filter((r) => !r.cancelled)
    .forEach((r) => r.flush('unavailable', { status: 503, statusText: 'Unavailable' }));
const kpiValues = (el: HTMLElement) =>
  [...el.querySelectorAll('.kpi-value')].map((k) => k.textContent!.trim());
const section = (el: HTMLElement, heading: string) =>
  [...el.querySelectorAll<HTMLElement>('section.overview-section')].find(
    (s) => s.querySelector('h2')?.textContent?.trim() === heading,
  )!;
/** Each body row as its cells' text, " | " between cells. */
/** Focus only moves inside the document; specs that check it attach the fixture first. */
const attach = (el: HTMLElement) => {
  if (!document.body.contains(el)) document.body.appendChild(el);
  return el;
};
const headingOf = (section: HTMLElement) => section.querySelector('h2')!;
const retryIn = (section: HTMLElement) =>
  [...section.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent!.trim() === 'Retry',
  )!;
const rowsOf = (el: Element) =>
  [...el.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => text(td).trim()).join(' | '),
  );

const tasksCard = (over: { overdue?: unknown[]; dueSoon?: unknown[]; overdueCount?: number; dueSoonCount?: number } = {}) => {
  const overdue = over.overdue ?? [
    { id: 3, title: 'Call seller', status: 'OPEN', dueAt: '2026-11-01T10:00:00Z' },
  ];
  const dueSoon = over.dueSoon ?? [
    { id: 4, title: 'Send offer', status: 'IN_PROGRESS', dueAt: '2026-11-18T10:00:00Z' },
  ];
  return {
    scope: 'CURRENT_USER',
    generatedAt: '2026-11-16T09:00:00',
    status: 'OK',
    error: null,
    limit: 5,
    tasks: {
      summary: {
        total: 5,
        open: 3,
        inProgress: 1,
        completed: 1,
        cancelled: 0,
        overdue: over.overdueCount ?? 2,
      },
      window: { days: 7, from: '2026-11-16T09:00:00Z', to: '2026-11-23T09:00:00Z' },
      dueSoonCount: over.dueSoonCount ?? 3,
      overdue,
      dueSoon,
    },
    pipeline: {
      total: 6,
      open: 5,
      byStage: { PROSPECT: 1, VIEWING: 2, OFFER: 1, UNDER_CONTRACT: 1, CLOSED: 1, CANCELLED: 0 },
    },
  };
};
const clientsLeads = {
  scope: 'CURRENT_USER',
  generatedAt: '2026-11-16T09:00:00',
  status: 'OK',
  error: null,
  limit: 5,
  clients: { total: 14, recent: [] },
  leads: {
    total: 9,
    open: 6,
    byStage: { NEW: 4, CONTACTED: 1, QUALIFIED: 1, CONVERTED: 2, LOST: 1 },
    recent: [],
  },
};

describe('Overviews: home and professional areas', () => {
  it('formats money compactly and keeps a missing amount unavailable', () => {
    expect([
      usdCompact(1_250_000),
      usdCompact(845_200),
      usdCompact(920),
      usdCompact(-12_500),
    ]).toEqual(['$1.25M', '$845K', '$920', '−$13K']);
    expect(usdCompact(null)).toBeNull();
  });

  describe('realtor', () => {
    function realtor(tasks = tasksCard()) {
      const http = signedIn();
      const fixture = TestBed.createComponent(RealtorDashboard);
      fixture.detectChanges();
      // The two realtor cards replace one request per CRM list.
      expect(http.match((r) => r.url.endsWith('/crm/leads')).length).toBe(0);
      http
        .expectOne((r) => r.url.endsWith('/dashboards/realtor/clients-leads'))
        .flush(clientsLeads);
      http
        .expectOne(
          (r) =>
            r.url.endsWith('/dashboards/realtor/tasks-pipeline') &&
            r.params.get('days') === '7' &&
            r.params.get('limit') === '5',
        )
        .flush(tasks);
      http.expectOne((r) => r.url.endsWith('/crm/activities')).flush(page([]));
      failRest(http);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('leads with overdue and due tasks, then clients and leads, deals by stage, the newest leads and activity', () => {
      const el = realtor();
      const lead = section(el, 'Overdue and due this week');
      // The lead comes first: no summary tiles above it, and no consumer cards anywhere.
      expect(el.querySelector('section.overview-section')).toBe(lead);
      expect(lead.querySelectorAll('.kpi-value').length).toBe(0);
      expect(text(lead)).toContain('2 overdue · 3 due in the next 7 days');
      const rows = rowsOf(lead);
      expect(rows[0]).toContain('Call seller');
      expect(rows[0]).toContain('Overdue');
      expect(rows[1]).toContain('Send offer');
      expect(rows[1]).toContain('In progress');
      // The card lists the first of each group; the rest are counted, not hidden.
      expect(text(lead)).toContain('Listed: 1 of 2 overdue and 1 of 3 due in the next 7 days.');
      // No action marks a task done from here (the CRM slice is not on this route): Tasks does.
      expect(text(lead)).toContain('Mark tasks done in Tasks.');
      expect(lead.querySelector('tbody a')!.getAttribute('href')).toBe('/crm/tasks');

      // Clients and leads: the card's own counts (SOW: new leads, active clients), never summed here.
      const people = section(el, 'Clients and leads');
      expect(kpiValues(people)).toEqual(['14', '6', '4']);
      expect(text(people)).toContain('9 leads, 6 open');
      const fresh = [...people.querySelectorAll<HTMLAnchorElement>('.stages a')].find((a) =>
        a.textContent!.includes('New'),
      )!;
      expect(fresh.getAttribute('href')).toBe('/crm/leads?stage=NEW');
      const newLeads = [...people.querySelectorAll<HTMLAnchorElement>('.kpi-link')].find(
        (a) => a.textContent!.trim() === 'New leads',
      )!;
      expect(newLeads.getAttribute('href')).toBe('/crm/leads?stage=NEW');

      const pipeline = section(el, 'Pipeline by stage');
      expect(text(pipeline)).toContain('6 deals, 5 in progress');
      const offer = [...pipeline.querySelectorAll<HTMLAnchorElement>('.stages a')].find((a) =>
        a.textContent!.includes('Offer'),
      )!;
      expect(offer.getAttribute('href')).toBe('/crm/deals?stage=OFFER');

      // The card's newest leads are already loaded: none here, so one sentence.
      expect(text(section(el, 'Newest leads'))).toContain('New leads appear here first');

      const activity = section(el, 'Recent activity');
      expect(text(activity)).toContain('Notes, stage changes and new clients, leads and deals will appear here.');
      // The shared ending (saved, searches and alerts trio, shortcut cards) is gone.
      expect(text(el)).not.toContain('Saved properties');
      expect(text(el)).not.toContain('Affordability');
      // Without a license submission the overview asks for one.
      expect(text(el)).toContain('Verify your license');
    });

    it('lists the newest leads from the card, each opening its record', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(RealtorDashboard);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/dashboards/realtor/clients-leads')).flush({
        ...clientsLeads,
        leads: {
          ...clientsLeads.leads,
          recent: [
            { id: 51, clientId: 8, clientName: 'Marisol Etienne', propertyId: 42, title: 'Coral Way condo', source: 'CONTACT_REQUEST', stage: 'NEW', createdAt: '2026-11-15T14:00:00Z' },
          ],
        },
      });
      failRest(http);
      fixture.detectChanges();
      const newest = section(fixture.nativeElement, 'Newest leads');
      expect(text(newest)).toContain('1 newest of 9');
      const row = newest.querySelector('tbody tr')!;
      expect(row.querySelector('a')!.textContent!.trim()).toBe('Coral Way condo');
      expect(text(row)).toContain('Marisol Etienne · Contact request');
      expect(rowsOf(newest)[0]).toMatch(/\| New \| Nov 15$/);
      expect(newest.querySelector('tbody a')!.getAttribute('href')).toBe('/crm/leads?open=51');
    });

    it('a failed task card says so, and Retry moves focus to the section heading', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(RealtorDashboard);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/dashboards/realtor/tasks-pipeline'))
        .flush('down', { status: 500, statusText: 'Server Error' });
      failRest(http);
      fixture.detectChanges();
      const lead = section(attach(fixture.nativeElement), 'Overdue and due this week');
      expect(text(lead)).toContain('Tasks could not load.');
      retryIn(lead).click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(headingOf(lead));
      expect(http.match((r) => r.url.endsWith('/dashboards/realtor/tasks-pipeline')).length).toBe(1);
      failRest(http);
    });

    it('with nothing due, says so and offers to create a task', () => {
      const el = realtor(tasksCard({ overdue: [], dueSoon: [], overdueCount: 0, dueSoonCount: 0 }));
      const lead = section(el, 'Overdue and due this week');
      expect(text(lead)).toContain('No tasks due in the next 7 days.');
      expect(lead.querySelector('table')).toBeNull();
      const create = [...lead.querySelectorAll<HTMLAnchorElement>('a.btn')].find(
        (a) => a.textContent!.trim() === 'New task',
      )!;
      // It opens the New task form on Tasks.
      expect(create.getAttribute('href')).toBe('/crm/tasks?new=1');
    });
  });

  describe('lender', () => {
    const org = [{ id: 42, name: 'Coral Bank', ownerUserId: 7 }];
    const application = (id: number, stage: string, updatedAt: string, extra: object = {}) => ({
      id,
      organizationId: 42,
      applicantName: 'Applicant ' + id,
      propertyId: null,
      requestedAmount: 300000,
      currency: 'USD',
      stage,
      loanType: 'FHA',
      updatedAt,
      ...extra,
    });
    function lender(pipelineStages: object, recent: unknown[], mix: unknown[], funded = { count: 1, totalAmount: 240000 }) {
      const http = signedIn();
      const fixture = TestBed.createComponent(LenderDashboard);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/lender/organizations')).flush(org);
      http
        .expectOne((r) => r.url.endsWith('/lender/pipeline'))
        .flush({
          organizationId: 42,
          currency: 'USD',
          total: 4,
          stages: pipelineStages,
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
        status: funded.count ? 'OK' : 'EMPTY',
        error: null,
        generatedAt: '2026-11-16T09:00:00Z',
        period: { fromDate: '2026-11-01', toDate: '2026-11-30', timeZone: 'UTC' },
        approved: { count: 1, totalAmount: 250000 },
        funded,
        fundedLoanMix: mix,
        note: null,
      });
      http.expectOne((r) => r.url.endsWith('/lender/applications')).flush(page(recent));
      return { http, fixture, el: fixture.nativeElement as HTMLElement };
    }

    it('without an organization, asks to set one up instead of showing zeros', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(LenderDashboard);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/lender/organizations')).flush([]);
      failRest(http);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(text(el)).toContain('Create your lending organization');
      expect(text(el)).not.toContain('$0');
      // No zero tiles: no figure at all until there is an organization.
      expect(el.querySelectorAll('.kpi-value').length).toBe(0);
      expect(http.match((r) => r.url.includes('/approved-funded')).length).toBe(0);
    });

    it('leads with the applications waiting for review, oldest update first, with their LTV', () => {
      const { http, fixture, el } = lender(
        {
          DRAFT: { count: 1, requestedAmount: 100000 },
          SUBMITTED: { count: 2, requestedAmount: 500000 },
          UNDER_REVIEW: { count: 1, requestedAmount: 300000 },
          FUNDED: { count: 1, requestedAmount: 250000 },
        },
        [
          application(16, 'SUBMITTED', '2026-11-16T10:00:00Z'),
          application(15, 'UNDER_REVIEW', '2026-11-15T10:00:00Z', { propertyId: 100 }),
          application(14, 'DRAFT', '2026-11-14T10:00:00Z'),
          application(13, 'FUNDED', '2026-11-13T10:00:00Z'),
        ],
        [
          { loanType: 'CONVENTIONAL', count: 0, totalAmount: 0 },
          { loanType: 'FHA', count: 1, totalAmount: 240000 },
        ],
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
      const lead = section(el, 'Waiting for review');
      expect(el.querySelector('section.overview-section')).toBe(lead);
      // Each stage as the pipeline sends it; nothing summed on the client.
      expect(text(lead)).toContain('Submitted 2 ($500K requested) · Under review 1 ($300K requested)');
      // Only Submitted and Under review, the oldest update first.
      const rows = rowsOf(lead);
      expect(rows.length).toBe(2);
      expect(rows[0]).toContain('Applicant 15');
      expect(rows[0]).toContain('Under review');
      expect(rows[0]).toContain('75%');
      expect(rows[0]).toContain('of $300K requested');
      expect(rows[1]).toContain('Applicant 16');
      expect(rows[1]).toContain('No property linked');
      // The slice holds the newest applications only; the lead says how many it can list.
      expect(text(lead)).toContain(
        'Listed: 1 of 2 submitted and 1 of 1 under review. The overview receives only the 4 newest applications',
      );
      // On phones the LTV column hides; the second line carries it.
      expect(text(lead.querySelector('tbody tr')!)).toContain('LTV 75% of $300K requested');
      expect(text(lead.querySelectorAll('tbody tr')[1])).toContain('LTV: no property linked');
      expect(text(lead)).toContain('not a credit decision');
      const open = lead.querySelector<HTMLAnchorElement>('a.btn.primary')!;
      expect(open.textContent!.trim()).toBe('Open Applications');
      // On the organization chosen here (Loan review keeps its own choice otherwise).
      expect(open.getAttribute('href')).toBe('/loan-review?tab=applications&org=42');

      // SOW: pipeline volume. Every stage with its count and requested amount, from the pipeline the
      // lead already read (no second request); a stage opens Applications filtered on it.
      const pipeline = section(el, 'Pipeline by stage');
      expect(text(pipeline)).toContain('4 applications · requested amounts in USD · as of Nov 16');
      const stages = [...pipeline.querySelectorAll<HTMLAnchorElement>('.stages a')];
      const cells = (a: Element) =>
        ['.stage-name', '.stage-count', '.stage-amount'].map((c) => text(a.querySelector(c)!).trim()).join(' ');
      expect(stages.map(cells)).toEqual([
        'Draft 1 $100K',
        'Submitted 2 $500K',
        'Under review 1 $300K',
        'Approved 0 $0',
        'Funded 1 $250K',
        'Rejected 0 $0',
        'Withdrawn 0 $0',
      ]);
      expect(stages[1].getAttribute('href')).toBe('/loan-review?tab=applications&org=42&stage=SUBMITTED');

      expect(kpiValues(el)).toEqual(['$250K', '$240K']);
      const funded = section(el, 'Approved and funded this month');
      expect(text(funded)).toContain('1 application');
      expect(text(funded)).toContain('1 loan');
      expect(text(funded)).not.toContain('1 loans');
      const mix = section(el, 'Loan mix');
      expect(text(mix)).toContain('1 loan funded this month, by loan type');
      // A loan type with no loans draws nothing and is not listed.
      expect(rowsOf(mix)).toEqual(['FHA | 1 | 100% | $240,000']);
      expect(mix.querySelectorAll('thead th').length).toBe(4);
      expect(mix.querySelector('.mix-bar')!.getAttribute('aria-label')).toBe(
        'Funded loans by loan type. FHA 1, 100%',
      );
    });

    it('a failed pipeline says so, and Retry moves focus to the section heading', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(LenderDashboard);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/lender/organizations')).flush(org);
      http
        .expectOne((r) => r.url.endsWith('/lender/pipeline'))
        .flush('down', { status: 500, statusText: 'Server Error' });
      failRest(http);
      fixture.detectChanges();
      const lead = section(attach(fixture.nativeElement), 'Waiting for review');
      expect(text(lead)).toContain('Applications could not load.');
      // No way into Applications beside an error.
      expect(lead.querySelector('a.btn.primary')).toBeNull();
      retryIn(lead).click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(headingOf(lead));
      failRest(http);
    });

    it('switching the organization drops the previous one\'s applications at once', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(LenderDashboard);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/lender/organizations'))
        .flush([...org, { id: 43, name: 'Keys Credit', ownerUserId: 7 }]);
      http
        .expectOne((r) => r.url.endsWith('/lender/pipeline'))
        .flush({ organizationId: 42, currency: 'USD', total: 1, stages: { SUBMITTED: { count: 1, requestedAmount: 300000 } } });
      http
        .expectOne((r) => r.url.endsWith('/lender/applications'))
        .flush(page([application(16, 'SUBMITTED', '2026-11-16T10:00:00Z')]));
      failRest(http);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(rowsOf(section(el, 'Waiting for review'))[0]).toContain('Applicant 16');
      const select = el.querySelector<HTMLSelectElement>('#dash-org')!;
      select.value = '43';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(
        http.match((r) => r.url.endsWith('/lender/pipeline') && r.params.get('organizationId') === '43').length,
      ).toBe(1);
      const lead = section(el, 'Waiting for review');
      expect(lead.querySelector('table')).toBeNull();
      expect(lead.querySelectorAll('.row-skeleton').length).toBeGreaterThan(0);
      expect(text(el)).not.toContain('Applicant 16');
      failRest(http);
    });

    it('applies a period and goes back to this month, keeping focus in the period form', async () => {
      const { http, fixture, el } = lender(
        { SUBMITTED: { count: 1, requestedAmount: 300000 } },
        [application(16, 'SUBMITTED', '2026-11-16T10:00:00Z')],
        [{ loanType: 'FHA', count: 1, totalAmount: 240000 }],
      );
      failRest(http);
      fixture.detectChanges();
      await fixture.whenStable();
      attach(el);
      const details = el.querySelector<HTMLDetailsElement>('details.ld-period')!;
      details.open = true;
      const from = el.querySelector<HTMLInputElement>('#lender-from')!;
      const to = el.querySelector<HTMLInputElement>('#lender-to')!;
      from.value = '2026-10-01';
      from.dispatchEvent(new Event('input'));
      to.value = '2026-10-31';
      to.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      details.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      const card = http.expectOne((r) => r.url.endsWith('/dashboards/lender/approved-funded'));
      expect(card.request.params.get('fromDate')).toBe('2026-10-01');
      expect(card.request.params.get('toDate')).toBe('2026-10-31');
      // While the October card loads, November's figures stay under November's heading, dimmed.
      const funded = () =>
        [...el.querySelectorAll<HTMLElement>('section.overview-section')].find((x) =>
          x.querySelector('h2')!.textContent!.startsWith('Approved and funded'),
        )!;
      expect(headingOf(funded()).textContent!.trim()).toBe('Approved and funded this month');
      expect(funded().getAttribute('aria-busy')).toBe('true');
      card.flush({
        organizationId: 42,
        currency: 'USD',
        status: 'OK',
        error: null,
        generatedAt: '2026-11-16T09:00:00Z',
        period: { fromDate: '2026-10-01', toDate: '2026-10-31', timeZone: 'UTC' },
        approved: { count: 2, totalAmount: 500000 },
        funded: { count: 1, totalAmount: 240000 },
        fundedLoanMix: [{ loanType: 'FHA', count: 1, totalAmount: 240000 }],
        note: null,
      });
      fixture.detectChanges();
      expect(headingOf(funded()).textContent!.trim()).toBe('Approved and funded');
      expect(funded().getAttribute('aria-busy')).toBeNull();
      expect(text(section(el, 'Loan mix'))).toContain('1 loan funded in this period, by loan type');
      // "This month" removes itself: focus goes to the form's summary, and the form stays open.
      const back = [...funded().querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent!.trim() === 'This month',
      )!;
      back.click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(details.querySelector('summary'));
      expect(details.open).toBe(true);
      const month = http.expectOne((r) => r.url.endsWith('/dashboards/lender/approved-funded'));
      expect(month.request.params.has('fromDate')).toBe(false);
      failRest(http);
    });

    it('names no period after a failed period request: the one held is not the one asked for', async () => {
      const { http, fixture, el } = lender(
        { SUBMITTED: { count: 1, requestedAmount: 300000 } },
        [application(16, 'SUBMITTED', '2026-11-16T10:00:00Z')],
        [{ loanType: 'FHA', count: 1, totalAmount: 240000 }],
      );
      failRest(http);
      fixture.detectChanges();
      await fixture.whenStable();
      const funded = () =>
        [...el.querySelectorAll<HTMLElement>('section.overview-section')].find((x) =>
          x.querySelector('h2')!.textContent!.startsWith('Approved and funded'),
        )!;
      expect(text(funded())).toContain('Nov 1 to Nov 30 · UTC days');
      const details = el.querySelector<HTMLDetailsElement>('details.ld-period')!;
      details.open = true;
      const from = el.querySelector<HTMLInputElement>('#lender-from')!;
      const to = el.querySelector<HTMLInputElement>('#lender-to')!;
      from.value = '2026-01-01';
      from.dispatchEvent(new Event('input'));
      to.value = '2026-03-31';
      to.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      details.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/dashboards/lender/approved-funded'))
        .flush('down', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(text(funded())).toContain('Approved and funded loans could not load.');
      expect(headingOf(funded()).textContent!.trim()).toBe('Approved and funded');
      expect(text(funded())).not.toContain('Nov 1 to Nov 30');
      expect(text(funded())).not.toContain('this month');
      failRest(http);
    });

    it('shows an unknown loan type as the hatched part, Unavailable with its reason', () => {
      const { http, fixture, el } = lender(
        { SUBMITTED: { count: 1, requestedAmount: 300000 } },
        [application(16, 'SUBMITTED', '2026-11-16T10:00:00Z')],
        [
          { loanType: 'FHA', count: 3, totalAmount: 900000 },
          { loanType: 'UNKNOWN', count: 1, totalAmount: 200000 },
        ],
        { count: 4, totalAmount: 1100000 },
      );
      failRest(http);
      fixture.detectChanges();
      const mix = section(el, 'Loan mix');
      const parts = [...mix.querySelectorAll<HTMLElement>('.mix-part')];
      expect(parts.length).toBe(2);
      expect(parts[1].classList).toContain('na');
      const unknown = [...mix.querySelectorAll('tbody tr')][1];
      expect(unknown.querySelector('td.na')).toBeTruthy();
      expect(text(unknown)).toContain('Unavailable');
      expect(text(unknown)).toContain('Loan type not recorded');
      expect(text(unknown)).toContain('25%');
    });

    it('with nothing waiting, says so and offers a new application; no zero tiles for the month', () => {
      const { http, fixture, el } = lender(
        { FUNDED: { count: 1, requestedAmount: 250000 } },
        [application(13, 'FUNDED', '2026-11-13T10:00:00Z')],
        [],
        { count: 0, totalAmount: 0 },
      );
      failRest(http);
      fixture.detectChanges();
      const lead = section(el, 'Waiting for review');
      expect(text(lead)).toContain('No applications waiting.');
      const create = lead.querySelector<HTMLAnchorElement>('a.btn.primary')!;
      expect(create.textContent!.trim()).toBe('New application');
      expect(create.getAttribute('href')).toBe('/loan-review?tab=applications&org=42');
      expect(text(section(el, 'Approved and funded this month'))).toContain(
        'No application was approved or funded this month.',
      );
      expect(text(section(el, 'Loan mix'))).toContain('No loans were funded this month.');
      expect(el.querySelectorAll('.kpi-value').length).toBe(0);
    });
  });

  describe('investor', () => {
    const metric = (total: number | null, knownTotal: number, covered: number, of = 5) => ({
      status: total !== null ? 'COMPLETE' : covered ? 'PARTIAL' : 'UNAVAILABLE',
      total,
      knownTotal,
      coveredHoldings: covered,
      totalHoldings: of,
    });
    const valueCard = (over: object = {}) => ({
      scope: 'ALL_PORTFOLIOS',
      portfolioId: null,
      status: 'OK',
      error: null,
      totalHoldings: 5,
      asOfDate: '2026-11-16',
      value: metric(null, 1_200_000, 3),
      debt: metric(null, 400_000, 3),
      equity: metric(null, 500_000, 2),
      valueCoveragePercent: 60,
      debtCoveragePercent: 60,
      equityCoveragePercent: 40,
      oldestValuationDate: '2026-10-01',
      newestValuationDate: '2026-11-01',
      oldestBalanceDate: null,
      newestBalanceDate: null,
      debtSource: 'OWNER_REPORTED_FINANCING',
      valuationSources: [],
      note: 'By ownership share.',
      ...over,
    });
    const occupancyCard = {
      scope: 'ALL_PORTFOLIOS',
      portfolioId: null,
      status: 'OK',
      error: null,
      asOfDate: '2026-11-16',
      totalHoldings: 5,
      occupancyCounts: { RENTED: 2, VACANT: 1, OWNER_OCCUPIED: 1, UNKNOWN: 1 },
      knownOccupancyHoldings: 4,
      rentalHoldings: 3,
      rentalOccupancyPercent: 66.67,
      occupancyCoveragePercent: 80,
      knownGeographyHoldings: 5,
      geographyCoveragePercent: 100,
      states: [],
      counties: [],
    };

    const incomeCard = (over: object = {}) => ({
      scope: 'ALL_PORTFOLIOS',
      portfolioId: null,
      portfolioCount: 2,
      status: 'OK',
      error: null,
      generatedAt: '2026-11-16T09:00:00Z',
      currency: 'USD',
      period: { fromMonth: '2025-11', toMonth: '2026-10', fromDate: '2025-11-01', toDate: '2026-10-31', months: 12, timeZone: 'UTC' },
      totalHoldings: 5,
      actual: {
        basis: 'ACTUAL_RECORDED_CASH',
        status: 'RECORDED',
        income: 40500,
        expenses: 14000,
        cashFlow: 26500,
        recordCount: 38,
        holdingsWithRecords: 2,
        holdingsWithoutRecords: 3,
        categories: [
          { category: 'REPAIRS', type: 'EXPENSE', amount: 14000, recordCount: 6 },
          { category: 'RENT', type: 'INCOME', amount: 40500, recordCount: 32 },
        ],
        expenseCategoriesWithoutRecords: ['INSURANCE', 'PROPERTY_TAX'],
        recordsUpdatedAt: '2026-11-03T12:00:00',
      },
      projected: {
        basis: 'CONTRACT_RENT_INVESTMENT_CALCULATION',
        status: 'AVAILABLE',
        rentedHoldings: 2,
        holdingsWithRent: 2,
        monthlyGrossRent: 3500,
        annualGrossRent: 42000,
        periodGrossRent: 42000,
        grossYieldPercent: 8.4,
        netOperatingIncome: null,
        missingInputs: [],
        reason: null,
      },
      note: null,
      ...over,
    });
    const opportunity = (propertyId: number, over: object = {}) => ({
      propertyId,
      folio: '30493400402' + propertyId,
      address: propertyId + ' SW 27th Ter',
      city: 'Miami',
      zip: '33133',
      countyName: 'Miami-Dade',
      stateCode: 'FL',
      score: 44.49,
      maxScore: 100,
      coveragePercent: 50,
      estimatedValue: 525636.5,
      forecastGrowth1yPct: 10.32,
      factors: [],
      valuationDataThrough: '2026-07-26',
      scoredAt: '2026-11-08T20:00:00Z',
      alreadyHeld: false,
      ...over,
    });
    const opportunitiesCard = (over: object = {}) => ({
      scope: 'ALL_PORTFOLIOS',
      portfolioId: null,
      portfolioCount: 2,
      status: 'OK',
      error: null,
      generatedAt: '2026-11-16T09:00:00Z',
      scoreVersion: 'opportunity-v1',
      candidateStatus: 'OK',
      countyId: null,
      stateId: null,
      limit: 5,
      totalCandidates: 416226,
      items: [opportunity(42), opportunity(43, { alreadyHeld: true, estimatedValue: null, forecastGrowth1yPct: null })],
      notes: [],
      note: null,
      ...over,
    });
    /** GET /dashboards/investor: the four cards of one scope, each overridable. */
    const dashboard = (portfolioId: number | null, cards: Record<string, unknown> = {}) => ({
      scope: portfolioId === null ? 'ALL_PORTFOLIOS' : 'PORTFOLIO',
      portfolioId,
      portfolioCount: portfolioId === null ? 2 : 1,
      status: 'OK',
      failedCards: [],
      generatedAt: '2026-11-16T09:00:00Z',
      period: incomeCard().period,
      valueEquityDebt: valueCard({ portfolioId }),
      incomeExpensesReturns: incomeCard({ portfolioId }),
      occupancyExposure: { ...occupancyCard, portfolioId },
      opportunities: opportunitiesCard({ portfolioId }),
      note: null,
      ...cards,
    });
    const dashboardRequest = (http: HttpTestingController, portfolioId: number | null) =>
      http.expectOne(
        (r) =>
          r.url.endsWith('/dashboards/investor') &&
          (portfolioId === null ? !r.params.has('portfolioId') : r.params.get('portfolioId') === String(portfolioId)),
      );

    it('without a portfolio, offers to create one and shows no figures', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(InvestorDashboard);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/portfolios')).flush(page([]));
      failRest(http);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(text(el)).toContain('Create a portfolio');
      expect(el.querySelectorAll('.kpi-value').length).toBe(0);
      expect(el.querySelector('section.overview-section h2')!.textContent!.trim()).toBe('Portfolio');
    });

    it('reads the four cards in one request, labels partial figures and offers the action that raises coverage', () => {
      const http = signedIn();
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
      // One request for the scope (no portfolioId: all of them), not one per card.
      expect(http.match((r) => r.url.includes('/dashboards/investor/')).length).toBe(0);
      dashboardRequest(http, null).flush(dashboard(null));
      expect(http.match((r) => r.url.includes('/summary')).length).toBe(0);
      failRest(http);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const lead = section(el, 'All portfolios');
      expect(el.querySelector('section.overview-section')).toBe(lead);
      // A partial total says so, and is never shown as the whole portfolio's value.
      expect(kpiValues(lead)).toEqual(['$1.20M', '$400K', '$500K']);
      expect(text(lead)).toContain('Partial: 3 of 5 holdings valued');
      expect(text(lead)).toContain('Partial: 3 of 5 holdings with a known balance');
      expect(text(lead)).toContain('Partial: 2 of 5 holdings with value and debt');
      // The one action that raises coverage: the holdings without a loan balance.
      expect(text(lead)).toContain('2 holdings have no loan balance');
      const action = lead.querySelector<HTMLAnchorElement>('a.btn.primary')!;
      expect(action.textContent!.trim()).toBe('Add balances in Portfolio');
      expect(action.getAttribute('href')).toBe('/portfolio');
      const occupancy = section(el, 'Occupancy');
      expect(kpiValues(occupancy)).toEqual(['67%']);
      expect(text(occupancy)).toContain('2 of 3 rental holdings rented');
      expect(text(occupancy)).toContain('Occupancy is recorded for 4 of them');
      // Bars are drawn against every holding (Rented 2 of 5), not against the largest status.
      const rented = occupancy.querySelector<HTMLElement>('tbody tr .iv-bar i')!;
      expect(rented.style.width).toBe('40%');
      // The all-portfolios count is the card's own, not a sum of the listed portfolios.
      expect(el.querySelector('#dash-portfolio option')!.textContent!.trim()).toBe('All portfolios · 5 holdings');

      // Income and returns now covers every portfolio: no "choose one portfolio" any more.
      const income = section(el, 'Income and returns');
      expect(text(income)).toContain('Nov 2025 to Oct 2026 · 38 records');
      expect(kpiValues(income)).toEqual(['$41K', '$14K', '+$27K', '$3,500', '$42K', '8.4%']);
      expect(text(income)).toContain('From records on 2 of 5 holdings');
      expect(text(income)).not.toContain('Partial:');
      // Income first, signed; expenses with a true minus.
      expect(rowsOf(income)).toEqual([
        'Rent Income | Income | 32 | +$40,500',
        'Repairs Expense | Expense | 6 | −$14,000',
      ]);
      // An expense category without a record is a missing cost, never $0.
      expect(text(income)).toContain('No record of insurance, property tax: a missing cost, not a cost of $0.');
      // Contract rent is kept apart from the recorded cash.
      expect(text(income)).toContain('2 of 2 rented holdings with a lease rent');
      expect(text(income)).toContain('never added to it');

      // Opportunities: the stored scores, best first, holdings marked, each opening its property.
      const opp = section(el, 'Opportunities');
      expect(text(opp)).toContain('Top 2 of 416,226 scored properties');
      const rows = rowsOf(opp);
      const first = opp.querySelector('tbody tr')!;
      expect(first.querySelector('a')!.textContent!.trim()).toBe('42 SW 27th Ter');
      expect(text(first)).toContain('Miami, Miami-Dade County, FL');
      expect(rows[0]).toMatch(/^1 \| .* \| 44\.5Evidence covers 50 of 100 \| \$526K \| \+10\.3%$/);
      expect(rows[1]).toContain('In your portfolio');
      expect(rows[1]).toContain('Unavailable');
      expect(opp.querySelector('tbody a')!.getAttribute('href')).toBe('/property/42');
      expect(opp.querySelector('a.ov-link')!.getAttribute('href')).toBe('/opportunities');

      const select = el.querySelector<HTMLSelectElement>('#dash-portfolio')!;
      select.value = '2';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      // Another scope never shows the previous one's figures: the strip waits.
      expect(el.querySelectorAll('section.overview-section')[0].querySelectorAll('.kpi-value.skeleton').length).toBe(3);
      expect(text(el)).not.toContain('$1.20M');
      dashboardRequest(http, 2).flush(
        dashboard(2, {
          valueEquityDebt: valueCard({
            scope: 'PORTFOLIO',
            portfolioId: 2,
            totalHoldings: 2,
            value: metric(1_900_000, 1_900_000, 2, 2),
            debt: metric(600_000, 600_000, 2, 2),
            equity: metric(1_300_000, 1_300_000, 2, 2),
          }),
          incomeExpensesReturns: incomeCard({
            portfolioId: 2,
            totalHoldings: 2,
            actual: { ...incomeCard().actual, status: 'NO_RECORDS', recordCount: 0, holdingsWithRecords: 0, categories: [] },
            projected: { ...incomeCard().projected, status: 'UNAVAILABLE', reason: 'No rented holding has a contract rent.' },
          }),
        }),
      );
      failRest(http);
      fixture.detectChanges();
      // Complete coverage: no Partial label, and the action becomes Add a holding.
      const keys = section(el, 'Keys');
      expect(text(keys)).not.toContain('Partial:');
      expect(text(keys)).toContain('2 of 2 holdings valued');
      expect(text(keys)).toContain('Every holding has a loan balance or is recorded as bought with cash.');
      expect(keys.querySelector('a.btn.primary')!.textContent!.trim()).toBe('Add a holding');
      const keysIncome = section(el, 'Income and returns');
      expect(text(keysIncome)).toContain('No income or expense was recorded from Nov 2025 to Oct 2026.');
      expect(text(keysIncome)).toContain('No rented holding has a contract rent.');
      expect(kpiValues(keysIncome)).toEqual([]);
    });

    it('a card the server could not build says so beside the others; Retry moves focus to its heading', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(InvestorDashboard);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/portfolios'))
        .flush(page([{ id: 1, name: 'Miami rentals', holdingCount: 5 }]));
      // PARTIAL: one card has status ERROR, the others are kept.
      dashboardRequest(http, null).flush(
        dashboard(null, {
          status: 'PARTIAL',
          failedCards: ['valueEquityDebt'],
          valueEquityDebt: { ...valueCard(), status: 'ERROR', error: 'Valuations are unavailable.' },
        }),
      );
      failRest(http);
      fixture.detectChanges();
      const el = attach(fixture.nativeElement);
      const lead = section(el, 'Miami rentals');
      expect(text(lead)).toContain('Value, debt and equity could not load.');
      expect(kpiValues(section(el, 'Occupancy'))).toEqual(['67%']);
      retryIn(lead).click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(headingOf(lead));
      // A failed request (503: no card could be built) fails every section, each with Retry.
      http
        .expectOne((r) => r.url.endsWith('/portfolios'))
        .flush(page([{ id: 1, name: 'Miami rentals', holdingCount: 5 }]));
      dashboardRequest(http, null).flush('down', { status: 503, statusText: 'Unavailable' });
      failRest(http);
      fixture.detectChanges();
      for (const heading of ['Miami rentals', 'Occupancy', 'Income and returns', 'Opportunities'])
        expect(retryIn(section(el, heading))).toBeTruthy();
    });

    it('a failed card as the server builds it (status and error only, the rest null) never breaks the page', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(InvestorDashboard);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/portfolios')).flush(
        page([
          { id: 1, name: 'Miami rentals', holdingCount: 5 },
          { id: 2, name: 'Keys', holdingCount: 1 },
        ]),
      );
      // InvestorDashboardServiceImpl's stand-in: items and totalHoldings are null, not empty.
      const standIn = (error: string) => ({
        scope: 'ALL_PORTFOLIOS',
        portfolioId: null,
        portfolioCount: 2,
        status: 'ERROR',
        error,
        generatedAt: '2026-11-26T09:00:00Z',
        totalHoldings: null,
        items: null,
      });
      dashboardRequest(http, null).flush(
        dashboard(null, {
          status: 'PARTIAL',
          failedCards: ['valueEquityDebt', 'opportunities'],
          valueEquityDebt: standIn('Valuations are unavailable.'),
          opportunities: standIn('Scores are unavailable.'),
        }),
      );
      failRest(http);
      expect(() => fixture.detectChanges()).not.toThrow();
      const el = attach(fixture.nativeElement);
      expect(text(section(el, 'All portfolios'))).toContain('Value, debt and equity could not load.');
      expect(text(section(el, 'Opportunities'))).toContain('Opportunities could not load.');
      expect(kpiValues(section(el, 'Occupancy'))).toEqual(['67%']);
    });

    it('asks again when the list drops the portfolio in view, and never shows its old figures', () => {
      const http = signedIn();
      const store = TestBed.inject(Store);
      // A portfolio that was in scope on an earlier visit, since deleted elsewhere.
      store.dispatch(InvestorDashboardActions.selectScope({ portfolioId: 9 }));
      failRest(http);
      const fixture = TestBed.createComponent(InvestorDashboard);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/portfolios'))
        .flush(page([{ id: 1, name: 'Miami rentals', holdingCount: 5 }]));
      // The cards were asked for the deleted portfolio; it answers 404.
      http
        .match((r) => r.params.get('portfolioId') === '9')
        .forEach((r) => r.flush('gone', { status: 404, statusText: 'Not Found' }));
      fixture.detectChanges();
      // The slice moved the scope to all portfolios; the overview asks for it with the scope action.
      dashboardRequest(http, null).flush(dashboard(null, { valueEquityDebt: valueCard({ totalHoldings: 5 }) }));
      failRest(http);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(kpiValues(section(el, 'Miami rentals'))).toEqual(['$1.20M', '$400K', '$500K']);
      expect(text(section(el, 'Miami rentals'))).not.toContain('could not load');
    });

    it('shows a figure no holding covers as Unavailable, never $0 or "Partial: 0 of 5"', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(InvestorDashboard);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/portfolios'))
        .flush(page([{ id: 1, name: 'Miami rentals', holdingCount: 5 }]));
      dashboardRequest(http, null).flush(
        dashboard(null, {
          valueEquityDebt: valueCard({ equity: metric(null, 0, 0) }),
          incomeExpensesReturns: incomeCard({ projected: { ...incomeCard().projected, grossYieldPercent: null } }),
          opportunities: opportunitiesCard({ status: 'EMPTY', candidateStatus: 'NOT_SCORED', items: [], totalCandidates: 0 }),
        }),
      );
      failRest(http);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const equity = [...el.querySelectorAll('.kpi')].find((k) => k.textContent!.includes('Equity'))!;
      expect(equity.querySelector('.kpi-value.na')).toBeTruthy();
      expect(text(equity)).toContain('Needs a value and a loan balance on the same holding');
      expect(text(el)).not.toContain('Partial: 0 of');
      const yieldKpi = [...el.querySelectorAll('.kpi')].find((k) => k.textContent!.includes('Gross yield'))!;
      expect(text(yieldKpi)).toContain('A purchase price is missing');
      // No candidate: the shared service's reason, never an invented list.
      expect(text(section(el, 'Opportunities'))).toContain('Opportunity scores have not been calculated yet.');
    });
  });

  describe('buyer', () => {
    const recommendations: RecommendationResponse = {
      status: 'NO_PREFERENCES',
      generatedAt: '2026-11-18T15:00:00Z',
      source: 'PROPERTY_RECORDS',
      sourceAsOf: null,
      rankingMethod: null,
      limit: 20,
      appliedCountyIds: [],
      minBudget: null,
      maxBudget: null,
      investmentGoals: [],
      limitations: [],
      content: [],
    } as unknown as RecommendationResponse;

    it('leads with the matches (the area form without preferences), then saved properties, searches, alerts and activity', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(BuyerDashboard);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/recommendations')).flush(recommendations);
      http
        .expectOne((r) => r.url.endsWith('/dashboards/user/favorites'))
        .flush({
          scope: 'CURRENT_USER',
          generatedAt: '2026-11-18T15:00:00Z',
          status: 'OK',
          error: null,
          count: 3,
          limit: 5,
          recent: [
            { propertyId: 42, folio: '0141370120450', address: '2847 SW 27th Ter', countyName: 'Miami-Dade', stateCode: 'FL', favoritedAt: '2026-11-16T10:00:00Z' },
            { propertyId: 43, folio: '0141370120460', address: null, countyName: 'Miami-Dade', stateCode: 'FL', favoritedAt: '2026-11-12T10:00:00Z' },
          ],
        });
      http
        .expectOne((r) => r.url.endsWith('/dashboards/user/activity'))
        .flush({
          scope: 'CURRENT_USER',
          generatedAt: '2026-11-18T15:00:00Z',
          status: 'OK',
          error: null,
          limit: 6,
          recent: [
            { type: 'SAVED_SEARCH_CREATED', occurredAt: '2026-11-17T10:00:00Z', entityId: 1, label: 'Coral Gables 3-bed', propertyId: null, portfolioId: null },
            { type: 'PORTFOLIO_CREATED', occurredAt: '2026-11-15T10:00:00Z', entityId: 3, label: 'Miami rentals', propertyId: null, portfolioId: 3 },
          ],
        });
      http
        .expectOne((r) => r.url.endsWith('/dashboards/user/saved-searches'))
        .flush({
          scope: 'CURRENT_USER',
          generatedAt: '2026-11-18T15:00:00Z',
          status: 'OK',
          error: null,
          count: 8,
          limit: 5,
          recent: [
            { id: 1, name: 'Coral Gables 3-bed', cadence: 'DAILY', paused: false, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-17T10:00:00Z' },
            { id: 2, name: 'Grove condos', cadence: 'WEEKLY', paused: true, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-10T10:00:00Z' },
          ],
        });
      http
        .expectOne((r) => r.url.endsWith('/dashboards/user/alerts'))
        .flush({
          scope: 'CURRENT_USER',
          generatedAt: '2026-11-18T15:00:00Z',
          status: 'OK',
          error: null,
          count: 2,
          limit: 5,
          activeCount: 1,
          pausedCount: 1,
          recent: [
            { id: 5, name: 'New in Coral Gables', eventType: 'NEW_MATCH', propertyId: null, savedSearchId: 1, cadence: 'DAILY', paused: false, effectivePaused: false, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-17T10:00:00Z' },
            { id: 6, name: 'Grove value', eventType: 'VALUATION_CHANGED', propertyId: 42, savedSearchId: null, cadence: 'WEEKLY', paused: false, effectivePaused: true, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-10T10:00:00Z' },
          ],
        });
      failRest(http);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('h1')!.textContent!.trim()).toBe('Overview');
      // NO_PREFERENCES is the inline form, never "Matches for you 0".
      expect(el.querySelector('gz-matches gz-area-budget-form')).toBeTruthy();
      expect(text(el)).toContain('Set your area and budget');
      expect(text(el)).not.toContain('Matches for you 0');
      expect(el.querySelectorAll('.kpi-value').length).toBe(0);

      const searches = section(el, 'Saved searches');
      // The card holds the newest saved searches (by creation), so the caption says so.
      expect(text(searches)).toContain('2 newest of 8');
      expect(rowsOf(searches)[0]).toContain('Coral Gables 3-bed');
      expect(rowsOf(searches)[1]).toContain('Paused');
      const alerts = section(el, 'Alerts');
      expect(text(alerts)).toContain('2 alerts: 1 active, 1 paused');
      expect(rowsOf(alerts)[0]).toContain('New matches');
      expect(rowsOf(alerts)[1]).toContain('ZentraValue changes');
      expect(rowsOf(alerts)[1]).toContain('Paused with its search');

      // SOW: favorites and recent activity, from the cards the overview already asks for.
      const saved = section(el, 'Saved properties');
      expect(text(saved)).toContain('2 newest of 3');
      expect(saved.querySelector('tbody a')!.textContent!.trim()).toBe('2847 SW 27th Ter');
      expect(rowsOf(saved)[0]).toMatch(/Miami-Dade County, FL \| Nov 16$/);
      // Without an address, the folio, never "Property #43".
      expect(rowsOf(saved)[1]).toContain('Folio 01-4137-012-0460');
      expect(saved.querySelector('tbody a')!.getAttribute('href')).toBe('/property/42');
      const activity = section(el, 'Recent activity');
      expect(rowsOf(activity)[0]).toMatch(/^Saved a search\s*Coral Gables 3-bed \| Nov 17$/);
      expect(activity.querySelector('tbody a')!.getAttribute('href')).toBe('/saved');
      // A home buyer has no Portfolio page: the portfolio is named, not linked.
      expect(rowsOf(activity)[1]).toMatch(/^Created a portfolio\s*Miami rentals/);
      expect(activity.querySelectorAll('tbody a').length).toBe(1);
      // No shortcut cards, and the calculators stay in the Studio.
      expect(text(el)).not.toContain('Compare properties');
      expect(text(el)).not.toContain('Affordability');
    });

    it('a failed section says what failed and retries', () => {
      const http = signedIn();
      const store = TestBed.inject(Store);
      const fixture = TestBed.createComponent(BuyerDashboard);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/recommendations')).flush(recommendations);
      http
        .expectOne((r) => r.url.endsWith('/dashboards/user/saved-searches'))
        .flush('down', { status: 500, statusText: 'Server Error' });
      failRest(http);
      fixture.detectChanges();
      const searches = section(fixture.nativeElement, 'Saved searches');
      expect(text(searches)).toContain('Saved searches could not load.');
      attach(fixture.nativeElement);
      const dispatch = vi.spyOn(store, 'dispatch');
      retryIn(searches).click();
      expect(dispatch).toHaveBeenCalledWith(DashboardActions.load());
      expect(document.activeElement).toBe(headingOf(searches));
      failRest(http);
    });

    it('leads with the top 5 matches and "See all N matches"', () => {
      const http = signedIn();
      const fixture = TestBed.createComponent(BuyerDashboard);
      fixture.detectChanges();
      const property = (id: number) => ({
        id,
        folio: '01413701204' + String(id).padStart(2, '0'),
        countyId: 17,
        countyName: 'Miami-Dade',
        stateCode: 'FL',
        stateName: 'Florida',
        address: id + ' SW 27th Ter',
        city: 'Miami',
        zip: '33133',
        dorCode: '0101',
        propertyType: 'Single family',
        bedrooms: 3,
        bathrooms: 2,
        livingAreaSqft: 1840,
        lotSize: 6250,
        yearBuilt: '1952',
        neighborhood: null,
        neighborhoodDescription: null,
      });
      http.expectOne((r) => r.url.endsWith('/recommendations')).flush({
        ...recommendations,
        status: 'READY',
        appliedCountyIds: [17],
        content: [1, 2, 3, 4, 5, 6, 7, 8].map((rank) => ({
          rank,
          property: property(40 + rank),
          reasons: ['Matches your saved target county: Miami-Dade, FL'],
          budgetMatch: 'NOT_REQUESTED',
          goalMatch: 'NOT_REQUESTED',
          listingStatus: 'UNKNOWN',
        })),
      });
      failRest(http);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const matches = el.querySelector('gz-matches')!;
      expect(matches.querySelectorAll('tbody tr').length).toBe(5);
      const all = [...matches.querySelectorAll<HTMLAnchorElement>('a')].find((a) =>
        a.textContent!.includes('See all'),
      )!;
      expect(all.textContent!.trim()).toBe('See all 8 matches');
      expect(all.getAttribute('href')).toBe('/opportunities?view=matches');
      failRest(http);
    });
  });

  describe('the page', () => {
    it('opens the home overview for every account, an admin included: nothing is taken away', async () => {
      const http = signedIn({ admin: true });
      const fixture = TestBed.createComponent(Dashboard);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/');
      expect((fixture.nativeElement as HTMLElement).querySelector('gz-buyer-dashboard')).toBeTruthy();
      failRest(http);
    });

    it('titles each professional overview with its area, as the menu names it', () => {
      const http = signedIn();
      const heading = (c: unknown) => {
        const fixture = TestBed.createComponent(c as typeof RealtorDashboard);
        fixture.detectChanges();
        return (fixture.nativeElement as HTMLElement).querySelector('h1')!.textContent!.trim();
      };
      expect(heading(InvestorDashboard)).toBe('Investments');
      expect(heading(RealtorDashboard)).toBe('CRM');
      expect(heading(LenderDashboard)).toBe('Lending');
      failRest(http);
    });
    it('shows guests the sign-in line only, and asks for nothing of an account', () => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          ...provideTestStore(),
          { provide: KeycloakService, useValue: { isLoggedIn: () => false, hasRealmRole: () => false } },
        ],
      });
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(Dashboard);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('h1')!.textContent!.trim()).toBe('Overview');
      expect(text(el)).toContain('Sign in to see properties matched to your area and budget.');
      expect(el.querySelectorAll('section.overview-section').length).toBe(0);
      expect(
        http.match((r) => r.url.includes('/recommendations') || r.url.includes('/dashboards/')).length,
      ).toBe(0);
      failRest(http);
    });

  });
});
