import { Injectable, inject } from '@angular/core';
import { Action, Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { filter, map, withLatestFrom } from 'rxjs';
import { UiActions } from './ui.actions';
import { AccountActions } from '../account/account.actions';
import { selectEntitlements } from '../account/account.selectors';
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

type Failure = Action & { error: string; section?: string; operation?: string };

/**
 * Something the user did that the server refused or never answered: the words that open its toast,
 * or null when the action is a failed read (that one is said where the data would be, with Retry).
 * Writes that say their failure themselves are not here: favorites, profile and preferences
 * (user), the lender's writes, admin decisions and revokes, and alert evaluations.
 */
export const WRITE_FAILURES: Record<string, (a: Failure) => string | null> = {
  [AccountActions.onboardingFailed.type]: () => 'Your choice was not saved.',
  [AccountActions.roleRequestFailed.type]: () => 'Request not sent.',
  [AccountActions.cancelFailed.type]: () => 'Request not cancelled.',
  [AdminActions.refreshActionFailed.type]: () => 'Refresh request not changed.',
  [alertsActions.failed.type]: (a) => (a.operation === 'save' ? 'Not saved.' : null),
  [ContactRequestsActions.submitFailed.type]: () => 'Request not sent.',
  [CrmActions.saveFailed.type]: () => 'Not saved.',
  [ImportJobsActions.uploadFailed.type]: () => 'File not uploaded.',
  [ImportJobsActions.retryFailed.type]: () => 'Retry not started.',
  [InvestmentActions.writeFailed.type]: () => 'Not saved.',
  [NotificationPreferencesActions.failed.type]: (a) => (a.operation === 'save' ? 'Not saved.' : null),
  [NotificationsActions.readFailed.type]: () => 'Not marked read.',
  [OpportunitiesActions.refreshFailed.type]: () => 'Scores not refreshed.',
  [portfolioActions.failed.type]: (a) => (a.section === 'save' ? 'Not saved.' : null),
  [RealtorLicenseActions.submitFailed.type]: () => 'License not submitted.',
  [savedSearchesActions.failed.type]: (a) => (a.operation === 'save' ? 'Not saved.' : null),
};

/**
 * Every failed write is said in an error toast (DESIGN.md §6, Feedback), wherever the page shows it
 * inline: the form that sent it may be scrolled away, closed, or on another page by the time the
 * server answers. Error toasts stay until they are closed with × or the user leaves the page (app.ts).
 */
@Injectable()
export class FailureToastEffects {
  private actions = inject(Actions);
  private store = inject(Store);
  toast = createEffect(() =>
    this.actions.pipe(
      map((a) => {
        const lead = WRITE_FAILURES[a.type]?.(a as Failure);
        return lead ? UiActions.toast({ message: lead + ' ' + (a as Failure).error, kind: 'error' }) : null;
      }),
      filter((a) => a !== null),
    ),
  );
  /**
   * Reads every page depends on, with no place of their own to say a failure: without the
   * entitlements a professional account loses its menus (the shell falls back to the home buyer
   * pages); without the profile, favorites and contact requests stay off. A re-read that fails
   * while the entitlements are known hides nothing and says nothing.
   */
  unavailable = createEffect(() =>
    this.actions.pipe(
      ofType(AccountActions.entitlementsFailed, UserActions.failed),
      withLatestFrom(this.store.select(selectEntitlements)),
      filter(([a, known]) => a.type === UserActions.failed.type || !known),
      map(([a]) =>
        UiActions.toast({
          kind: 'error',
          message:
            a.type === UserActions.failed.type
              ? 'Your profile could not be loaded, so favorites and contact requests are off. Reload the page to try again.'
              : 'Your account areas could not be loaded, so some menus are hidden. Reload the page to try again.',
        }),
      ),
    ),
  );
}
