import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Workspace } from '../data/workspace';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { IDLE_LOOKUP, MIN_LOOKUP_QUERY } from '../../store/catalog/catalog.model';
import { PropertySearchItem } from '../../core/models/api';
import { formatFolio, placeLine } from '../data/format';
import { Icon } from './icon/icon';

/** The catalog lookup this search owns (keyed lookups are independent of the pickers'). */
const KEY = 'shell-search';

/**
 * Address search in the top bar: a combobox over the catalog's address lookup. Picking a match
 * opens the property page. On phones it collapses to a button that opens the field over the bar.
 * The property search takes no folio filter, so this searches addresses only (DESIGN.md §16).
 */
@Component({
  selector: 'gz-shell-search',
  imports: [Icon],
  host: {
    '[class.expanded]': 'expanded()',
    '(document:click)': 'outside($event)',
    '(focusout)': 'leave($event)',
  },
  template: `
    <button
      type="button"
      class="iconbtn search-toggle"
      aria-label="Search addresses"
      [attr.aria-expanded]="expanded()"
      (click)="expand()"
    >
      <gz-icon name="search" />
    </button>
    <div class="search-field" role="search">
      <gz-icon name="search" />
      <label class="sr-only" for="shell-search-input">Search address</label>
      <input
        id="shell-search-input"
        #input
        type="search"
        role="combobox"
        autocomplete="off"
        placeholder="Search address"
        aria-autocomplete="list"
        aria-controls="shell-search-results"
        [attr.aria-expanded]="listOpen()"
        [attr.aria-activedescendant]="active() >= 0 ? 'shell-search-option-' + active() : null"
        [value]="query()"
        (input)="search($any($event.target).value)"
        (keydown)="key($event)"
        (focus)="focused.set(true)"
      />
      <button type="button" class="iconbtn search-close" aria-label="Close search" (click)="collapse()">
        <gz-icon name="close" />
      </button>
    </div>
    @if (listOpen()) {
      <div class="menu-panel search-results" id="shell-search-results" role="listbox" aria-label="Matching properties">
        @if (state().loading && !state().items.length) {
          <p class="search-note" role="status">Searching addresses…</p>
        } @else if (state().error) {
          <p class="search-note" role="alert">
            The search failed. <button type="button" class="linkbtn" (click)="retry()">Retry</button>
          </p>
        } @else {
          @for (p of state().items; track p.id; let i = $index) {
            <div
              class="search-option"
              role="option"
              [id]="'shell-search-option-' + i"
              [attr.aria-selected]="i === active()"
              [class.active]="i === active()"
              (mousedown)="$event.preventDefault()"
              (click)="pick(p)"
            >
              <span class="search-address">{{ p.address || folio(p) }}</span>
              <span class="search-place"
                ><span>{{ place(p) }}</span>
                @if (p.address && p.folio) {
                  <span class="num">{{ folio(p) }}</span>
                }
              </span>
            </div>
          } @empty {
            <p class="search-note" role="status">
              No property matches “{{ query().trim() }}”. Try a street number and name.
            </p>
          }
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      align-items: center;
      min-width: 0;
    }
    .search-toggle,
    .search-close {
      display: none;
    }
    .search-field {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      width: var(--search-w, 360px);
      max-width: 100%;
      height: var(--nav-btn);
      padding: 0 10px;
      border: 1px solid var(--control);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink-2);
    }
    .search-field:focus-within {
      border-color: var(--copper);
      box-shadow: 0 0 0 3px var(--field-ring);
    }
    .search-field gz-icon {
      color: var(--ink-2);
    }
    input,
    input:focus {
      flex: 1;
      min-width: 0;
      min-height: 0;
      height: 100%;
      padding: 0;
      border: 0;
      outline: 0;
      box-shadow: none;
      background: transparent;
      font-size: var(--nav-text);
    }
    .search-results {
      left: 0;
      right: auto;
      width: max(100%, 360px);
      max-height: min(420px, 70dvh);
      overflow-y: auto;
    }
    .search-option {
      display: flex;
      flex-direction: column;
      padding: 8px 14px;
      cursor: pointer;
    }
    .search-option.active,
    .search-option:hover {
      background: var(--row-hover);
      box-shadow: inset 3px 0 0 var(--copper);
    }
    .search-address {
      font-size: var(--nav-text);
      line-height: var(--lh-body);
      font-weight: 500;
      color: var(--ink);
    }
    .search-place {
      display: flex;
      flex-wrap: wrap;
      gap: 0 var(--sp-12);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .search-note {
      margin: 0;
      padding: 10px 14px;
      font-size: var(--fs-body);
      color: var(--ink-2);
    }
    @media (max-width: 700px) {
      .search-toggle {
        display: inline-flex;
      }
      .search-field {
        display: none;
      }
      :host(.expanded) {
        position: absolute;
        inset: 0;
        z-index: 1;
        padding: 0 6px 0 14px;
        background: var(--surface);
      }
      :host(.expanded) .search-toggle {
        display: none;
      }
      :host(.expanded) .search-field {
        display: flex;
        flex: 1;
        width: auto;
      }
      :host(.expanded) .search-close {
        display: inline-flex;
      }
      .search-results {
        position: fixed;
        top: var(--topbar-h);
        left: 0;
        right: 0;
        width: auto;
        border-radius: 0;
        border-width: 0 0 1px;
      }
    }
  `,
})
export class ShellSearch {
  private readonly w = inject(Workspace);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  readonly query = signal('');
  readonly active = signal(-1);
  readonly focused = signal(false);
  /** Phones: the field is open over the top bar. */
  readonly expanded = signal(false);
  private focusOnExpand = false;
  readonly state = computed(() => this.w.catalog().lookups[KEY] ?? IDLE_LOOKUP);
  readonly listOpen = computed(
    () => this.focused() && this.query().trim().length >= MIN_LOOKUP_QUERY,
  );
  readonly folio = (p: PropertySearchItem) => 'Folio ' + formatFolio(p.folio);
  constructor() {
    inject(DestroyRef).onDestroy(() =>
      this.w.store.dispatch(CatalogActions.lookupClosed({ key: KEY })),
    );
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e instanceof NavigationStart) this.reset();
      });
    afterRenderEffect(() => {
      if (this.expanded() && this.focusOnExpand) {
        this.focusOnExpand = false;
        this.input().nativeElement.focus();
      }
    });
  }
  place(p: PropertySearchItem) {
    return placeLine(p.city || p.countyName, p.stateCode, p.zip);
  }
  search(value: string) {
    this.query.set(value);
    this.active.set(-1);
    this.w.store.dispatch(CatalogActions.lookup({ key: KEY, source: 'catalog', query: value }));
  }
  retry() {
    this.w.store.dispatch(
      CatalogActions.lookup({ key: KEY, source: 'catalog', query: this.query(), immediate: true }),
    );
  }
  key(event: KeyboardEvent) {
    const items = this.state().items;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!items.length) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const current = this.active();
      // Nothing highlighted yet: Down starts at the first match, Up at the last.
      this.active.set(
        current < 0
          ? step > 0
            ? 0
            : items.length - 1
          : (current + step + items.length) % items.length,
      );
    } else if (event.key === 'Enter') {
      const pick = items[this.active()] ?? (items.length === 1 ? items[0] : null);
      if (pick) {
        event.preventDefault();
        this.pick(pick);
      }
    } else if (event.key === 'Escape') {
      if (this.query()) {
        event.stopPropagation();
        this.search('');
      } else this.collapse();
    }
  }
  pick(p: PropertySearchItem) {
    this.reset();
    void this.router.navigate(['/property', p.id]);
  }
  expand() {
    this.focusOnExpand = true;
    this.expanded.set(true);
  }
  collapse() {
    this.reset();
    this.expanded.set(false);
  }
  /** Tabbing out of the search closes its list (picking an option keeps focus in the field). */
  leave(event: FocusEvent) {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) this.focused.set(false);
  }
  outside(event: MouseEvent) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.focused.set(false);
  }
  private reset() {
    this.query.set('');
    this.active.set(-1);
    this.focused.set(false);
    this.w.store.dispatch(CatalogActions.lookupClosed({ key: KEY }));
  }
}
