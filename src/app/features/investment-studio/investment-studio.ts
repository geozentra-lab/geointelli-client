import { Component, computed, effect, inject, linkedSignal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AffordabilityCalculator } from './affordability-calculator';
import { MortgageCalculator } from './mortgage-calculator';
import { RentalAnalysis } from './rental-analysis';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { PageHeading } from '../../shared/components/page-heading';
import { Workspace } from '../../shared/data/workspace';
import { formatFolio, placeLine } from '../../shared/data/format';

type StudioMode = 'mortgage' | 'affordability' | 'rental';
const modeFrom = (value: string | null): StudioMode =>
  value === 'affordability' || value === 'rental' ? value : 'mortgage';

/**
 * The investment studio, a reading page (DESIGN.md §5 Record): three calculators on the user's own
 * figures, as tabs kept in the address (?mode=affordability, ?mode=rental). Each puts the
 * assumptions beside the result. Opened from a property (/investment-studio/:id, "Open in Studio"),
 * it names that property and links back; its figures are never filled in from the record.
 */
@Component({
  imports: [RouterLink, PageHeading, AffordabilityCalculator, MortgageCalculator, RentalAnalysis],
  template: `
    <gz-heading
      title="Investment studio"
      subtitle="Monthly payments, what you can afford and rental returns, worked out on your own figures."
    />
    @if (propertyId(); as id) {
      @if (w.catalog().detail?.id === id && w.catalog().detail; as p) {
        <p class="studio-for">
          For <a [routerLink]="['/property', id]">{{ p.address?.address || 'Folio ' + folio(p.folio) }}</a
          >{{ place(p) }}. Enter your own price: assessments and past sales are not market values.
        </p>
      } @else if (w.catalog().detailError) {
        <p class="insight warning studio-for" role="alert">
          The property you came from could not load. You can still work with your own figures, or
          <a [routerLink]="['/property', id]">go back to its record</a>.
        </p>
      }
    }
    <div class="tabs" role="tablist" aria-label="Calculator">
      @for (t of tabs(); track t[0]) {
        <button
          type="button"
          role="tab"
          [id]="'studio-tab-' + t[0]"
          [attr.aria-selected]="mode() === t[0]"
          aria-controls="studio-panel"
          [attr.tabindex]="mode() === t[0] ? 0 : -1"
          [class.active]="mode() === t[0]"
          [attr.data-tab]="t[0]"
          (keydown)="onTabKey($event)"
          (click)="show(t[0])"
        >
          {{ t[1] }}
        </button>
      }
    </div>
    <div role="tabpanel" id="studio-panel" [attr.aria-labelledby]="'studio-tab-' + mode()">
      <!-- All three stay mounted, so switching tabs keeps what was typed. -->
      <gz-mortgage-calculator [hidden]="mode() !== 'mortgage'" />
      <gz-affordability-calculator [hidden]="mode() !== 'affordability'" />
      @if (investor()) {
        <gz-rental-analysis [hidden]="mode() !== 'rental'" [propertyId]="propertyId()" />
      }
    </div>
  `,
  styles: `
    .studio-for {
      margin: calc(-1 * var(--sp-8)) 0 var(--sp-16);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: 90ch;
    }
    .studio-for a {
      color: var(--ink);
      font-weight: 500;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .studio-for a:hover {
      color: var(--copper);
    }
    .insight.studio-for {
      margin-top: 0;
    }
    .tabs {
      margin-bottom: var(--sp-24);
    }
  `,
})
export class InvestmentStudio {
  readonly w = inject(Workspace);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /** Rental analysis (POST /api/calculations/investment) is the investor's; the calculators are everyone's. */
  readonly investor = computed(() => this.w.features().investment);
  readonly tabs = computed<readonly (readonly [StudioMode, string])[]>(() => [
    // Short enough that all three fit at 390 px.
    ['mortgage', 'Mortgage'],
    ['affordability', 'Affordability'],
    ...(this.investor() ? [['rental', 'Rental'] as const] : []),
  ]);
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  /**
   * ?mode=affordability (or rental) opens that tab, and the tab follows the address: the nav's
   * Studio link (no ?mode) brings back Mortgage even when the page is already open.
   */
  readonly mode = linkedSignal<StudioMode>(() => {
    const asked = modeFrom(this.query().get('mode'));
    return asked === 'rental' && !this.investor() ? 'mortgage' : asked;
  });
  private readonly params = toSignal(this.route.paramMap);
  readonly propertyId = computed(() => {
    const id = Number(this.params()?.get('id'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });

  constructor() {
    // The property the studio was opened from, for its name and a link back.
    effect(() => {
      const id = this.propertyId();
      if (id !== null && untracked(() => this.w.catalog().detail?.id) !== id)
        untracked(() => this.w.store.dispatch(CatalogActions.loadDetail({ id })));
    });
  }

  show(mode: StudioMode) {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    // Kept in the address, so a refresh or a shared link opens the same calculator.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mode: mode === 'mortgage' ? null : mode },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const order = this.tabs().map((t) => t[0]);
    const index = order.indexOf(this.mode());
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? order.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length;
    this.show(order[next]);
    document.getElementById('studio-tab-' + order[next])?.focus();
  }

  folio(f: string | null | undefined) {
    return formatFolio(f);
  }
  /** ", Miami, FL 33133" after the address. */
  place(p: { address?: { city?: string; zip?: string } | null; countyName?: string | null; stateCode?: string | null }) {
    const line = placeLine(p.address?.city || p.countyName, p.stateCode, p.address?.zip);
    return line ? ', ' + line : '';
  }
}
