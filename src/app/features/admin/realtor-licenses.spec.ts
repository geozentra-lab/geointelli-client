import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store, provideState } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { DEFAULT_REGISTRY_SOURCE, RealtorLicenseReviewDTO } from '../../core/models/account';
import { AdminAccessActions as A } from '../../store/admin-access/admin-access.actions';
import { adminAccessReducer } from '../../store/admin-access/admin-access.reducer';
import { RealtorLicenses } from './realtor-licenses';

const license = (id: number, over: Partial<RealtorLicenseReviewDTO> = {}): RealtorLicenseReviewDTO => ({
  id,
  applicantUserId: 200 + id,
  applicantEmail: `realtor${id}@example.com`,
  licenseHolderName: 'Dana Ruiz',
  licensingState: 'FL',
  licenseNumber: 'SL3512345',
  licenseExpirationDate: '2027-05-31',
  brokerageName: 'Coastal Realty',
  workEmail: null,
  status: 'PENDING_REVIEW',
  decisionMethod: null,
  reviewedByUserId: null,
  decidedAt: null,
  registrySource: null,
  rejectionReason: null,
  autoCheckResult: 'MATCH',
  autoCheckedAt: '2026-11-18T15:01:00Z',
  autoCheckSource: 'DBPR',
  autoCheckNote: null,
  submittedAt: '2026-11-18T15:00:00Z',
  ...over,
});
const page = (content: RealtorLicenseReviewDTO[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

describe('Realtor licenses page', () => {
  let store: Store;
  let dispatched: Action[];

  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin/realtor-licenses', component: RealtorLicenses }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        provideState('adminAccess', adminAccessReducer),
        { provide: KeycloakService, useValue: { isLoggedIn: () => true, hasRealmRole: (r: string) => r === 'admin' } },
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
    await harness.navigateByUrl(url, RealtorLicenses);
    const el = harness.routeNativeElement as HTMLElement;
    document.body.appendChild(harness.fixture.nativeElement);
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    await settle();
    return { el, settle };
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
  const pane = () => document.querySelector('.desk-slot gz-record-pane')!;
  const type = (field: HTMLTextAreaElement | HTMLInputElement, value: string) => {
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };
  async function openFirst(rows: RealtorLicenseReviewDTO[]) {
    const s = await setup('/admin/realtor-licenses');
    store.dispatch(A.licensesLoaded({ page: page(rows) }));
    await s.settle();
    s.el.querySelector<HTMLElement>('.rl-table tbody tr td')!.click();
    await s.settle();
    return s;
  }

  it('loads the submissions waiting for review and shows the automatic check in words', async () => {
    const { el, settle } = await setup('/admin/realtor-licenses');
    expect(of<ReturnType<typeof A.loadLicenses>>(A.loadLicenses.type)[0].query).toEqual({ status: 'PENDING_REVIEW', page: 0 });
    store.dispatch(
      A.licensesLoaded({
        page: page([
          license(1),
          license(2, { autoCheckResult: 'NO_MATCH', autoCheckNote: 'The registry lists this number under another name.', brokerageName: null }),
          license(3, { autoCheckResult: null, autoCheckedAt: null, licenseExpirationDate: null }),
        ]),
      }),
    );
    await settle();
    expect(text(el.querySelector('h1'))).toBe('Realtor licenses');
    expect(text(el.querySelector('.rl-count'))).toBe('3 submissions · Pending review');
    const rows = [...el.querySelectorAll('.rl-table tbody tr')];
    expect(spaced(rows[0])).toContain('Dana Ruiz SL3512345 FL May 31, 2027 Coastal Realty');
    expect(spaced(rows[0])).toContain('Matches the registry');
    expect(spaced(rows[1])).toContain('No match in the registry The registry lists this number under another name.');
    expect(spaced(rows[1])).toContain('Not given');
    expect(spaced(rows[2])).toContain('Not checked');
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe('/admin/users/201?email=realtor1@example.com');
    // Pending review: no Decision column.
    expect([...el.querySelectorAll('.rl-table thead th')].map((th) => text(th))).not.toContain('Decision');
  });

  it('approves with the registry prefilled, says why when it is cleared, and sends it', async () => {
    const { settle } = await openFirst([license(1)]);
    button(pane(), 'Approve…').click();
    await settle();
    const registry = pane().querySelector<HTMLInputElement>('#rl-registry')!;
    expect(registry.value).toBe(DEFAULT_REGISTRY_SOURCE);
    type(registry, '   ');
    await settle();
    expect(button(pane(), 'Approve realtor access').getAttribute('aria-disabled')).toBe('true');
    expect(text(pane().querySelector('#rl-why'))).toBe('Name the registry you checked.');
    button(pane(), 'Approve realtor access').click();
    expect(of(A.approveLicense.type)).toHaveLength(0);
    type(registry, 'Florida DBPR licensee search, checked by phone');
    await settle();
    button(pane(), 'Approve realtor access').click();
    await settle();
    expect(of<ReturnType<typeof A.approveLicense>>(A.approveLicense.type)).toEqual([
      expect.objectContaining({ id: 1, registrySource: 'Florida DBPR licensee search, checked by phone' }),
    ]);
  });

  it('needs a reason to reject, says the applicant sees it, and sends the registry with it', async () => {
    const { settle } = await openFirst([license(1)]);
    button(pane(), 'Reject…').click();
    await settle();
    expect(text(pane().querySelector('#rl-reason-hint'))).toContain('Shown to the applicant.');
    expect(button(pane(), 'Reject license').getAttribute('aria-disabled')).toBe('true');
    expect(text(pane().querySelector('#rl-why'))).toBe('Write the reason first: the applicant sees it.');
    button(pane(), 'Reject license').click();
    expect(of(A.rejectLicense.type)).toHaveLength(0);
    type(pane().querySelector<HTMLTextAreaElement>('#rl-reason')!, 'The license number belongs to another licensee.');
    await settle();
    button(pane(), 'Reject license').click();
    await settle();
    expect(of<ReturnType<typeof A.rejectLicense>>(A.rejectLicense.type)).toEqual([
      expect.objectContaining({
        id: 1,
        registrySource: DEFAULT_REGISTRY_SOURCE,
        rejectionReason: 'The license number belongs to another licensee.',
      }),
    ]);
  });

  it('shows how a decided license was decided', async () => {
    const { el, settle } = await setup('/admin/realtor-licenses?status=REJECTED');
    expect(of<ReturnType<typeof A.loadLicenses>>(A.loadLicenses.type)[0].query.status).toBe('REJECTED');
    store.dispatch(
      A.licensesLoaded({
        page: page([
          license(1, {
            status: 'REJECTED',
            decisionMethod: 'MANUAL',
            reviewedByUserId: 3,
            decidedAt: '2026-11-19T12:00:00Z',
            registrySource: DEFAULT_REGISTRY_SOURCE,
            rejectionReason: 'Expired',
          }),
        ]),
      }),
    );
    await settle();
    expect(spaced(el.querySelector('.rl-table tbody tr'))).toContain('Rejected · Nov 19 Expired');
    el.querySelector<HTMLElement>('.rl-table tbody tr td')!.click();
    await settle();
    expect(button(pane(), 'Approve…')).toBeUndefined();
    expect(spaced(pane())).toContain('Decided by User ID 3');
    expect(spaced(pane())).toContain('Registry checked ' + DEFAULT_REGISTRY_SOURCE);
  });
});
