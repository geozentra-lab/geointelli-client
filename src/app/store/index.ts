import { ActionReducer, MetaReducer, provideState, provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { EnvironmentProviders, Type } from '@angular/core';
import { UserActions } from './user/user.actions';
import { notificationsReducer } from './notifications/notifications.reducer';
import { NotificationsEffects } from './notifications/notifications.effects';
import { propertyImagesReducer } from './property-images/property-images.reducer';
import { PropertyImagesEffects } from './property-images/property-images.effects';
import { locationsReducer } from './locations/locations.reducer';
import { LocationsEffects } from './locations/locations.effects';
import { propertiesReducer } from './properties/properties.reducer';
import { PropertiesEffects } from './properties/properties.effects';
import { valuationReducer } from './valuation/valuation.reducer';
import { ValuationEffects } from './valuation/valuation.effects';
import { uiReducer } from './ui/ui.reducer';
import { UiEffects } from './ui/ui.effects';
import { userReducer } from './user/user.reducer';
import { UserEffects } from './user/user.effects';
import { favoritesReducer } from './favorites/favorites.reducer';
import { FavoritesEffects } from './favorites/favorites.effects';
import { savedSearchesReducer } from './saved-searches/saved-searches.reducer';
import { SavedSearchesEffects } from './saved-searches/saved-searches.effects';
import { alertsReducer } from './alerts/alerts.reducer';
import { AlertsEffects } from './alerts/alerts.effects';
import { portfolioReducer } from './portfolio/portfolio.reducer';
import { PortfolioEffects } from './portfolio/portfolio.effects';
import { catalogReducer } from './catalog/catalog.reducer';
import { CatalogEffects } from './catalog/catalog.effects';
import { comparablesReducer } from './comparables/comparables.reducer';
import { ComparablesEffects } from './comparables/comparables.effects';
import { mortgageReducer } from './mortgage/mortgage.reducer';
import { MortgageEffects } from './mortgage/mortgage.effects';
import { recommendationsReducer } from './recommendations/recommendations.reducer';
import { RecommendationsEffects } from './recommendations/recommendations.effects';
import { propertyCompareReducer } from './property-compare/property-compare.reducer';
import { PropertyCompareEffects } from './property-compare/property-compare.effects';
import { affordabilityReducer } from './affordability/affordability.reducer';
import { AffordabilityEffects } from './affordability/affordability.effects';
import { dashboardReducer } from './dashboard/dashboard.reducer';
import { DashboardEffects } from './dashboard/dashboard.effects';
import { notificationPreferencesReducer } from './notification-preferences/notification-preferences.reducer';
import { NotificationPreferencesEffects } from './notification-preferences/notification-preferences.effects';
import { crmReducer } from './crm/crm.reducer';
import { CrmEffects } from './crm/crm.effects';
import { contactRequestsReducer } from './contact-requests/contact-requests.reducer';
import { ContactRequestsEffects } from './contact-requests/contact-requests.effects';
import { importJobsReducer } from './import-jobs/import-jobs.reducer';
import { ImportJobsEffects } from './import-jobs/import-jobs.effects';
import { lenderReducer } from './lender/lender.reducer';
import { LenderEffects } from './lender/lender.effects';
import { opportunitiesReducer } from './opportunities/opportunities.reducer';
import { OpportunitiesEffects } from './opportunities/opportunities.effects';
import { realtorDashboardReducer } from './realtor-dashboard/realtor-dashboard.reducer';
import { RealtorDashboardEffects } from './realtor-dashboard/realtor-dashboard.effects';
import { investorDashboardReducer } from './investor-dashboard/investor-dashboard.reducer';
import { InvestorDashboardEffects } from './investor-dashboard/investor-dashboard.effects';
import { lenderDashboardReducer } from './lender-dashboard/lender-dashboard.reducer';
import { LenderDashboardEffects } from './lender-dashboard/lender-dashboard.effects';
import { investmentReducer } from './investment/investment.reducer';
import { InvestmentEffects } from './investment/investment.effects';
import { propertyInsightsReducer } from './property-insights/property-insights.reducer';
import { PropertyInsightsEffects } from './property-insights/property-insights.effects';
import { realtorLicenseReducer } from './realtor-license/realtor-license.reducer';
import { RealtorLicenseEffects } from './realtor-license/realtor-license.effects';
import { adminReducer } from './admin/admin.reducer';
import { AdminEffects } from './admin/admin.effects';

/**
 * Slices the app shell or the Workspace facade read on every page, or that several lazy routes
 * share. They load with the shell.
 */
export const appReducers = {
  notifications: notificationsReducer,
  user: userReducer,
  catalog: catalogReducer,
  favorites: favoritesReducer,
  savedSearches: savedSearchesReducer,
  alerts: alertsReducer,
  portfolio: portfolioReducer,
  propertyImages: propertyImagesReducer,
  locations: locationsReducer,
  properties: propertiesReducer,
  valuation: valuationReducer,
  ui: uiReducer,
  propertyCompare: propertyCompareReducer,
  // Shared by the dashboard and the page that owns them (Opportunities, Investment Studio).
  recommendations: recommendationsReducer,
  opportunities: opportunitiesReducer,
  affordability: affordabilityReducer,
  mortgage: mortgageReducer,
};
const appEffects = [
  NotificationsEffects,
  UserEffects,
  CatalogEffects,
  FavoritesEffects,
  SavedSearchesEffects,
  AlertsEffects,
  PortfolioEffects,
  PropertiesEffects,
  ValuationEffects,
  UiEffects,
  LocationsEffects,
  PropertyImagesEffects,
  PropertyCompareEffects,
  RecommendationsEffects,
  OpportunitiesEffects,
  AffordabilityEffects,
  MortgageEffects,
];

interface FeatureStore {
  // Reducer state types are contravariant, so a shared map needs `any` to hold any slice.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reducer: ActionReducer<any>;
  effects: Type<unknown>;
}
/**
 * Slices used by exactly one feature. Each is registered by its route's `providers` so its code
 * ships in that route's chunk, not the initial bundle. Register a slice on one route object only
 * (use a parent route with `children` for path variants): a second registration would create a
 * second effects instance and duplicate its requests.
 */
export const featureStores = {
  comparables: { reducer: comparablesReducer, effects: ComparablesEffects },
  dashboard: { reducer: dashboardReducer, effects: DashboardEffects },
  realtorDashboard: { reducer: realtorDashboardReducer, effects: RealtorDashboardEffects },
  investorDashboard: { reducer: investorDashboardReducer, effects: InvestorDashboardEffects },
  lenderDashboard: { reducer: lenderDashboardReducer, effects: LenderDashboardEffects },
  investment: { reducer: investmentReducer, effects: InvestmentEffects },
  propertyInsights: { reducer: propertyInsightsReducer, effects: PropertyInsightsEffects },
  realtorLicense: { reducer: realtorLicenseReducer, effects: RealtorLicenseEffects },
  admin: { reducer: adminReducer, effects: AdminEffects },
  notificationPreferences: {
    reducer: notificationPreferencesReducer,
    effects: NotificationPreferencesEffects,
  },
  crm: { reducer: crmReducer, effects: CrmEffects },
  contactRequests: { reducer: contactRequestsReducer, effects: ContactRequestsEffects },
  importJobs: { reducer: importJobsReducer, effects: ImportJobsEffects },
  lender: { reducer: lenderReducer, effects: LenderEffects },
} satisfies Record<string, FeatureStore>;
export type FeatureStoreKey = keyof typeof featureStores;

const resetOnSignOut: MetaReducer = (reducer) => (state, action) =>
  reducer(action.type === UserActions.signedOut.type ? undefined : state, action);

export const provideAppStore = () => [
  provideStore(appReducers, { metaReducers: [resetOnSignOut] }),
  provideEffects(...appEffects),
];

/** Route providers for one or more feature slices; see {@link featureStores}. */
export const provideFeatureStore = (...keys: FeatureStoreKey[]): EnvironmentProviders[] =>
  keys.flatMap((key) => [
    provideState(key, featureStores[key].reducer),
    provideEffects(featureStores[key].effects),
  ]);

/** Every slice at once, for specs that render features without routing. */
export const provideTestStore = () => [
  provideStore(
    {
      ...appReducers,
      ...Object.fromEntries(
        Object.entries(featureStores).map(([key, store]) => [key, store.reducer]),
      ),
    },
    { metaReducers: [resetOnSignOut] },
  ),
  provideEffects(...appEffects, ...Object.values(featureStores).map((store) => store.effects)),
];
export type { AppState } from './app.state';
