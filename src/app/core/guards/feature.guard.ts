import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take, tap } from 'rxjs';
import { FeatureKey } from '../models/account';
import { KeycloakService } from '../auth/keycloak.service';
import { AccountActions } from '../../store/account/account.actions';
import { selectAccount } from '../../store/account/account.selectors';

/**
 * Hides and blocks a professional area whose feature flag (entitlements.features) is off. The
 * backend enforces the same rules; this only spares the user an area that would answer 403.
 * - Guests pass: each page asks them to sign in.
 * - A signed-in account waits for its entitlements (read on sign-in and after every token refresh),
 *   then enters, or goes to "No access", which says why and what to do.
 * - If the entitlements can't be read, the page opens and the backend decides.
 */
export const featureGuard =
  (feature: FeatureKey): CanActivateFn =>
  () => {
    if (!inject(KeycloakService).isLoggedIn()) return true;
    const store = inject(Store);
    const router = inject(Router);
    return store.select(selectAccount).pipe(
      tap((s) => {
        const e = s.entitlements;
        if (!e.value && !e.loading && !e.error) store.dispatch(AccountActions.loadEntitlements());
      }),
      filter((s) => !!s.entitlements.value || !!s.entitlements.error),
      take(1),
      map(
        (s) =>
          !s.entitlements.value ||
          s.entitlements.value.features[feature] ||
          router.createUrlTree(['/no-access'], { queryParams: { area: feature } }),
      ),
    );
  };
