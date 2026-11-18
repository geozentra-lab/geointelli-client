import { Routes } from '@angular/router';
import { provideFeatureStore } from './store';

// Feature-only store slices are provided on their route so they load with that page. Path
// variants of one page sit under a component-less parent so the slice registers exactly once.
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    providers: provideFeatureStore(
      'dashboard',
      'realtorDashboard',
      'investorDashboard',
      'lenderDashboard',
    ),
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'explore/live',
    loadComponent: () => import('./features/explore/live-map/map').then((m) => m.Map),
  },
  {
    path: 'explore',
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
    providers: provideFeatureStore('notificationPreferences', 'realtorLicense'),
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'crm',
    providers: provideFeatureStore('crm'),
    children: [
      { path: '', loadComponent: () => import('./features/crm/crm').then((m) => m.Crm) },
      { path: ':tab', loadComponent: () => import('./features/crm/crm').then((m) => m.Crm) },
    ],
  },
  {
    path: 'loan-review',
    providers: provideFeatureStore('lender'),
    loadComponent: () => import('./features/loan-review/loan-review').then((m) => m.LoanReview),
  },
  {
    path: 'admin',
    providers: provideFeatureStore('importJobs', 'admin'),
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
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
