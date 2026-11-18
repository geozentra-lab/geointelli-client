import { NotificationMenu } from './shared/components/notification-menu';
import { NetworkStatus } from './shared/components/network-status';
import { CompareTray } from './shared/components/compare-tray';
import { Title } from '@angular/platform-browser';
import { effect } from '@angular/core';
import { Component, Injector, afterNextRender, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Icon } from './shared/components/icon/icon';
import { Workspace } from './shared/data/workspace';
import { UserActions } from './store/user/user.actions';
import { Persona } from './store/user/user.model';
import { selectCompareSelection } from './store/property-compare/property-compare.selectors';

const NAV_KEY = 'gz.navHidden';
function readNavHidden() {
  try {
    return localStorage.getItem(NAV_KEY) === '1';
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-root',
  imports: [
    NotificationMenu,
    NetworkStatus,
    CompareTray,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Icon,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown.escape)': 'mobileOpen.set(false)',
    '[class.navhidden]': 'navHidden()',
  },
})
export class App {
  ngOnInit() {
    this.w.reloadUser();
  }
  readonly w = inject(Workspace);
  private router = inject(Router);
  private pageTitle = inject(Title);
  constructor() {
    effect(() => this.pageTitle.setTitle(this.title() + ' | GeoZentra'));
    // The root component lives as long as the page, so this listener never needs removing.
    this.phoneQuery?.addEventListener('change', (e) => this.isPhone.set(e.matches));
  }
  private readonly injector = inject(Injector);
  readonly mobileOpen = signal(false);
  /** Desktop/tablet: the sidebar can be hidden to give pages the full width; remembered per browser. */
  readonly navHidden = signal(readNavHidden());
  private readonly phoneQuery =
    typeof matchMedia === 'function' ? matchMedia('(max-width: 650px)') : null;
  /** Tracks the phone breakpoint so the toggles swap when the window is resized across it. */
  private readonly isPhone = signal(this.phoneQuery?.matches ?? false);
  /** Whether the navigation is currently showing; decides which toggle button is rendered. */
  navShown() {
    return this.isPhone() ? this.mobileOpen() : !this.navHidden();
  }
  toggleNav() {
    // The button pressed disappears with the change, so hand focus to the one that replaces it.
    const next = this.navShown() ? 'nav-toggle-top' : 'nav-toggle-inside';
    afterNextRender(() => document.getElementById(next)?.focus(), { injector: this.injector });
    if (this.isPhone()) {
      this.mobileOpen.update((open) => !open);
      return;
    }
    const hidden = !this.navHidden();
    this.navHidden.set(hidden);
    try {
      localStorage.setItem(NAV_KEY, hidden ? '1' : '0');
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
    // Leaflet maps only re-measure on window resize; let them refit once the sidebar has moved.
    setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
  }
  readonly year = new Date().getFullYear();
  readonly personas: Persona[] = ['Buyer', 'Investor', 'Realtor', 'Lender'];
  readonly nav = [
    { path: 'dashboard', title: 'Overview', icon: 'grid' },
    { path: 'explore', title: 'Explore properties', icon: 'search' },
    { path: 'opportunities', title: 'Opportunities', icon: 'chart' },
    { path: 'compare', title: 'Compare', icon: 'compare' },
    { path: 'investment-studio', title: 'Investment studio', icon: 'wallet' },
    { path: 'portfolio', title: 'Portfolio', icon: 'brief' },
    { path: 'saved', title: 'Saved & searches', icon: 'heart' },
    { path: 'alerts', title: 'Alerts', icon: 'bell' },
    { path: 'crm', title: 'Clients & deals', icon: 'user' },
    { path: 'loan-review', title: 'Loan review', icon: 'layers' },
    { path: 'assistant', title: 'AIZentra', icon: 'spark', soon: true },
  ];
  readonly adminNav = [
    { path: 'import-jobs', title: 'Import jobs', icon: 'grid' },
    { path: 'data-quality', title: 'Data quality', icon: 'check' },
    { path: 'valuations', title: 'Valuation operations', icon: 'chart' },
  ];
  readonly mobileNav = [
    { path: 'dashboard', label: 'Home', icon: 'grid' },
    { path: 'explore', label: 'Explore', icon: 'search' },
    { path: 'opportunities', label: 'For you', icon: 'chart' },
    { path: 'saved', label: 'Saved', icon: 'heart' },
  ];
  /** The current path without query or fragment, e.g. "/admin/data-quality". */
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => {
        this.mobileOpen.set(false);
        return (e as NavigationEnd).urlAfterRedirects.split(/[?#]/)[0];
      }),
    ),
    { initialValue: '/dashboard' },
  );
  /** The first path segment: the section of the app the page belongs to. */
  readonly route = computed(() => this.path().split('/')[1]);
  private readonly compareSelection = this.w.store.selectSignal(selectCompareSelection);
  /** The compare tray floats at the bottom edge; toasts move up so neither covers the other. */
  readonly trayShown = computed(
    () => this.route() !== 'compare' && this.compareSelection().length > 0,
  );
  readonly title = computed(
    () =>
      this.nav.find((n) => n.path === this.route())?.title ??
      (this.route() === 'settings'
        ? 'Profile & preferences'
        : this.route() === 'admin'
          ? (this.adminNav.find((a) => a.path === this.path().split('/')[2])?.title ?? 'Admin')
          : this.route() === 'property'
            ? 'Property intelligence'
            : 'Page not found'),
  );
  // Plain (change) binding keeps @angular/forms out of the initial bundle; the select snaps back to
  // the stored persona and only moves once the save succeeds.
  changePersona(control: HTMLSelectElement) {
    const role = control.value as Persona;
    const current = this.w.user().role;
    control.value = current;
    if (!this.personas.includes(role) || role === current || this.w.account().savingProfile) return;
    this.w.store.dispatch(UserActions.changePersona({ role }));
  }
}
