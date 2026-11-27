import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { UserActions } from '../../store/user/user.actions';
import { selectUserState } from '../../store/user/user.selectors';
import { RealtorLicenseActions } from '../../store/realtor-license/realtor-license.actions';
import { AccountActions } from '../../store/account/account.actions';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { UserDTO, UserPreferencesDTO } from '../../core/models/api';
import { RealtorLicenseVerificationDTO } from '../../core/models/realtor-license';
import { Settings } from './settings';

const profile = (over: Partial<UserDTO> = {}): UserDTO =>
  ({
    id: 1,
    keycloakUserId: 'k',
    username: 'test.user',
    firstName: 'Original',
    lastName: 'Name',
    email: 'test@example.test',
    realtorLicenseStatus: null,
    ...over,
  }) as UserDTO;
const delivery = {
  inAppEnabled: true,
  emailEnabled: false,
  enabledEventTypes: ['NEW_MATCH', 'CONTACT_REQUEST', 'FUTURE_EVENT'],
  emailCadence: 'DAILY',
  emailAddress: null,
  nextEmailAt: null,
  updatedAt: null,
  emailDeliveryEnabled: false,
};
const prefs = (over: Partial<UserPreferencesDTO> = {}): UserPreferencesDTO => ({
  minBudget: 400000,
  maxBudget: 900000,
  targetLocations: [{ countyId: 12, countyName: 'Miami-Dade', stateCode: 'FL' }],
  investmentGoals: ['Rental income'],
  ...over,
});
const license = (id: number, over: Partial<RealtorLicenseVerificationDTO> = {}): RealtorLicenseVerificationDTO => ({
  id,
  licenseHolderName: 'Dana Okafor',
  licensingState: 'FL',
  licenseNumber: 'SL348721',
  licenseExpirationDate: null,
  brokerageName: 'Bayline Realty',
  workEmail: null,
  status: 'REJECTED',
  rejectionReason: 'The license number does not match the state record',
  submittedAt: '2026-10-02T15:00:00Z',
  decidedAt: '2026-10-04T15:00:00Z',
  ...over,
});

describe('Settings', () => {
  let store: Store;
  let http: HttpTestingController;
  let dispatched: Action[];
  const auth = { loggedIn: true };
  beforeEach(() => {
    auth.loggedIn = true;
  });

  async function setup(account: UserDTO | null = profile()) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'settings', component: Settings }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: () => false } },
      ],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
    if (account) store.dispatch(UserActions.profileSaved({ profile: account }));
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/settings', Settings);
    const el = harness.routeNativeElement as HTMLElement;
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    await settle();
    return { el, settle };
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  const button = (root: Element, words: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === words)!;
  const type = (el: Element, selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const of = (type: string) => dispatched.filter((a) => a.type === type);
  /** A radio or checkbox by the first words of its label. */
  const choice = (root: Element, words: string) =>
    [...root.querySelectorAll('label.se-choice')].find((l) => text(l.querySelector('span')) === words)!.querySelector('input')!;
  const answerDelivery = (body = delivery) => http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/notifications/preferences')).flush(body);

  it('offers account types only once the role requests are read, and says a failed read with Retry', async () => {
    const { el, settle } = await setup();
    store.dispatch(
      AccountActions.entitlementsLoaded({
        entitlements: { onboardingCompleted: true, roles: ['user'], features: { normalUser: true }, pendingRoles: [] } as never,
      }),
    );
    await settle();
    const section = el.querySelector('#account-type')!;
    const requests = () => http.match((r) => r.method === 'GET' && r.url.endsWith('/users/me/role-requests'));
    requests().forEach((r) => r.flush({ message: 'down' }, { status: 500, statusText: 'Server Error' }));
    await settle();
    // Not the choices: a pending request (and its Cancel) can't be told apart from none.
    expect(section.textContent).not.toContain('Add a professional account type');
    expect(text(section)).toContain('The request could not be completed. Please retry.');
    button(section, 'Retry').click();
    await settle();
    const again = requests();
    expect(again).toHaveLength(1);
    again[0].flush([]);
    await settle();
    expect(section.textContent).toContain('Add a professional account type');
  });

  it('asks a guest to sign in and loads nothing', async () => {
    auth.loggedIn = false;
    const { el } = await setup(null);
    expect(text(el.querySelector('h1'))).toBe('Settings');
    expect(el.textContent).toContain('Sign in to change your settings');
    expect(el.querySelector('gz-profile-form')).toBeNull();
    http.expectNone((r) => r.url.endsWith('/notifications/preferences'));
  });

  it('sends only what changed in the profile, keeps typed fields when saving fails, then accepts a retry', async () => {
    const { el, settle } = await setup();
    answerDelivery();
    const save = () => button(el, 'Save profile');
    // Nothing typed: Save says why it can't run, and sends nothing.
    expect(save().getAttribute('aria-disabled')).toBe('true');
    expect(text(el.querySelector('#se-profile-why'))).toBe('Nothing has changed.');
    save().click();
    http.expectNone((r) => r.method === 'PATCH');
    type(el, '#firstName', 'Edited');
    await settle();
    expect(save().getAttribute('aria-disabled')).toBeNull();
    save().click();
    const first = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/users/me'));
    expect(first.request.body).toEqual({ firstName: 'Edited' });
    first.flush({ message: 'Please retry' }, { status: 503, statusText: 'Unavailable' });
    await settle();
    expect(el.querySelector<HTMLInputElement>('#firstName')!.value).toBe('Edited');
    expect(store.selectSignal(selectUserState)().profile?.firstName).toBe('Original');
    expect(text(el.querySelector('gz-profile-form .field-error'))).toContain('The profile could not be saved');
    // A name can't be removed through the profile update.
    type(el, '#lastName', '');
    await settle();
    expect(text(el.querySelector('#se-profile-why'))).toBe('A name can be changed here, not removed.');
    type(el, '#lastName', 'Name');
    await settle();
    // The profile sends names only: the account type has its own section, approved by an admin.
    expect(el.querySelector('gz-profile-form input[type=radio]')).toBeNull();
    save().click();
    const second = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/users/me'));
    expect(second.request.body).toEqual({ firstName: 'Edited' });
    second.flush(profile({ firstName: 'Edited' }));
    await settle();
    expect(store.selectSignal(selectUserState)().profileError).toBeNull();
    expect(el.querySelector('gz-profile-form .field-error')).toBeNull();
    expect(text(el.querySelector('#se-profile-why'))).toBe('Nothing has changed.');
  });

  it('saves notification settings without dropping event types the form doesn’t know', async () => {
    const { el, settle } = await setup();
    answerDelivery();
    await settle();
    const newMatches = choice(el.querySelector('gz-notification-form')!, 'New matches');
    expect(newMatches.checked).toBe(true);
    newMatches.click();
    await settle();
    button(el, 'Save notification settings').click();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/notifications/preferences'));
    expect([...put.request.body.enabledEventTypes].sort()).toEqual(['CONTACT_REQUEST', 'FUTURE_EVENT']);
    put.flush({ ...delivery, enabledEventTypes: ['CONTACT_REQUEST', 'FUTURE_EVENT'] });
    await settle();
    expect(text(el.querySelector('#se-notify-why'))).toBe('Nothing has changed.');
  });

  it('says why preferences can’t be saved instead of a toast, and keeps typed fields when they are answered again', async () => {
    const { el, settle } = await setup();
    answerDelivery();
    store.dispatch(UserActions.preferencesLoaded({ preferences: prefs() }));
    await settle();
    const save = () => button(el, 'Save preferences');
    expect(text(el.querySelector('#se-prefs-why'))).toBe('Nothing has changed.');
    type(el, '#minBudget', '950000');
    await settle();
    expect(text(el.querySelector('#se-prefs-why'))).toBe('The minimum is more than the maximum.');
    save().click();
    expect(of(UserActions.savePreferences.type)).toHaveLength(0);
    type(el, '#minBudget', '300000');
    await settle();
    // The same preferences answered again with another maximum: the typed minimum stays.
    store.dispatch(UserActions.preferencesLoaded({ preferences: prefs({ maxBudget: 1000000 }) }));
    await settle();
    expect(el.querySelector<HTMLInputElement>('#minBudget')!.value).toBe('300000');
    expect(el.querySelector<HTMLInputElement>('#maxBudget')!.value).toBe('1000000');
    expect(text(el.querySelector('.pf-counties'))).toContain('Miami-Dade, FL');
    button(el, 'Remove').click();
    await settle();
    expect(text(el.querySelector('gz-preferences-form'))).toContain('No counties chosen.');
    save().click();
    expect(of(UserActions.savePreferences.type)[0]).toMatchObject({
      preferences: { minBudget: 300000, maxBudget: 1000000, targetLocations: [], investmentGoals: ['Rental income'] },
    });
  });

  it('shows a rejected license’s reason, prefills the form from it and lists earlier submissions', async () => {
    const { el, settle } = await setup(profile({ realtorLicenseStatus: 'REJECTED' }));
    answerDelivery();
    store.dispatch(
      RealtorLicenseActions.loaded({
        history: [license(7), license(5, { licenseNumber: 'SL1', submittedAt: '2026-09-01T15:00:00Z', rejectionReason: 'Expired' })],
      }),
    );
    await settle();
    const section = el.querySelector('#license')!;
    expect(text(section)).toContain('Not verified on');
    expect(text(section)).toContain('The license number does not match the state record. Correct the details below and submit again.');
    expect(section.querySelector<HTMLInputElement>('#lic-number')!.value).toBe('SL348721');
    expect(text(section.querySelector('.lic-table tbody'))).toContain('SL1');
    type(section, '#lic-number', ' ');
    await settle();
    expect(text(section.querySelector('#lic-why'))).toBe('Enter the name on the license and its number.');
    button(section, 'Submit for verification').click();
    expect(of(RealtorLicenseActions.submit.type)).toHaveLength(0);
    type(section, '#lic-number', 'SL3487215');
    await settle();
    button(section, 'Submit for verification').click();
    expect(of(RealtorLicenseActions.submit.type)[0]).toMatchObject({
      request: { licenseHolderName: 'Dana Okafor', licensingState: 'FL', licenseNumber: 'SL3487215', brokerageName: 'Bayline Realty' },
    });
  });

  it('offers a renewal once a verified license has expired, and not while it is valid', async () => {
    const { el, settle } = await setup(profile({ realtorLicenseStatus: 'VERIFIED' }));
    answerDelivery();
    const verified = (expires: string | null) =>
      license(9, { status: 'VERIFIED', rejectionReason: null, licenseExpirationDate: expires });
    // Valid (or no expiry date): the backend refuses a new submission, so there is no form.
    store.dispatch(RealtorLicenseActions.loaded({ history: [verified('2099-12-31')] }));
    await settle();
    const section = el.querySelector('#license')!;
    expect(section.querySelector('#lic-number')).toBeNull();
    store.dispatch(RealtorLicenseActions.loaded({ history: [verified(null)] }));
    await settle();
    expect(section.querySelector('#lic-number')).toBeNull();
    // Expired (the expiry run revoked the realtor role): the form is back, filled from it, date empty.
    store.dispatch(RealtorLicenseActions.loaded({ history: [verified('2020-01-31')] }));
    await settle();
    expect(text(section)).toContain('This license expired on');
    expect(section.querySelector<HTMLInputElement>('#lic-number')!.value).toBe('SL348721');
    expect(section.querySelector<HTMLInputElement>('#lic-expires')!.value).toBe('');
    // The earliest expiry the backend takes is today in UTC.
    expect(section.querySelector<HTMLInputElement>('#lic-expires')!.min).toBe(new Date().toISOString().slice(0, 10));
  });

  it('shows the license section only to realtors or anyone with a submission', async () => {
    const { el } = await setup(profile());
    expect(el.querySelector('#license')).toBeNull();
    expect(text(el.querySelector('.pagehead'))).not.toContain('realtor license');
  });
});
