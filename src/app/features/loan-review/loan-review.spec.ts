import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { LenderActions as A } from '../../store/lender/lender.actions';
import { NO_ACCOUNT_FOR_EMAIL, memberLookupError } from '../../store/lender/lender.effects';
import { UserActions } from '../../store/user/user.actions';
import { LenderApplicationDTO, LenderPipelineDTO } from '../../core/models/lender';
import { LoanReview } from './loan-review';
import { isAmount } from './application-record';
import { selectLender } from '../../store/lender/lender.selectors';

const app = (id: number, over: Partial<LenderApplicationDTO> = {}): LenderApplicationDTO => ({
  id,
  organizationId: 42,
  createdByUserId: 7,
  applicantName: 'Applicant ' + id,
  applicantEmail: null,
  propertyId: null,
  requestedAmount: 300000,
  currency: 'USD',
  stage: 'UNDER_REVIEW',
  loanType: 'FHA',
  approvedAmount: null,
  fundedAmount: null,
  approvedAt: null,
  fundedAt: null,
  notes: null,
  source: null,
  externalId: null,
  createdAt: '2026-11-01T12:00:00Z',
  updatedAt: '2026-11-16T12:00:00Z',
  ...over,
});
const pipeline: LenderPipelineDTO = {
  organizationId: 42,
  currency: 'USD',
  total: 3,
  stages: { SUBMITTED: { count: 1, requestedAmount: 300000 }, UNDER_REVIEW: { count: 2, requestedAmount: 600000 } },
  approvedCount: 0,
  approvedAmount: 0,
  fundedCount: 0,
  fundedAmount: 0,
  asOf: '2026-11-18T12:00:00Z',
  scope: '',
};
const page = <T>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

describe('Loan review', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: true };
  const confirm = vi.fn(async () => true);
  beforeEach(() => {
    auth.loggedIn = true;
    confirm.mockClear();
  });

  async function setup(url = '/loan-review?tab=applications') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'loan-review', component: LoanReview }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: () => false } },
        { provide: ConfirmationService, useValue: { confirm } },
      ],
    });
    store = TestBed.inject(Store);
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, LoanReview);
    const el = harness.routeNativeElement as HTMLElement;
    document.body.appendChild(harness.fixture.nativeElement);
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    return { harness, el, settle };
  }
  function hold(...apps: LenderApplicationDTO[]) {
    store.dispatch(UserActions.loaded({ profile: { id: 7 } as never }));
    store.dispatch(A.organizationsLoaded({ organizations: [{ id: 42, name: 'Biscayne Community Lending', ownerUserId: 7 }] }));
    store.dispatch(A.pipelineLoaded({ pipeline }));
    store.dispatch(A.applicationsLoaded({ page: page(apps) }));
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  const spaced = (el: Element | null) => {
    const walk = document.createTreeWalker(el!, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    while (walk.nextNode()) out.push(walk.currentNode.textContent!);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  const of = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  const button = (root: Element, words: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === words)!;

  it('asks a guest to sign in and loads nothing', async () => {
    auth.loggedIn = false;
    const { el } = await setup('/loan-review');
    expect(el.textContent).toContain('Sign in to review applications');
    expect(of(A.loadOrganizations.type)).toHaveLength(0);
  });

  it('lists applications as a table, with stage links counted by the pipeline', async () => {
    const { el, settle } = await setup();
    expect(of(A.loadOrganizations.type)).toHaveLength(1);
    hold(app(16), app(17, { stage: 'SUBMITTED', propertyId: null }));
    await settle();
    expect(text(el.querySelector('h1'))).toBe('Applications');
    expect(spaced(el.querySelector('.lr-table tbody tr'))).toContain('Applicant 16 FHA Under review $300,000');
    const links = [...el.querySelectorAll('gz-stage-links button')].map((b) => spaced(b));
    expect(links[0]).toBe('All 3');
    expect(links).toContain('Submitted 1');
    expect(links).toContain('Under review 2');
    // No banner on top, no ids in prose; the note says what a stage is.
    expect(el.textContent).toContain('Recording a stage doesn’t approve credit or move any funds.');
  });

  it('approves from the pane with an amount, said back when it is too high', async () => {
    const { el, settle } = await setup();
    hold(app(16));
    await settle();
    (el.querySelector('.lr-table tbody tr td') as HTMLElement).click();
    await settle();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    button(pane, 'Approve…').click();
    await settle();
    const amount = pane.querySelector<HTMLInputElement>('#ar-amount')!;
    expect(amount.value).toBe('300000');
    amount.value = '350000';
    amount.dispatchEvent(new Event('input'));
    await settle();
    expect(text(pane.querySelector('#ar-amount-why'))).toBe('The approved amount can’t be more than the requested amount.');
    amount.value = '280000';
    amount.dispatchEvent(new Event('input'));
    await settle();
    button(pane, 'Mark approved').click();
    await settle();
    expect(of<ReturnType<typeof A.updateApplication>>(A.updateApplication.type)[0]).toEqual(
      A.updateApplication({ id: 16, request: { stage: 'APPROVED', approvedAmount: 280000 } }),
    );
  });

  it('opens Applications filtered on ?stage= from the overview, then takes it out of the address', async () => {
    const { settle } = await setup('/loan-review?tab=applications&stage=SUBMITTED');
    hold();
    await settle();
    expect(of<ReturnType<typeof A.loadApplications>>(A.loadApplications.type)[0]).toEqual(
      A.loadApplications({ page: 0, stage: 'SUBMITTED' }),
    );
    await new Promise((r) => setTimeout(r));
    expect(TestBed.inject(Router).url).toBe('/loan-review?tab=applications');
    // An unknown stage is ignored.
    await TestBed.inject(Router).navigateByUrl('/loan-review?tab=applications&stage=LOST');
    await settle();
    expect(of(A.loadApplications.type)).toHaveLength(1);
  });

  it('opens on the organization chosen on the overview (?org=), then takes it out of the address', async () => {
    const orgs = [
      { id: 42, name: 'Biscayne Community Lending', ownerUserId: 7 },
      { id: 43, name: 'Keys Credit Union', ownerUserId: 8 },
    ];
    const selected = () => {
      let id: number | null = null;
      store.select(selectLender).subscribe((s) => (id = s.selectedId)).unsubscribe();
      return id;
    };
    // Before the organizations are read: preferred, and kept once they arrive (not the first one).
    const { settle } = await setup('/loan-review?tab=applications&org=43');
    await settle();
    expect(of(A.preferOrganization.type)).toEqual([A.preferOrganization({ organizationId: 43 })]);
    store.dispatch(A.organizationsLoaded({ organizations: orgs }));
    expect(selected()).toBe(43);
    await new Promise((r) => setTimeout(r));
    expect(TestBed.inject(Router).url).toBe('/loan-review?tab=applications');
    // Once they are read: chosen as from the picker. One the account doesn't belong to is ignored.
    await TestBed.inject(Router).navigateByUrl('/loan-review?tab=applications&org=42');
    await settle();
    expect(of<ReturnType<typeof A.selectOrganization>>(A.selectOrganization.type).map((a) => a.organizationId)).toEqual([42]);
    expect(selected()).toBe(42);
    await TestBed.inject(Router).navigateByUrl('/loan-review?tab=applications&org=99');
    await settle();
    expect(selected()).toBe(42);
  });

  it('takes any amount in whole cents (an exact check refused 1.10, 19.99 and 300000.10)', () => {
    for (const v of [0.01, 1.1, 4.35, 19.99, 12.5, 250000, 300000.1, 999999999.99]) expect(isAmount(v)).toBe(true);
    for (const v of [0, -5, 1.105, 0.001, NaN, Infinity, null, undefined]) expect(isAmount(v)).toBe(false);
  });

  it('asks before a final stage, and shows the import source as a field', async () => {
    const { el, settle } = await setup();
    hold(app(16, { source: 'BROKER_SOUTHDADE', externalId: 'SD-2238' }));
    await settle();
    (el.querySelector('.lr-table tbody tr td') as HTMLElement).click();
    await settle();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(spaced(pane)).toContain('Source BROKER_SOUTHDADE · SD-2238');
    expect(pane.textContent).not.toContain('Imported from');
    button(pane, 'Reject').click();
    await settle();
    expect(confirm).toHaveBeenCalled();
    expect(of<ReturnType<typeof A.updateApplication>>(A.updateApplication.type)[0].request).toEqual({ stage: 'REJECTED' });
  });

  it('lists the team by user ID, finds a colleague by email and gives them access by name', async () => {
    const { el, settle } = await setup('/loan-review?tab=team');
    hold();
    store.dispatch(A.membersLoaded({ members: [7, 112] }));
    await settle();
    const rows = [...el.querySelectorAll('.lr-team tbody tr')].map((r) => spaced(r));
    expect(rows[0]).toContain('Unavailable');
    expect(rows[0]).toContain('7 Owner · You');
    expect(rows[1]).toContain('112 Member');
    expect(el.textContent).not.toContain('User 112');
    expect(el.querySelector('#memberId')).toBeNull();
    expect(text(el.querySelector('#member-why'))).toBe('Enter their email.');
    const email = el.querySelector<HTMLInputElement>('#memberEmail')!;
    const type = async (v: string) => {
      email.value = v;
      email.dispatchEvent(new Event('input'));
      await settle();
    };
    await type('dana.okafor@');
    expect(text(el.querySelector('#member-why'))).toBe('Enter an email address, like name@example.com.');
    button(el, 'Find').click();
    expect(of(A.lookUpMember.type)).toHaveLength(0);

    await type(' Dana.Okafor@bayline.test ');
    expect(el.querySelector('#member-why')).toBeNull();
    button(el, 'Find').click();
    expect(of(A.lookUpMember.type)).toEqual([A.lookUpMember({ email: 'Dana.Okafor@bayline.test' })]);
    store.dispatch(
      A.memberFound({
        email: 'Dana.Okafor@bayline.test',
        result: { userId: 140, email: 'dana.okafor@bayline.test', firstName: 'Dana', lastName: 'Okafor', member: false },
      }),
    );
    await settle();
    const person = el.querySelector('.lr-person')!;
    expect(spaced(person)).toBe('Dana Okafor dana.okafor@bayline.test Give access');
    button(person, 'Give access').click();
    expect(of(A.addMember.type)).toEqual([A.addMember({ userId: 140, who: 'Dana Okafor' })]);

    // Someone already on the team, and an email no account uses.
    await type('lee@bayline.test');
    expect(el.querySelector('.lr-person')).toBeNull();
    store.dispatch(A.lookUpMember({ email: 'lee@bayline.test' }));
    store.dispatch(
      A.memberFound({ email: 'lee@bayline.test', result: { userId: 112, email: 'lee@bayline.test', firstName: null, lastName: null, member: true } }),
    );
    await settle();
    expect(spaced(el.querySelector('.lr-person'))).toBe('lee@bayline.test Already has access to Biscayne Community Lending.');
    store.dispatch(A.lookUpMember({ email: 'lee@bayline.test' }));
    store.dispatch(A.memberLookupFailed({ email: 'lee@bayline.test', error: NO_ACCOUNT_FOR_EMAIL }));
    await settle();
    expect(text(el.querySelector('.lr-found [role=alert]'))).toBe(NO_ACCOUNT_FOR_EMAIL);
  });

  it('says a missing account in words; other failures as usual', () => {
    expect(memberLookupError(new HttpErrorResponse({ status: 404 }))).toBe(NO_ACCOUNT_FOR_EMAIL);
    expect(
      memberLookupError(new HttpErrorResponse({ status: 400, error: { message: 'email must be an email address' } })),
    ).toBe('Email must be an email address.');
  });

  it('says a snapshot that is not JSON, and lists a result row by row in words', async () => {
    const { el, settle } = await setup('/loan-review?tab=import');
    hold();
    await settle();
    const json = el.querySelector<HTMLTextAreaElement>('#importJson')!;
    json.value = '{ not json';
    json.dispatchEvent(new Event('input'));
    await settle();
    // The form's Import, not the Import tab.
    el.querySelector<HTMLButtonElement>('section[aria-labelledby=lr-import-title] button.primary')!.click();
    await settle();
    expect(text(el.querySelector('#import-error'))).toContain('This is not valid JSON');
    expect(of(A.importApplications.type)).toHaveLength(0);
    store.dispatch(
      A.importFinished({
        result: { created: 1, updated: 0, unchanged: 0, rejected: 1, rows: [
          { row: 1, status: 'CREATED', applicationId: 1041, errorCode: null },
          { row: 2, status: 'REJECTED', applicationId: null, errorCode: 'INVALID_TRANSITION' },
        ] },
      }),
    );
    await settle();
    const rows = [...el.querySelectorAll('section[aria-labelledby=lr-result-title] tbody tr')].map((r) => spaced(r));
    expect(rows[0]).toBe('1 Created 1041');
    expect(rows[1]).toBe('2 Rejected Stage change not allowed');
    expect(el.textContent).not.toContain('—');
  });

  it('asks to create an organization when there is none', async () => {
    const { el, settle } = await setup('/loan-review');
    store.dispatch(A.organizationsLoaded({ organizations: [] }));
    await settle();
    expect(el.textContent).toContain('Create your lending organization');
    expect(text(el.querySelector('#org-why'))).toBe('Enter a name.');
  });

  it('says the pipeline’s approved and funded totals as what they are', async () => {
    const { el, settle } = await setup('/loan-review?tab=pipeline');
    hold();
    store.dispatch(A.pipelineLoaded({ pipeline: { ...pipeline, approvedCount: 2, approvedAmount: 500000, fundedCount: 1, fundedAmount: 240000 } }));
    await settle();
    const captions = spaced(el.querySelector('.kpi-row'));
    expect(captions).toContain('$500K approved · funded included');
    expect(captions).toContain('$240K funded');
    expect(captions).not.toContain('requested');
  });

  it('keeps Approve with its own application and the LTV check, and an error with its own record', async () => {
    const { el, settle } = await setup();
    hold(app(16, { propertyId: 42 }), app(17));
    await settle();
    const rows = () => [...el.querySelectorAll<HTMLElement>('.lr-table tbody tr')];
    rows()[0].querySelector('td')!.click();
    await settle();
    let pane = el.querySelector('.desk-slot gz-record-pane')!;
    button(pane, 'Approve…').click();
    await settle();
    expect(pane.querySelector('#ar-amount')).not.toBeNull();
    // Check LTV changes the slice; the amount form stays.
    button(pane, 'Check LTV').click();
    await settle();
    expect(el.querySelector('#ar-amount')).not.toBeNull();
    // The next application: the form was the other's.
    rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane.querySelector('.pane-title'))).toBe('Applicant 17');
    expect(pane.querySelector('#ar-amount')).toBeNull();
    // A failed move on 17 is said in 17's pane, not after stepping to 16.
    button(pane, 'Reject').click();
    await settle();
    store.dispatch(A.writeFailed({ write: 'update', error: 'The stage could not be changed.' }));
    await settle();
    expect(text(el.querySelector('.lr-pane-error'))).toBe('The stage could not be changed.');
    rows()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await settle();
    expect(el.querySelector('.lr-pane-error')).toBeNull();
  });

  it('opens New application from an empty pipeline', async () => {
    const { el, settle } = await setup('/loan-review?tab=pipeline');
    hold();
    store.dispatch(A.pipelineLoaded({ pipeline: { ...pipeline, total: 0, stages: {} } }));
    await settle();
    button(el, 'New application').click();
    await settle();
    expect(text(el.querySelector('h1'))).toBe('Applications');
    expect(text(el.querySelector('.desk-slot .pane-title'))).toBe('New application');
  });
});
