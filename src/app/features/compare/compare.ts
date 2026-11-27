import { Component, computed, effect, inject, linkedSignal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { SignInPrompt } from '../../shared/components/sign-in-prompt';
import { PropertyCompareActions } from '../../store/property-compare/property-compare.actions';
import { selectCompareSelection } from '../../store/property-compare/property-compare.selectors';
import { SideBySide } from './side-by-side';
import { ComparableSales } from './comparable-sales';

type View = 'side' | 'sales';

/**
 * Compare (DESIGN.md §5 Compare): h1 "Compare" and one line; tabs Side by side and Comparable sales,
 * kept in the address (`?view=`) and following it. `/compare/:id` opens the comparable sales of
 * that property (the property page's "Open in Compare"), and `?property=` holds the one picked here;
 * `/compare?ids=12,34` restores and runs a side-by-side comparison (the compare tray), and `?ids=`
 * then follows the selection, so a reload or a copied link shows what is chosen. Both tabs stay
 * mounted, so switching keeps what was chosen and typed. Address changes replace the entry.
 */
@Component({
  imports: [PageHeading, SideBySide, ComparableSales, SignInPrompt],
  template: `
    <gz-heading
      title="Compare"
      subtitle="Up to five properties field by field, or the recorded sales most like one property."
    />
    @if (!signedIn) {
      <gz-sign-in-prompt
        heading="Sign in to compare properties"
        text="Comparing properties side by side, and the recorded sales most like one, needs an account."
      />
    } @else {
      <div class="tabs" role="tablist" aria-label="Compare">
        @for (t of tabs; track t[0]) {
          <button
            type="button"
            role="tab"
            [id]="'cp-tab-' + t[0]"
            [attr.aria-selected]="view() === t[0]"
            [attr.aria-controls]="'cp-panel-' + t[0]"
            [attr.tabindex]="view() === t[0] ? 0 : -1"
            [class.active]="view() === t[0]"
            (click)="show(t[0])"
            (keydown)="onTabKey($event)"
          >
            {{ t[1] }}
          </button>
        }
      </div>
      <div
        role="tabpanel"
        id="cp-panel-side"
        aria-labelledby="cp-tab-side"
        [hidden]="view() !== 'side'"
      >
        <gz-side-by-side />
      </div>
      <div
        role="tabpanel"
        id="cp-panel-sales"
        aria-labelledby="cp-tab-sales"
        [hidden]="view() !== 'sales'"
      >
        <gz-comparable-sales [startId]="routeId()" (picked)="openSales($event)" />
      </div>
    }
  `,
})
export class Compare {
  private readonly w = inject(Workspace);
  /** Comparing needs an account (401 otherwise): a guest is asked to sign in, and nothing is sent. */
  readonly signedIn = this.w.auth.isLoggedIn();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly tabs = [
    ['side', 'Side by side'],
    ['sales', 'Comparable sales'],
  ] as const;

  /** The property whose comparable sales show: ?property= (picked here), else /compare/:id. */
  readonly routeId = computed(() => {
    const id = Number(this.query().get('property') ?? this.params().get('id'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  /** The tab without ?view=: comparable sales on /compare/:id, side by side on /compare. */
  private readonly home = computed<View>(() => (this.routeId() !== null ? 'sales' : 'side'));
  readonly view = linkedSignal<View>(() => {
    const v = this.query().get('view');
    return v === 'side' || v === 'sales' ? v : this.home();
  });
  /** ?ids= as written, so a change of ?view= doesn't run the comparison again. */
  private readonly ids = computed(() => this.query().get('ids') ?? '');
  private readonly selection = this.w.store.selectSignal(selectCompareSelection);
  /** The last ?ids= this page wrote or took in: a new value other than that is a link to restore. */
  private written: string | null = null;
  /** ?ids= at the last run: only a change of the address can be a link (not a change of selection). */
  private seen: string | null = null;

  constructor() {
    effect(() => {
      const raw = this.ids();
      const selection = this.selection();
      // A guest's link waits for sign-in: the comparison needs an account (401 otherwise).
      if (!this.signedIn) return;
      untracked(() => {
        const changed = raw !== this.seen;
        this.seen = raw;
        // A link (/compare?ids=12,34 from the tray or a copied address): restore it and run it.
        if (changed && raw && raw !== this.written) {
          this.written = raw;
          const ids = raw
            .split(',')
            .map(Number)
            .filter((n) => Number.isSafeInteger(n) && n > 0);
          if (!ids.length) return;
          this.w.store.dispatch(PropertyCompareActions.setSelection({ propertyIds: ids }));
          if (ids.length >= 2) this.w.store.dispatch(PropertyCompareActions.load());
          return;
        }
        // Otherwise the address follows the selection (added, removed, cleared), without running it.
        const want = selection.join(',');
        if (want === raw) return;
        this.written = want;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { ids: want || null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  /** A property picked in Comparable sales goes into the address, which then searches it. */
  openSales(id: number) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { property: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  show(view: View) {
    if (view === this.view()) return;
    this.view.set(view);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === this.home() ? null : view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: View =
      event.key === 'Home'
        ? 'side'
        : event.key === 'End'
          ? 'sales'
          : this.view() === 'side'
            ? 'sales'
            : 'side';
    this.show(next);
    document.getElementById('cp-tab-' + next)?.focus();
  }
}
