import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../data/workspace';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { IDLE_LOOKUP, LOOKUP_PAGE } from '../../store/catalog/catalog.model';
import { PropertySearchItem } from '../../core/models/api';
import { Icon } from './icon/icon';
import { RequestStatus } from './request-status';

/** The lookup returns at most this many matches; the list says so when it is full. */
const PAGE = LOOKUP_PAGE;
let nextId = 0;

/**
 * Address typeahead with photos, used wherever a property is referenced (holdings, CRM, compare).
 * Search state is local so several pickers can live on one page without sharing results.
 * mode="single" shows the chosen property; mode="add" emits each pick and keeps searching.
 */
@Component({
  selector: 'gz-property-picker',
  imports: [RouterLink, Icon, RequestStatus],
  template: `
    <div class="formfield">
      @if (mode() === 'single' && propertyId(); as id) {
        <span class="label" [id]="uid + '-label'">{{ label() }}</span>
        <div class="chosen" role="group" [attr.aria-labelledby]="uid + '-label'">
          @if (photo(id); as url) {
            <img [src]="url" alt="" loading="lazy" (error)="failedImage(id)" />
          } @else {
            <span class="thumbnail"><gz-icon name="home" /></span>
          }
          <span
            >{{ title(id)
            }}<small
              >{{ subtitle(id) }}
              @if (w.catalog().unresolved[id]) {
                <button type="button" class="linkbtn" (click)="retryLookup(id)">Retry</button>
              }
            </small></span
          >
          <a
            class="btn iconbtn"
            [routerLink]="['/property', id]"
            target="_blank"
            rel="noopener"
            [attr.aria-label]="'View details for ' + title(id) + ' (opens in a new tab)'"
            title="View property details"
            ><gz-icon name="external-link"
          /></a>
          @if (!locked() && !disabled()) {
            <button class="btn small" type="button" (click)="clear()">Change</button>
          }
        </div>
      } @else {
        <label [for]="uid">{{ label() }}</label>
        <input
          [id]="uid"
          type="search"
          autocomplete="off"
          placeholder="Start typing an address"
          [value]="state().query"
          [disabled]="disabled()"
          (input)="search($any($event.target).value)"
          (keydown.escape)="search('')"
          [attr.aria-describedby]="uid + '-hint'"
        />
        <p [id]="uid + '-hint'" class="muted smalltext">{{ hint() }}</p>
        <div aria-live="polite">
          <gz-request-status
            [loading]="state().loading"
            loadingText="Searching addresses…"
            [error]="state().error"
            (retry)="retry()"
          />
          @if (state().query.trim().length >= 3 && !state().loading && !state().error) {
            @if (!state().items.length) {
              <p class="muted">No matching properties. Try a street number and name.</p>
            }
            <div
              class="results-scroll"
              [style.max-height.px]="resultsHeight()"
              role="region"
              [attr.aria-label]="'Properties matching ' + state().query"
              tabindex="0"
            >
              @for (p of state().items; track p.id) {
                @let taken = exclude().includes(p.id);
                <div class="result" #resultRow>
                  <button class="pick" type="button" [disabled]="taken" (click)="choose(p)">
                    @if (photo(p.id); as url) {
                      <img [src]="url" alt="" loading="lazy" (error)="failedImage(p.id)" />
                    } @else {
                      <span class="thumbnail"><gz-icon name="home" /></span>
                    }
                    <span
                      >{{ p.address || 'Address unavailable' }}
                      @if (taken) {
                        <span class="tag">Added</span>
                      }
                      <small>{{ describe(p) }}</small></span
                    >
                  </button>
                  <a
                    class="btn iconbtn"
                    [routerLink]="['/property', p.id]"
                    target="_blank"
                    rel="noopener"
                    [attr.aria-label]="
                      'View details for ' + (p.address || p.folio) + ' (opens in a new tab)'
                    "
                    title="View property details"
                    ><gz-icon name="external-link"
                  /></a>
                </div>
              }
            </div>
            @if (state().items.length === page) {
              <p class="muted smalltext">
                Showing the first {{ page }} matches. Add more of the address to narrow them.
              </p>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      input {
        width: 100%;
      }
      .results-scroll {
        overflow-y: auto;
        overscroll-behavior-y: contain;
        scrollbar-gutter: stable;
      }
      .result,
      .chosen {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--line);
      }
      .pick {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        white-space: normal;
        font: inherit;
        line-height: 1.45;
        min-width: 0;
        border: 0;
        background: transparent;
        text-align: left;
        color: inherit;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
      }
      .pick:hover:not(:disabled) {
        background: #f1f5f7;
      }
      .pick:disabled {
        cursor: default;
        opacity: 0.6;
      }
      .pick > span:last-child,
      .chosen > span:not(.thumbnail) {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
        white-space: normal;
      }
      small {
        display: block;
        color: var(--muted);
        margin-top: 5px;
        font-size: 12px;
      }
      img,
      .thumbnail {
        width: 76px;
        height: 64px;
        object-fit: cover;
        border-radius: 6px;
        flex-shrink: 0;
      }
      .thumbnail {
        display: grid;
        place-items: center;
        flex: 0 0 76px;
        background: #edf1f4;
        color: var(--muted);
      }
      .chosen {
        flex-wrap: wrap;
      }
      .chosen > span:not(.thumbnail) {
        flex-basis: 140px;
      }
      .iconbtn {
        width: 44px;
        height: 44px;
        padding: 10px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class PropertyPicker {
  w = inject(Workspace);
  readonly uid = 'property-picker-' + nextId++;
  readonly page = PAGE;
  propertyId = input<number | null>(null);
  mode = input<'single' | 'add'>('single');
  label = input('Property address');
  hint = input('Type at least 3 characters of the address, then pick a match.');
  locked = input(false);
  disabled = input(false);
  /** IDs already chosen elsewhere (e.g. the comparison selection); shown as "Added". */
  exclude = input<number[]>([]);
  selected = output<number | null>();
  /** This picker's typeahead in the catalog, under its own key. */
  readonly state = computed(() => this.w.catalog().lookups[this.uid] ?? IDLE_LOOKUP);
  readonly resultRows = viewChildren<ElementRef<HTMLElement>>('resultRow');
  readonly resultsHeight = signal(300);
  private broken = signal<Set<number>>(new Set());
  constructor() {
    inject(DestroyRef).onDestroy(() =>
      this.w.store.dispatch(CatalogActions.lookupClosed({ key: this.uid })),
    );
    // A property chosen earlier (editing a record) may not be in the catalog yet.
    effect(() => {
      const id = this.propertyId();
      if (id && !this.w.home(id) && !this.w.catalog().unresolved[id])
        this.w.store.dispatch(CatalogActions.resolveProperty({ id }));
    });
    // Show three full results, then scroll, regardless of how tall each row renders.
    effect((onCleanup) => {
      const rows = this.resultRows().slice(0, 3);
      if (!rows.length) return;
      const measure = () =>
        this.resultsHeight.set(
          Math.ceil(
            rows.reduce((h, row) => h + row.nativeElement.getBoundingClientRect().height, 0),
          ),
        );
      measure();
      // Not every runtime has ResizeObserver (jsdom, old WebViews); the first measurement still applies.
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      rows.forEach((row) => observer.observe(row.nativeElement));
      onCleanup(() => observer.disconnect());
    });
  }
  search(query: string) {
    this.w.store.dispatch(CatalogActions.lookup({ key: this.uid, source: 'catalog', query }));
  }
  retry() {
    this.w.store.dispatch(
      CatalogActions.lookup({
        key: this.uid,
        source: 'catalog',
        query: this.state().query,
        immediate: true,
      }),
    );
  }
  choose(p: PropertySearchItem) {
    this.selected.emit(p.id);
    this.search('');
  }
  clear() {
    this.selected.emit(null);
    this.search('');
  }
  title(id: number) {
    const p = this.w.home(id);
    return p?.address || (p ? 'Folio ' + p.folio : 'Property #' + id);
  }
  subtitle(id: number) {
    const p = this.w.home(id);
    if (p) return this.describe(p);
    return this.w.catalog().unresolved[id]
      ? 'Property details are unavailable right now.'
      : 'Loading property details…';
  }
  retryLookup(id: number) {
    this.w.store.dispatch(CatalogActions.resolveProperty({ id }));
  }
  describe(p: PropertySearchItem) {
    const place = [p.city || p.countyName, p.stateCode, p.zip].filter(Boolean).join(' ');
    return [place, 'Folio ' + p.folio].filter(Boolean).join(' · ');
  }
  photo(id: number) {
    if (this.broken().has(id)) return null;
    const images = this.w.catalog().photos[id];
    return (images?.find((p) => p.primaryImage) || images?.[0])?.storagePath || null;
  }
  failedImage(id: number) {
    this.broken.update((ids) => new Set([...ids, id]));
  }
}
