import { selectNotifications } from '../../store/notifications/notifications.selectors';
import { Injectable, inject, computed } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectUser, selectUserState } from '../../store/user/user.selectors';
import { selectCatalog, selectVisibleProperties } from '../../store/catalog/catalog.selectors';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import {
  selectVisibleFavorites,
  selectFavoriteState,
} from '../../store/favorites/favorites.selectors';
import { favoritesActions } from '../../store/favorites/favorites.actions';
import {
  selectSavedSearches,
  selectSavedSearchesState,
} from '../../store/saved-searches/saved-searches.selectors';
import { savedSearchesActions } from '../../store/saved-searches/saved-searches.actions';
import { selectAlerts, selectAlertsState } from '../../store/alerts/alerts.selectors';
import { selectPortfolioState, selectPortfolios } from '../../store/portfolio/portfolio.selectors';
import { selectUi } from '../../store/ui/ui.selectors';
import { ToastKind, UiActions } from '../../store/ui/ui.actions';
import { UserActions } from '../../store/user/user.actions';
import { AccountActions } from '../../store/account/account.actions';
import {
  selectAccount,
  selectAccountType,
  selectFeatures,
  selectPendingRoles,
} from '../../store/account/account.selectors';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { PropertySearchRequest } from '../../core/models/api';
@Injectable({ providedIn: 'root' })
export class Workspace {
  readonly store = inject(Store);
  readonly auth = inject(KeycloakService);
  readonly user = this.store.selectSignal(selectUser);
  readonly account = this.store.selectSignal(selectUserState);
  /** Account type, features and onboarding (backend SCRUM-204): from the access token's roles. */
  readonly access = this.store.selectSignal(selectAccount);
  readonly features = this.store.selectSignal(selectFeatures);
  /** investor, realtor or lender; null is a home buyer. */
  readonly accountType = this.store.selectSignal(selectAccountType);
  readonly pendingRoles = this.store.selectSignal(selectPendingRoles);
  readonly notifications = this.store.selectSignal(selectNotifications);
  readonly ui = this.store.selectSignal(selectUi);
  readonly catalog = this.store.selectSignal(selectCatalog);
  readonly properties = this.store.selectSignal(selectVisibleProperties);
  readonly favorites = this.store.selectSignal(selectVisibleFavorites);
  readonly favoriteState = this.store.selectSignal(selectFavoriteState);
  readonly searches = this.store.selectSignal(selectSavedSearches);
  readonly searchState = this.store.selectSignal(selectSavedSearchesState);
  readonly alerts = this.store.selectSignal(selectAlerts);
  readonly alertState = this.store.selectSignal(selectAlertsState);
  readonly portfolio = this.store.selectSignal(selectPortfolioState);
  readonly portfolios = this.store.selectSignal(selectPortfolios);
  readonly savedHomes = computed(() =>
    this.favorites()
      .map((f) => this.catalog().entities[f.propertyId])
      .filter((p) => p !== undefined),
  );
  get homes() {
    return this.properties();
  }
  home(id: string | number | null) {
    return id === null ? undefined : this.catalog().entities[Number(id)];
  }
  readonly favoriteIds = computed(() => new Set(this.favorites().map((f) => f.propertyId)));
  isSaved(id: string | number) {
    return this.favoriteIds().has(Number(id));
  }
  toggleSave(id: string | number) {
    const propertyId = Number(id);
    if (
      !Number.isSafeInteger(propertyId) ||
      propertyId <= 0 ||
      this.favoriteState().pending.includes(propertyId)
    )
      return;
    if (!this.requireAccount('save properties')) return;
    if (this.favoriteState().loading || !this.favoriteState().loaded) {
      this.toast('Your favorites are still syncing. Please try again shortly.');
      return;
    }
    this.store.dispatch(
      this.isSaved(id)
        ? favoritesActions.remove({ propertyId })
        : favoritesActions.add({ propertyId }),
    );
  }
  dismissToast() {
    this.store.dispatch(UiActions.clearToast({ message: this.ui().toast }));
  }
  toast(message: string, kind: ToastKind = 'info') {
    this.store.dispatch(UiActions.toast({ message, kind }));
  }
  search(query: Partial<PropertySearchRequest>, resetPage = true) {
    const merged = { ...this.catalog().query, ...query };
    this.store.dispatch(
      CatalogActions.search({
        query: { ...merged, page: resetPage ? 0 : (merged.page ?? 0), size: 20 },
      }),
    );
  }
  saveSearch(name: string) {
    if (this.searchState().saving || !name.trim() || !this.requireAccount('save searches')) return;
    const { page, size, ...filters } = this.catalog().query;
    this.store.dispatch(
      savedSearchesActions.create({ request: { name, filters, cadence: 'DAILY', paused: false } }),
    );
  }
  signIn() {
    void this.auth
      .login()
      .catch(() =>
        this.toast(
          this.auth.unavailable
            ? 'Sign-in is temporarily unavailable. You can keep browsing as a guest; reload to try again.'
            : 'Sign-in could not be opened. Please try again.',
          'error',
        ),
      );
  }
  signUp() {
    void this.auth
      .register()
      .catch(() =>
        this.toast(
          this.auth.unavailable
            ? 'Account creation is temporarily unavailable. You can keep browsing as a guest; reload to try again.'
            : 'The account page could not be opened. Try again.',
          'error',
        ),
      );
  }
  requireAccount(action = 'save changes') {
    if (!this.auth.isLoggedIn()) {
      this.toast('Sign in to ' + action + '. You can keep browsing as a guest.');
      return false;
    }
    return true;
  }
  retryFavorite() {
    const failure = this.favoriteState().lastFailure;
    if (failure) {
      if (this.requireAccount('update favorites'))
        this.store.dispatch(
          failure.desired
            ? favoritesActions.add({ propertyId: failure.propertyId })
            : favoritesActions.remove({ propertyId: failure.propertyId }),
        );
    } else this.store.dispatch(favoritesActions.load());
  }

  signOut() {
    void this.auth
      .logout()
      .catch(() => this.toast('Sign-out could not finish. Please try again.', 'error'));
  }
  /** The profile, and the entitlements (account type, features, onboarding), after sign-in. */
  reloadUser() {
    if (!this.auth.isLoggedIn()) return;
    this.store.dispatch(UserActions.load());
    this.store.dispatch(AccountActions.loadEntitlements());
  }
}
