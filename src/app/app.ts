import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { revealWhenFirstPageIsDrawn } from './core/boot-splash';
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import type { Event as RouterEvent } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NotificationMenu } from './shared/components/notification-menu';
import { NetworkStatus } from './shared/components/network-status';
import { CompareTray } from './shared/components/compare-tray';
import { AccountMenu } from './shared/components/account-menu';
import { ShellSearch } from './shared/components/shell-search';
import { Icon } from './shared/components/icon/icon';
import { Workspace } from './shared/data/workspace';
import { ShellLayer } from './shared/layout/shell-layer';
import { RouteProgress } from './shared/layout/route-progress';
import { AccessBanner } from './shared/layout/access-banner';
import { NO_FEATURES } from './store/account/account.selectors';
import {
  Here,
  NAV,
  NavItem,
  ShellKind,
  bottomBar,
  featureFor,
  isActive,
  moreItems,
  parseUrl,
  publicLinks,
  railGroups,
  shellFor,
  titleFor,
} from './shared/data/navigation';
import { selectCompareSelection } from './store/property-compare/property-compare.selectors';

/** Remembers which shell the last signed-in visit used, so the frame doesn't jump while the
 *  profile loads. A per-browser convenience only; the profile decides. */
const SHELL_KEY = 'gz.shell';
function readShellHint(): ShellKind | null {
  try {
    const v = localStorage.getItem(SHELL_KEY);
    return v === 'pro' || v === 'public' ? v : null;
  } catch {
    return null;
  }
}

/**
 * The Desk shell (DESIGN.md §5). Accounts with a professional area or the admin feature
 * (entitlements, backend SCRUM-204) get the navy rail: the home-buyer pages, then one section per
 * area; home buyers and guests get a search-first top bar. Phones get a bottom bar
 * with four items and More. One scrim, at shell level, sits under any open sheet; while a dialog
 * or sheet is open the rest of the shell is inert.
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    Icon,
    NotificationMenu,
    NetworkStatus,
    CompareTray,
    AccountMenu,
    ShellSearch,
    RouteProgress,
    AccessBanner,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: { '(document:keydown.escape)': 'escape()' },
})
export class App implements OnInit {
  readonly w = inject(Workspace);
  readonly layer = inject(ShellLayer);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly hint = readShellHint();
  readonly nav = NAV;

  /** Sign-in only changes with a page load or sign-out; reading the account keeps this fresh. */
  readonly signedIn = computed(() => {
    this.w.account();
    return this.w.auth.isLoggedIn();
  });
  /** The entitlements' features once read; none for guests. */
  readonly features = computed(() => (this.signedIn() ? this.w.features() : NO_FEATURES));
  readonly pending = computed(() => (this.signedIn() ? this.w.pendingRoles() : []));
  readonly shell = computed<ShellKind>(() => {
    if (!this.signedIn()) return 'public';
    const access = this.w.access().entitlements;
    if (access.value) return shellFor(access.value.features);
    return access.error ? 'public' : (this.hint ?? 'public');
  });
  readonly pro = computed(() => this.shell() === 'pro');

  readonly here = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => parseUrl((e as NavigationEnd).urlAfterRedirects)),
    ),
    { initialValue: parseUrl(this.router.url) },
  );
  readonly groups = computed(() => railGroups(this.features(), this.pending()));
  private readonly railItems = computed(() => this.groups().flatMap((g) => g.items));
  readonly links = computed(() => publicLinks(this.signedIn(), this.pending()));
  readonly bottom = computed(() => bottomBar(this.shell(), this.groups()));
  readonly more = computed(() => moreItems(this.shell(), this.groups(), this.signedIn()));
  readonly title = computed(() => titleFor(this.here()));
  /** Map pages (Explore, parcel search) are full bleed: no 1200 px measure, their own gutters. */
  readonly widePage = computed(() => this.here().path.startsWith('/explore'));

  readonly moreOpen = signal(false);
  private readonly moreButton = viewChild<ElementRef<HTMLButtonElement>>('moreButton');
  private readonly moreClose = viewChild<ElementRef<HTMLButtonElement>>('moreClose');
  /** Everything but the open layer is inert: a dialog or the More sheet covers the whole shell. */
  readonly shellInert = computed(() => this.layer.modalOpen() || this.moreOpen());
  /** A sheet over the page: the bars beside it are inert (the page makes its own content inert). */
  readonly barsInert = computed(() => this.layer.sheetOpen());
  readonly scrimShown = computed(() => this.layer.sheetOpen() && !this.layer.modalOpen());

  private readonly compareSelection = this.w.store.selectSignal(selectCompareSelection);
  /**
   * The toast on screen. The store clears every toast after 5 s; an error stays on the page until it
   * is dismissed or another toast takes its place, so nobody has to read it against the clock
   * (WCAG 2.2.1), and goes when the user leaves the page for another path.
   */
  readonly toastText = signal('');
  readonly toastIsError = signal(false);
  dismissToast() {
    this.toastText.set('');
    this.w.dismissToast();
    // The close button goes with the toast: focus returns to the page, not to the document body.
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }
  /**
   * The page a URL shows: its path, and for a navigation item told apart by a query (the lender's
   * Pipeline, Applications, Import and Team on /loan-review?tab=) that item too.
   */
  private pageOf(here: Here) {
    const items = [...this.railItems(), ...this.links()];
    const tab = items.find((item) => item.query && isActive(item, here, items));
    return tab ? here.path + '|' + tab.key : here.path;
  }
  /** A held error goes with the page it was raised on (and the store's copy, if it still has it). */
  private dropHeldError() {
    const held = this.toastText();
    this.toastText.set('');
    this.toastIsError.set(false);
    if (this.w.ui().toast === held) this.w.dismissToast();
  }

  /** The compare tray floats at the bottom edge; toasts move up so neither covers the other. */
  readonly trayShown = computed(
    () => !this.here().path.startsWith('/compare') && this.compareSelection().length > 0,
  );

  constructor() {
    effect(() => {
      const ui = this.w.ui();
      untracked(() => {
        if (ui.toast) {
          this.toastText.set(ui.toast);
          this.toastIsError.set(ui.toastKind === 'error');
        } else if (!this.toastIsError()) this.toastText.set('');
      });
    });
    // Leaving the page takes a held error with it; a change of the query on the same page (a filter, a
    // selected record, an in-page tab) keeps it, and so does a navigation that is cancelled or
    // redirected back to the page. It goes when the navigation ends on another page, and only if it
    // is still the toast it was when the navigation started: an error the navigation itself raised
    // (a page that fails to open or to start) has replaced it in the store by then, and stays.
    let leaving: { page: string; held: string } | null = null;
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e: RouterEvent) => {
      if (e instanceof NavigationStart) {
        leaving =
          this.toastIsError() && this.toastText()
            ? { page: this.pageOf(this.here()), held: this.toastText() }
            : null;
      } else if (e instanceof NavigationEnd) {
        const from = leaving;
        leaving = null;
        if (!from || this.toastText() !== from.held) return;
        const stored = this.w.ui().toast;
        if (stored && stored !== from.held) return;
        if (this.pageOf(parseUrl(e.urlAfterRedirects)) !== from.page) this.dropHeldError();
      }
    });
    revealWhenFirstPageIsDrawn(this.router, this.injector, inject(DOCUMENT));
    const pageTitle = inject(Title);
    effect(() => pageTitle.setTitle(this.title() + ' | GeoZentra'));
    effect(() => {
      if (!this.w.access().entitlements.value) return;
      try {
        localStorage.setItem(SHELL_KEY, this.shell());
      } catch {
        // Storage can be unavailable (private mode); the shell still follows the entitlements.
      }
    });
    // A new account answers the onboarding page first; it never shows again once answered.
    effect(() => {
      const e = this.signedIn() ? this.w.access().entitlements.value : null;
      const path = this.here().path;
      if (!e) return;
      untracked(() => {
        if (!e.onboardingCompleted && path !== '/onboarding')
          void this.router.navigate(['/onboarding'], { replaceUrl: true });
      });
    });
    // An area that is no longer allowed (a revocation reached the token, e.g. after a 403 and a
    // token refresh) is left for the home dashboard. Route guards stop a new visit.
    effect(() => {
      const e = this.signedIn() ? this.w.access().entitlements.value : null;
      const feature = featureFor(this.here().path);
      if (!e || !feature || e.features[feature]) return;
      untracked(() => {
        void this.router.navigate(['/dashboard'], { replaceUrl: true });
        this.w.toast('That area is no longer part of your account. You are back on your home overview.');
      });
    });
    effect(() => {
      // Navigating (e.g. from a link in the More sheet) closes the sheet.
      this.here();
      this.moreOpen.set(false);
    });
  }
  ngOnInit() {
    this.w.reloadUser();
  }
  active(item: NavItem) {
    return isActive(item, this.here(), this.railItems());
  }
  openMore() {
    this.moreOpen.set(true);
    afterNextRender(() => this.moreClose()?.nativeElement.focus(), { injector: this.injector });
  }
  closeMore() {
    if (!this.moreOpen()) return;
    this.moreOpen.set(false);
    afterNextRender(() => this.moreButton()?.nativeElement.focus(), { injector: this.injector });
  }
  escape() {
    if (this.moreOpen()) this.closeMore();
    else if (this.layer.sheetOpen() && !this.layer.modalOpen()) this.layer.dismissSheet();
  }
}
