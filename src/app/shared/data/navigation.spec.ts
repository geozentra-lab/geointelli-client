import {
  NAV,
  bottomBar,
  featureFor,
  isActive,
  moreItems,
  parseUrl,
  publicLinks,
  railGroups,
  shellFor,
  titleFor,
} from './navigation';
import { EntitlementFeatures } from '../../core/models/account';

const labels = (items: { label: string }[]) => items.map((i) => i.label);
const features = (on: Partial<EntitlementFeatures> = {}): EntitlementFeatures => ({
  normalUser: true,
  investment: false,
  realtorCrm: false,
  lender: false,
  administration: false,
  ...on,
});
const HOME = ['Overview', 'Explore', 'For you', 'Compare', 'Studio', 'Saved', 'Alerts'];

describe('Navigation by entitlements (account types)', () => {
  it('puts any professional area or the admin feature in the pro shell; home buyers in public', () => {
    expect(shellFor(features({ lender: true }))).toBe('pro');
    expect(shellFor(features({ realtorCrm: true }))).toBe('pro');
    expect(shellFor(features({ investment: true }))).toBe('pro');
    expect(shellFor(features({ administration: true }))).toBe('pro');
    expect(shellFor(features())).toBe('public');
  });

  it('keeps the home-buyer pages for everyone and adds one section per professional feature', () => {
    expect(railGroups(features({ realtorCrm: true })).map((g) => [g.label, labels(g.items)])).toEqual([
      [null, HOME],
      ['CRM', ['Overview', 'Clients', 'Leads', 'Tasks', 'Deals']],
    ]);
    expect(railGroups(features({ investment: true })).map((g) => [g.label, labels(g.items)])).toEqual([
      [null, HOME],
      ['Investments', ['Overview', 'Portfolio']],
    ]);
    // The backend gives an admin every feature: every section, then Admin.
    const admin = railGroups(
      features({ investment: true, realtorCrm: true, lender: true, administration: true }),
    );
    expect(admin.map((g) => g.label)).toEqual([null, 'Investments', 'CRM', 'Lending', 'Admin']);
    expect(labels(admin.at(-1)!.items)).toEqual([
      'Import jobs',
      'Data quality',
      'Valuations',
      'Role requests',
      'Licenses',
      'Users',
    ]);
  });

  it('shows a pending role as one locked entry in its section, not as a link to the area', () => {
    const [, lending] = railGroups(features(), ['lender']);
    expect(lending.label).toBe('Lending');
    expect(lending.items).toHaveLength(1);
    expect(lending.items[0]).toMatchObject({ locked: true, icon: 'lock' });
    expect(isActive(lending.items[0], parseUrl('/settings'))).toBe(false);
    // Public shell: the locked entry follows the buyer's links; guests have none.
    expect(publicLinks(true, ['investor']).at(-1)).toMatchObject({ label: 'Investments', locked: true });
    expect(labels(publicLinks(false, ['investor']))).toEqual(['Explore', 'Opportunities', 'Compare']);
  });

  it('links lender work to the existing loan-review route with the tab as a query parameter', () => {
    const lending = railGroups(features({ lender: true }))[1].items;
    expect(lending.map((i) => [i.path, i.query?.['tab'] ?? null])).toEqual([
      ['/dashboard/lending', null],
      ['/loan-review', 'pipeline'],
      ['/loan-review', 'applications'],
      ['/loan-review', 'import'],
      ['/loan-review', 'team'],
    ]);
  });

  it('marks the current page, with the first tab standing in for a page opened without one', () => {
    const lender = railGroups(features({ lender: true })).flatMap((g) => g.items);
    const active = (url: string) =>
      lender.filter((i) => isActive(i, parseUrl(url), lender)).map((i) => i.key);
    expect(active('/loan-review')).toEqual(['pipeline']);
    expect(active('/loan-review?tab=team')).toEqual(['team']);
    expect(active('/explore/live')).toEqual(['explore']);
    expect(active('/property/42')).toEqual([]);
    // The home Overview is not active on a professional overview, and the reverse.
    expect(active('/dashboard')).toEqual(['overview']);
    expect(active('/dashboard/lending')).toEqual(['lender-overview']);
    expect(isActive(NAV.leads, parseUrl('/crm/leads?stage=NEW'))).toBe(true);
  });

  it('keeps four items in the phone bar, the own area first, and moves the rest into More', () => {
    const groups = railGroups(features({ lender: true }));
    expect(bottomBar('pro', groups).map((i) => i.key)).toEqual([
      'lender-overview',
      'pipeline',
      'applications',
      'explore',
    ]);
    expect(moreItems('pro', groups, true).map((i) => i.key)).toEqual([
      'overview',
      'opportunities',
      'compare',
      'studio',
      'saved',
      'alerts',
      'lender-import',
      'team',
    ]);
    const buyer = railGroups(features());
    expect(labels(bottomBar('public', buyer))).toEqual(['Explore', 'For you', 'Saved', 'Alerts']);
    expect(labels(moreItems('public', buyer, false))).toEqual(['Overview', 'Compare']);
    expect(labels(moreItems('public', buyer, true))).toEqual(['Overview', 'Compare', 'Studio']);
    expect(labels(publicLinks(false))).toEqual(['Explore', 'Opportunities', 'Compare']);
  });

  it('knows which feature guards each area', () => {
    expect(featureFor('/portfolio')).toBe('investment');
    expect(featureFor('/dashboard/investments')).toBe('investment');
    expect(featureFor('/crm/leads')).toBe('realtorCrm');
    expect(featureFor('/loan-review')).toBe('lender');
    expect(featureFor('/admin/role-requests')).toBe('administration');
    expect(featureFor('/dashboard')).toBeNull();
    expect(featureFor('/opportunities')).toBeNull();
  });

  it('titles the browser tab with the page name from the navigation', () => {
    expect(titleFor(parseUrl('/loan-review?tab=applications'))).toBe('Applications');
    expect(titleFor(parseUrl('/loan-review'))).toBe('Pipeline');
    expect(titleFor(parseUrl('/crm/leads'))).toBe('Leads');
    expect(titleFor(parseUrl('/dashboard/investments'))).toBe('Investments');
    expect(titleFor(parseUrl('/admin/users'))).toBe('Users');
    expect(titleFor(parseUrl('/admin/users/36?email=ana%40example.test'))).toBe('Role history');
    expect(titleFor(parseUrl('/dashboard'))).toBe('Overview');
    expect(titleFor(parseUrl('/onboarding'))).toBe('Choose your account type');
    expect(titleFor(parseUrl('/admin/data-quality#top'))).toBe('Data quality');
    expect(titleFor(parseUrl('/nowhere'))).toBe('Page not found');
  });
});
