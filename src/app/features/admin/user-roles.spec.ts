import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store, provideState } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ROLE_MANAGEMENT_UNAVAILABLE, RoleGrantEventDTO } from '../../core/models/account';
import { AdminAccessActions as A } from '../../store/admin-access/admin-access.actions';
import { adminAccessReducer } from '../../store/admin-access/admin-access.reducer';
import { NO_USER_FOR_EMAIL } from '../../store/admin-access/admin-access.effects';
import { UserRoles } from './user-roles';

const event = (id: number, over: Partial<RoleGrantEventDTO> = {}): RoleGrantEventDTO => ({
  id,
  userId: 7,
  role: 'investor',
  action: 'GRANT',
  source: 'ROLE_REQUEST',
  sourceId: 1,
  reason: null,
  decidedByUserId: 3,
  createdAt: '2026-11-18T12:00:00Z',
  ...over,
});
/** Newest first, as the backend sends it: investor held; lender granted, then revoked. */
const history = () => [
  event(3, { role: 'lender', action: 'REVOKE', source: 'ADMIN_REVOCATION', reason: 'Wanted an investor account.', createdAt: '2026-11-17T12:00:00Z' }),
  event(2, { role: 'lender', createdAt: '2026-11-10T12:00:00Z' }),
  event(1, { role: 'investor', source: 'SELF_SERVICE', decidedByUserId: null, createdAt: '2026-11-01T12:00:00Z' }),
];

describe('Role history page', () => {
  let store: Store;
  let dispatched: Action[];

  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/users', component: UserRoles },
          { path: 'admin/users/:userId', component: UserRoles },
        ]),
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
    await harness.navigateByUrl(url, UserRoles);
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
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === words);

  it('Users: finds an account by email and opens its role history', async () => {
    const { el, settle } = await setup('/admin/users');
    expect(text(el.querySelector('h1'))).toBe('Users');
    expect(of(A.loadRoleGrants.type)).toHaveLength(0);
    expect(el.querySelector('.ur-empty')).toBeNull();
    const email = el.querySelector<HTMLInputElement>('#ur-email')!;
    const type = async (v: string) => {
      email.value = v;
      email.dispatchEvent(new Event('input'));
      await settle();
    };
    // A typo is caught here, said only once Find is pressed.
    await type('leo.marin');
    expect(el.querySelector('#ur-find-why')).toBeNull();
    button(el, 'Find')!.click();
    await settle();
    expect(text(el.querySelector('#ur-find-why'))).toBe('Enter an email address, like name@example.com.');
    expect(of(A.findUser.type)).toHaveLength(0);

    // No account: said in words, and the page stays.
    await type(' nobody@example.test ');
    button(el, 'Find')!.click();
    await settle();
    expect(of(A.findUser.type)).toEqual([A.findUser({ email: 'nobody@example.test' })]);
    expect(text(button(el, 'Finding…')!)).toBe('Finding…');
    store.dispatch(A.findUserFailed({ email: 'nobody@example.test', error: NO_USER_FOR_EMAIL }));
    await settle();
    expect(text(el.querySelector('[role=alert]'))).toBe(NO_USER_FOR_EMAIL);

    // Found: the role history of that account opens, named by its email.
    await type('Leo.Marin@example.test');
    button(el, 'Find')!.click();
    store.dispatch(
      A.userFound({
        email: 'Leo.Marin@example.test',
        user: { id: 52, keycloakUserId: 'k', username: 'leo', email: 'leo.marin@example.test', firstName: 'Leo', lastName: 'Marin' },
      }),
    );
    await settle();
    await new Promise((r) => setTimeout(r));
    await settle();
    expect(TestBed.inject(Router).url).toBe('/admin/users/52?email=leo.marin@example.test');
  });

  it('loads the user’s history and lists every grant and revoke in words', async () => {
    const { el, settle } = await setup('/admin/users/7?email=dana%40example.com');
    expect(of<ReturnType<typeof A.loadRoleGrants>>(A.loadRoleGrants.type)[0]).toMatchObject({ userId: 7 });
    expect(text(el.querySelector('h1'))).toBe('Role history');
    expect(text(el.querySelector('.sub'))).toBe('dana@example.com');
    store.dispatch(A.roleGrantsLoaded({ userId: 7, events: history() }));
    await settle();
    const rows = [...el.querySelectorAll('.ur-table tbody tr')].map(spaced);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^Nov 17, .* Lender Revoked Revoked by an admin Wanted an investor account\. User ID 3$/);
    expect(rows[2]).toContain('Investor Granted Granted at sign-up');
    expect(rows[2]).toContain('Unavailable');
    expect(text(el.querySelector('.ur-history .table-note'))).toContain('Decided by is Unavailable where the history names no admin');
  });

  it('offers to revoke only the roles held now, and needs a reason', async () => {
    const { el, settle } = await setup('/admin/users/7');
    expect(text(el.querySelector('.sub'))).toBe('User ID 7');
    store.dispatch(A.roleGrantsLoaded({ userId: 7, events: history() }));
    await settle();
    expect([...el.querySelectorAll('.ur-current tbody tr')].map(spaced)).toEqual([
      expect.stringMatching(/^Investor Nov 1 Granted at sign-up Revoke Investor access…$/),
    ]);
    expect(button(el, 'Revoke Lender access…')).toBeUndefined();
    expect(text(el.querySelector('.ur-note'))).toBe('A pending request is not changed by a revoke: reject it in Role requests.');
    expect(el.querySelector('.ur-note a')!.getAttribute('href')).toBe('/admin/role-requests');

    button(el, 'Revoke Investor access…')!.click();
    await settle();
    const submit = button(el, 'Revoke Investor access')!;
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    expect(text(el.querySelector('#ur-why'))).toBe('Write the reason first.');
    submit.click();
    expect(of(A.revokeRole.type)).toHaveLength(0);
    const reason = el.querySelector<HTMLTextAreaElement>('#ur-reason')!;
    reason.value = 'Moving to a lender account.';
    reason.dispatchEvent(new Event('input'));
    await settle();
    button(el, 'Revoke Investor access')!.click();
    await settle();
    expect(of<ReturnType<typeof A.revokeRole>>(A.revokeRole.type)).toEqual([
      expect.objectContaining({ userId: 7, role: 'investor', reason: 'Moving to a lender account.' }),
    ]);
    expect(button(el, 'Revoking…')).toBeTruthy();
    // Keycloak down: the form stays, with the reason it failed.
    store.dispatch(A.revokeFailed({ userId: 7, role: 'investor', error: ROLE_MANAGEMENT_UNAVAILABLE, reload: false }));
    await settle();
    expect(text(el.querySelector('.ur-form .field-error'))).toBe(ROLE_MANAGEMENT_UNAVAILABLE);
    expect(button(el, 'Revoke Investor access')).toBeTruthy();
  });

  it('says so in one sentence when there is no history, and when the address names no user', async () => {
    const { el, settle } = await setup('/admin/users/7');
    store.dispatch(A.roleGrantsLoaded({ userId: 7, events: [] }));
    await settle();
    expect(text(el.querySelector('.ur-empty'))).toBe('No role has been granted to or revoked from this user.');
    expect(el.querySelector('.ur-table')).toBeNull();
    TestBed.resetTestingModule();
    const bad = await setup('/admin/users/abc');
    expect(text(bad.el.querySelector('.ur-empty'))).toContain('This address doesn’t name a user');
    expect(of(A.loadRoleGrants.type)).toHaveLength(0);
  });
});
