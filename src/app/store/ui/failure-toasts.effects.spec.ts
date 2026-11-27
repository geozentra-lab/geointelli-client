import { TestBed } from '@angular/core/testing';
import { Action, Store, provideStore } from '@ngrx/store';
import { Actions, provideEffects } from '@ngrx/effects';
import { UiActions } from './ui.actions';
import { FailureToastEffects, WRITE_FAILURES } from './failure-toasts.effects';
import { AccountActions } from '../account/account.actions';
import { accountReducer } from '../account/account.reducer';
import { UserActions } from '../user/user.actions';
import { AdminActions } from '../admin/admin.actions';
import { alertsActions } from '../alerts/alerts.actions';
import { ContactRequestsActions } from '../contact-requests/contact-requests.actions';
import { CrmActions } from '../crm/crm.actions';
import { ImportJobsActions } from '../import-jobs/import-jobs.actions';
import { InvestmentActions } from '../investment/investment.actions';
import { NotificationPreferencesActions } from '../notification-preferences/notification-preferences.actions';
import { NotificationsActions } from '../notifications/notifications.actions';
import { OpportunitiesActions } from '../opportunities/opportunities.actions';
import { portfolioActions } from '../portfolio/portfolio.actions';
import { RealtorLicenseActions } from '../realtor-license/realtor-license.actions';
import { savedSearchesActions } from '../saved-searches/saved-searches.actions';

describe('Failure toasts', () => {
  let store: Store;
  let seen: Action[];
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideStore({ account: accountReducer }), provideEffects(FailureToastEffects)] });
    store = TestBed.inject(Store);
    seen = [];
    TestBed.inject(Actions).subscribe((a) => seen.push(a));
  });
  const toasts = () => seen.filter((a) => a.type === UiActions.toast.type);
  const why = 'The service could not be reached. Please retry.';

  it('says every failed write in an error toast, its lead first, then the reason', () => {
    const writes: [Action, string][] = [
      [AccountActions.onboardingFailed({ error: why }), 'Your choice was not saved.'],
      [AccountActions.roleRequestFailed({ error: why }), 'Request not sent.'],
      [AccountActions.cancelFailed({ error: why }), 'Request not cancelled.'],
      [AdminActions.refreshActionFailed({ id: 'r1', error: why }), 'Refresh request not changed.'],
      [alertsActions.failed({ error: why, operation: 'save' }), 'Not saved.'],
      [ContactRequestsActions.submitFailed({ error: why }), 'Request not sent.'],
      [CrmActions.saveFailed({ error: why }), 'Not saved.'],
      [ImportJobsActions.uploadFailed({ error: why }), 'File not uploaded.'],
      [ImportJobsActions.retryFailed({ id: 'j1', error: why }), 'Retry not started.'],
      [InvestmentActions.writeFailed({ error: why }), 'Not saved.'],
      [NotificationPreferencesActions.failed({ error: why, operation: 'save' }), 'Not saved.'],
      [NotificationsActions.readFailed({ id: 4, error: why }), 'Not marked read.'],
      [OpportunitiesActions.refreshFailed({ error: why }), 'Scores not refreshed.'],
      [portfolioActions.failed({ section: 'save', error: why }), 'Not saved.'],
      [RealtorLicenseActions.submitFailed({ error: why }), 'License not submitted.'],
      [savedSearchesActions.failed({ error: why, operation: 'save' }), 'Not saved.'],
    ];
    // Every write in the table is checked here.
    expect(new Set(writes.map(([a]) => a.type))).toEqual(new Set(Object.keys(WRITE_FAILURES)));
    for (const [action, lead] of writes) {
      seen = [];
      store.dispatch(action);
      expect(toasts(), action.type).toEqual([
        UiActions.toast({ message: lead + ' ' + why, kind: 'error' }),
      ]);
    }
  });

  it('leaves a failed read to the page, which says it where the data would be, with Retry', () => {
    store.dispatch(portfolioActions.failed({ section: 'records', error: why }));
    store.dispatch(alertsActions.failed({ error: why, operation: 'load' }));
    store.dispatch(savedSearchesActions.failed({ error: why, operation: 'load' }));
    store.dispatch(NotificationPreferencesActions.failed({ error: why, operation: 'load' }));
    store.dispatch(alertsActions.monitoringFailed({ id: 1, error: why }));
    store.dispatch(CrmActions.overviewFailed({ error: why }));
    store.dispatch(NotificationsActions.failed({ error: why }));
    expect(toasts()).toEqual([]);
  });

  it('says a failed profile or account read, which hides favorites or menus on every page', () => {
    store.dispatch(UserActions.failed({ error: why }));
    expect(toasts()).toEqual([
      UiActions.toast({
        kind: 'error',
        message: 'Your profile could not be loaded, so favorites and contact requests are off. Reload the page to try again.',
      }),
    ]);
    seen = [];
    store.dispatch(AccountActions.entitlementsFailed({ error: why }));
    expect(toasts()).toEqual([
      UiActions.toast({
        kind: 'error',
        message: 'Your account areas could not be loaded, so some menus are hidden. Reload the page to try again.',
      }),
    ]);
  });

  it('says nothing when a re-read of known account areas fails: nothing is hidden', () => {
    store.dispatch(
      AccountActions.entitlementsLoaded({
        entitlements: { onboardingCompleted: true, roles: ['investor'], features: {}, pendingRoles: [] } as never,
      }),
    );
    seen = [];
    store.dispatch(AccountActions.entitlementsFailed({ error: why }));
    expect(toasts()).toEqual([]);
  });
});
