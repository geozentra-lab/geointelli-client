import { Routes } from '@angular/router';
import { provideFeatureStore } from './store';
import { featureGuard } from './core/guards/feature.guard';

// Feature-only store slices are provided on their route so they load with that page. Path
// variants of one page sit under a component-less parent so the slice registers exactly once.
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    // The home overview for every account; each professional area's overview under it, guarded by
    // its feature (entitlements, backend SCRUM-204).
    path: 'dashboard',
    providers: provideFeatureStore(
      'dashboard',
      'realtorDashboard',
      'investorDashboard',
      'lenderDashboard',
    ),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'investments',
        canActivate: [featureGuard('investment')],
        loadComponent: () =>
          import('./features/dashboard/investor-dashboard/investor-dashboard').then(
            (m) => m.InvestorDashboard,
          ),
      },
      {
        path: 'crm',
        canActivate: [featureGuard('realtorCrm')],
        loadComponent: () =>
          import('./features/dashboard/realtor-dashboard/realtor-dashboard').then(
            (m) => m.RealtorDashboard,
          ),
      },
      {
        path: 'lending',
        canActivate: [featureGuard('lender')],
        loadComponent: () =>
          import('./features/dashboard/lender-dashboard/lender-dashboard').then(
            (m) => m.LenderDashboard,
          ),
      },
    ],
  },
  {
    // A new account chooses its account type here first (the shell sends it), once.
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding),
  },
  {
    path: 'no-access',
    loadComponent: () => import('./features/no-access/no-access').then((m) => m.NoAccess),
  },
  {
    path: 'explore/live',
    loadComponent: () => import('./features/explore/live-map/map').then((m) => m.Map),
  },
  {
    path: 'explore',
    providers: provideFeatureStore('exploreMap'),
    loadComponent: () => import('./features/explore/explore').then((m) => m.Explore),
  },
  { path: 'map', redirectTo: 'explore/live', pathMatch: 'full' },
  {
    path: 'property/:id',
    providers: provideFeatureStore('contactRequests', 'propertyInsights'),
    loadComponent: () =>
      import('./features/property-detail/property-detail').then((m) => m.PropertyDetail),
  },
  {
    path: 'compare',
    providers: provideFeatureStore('comparables'),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/compare/compare').then((m) => m.Compare),
      },
      {
        path: ':id',
        loadComponent: () => import('./features/compare/compare').then((m) => m.Compare),
      },
    ],
  },
  {
    path: 'investment-studio',
    providers: provideFeatureStore('investment'),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/investment-studio/investment-studio').then((m) => m.InvestmentStudio),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/investment-studio/investment-studio').then((m) => m.InvestmentStudio),
      },
    ],
  },
  { path: 'analysis', redirectTo: 'investment-studio', pathMatch: 'full' },
  { path: 'analysis/:id', redirectTo: 'investment-studio/:id', pathMatch: 'full' },
  {
    path: 'opportunities',
    loadComponent: () =>
      import('./features/opportunities/opportunities').then((m) => m.Opportunities),
  },
  {
    path: 'portfolio',
    canActivate: [featureGuard('investment')],
    loadComponent: () => import('./features/portfolio/portfolio').then((m) => m.Portfolio),
  },
  { path: 'saved', loadComponent: () => import('./features/saved/saved').then((m) => m.Saved) },
  { path: 'alerts', loadComponent: () => import('./features/alerts/alerts').then((m) => m.Alerts) },
  {
    path: 'assistant',
    loadComponent: () => import('./features/assistant/assistant').then((m) => m.Assistant),
  },
  {
    path: 'assistant/:id',
    loadComponent: () => import('./features/assistant/assistant').then((m) => m.Assistant),
  },
  {
    path: 'settings',
    providers: provideFeatureStore('notificationPreferences'),
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'crm',
    providers: provideFeatureStore('crm'),
    canActivate: [featureGuard('realtorCrm')],
    children: [
      { path: '', loadComponent: () => import('./features/crm/crm').then((m) => m.Crm) },
      { path: ':tab', loadComponent: () => import('./features/crm/crm').then((m) => m.Crm) },
    ],
  },
  {
    path: 'loan-review',
    providers: provideFeatureStore('lender'),
    canActivate: [featureGuard('lender')],
    loadComponent: () => import('./features/loan-review/loan-review').then((m) => m.LoanReview),
  },
  {
    path: 'admin',
    providers: provideFeatureStore('importJobs', 'admin', 'adminAccess'),
    canActivate: [featureGuard('administration')],
    children: [
      { path: '', redirectTo: 'import-jobs', pathMatch: 'full' },
      {
        path: 'import-jobs',
        loadComponent: () => import('./features/admin/import-jobs').then((m) => m.ImportJobs),
      },
      {
        path: 'data-quality',
        loadComponent: () => import('./features/admin/data-quality').then((m) => m.DataQuality),
      },
      {
        path: 'valuations',
        loadComponent: () =>
          import('./features/admin/valuation-operations').then((m) => m.ValuationOperations),
      },
      // Account types (SCRUM-204): the approval queues and one user's role history.
      {
        path: 'role-requests',
        loadComponent: () => import('./features/admin/role-requests').then((m) => m.RoleRequests),
      },
      {
        path: 'realtor-licenses',
        loadComponent: () =>
          import('./features/admin/realtor-licenses').then((m) => m.RealtorLicenses),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/admin/user-roles').then((m) => m.UserRoles),
      },
      {
        path: 'users/:userId',
        loadComponent: () => import('./features/admin/user-roles').then((m) => m.UserRoles),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
