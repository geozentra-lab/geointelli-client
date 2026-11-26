import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store, provideState } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ROLE_MANAGEMENT_UNAVAILABLE, RoleRequestReviewDTO } from '../../core/models/account';
import { AdminAccessActions as A } from '../../store/admin-access/admin-access.actions';
import { adminAccessReducer } from '../../store/admin-access/admin-access.reducer';
import { RoleRequests } from './role-requests';

const request = (id: number, over: Partial<RoleRequestReviewDTO> = {}): RoleRequestReviewDTO => ({
  id,
  userId: 100 + id,
  applicantEmail: `applicant${id}@example.com`,
  role: 'investor',
  status: 'PENDING',
  organizationName: null,
  note: null,
  decisionReason: null,
  decidedByUserId: null,
  createdAt: '2026-11-18T15:00:00Z',
  decidedAt: null,
  ...over,
});
const page = (content: RoleRequestReviewDTO[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

describe('Role requests page', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: true, admin: true };
  beforeEach(() => {
    auth.loggedIn = true;
    auth.admin = true;
  });

  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin/role-requests', component: RoleRequests }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        // Not registered in store/index.ts yet: the slice alone, no effects (outcomes are dispatched here).
        provideState('adminAccess', adminAccessReducer),
        {
          provide: KeycloakService,
          useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: (r: string) => auth.admin && r === 'admin' },
        },
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
    await harness.navigateByUrl(url, RoleRequests);
    const el = harness.routeNativeElement as HTMLElement;
    document.body.appendChild(harness.fixture.nativeElement);
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    await settle();
    return { el, harness, settle };
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  /** The text with a space between text nodes (Angular drops the whitespace between elements). */
  const spaced = (el: Element | null) => {
    const walk = document.createTreeWalker(el!, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    while (walk.nextNode()) out.push(walk.currentNode.textContent!);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  const of = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  const button = (root: Element, words: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === words)!;
  const pane = () => document.querySelector('.desk-slot gz-record-pane')!;
  const type = (field: HTMLTextAreaElement | HTMLInputElement, value: string) => {
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };

  it('loads pending requests by default and lists them as a table with a role history link', async () => {
    const { el, settle } = await setup('/admin/role-requests');
    expect(of<ReturnType<typeof A.loadRoleRequests>>(A.loadRoleRequests.type)[0].query).toEqual({ status: 'PENDING', role: null, page: 0 });
    store.dispatch(
      A.roleRequestsLoaded({
        page: page([
          request(1, { note: 'I manage six rentals in Hialeah.' }),
          request(2, { role: 'lender', organizationName: 'Biscayne Credit Union' }),
          request(3, { role: 'lender' }),
        ]),
      }),
    );
    await settle();
    expect(text(el.querySelector('h1'))).toBe('Role requests');
    expect(text(el.querySelector('.rr-count'))).toBe('3 requests · Pending');
    const rows = [...el.querySelectorAll('.rr-table tbody tr')];
    expect(rows).toHaveLength(3);
    expect(text(rows[0])).toContain('applicant1@example.com');
    expect(text(rows[0])).toContain('I manage six rentals in Hialeah.');
    expect(text(rows[1])).toContain('Biscayne Credit Union');
    expect(text(rows[2])).toContain('Not given');
    const link = rows[0].querySelector<HTMLAnchorElement>('a')!;
    expect(text(link)).toBe('Role history');
    expect(link.getAttribute('href')).toBe('/admin/users/101?email=applicant1@example.com');
    expect(text(el.querySelector('.pager'))).toContain('1 to 3 of 3');
  });

  it('follows the filters in the address and says what is empty', async () => {
    const { el, settle } = await setup('/admin/role-requests?status=ALL&role=lender');
    expect(of<ReturnType<typeof A.loadRoleRequests>>(A.loadRoleRequests.type)[0].query).toEqual({ status: null, role: 'lender', page: 0 });
    store.dispatch(A.roleRequestsLoaded({ page: page([]) }));
    await settle();
    expect(text(el.querySelector('.rr-empty p'))).toBe('No lender role request has been made yet.');
    expect(button(el, 'Clear filter')).toBeTruthy();
    expect(el.querySelector('.stage-links [aria-current="true"]')?.textContent?.trim()).toBe('All');
  });

  it('asks for a reason before a rejection and sends it', async () => {
    const { el, settle } = await setup('/admin/role-requests');
    store.dispatch(A.roleRequestsLoaded({ page: page([request(1)]) }));
    await settle();
    el.querySelector<HTMLElement>('.rr-table tbody tr td')!.click();
    await settle();
    expect(text(pane().querySelector('.pane-title'))).toBe('applicant1@example.com');
    button(pane(), 'Reject…').click();
    await settle();
    expect(text(pane().querySelector('#rr-reason-hint'))).toContain('Shown to the applicant.');
    const submit = button(pane(), 'Reject request');
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    expect(text(pane().querySelector('#rr-why'))).toBe('Write the reason first: the applicant sees it.');
    submit.click();
    await settle();
    expect(of(A.rejectRoleRequest.type)).toHaveLength(0);
    type(pane().querySelector<HTMLTextAreaElement>('#rr-reason')!, '  No investment history given.  ');
    await settle();
    expect(pane().querySelector('#rr-why')).toBeNull();
    button(pane(), 'Reject request').click();
    await settle();
    expect(of<ReturnType<typeof A.rejectRoleRequest>>(A.rejectRoleRequest.type)).toEqual([
      expect.objectContaining({ id: 1, reason: 'No investment history given.' }),
    ]);
    expect(text(pane().querySelector('.rr-form button.primary'))).toBe('Rejecting…');
  });

  it('approves without a reason, and the decided row leaves the Pending list', async () => {
    const { el, settle } = await setup('/admin/role-requests');
    store.dispatch(A.roleRequestsLoaded({ page: page([request(1), request(2, { role: 'lender' })]) }));
    await settle();
    el.querySelector<HTMLElement>('.rr-table tbody tr td')!.click();
    await settle();
    button(pane(), 'Approve…').click();
    await settle();
    button(pane(), 'Approve investor access').click();
    await settle();
    expect(of<ReturnType<typeof A.approveRoleRequest>>(A.approveRoleRequest.type)).toEqual([
      expect.objectContaining({ id: 1, reason: null }),
    ]);
    store.dispatch(A.roleRequestDecided({ id: 1, request: request(1, { status: 'APPROVED' }) }));
    await settle();
    await settle();
    expect(document.querySelector('.desk-slot')).toBeNull();
    expect(text(el.querySelector('.rr-count'))).toBe('1 request · Pending');
    expect(el.querySelectorAll('.rr-table tbody tr')).toHaveLength(1);
  });

  it('updates a decided row in place under All, and leaves a form opened meanwhile on another row alone', async () => {
    const { el, settle } = await setup('/admin/role-requests?status=ALL');
    store.dispatch(A.roleRequestsLoaded({ page: page([request(1), request(2)]) }));
    await settle();
    el.querySelector<HTMLElement>('.rr-table tbody tr td')!.click();
    await settle();
    button(pane(), 'Approve…').click();
    await settle();
    button(pane(), 'Approve investor access').click();
    await settle();
    // On to the next request before the answer: its Reject form, half written.
    el.querySelector('.rr-table tbody tr')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(text(pane().querySelector('.pane-title'))).toBe('applicant2@example.com');
    button(pane(), 'Reject…').click();
    await settle();
    type(pane().querySelector<HTMLTextAreaElement>('#rr-reason')!, 'Duplicate account');
    await settle();
    store.dispatch(A.roleRequestDecided({ id: 1, request: request(1, { status: 'APPROVED' }) }));
    await settle();
    expect(spaced(el.querySelector('.rr-table tbody tr'))).toContain('Approved');
    expect(pane().querySelector<HTMLTextAreaElement>('#rr-reason')!.value).toBe('Duplicate account');
    expect(button(pane(), 'Reject request').getAttribute('aria-disabled')).toBeNull();
  });

  it('keeps the form and the request pending when Keycloak role management is unavailable', async () => {
    const { el, settle } = await setup('/admin/role-requests');
    store.dispatch(A.roleRequestsLoaded({ page: page([request(1)]) }));
    await settle();
    el.querySelector<HTMLElement>('.rr-table tbody tr td')!.click();
    await settle();
    button(pane(), 'Approve…').click();
    await settle();
    button(pane(), 'Approve investor access').click();
    store.dispatch(A.roleRequestDecisionFailed({ id: 1, error: ROLE_MANAGEMENT_UNAVAILABLE, reload: false }));
    await settle();
    expect(text(pane().querySelector('.rr-form .field-error'))).toBe(ROLE_MANAGEMENT_UNAVAILABLE);
    expect(text(pane().querySelector('[paneMeta]'))).toBe('Investor · Pending');
    expect(button(pane(), 'Approve investor access').getAttribute('aria-disabled')).toBeNull();
  });

  it('shows a decided request’s reason and no decision buttons', async () => {
    const { el, settle } = await setup('/admin/role-requests?status=REJECTED');
    store.dispatch(
      A.roleRequestsLoaded({
        page: page([request(1, { status: 'REJECTED', decisionReason: 'No investment history given.', decidedByUserId: 3, decidedAt: '2026-11-19T10:00:00Z' })]),
      }),
    );
    await settle();
    expect(spaced(el.querySelector('.rr-table tbody tr'))).toContain('Rejected No investment history given.');
    el.querySelector<HTMLElement>('.rr-table tbody tr td')!.click();
    await settle();
    expect(button(pane(), 'Approve…')).toBeUndefined();
    expect(text(pane())).toContain('User ID 3');
  });

  it('shows the gate to a non-admin and loads nothing', async () => {
    auth.admin = false;
    const { el } = await setup('/admin/role-requests');
    expect(text(el.querySelector('gz-admin-gate'))).toContain('it can’t open role requests');
    expect(of(A.loadRoleRequests.type)).toHaveLength(0);
  });
});
