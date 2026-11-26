import {
  AREA_LABELS,
  EntitlementFeatures,
  FeatureKey,
  ProfessionalRole,
} from '../../core/models/account';

/**
 * Navigation for the two shells (DESIGN.md §5), from the account's entitlements (backend SCRUM-204).
 * Every account has the home-buyer pages; each professional feature adds its own section
 * (Investments, CRM, Lending), and the admin feature adds Admin. A role waiting for approval shows
 * its section as one locked entry. Hidden areas are also blocked by their route guard.
 */
export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  /** Query parameters the link sets, e.g. the loan-review tab. */
  query?: Record<string, string>;
  /** Waiting for an admin's approval: shown with "Waiting for approval", not a link. */
  locked?: boolean;
}
export interface NavGroup {
  key: string;
  /** The section's name over its items; null for the home-buyer pages. */
  label: string | null;
  items: NavItem[];
}
export type ShellKind = 'pro' | 'public';

const item = (
  key: string,
  label: string,
  icon: string,
  path: string,
  query?: Record<string, string>,
): NavItem => ({ key, label, icon, path, query });

export const NAV = {
  overview: item('overview', 'Overview', 'grid', '/dashboard'),
  explore: item('explore', 'Explore', 'search', '/explore'),
  compare: item('compare', 'Compare', 'compare', '/compare'),
  alerts: item('alerts', 'Alerts', 'bell', '/alerts'),
  saved: item('saved', 'Saved', 'heart', '/saved'),
  settings: item('settings', 'Settings', 'settings', '/settings'),
  // "For you" is the existing short label for Opportunities.
  forYou: item('opportunities', 'For you', 'target', '/opportunities'),
  opportunities: item('opportunities', 'Opportunities', 'target', '/opportunities'),
  studio: item('studio', 'Studio', 'studio', '/investment-studio'),
  portfolio: item('portfolio', 'Portfolio', 'brief', '/portfolio'),
  // Each professional area opens on its own overview.
  investorOverview: item('investor-overview', 'Overview', 'grid', '/dashboard/investments'),
  realtorOverview: item('realtor-overview', 'Overview', 'grid', '/dashboard/crm'),
  lenderOverview: item('lender-overview', 'Overview', 'grid', '/dashboard/lending'),
  // Lender: today's loan-review tabs, selected by the `tab` query parameter.
  pipeline: item('pipeline', 'Pipeline', 'pipeline', '/loan-review', { tab: 'pipeline' }),
  applications: item('applications', 'Applications', 'applications', '/loan-review', { tab: 'applications' }),
  lenderImport: item('lender-import', 'Import', 'import', '/loan-review', { tab: 'import' }),
  team: item('team', 'Team', 'team', '/loan-review', { tab: 'team' }),
  // Realtor: the existing crm/:tab routes.
  clients: item('clients', 'Clients', 'clients', '/crm/clients'),
  leads: item('leads', 'Leads', 'leads', '/crm/leads'),
  tasks: item('tasks', 'Tasks', 'tasks', '/crm/tasks'),
  deals: item('deals', 'Deals', 'deals', '/crm/deals'),
  // Admin feature.
  importJobs: item('import-jobs', 'Import jobs', 'database', '/admin/import-jobs'),
  dataQuality: item('data-quality', 'Data quality', 'quality', '/admin/data-quality'),
  valuations: item('valuations', 'Valuations', 'chart', '/admin/valuations'),
  roleRequests: item('role-requests', 'Role requests', 'user-check', '/admin/role-requests'),
  realtorLicenses: item('realtor-licenses', 'Licenses', 'badge', '/admin/realtor-licenses'),
  users: item('users', 'Users', 'user', '/admin/users'),
} as const;

/** The home-buyer pages: every account has them, whatever else it does. */
const HOME_ITEMS: NavItem[] = [
  NAV.overview,
  NAV.explore,
  NAV.forYou,
  NAV.compare,
  NAV.studio,
  NAV.saved,
  NAV.alerts,
];
/** One section per professional feature, in this order. */
export const AREAS: { role: ProfessionalRole; key: string; feature: FeatureKey; items: NavItem[] }[] = [
  { role: 'investor', key: 'investments', feature: 'investment', items: [NAV.investorOverview, NAV.portfolio] },
  {
    role: 'realtor',
    key: 'crm',
    feature: 'realtorCrm',
    items: [NAV.realtorOverview, NAV.clients, NAV.leads, NAV.tasks, NAV.deals],
  },
  {
    role: 'lender',
    key: 'lending',
    feature: 'lender',
    items: [NAV.lenderOverview, NAV.pipeline, NAV.applications, NAV.lenderImport, NAV.team],
  },
];
const ADMIN_ITEMS: NavItem[] = [
  NAV.importJobs,
  NAV.dataQuality,
  NAV.valuations,
  NAV.roleRequests,
  NAV.realtorLicenses,
  NAV.users,
];
/** A section waiting for approval: one entry, not a link, that says so. */
const lockedEntry = (role: ProfessionalRole, key: string): NavItem => ({
  key: key + '-locked',
  label: AREA_LABELS[role],
  icon: 'lock',
  path: '/settings',
  locked: true,
});

/** The feature a path belongs to (its area's guard); null for the pages every account has. */
export function featureFor(path: string): FeatureKey | null {
  const within = (p: string) => path === p || path.startsWith(p + '/');
  if (within('/portfolio') || within('/dashboard/investments')) return 'investment';
  if (within('/crm') || within('/dashboard/crm')) return 'realtorCrm';
  if (within('/loan-review') || within('/dashboard/lending')) return 'lender';
  if (within('/admin')) return 'administration';
  return null;
}

/** The pro shell (navy rail) for any account with a professional area or the admin feature. */
export function shellFor(f: EntitlementFeatures): ShellKind {
  return f.investment || f.realtorCrm || f.lender || f.administration ? 'pro' : 'public';
}

/**
 * The rail: the home-buyer pages, then each professional area the features allow (or, while its
 * role is pending, one locked entry), then Admin. Nothing is taken away by a professional role.
 */
export function railGroups(
  f: EntitlementFeatures,
  pending: readonly ProfessionalRole[] = [],
): NavGroup[] {
  const groups: NavGroup[] = [{ key: 'home', label: null, items: HOME_ITEMS }];
  for (const area of AREAS) {
    const label = AREA_LABELS[area.role];
    if (f[area.feature]) groups.push({ key: area.key, label, items: area.items });
    else if (pending.includes(area.role))
      groups.push({ key: area.key, label, items: [lockedEntry(area.role, area.key)] });
  }
  if (f.administration) groups.push({ key: 'admin', label: 'Admin', items: ADMIN_ITEMS });
  return groups;
}

/**
 * Public top bar links: Explore, Opportunities, Compare, then Studio, Saved and Alerts when signed
 * in, and a locked entry for a role waiting for approval.
 */
export function publicLinks(signedIn: boolean, pending: readonly ProfessionalRole[] = []): NavItem[] {
  if (!signedIn) return [NAV.explore, NAV.opportunities, NAV.compare];
  const locked = AREAS.filter((a) => pending.includes(a.role)).map((a) => lockedEntry(a.role, a.key));
  return [NAV.explore, NAV.opportunities, NAV.compare, NAV.studio, NAV.saved, NAV.alerts, ...locked];
}

/**
 * Phones: four items in the bottom bar, the rest in the More sheet. Public: the buyer's four. Pro:
 * the account's own area first (up to three), then Explore.
 */
export function bottomBar(shell: ShellKind, groups: NavGroup[]): NavItem[] {
  if (shell === 'public') return [NAV.explore, NAV.forYou, NAV.saved, NAV.alerts];
  const own = groups
    .filter((g) => g.key !== 'home')
    .flatMap((g) => g.items)
    .filter((i) => !i.locked);
  const items = own.length
    ? [...own.slice(0, 3), NAV.explore]
    : groups.flatMap((g) => g.items).filter((i) => !i.locked).slice(0, 4);
  return items;
}
export function moreItems(shell: ShellKind, groups: NavGroup[], signedIn: boolean): NavItem[] {
  const shown = new Set(bottomBar(shell, groups).map((i) => i.key));
  const all = groups.flatMap((g) => g.items).filter((i) => signedIn || i.key !== NAV.studio.key);
  return all.filter((i) => !shown.has(i.key));
}

/** The current location: path without query or fragment, plus its query parameters. */
export interface Here {
  path: string;
  query: Record<string, string>;
}
export function parseUrl(url: string): Here {
  const [path, rest = ''] = url.split('?');
  const query: Record<string, string> = {};
  new URLSearchParams(rest.split('#')[0]).forEach((v, k) => (query[k] = v));
  return { path: path.split('#')[0] || '/', query };
}
/**
 * Whether a nav item is the current page. Sections match their sub-paths (/explore/live is
 * Explore). Items that set a query match on it; the first tab of a page (no query yet) counts as
 * its default.
 */
export function isActive(nav: NavItem, here: Here, siblings: readonly NavItem[] = []): boolean {
  if (nav.locked) return false;
  // Overview is the home page only, not the professional overviews under it.
  if (nav.path === '/dashboard') return here.path === '/dashboard';
  const inSection = here.path === nav.path || here.path.startsWith(nav.path + '/');
  if (!inSection) return false;
  if (!nav.query) return true;
  const [key, value] = Object.entries(nav.query)[0];
  if (here.query[key] !== undefined) return here.query[key] === value;
  const first = siblings.find((s) => s.path === nav.path && s.query);
  return first?.key === nav.key;
}

const TITLES: [string, string][] = [
  ['/dashboard/investments', 'Investments'],
  ['/dashboard/crm', 'CRM'],
  ['/dashboard/lending', 'Lending'],
  ['/dashboard', 'Overview'],
  ['/onboarding', 'Choose your account type'],
  ['/no-access', 'No access'],
  ['/admin/role-requests', 'Role requests'],
  ['/admin/realtor-licenses', 'Realtor licenses'],
  ['/admin/users', 'Users'],
  ['/explore/live', 'Live map'],
  ['/explore', 'Explore'],
  ['/property', 'Property'],
  ['/compare', 'Compare'],
  ['/investment-studio', 'Investment studio'],
  ['/opportunities', 'Opportunities'],
  ['/portfolio', 'Portfolio'],
  ['/saved', 'Saved'],
  ['/alerts', 'Alerts'],
  ['/assistant', 'Assistant'],
  ['/settings', 'Settings'],
  ['/crm/clients', 'Clients'],
  ['/crm/leads', 'Leads'],
  ['/crm/tasks', 'Tasks'],
  ['/crm/deals', 'Deals'],
  ['/crm', 'Clients and deals'],
  ['/loan-review', 'Loan review'],
  ['/admin/import-jobs', 'Import jobs'],
  ['/admin/data-quality', 'Data quality'],
  ['/admin/valuations', 'Valuations'],
];
/** The browser tab title for a path: the page's name as it appears in the navigation. */
export function titleFor(here: Here): string {
  if (here.path === '/loan-review') {
    const tab = [NAV.pipeline, NAV.applications, NAV.lenderImport, NAV.team].find(
      (t) => t.query!['tab'] === here.query['tab'],
    );
    return tab?.label ?? 'Pipeline';
  }
  // Users is the search; one user's page under it is their role history.
  if (here.path.startsWith('/admin/users/')) return 'Role history';
  return TITLES.find(([p]) => here.path === p || here.path.startsWith(p + '/'))?.[1] ?? 'Page not found';
}
