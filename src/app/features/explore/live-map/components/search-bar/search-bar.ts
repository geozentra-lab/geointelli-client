import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { SearchMode, SearchQuery } from '../../../../../core/models/search-query';
import { PropertySearchItem } from '../../../../../core/models/api';
import { LocationsActions as L } from '../../../../../store/locations/locations.actions';
import { selectLocations } from '../../../../../store/locations/locations.selectors';
import { CatalogActions } from '../../../../../store/catalog/catalog.actions';
import { selectCatalog } from '../../../../../store/catalog/catalog.selectors';
import { IDLE_LOOKUP, MIN_LOOKUP_QUERY } from '../../../../../store/catalog/catalog.model';
import { Icon } from '../../../../../shared/components/icon/icon';
let nextId = 0;
/** Typing pauses this long before the address lookup runs. */
/**
 * Folio/address search for the parcel explorer. In address mode it shows matching property cards
 * (with photos) as you type; picking one shows that parcel on the map. The state list comes from
 * the shared locations store, but the selected state and county are local: picking a county for a
 * folio lookup must not change the Explore page's county filter.
 */
@Component({
  selector: 'app-search-bar',
  imports: [FormsModule, Icon],
  template: `@if (mode() === 'folio') {
      <div class="row" style="margin-bottom:12px;flex-wrap:wrap">
        <select
          class="field"
          aria-label="Property state"
          [ngModel]="stateId()"
          (ngModelChange)="selectState($event)"
        >
          <option [ngValue]="null">Select state</option>
          @for (state of locations().states; track state.id) {
            <option [ngValue]="state.id">{{ state.name }}</option>
          }
        </select>
        <select
          class="field"
          aria-label="Property county"
          [disabled]="stateId() === null || countiesLoading()"
          [ngModel]="countyId()"
          (ngModelChange)="countyId.set($event)"
        >
          <option [ngValue]="null">{{ countiesLoading() ? 'Loading…' : 'Select county' }}</option>
          @for (county of counties(); track county.countyId) {
            <option [ngValue]="county.countyId">{{ county.countyName }}</option>
          }
        </select>
        @if (locationsError(); as error) {
          <span class="smalltext" role="alert">{{ error }}</span
          ><button class="btn small" type="button" (click)="retryLocations()">Retry</button>
        }
      </div>
    }
    <div class="parcel-search">
      <div class="toggle">
        <button type="button" [class.active]="mode() === 'folio'" (click)="switchMode('folio')">
          Folio</button
        ><button
          type="button"
          [class.active]="mode() === 'address'"
          (click)="switchMode('address')"
        >
          Address
        </button>
      </div>
      <input
        class="field"
        aria-label="Search parcels"
        role="combobox"
        aria-autocomplete="list"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && active() >= 0 ? optionId(active()) : null"
        [ngModel]="value()"
        (ngModelChange)="onInput($event)"
        [placeholder]="mode() === 'folio' ? 'Enter folio number…' : 'Start typing an address…'"
        (keydown)="onKeydown($event)"
        (blur)="close()"
      /><button
        class="btn primary"
        type="button"
        [disabled]="!canSubmit()"
        [attr.aria-describedby]="submitHint() ? listId + '-hint' : null"
        (click)="submit()"
      >
        Search
      </button>
      @if (open()) {
        <div
          class="parcel-suggestions property-results"
          role="listbox"
          [id]="listId"
          aria-label="Matching properties"
          [attr.aria-busy]="lookup().loading"
        >
          @for (p of lookup().items; track p.id; let i = $index) {
            <button
              type="button"
              role="option"
              class="property-option"
              [id]="optionId(i)"
              [class.active]="i === active()"
              [attr.aria-selected]="i === active()"
              (mousedown)="$event.preventDefault(); pickCard(p)"
              (mousemove)="activeIndex.set(i)"
            >
              @if (photo(p.id); as url) {
                <img [src]="url" alt="" loading="lazy" (error)="failedImage(p.id)" />
              } @else {
                <span class="thumbnail" aria-hidden="true"><gz-icon name="home" /></span>
              }
              <span class="text">
                <span class="title">{{ p.address || 'Folio ' + p.folio }}</span>
                <span class="meta">{{ place(p) }}</span>
                @if (facts(p); as f) {
                  <span class="meta">{{ f }}</span>
                }
              </span>
            </button>
          }
          @if (lookup().loading && !lookup().items.length) {
            <p class="lookup-note" role="status">Searching properties…</p>
          } @else if (lookup().error; as error) {
            <p class="lookup-note" role="alert">
              {{ error }}
              <button
                type="button"
                class="btn small"
                (mousedown)="$event.preventDefault(); retryLookup()"
              >
                Retry
              </button>
            </p>
          } @else if (!lookup().loading && !lookup().items.length) {
            <p class="lookup-note" role="status">No properties match that address.</p>
          }
        </div>
      }
    </div>
    @if (submitHint(); as hint) {
      <p class="search-hint" [id]="listId + '-hint'">{{ hint }}</p>
    }`,
  styles: `
    .search-hint {
      margin: 6px 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
  `,
})
export class SearchBar implements OnInit {
  search = output<SearchQuery>();
  /** A property card chosen from the typeahead; the map shows its parcel. */
  pick = output<PropertySearchItem>();
  private store = inject(Store);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroy = inject(DestroyRef);
  locations = this.store.selectSignal(selectLocations);
  private catalog = this.store.selectSignal(selectCatalog);
  readonly listId = `parcel-suggestions-${nextId++}`;
  mode = signal<SearchMode>('folio');
  value = signal('');
  showSuggestions = signal(false);
  /** Index of the keyboard-highlighted card; -1 when none. */
  activeIndex = signal(-1);
  /** Cards for the typed address; kept under this bar's key, apart from the map's own results. */
  lookup = computed(() => this.catalog().lookups[this.listId] ?? IDLE_LOOKUP);
  private broken = signal<Set<number>>(new Set());
  stateId = signal<number | null>(null);
  countyId = signal<number | null>(null);
  /** Counties of the state chosen here, from the per-state cache (not the shared Explore filter). */
  private countyState = computed(() => {
    const id = this.stateId();
    return id === null ? null : (this.locations().countiesByState[id] ?? null);
  });
  counties = computed(() => this.countyState()?.counties ?? []);
  countiesLoading = computed(() => this.countyState()?.loading ?? false);
  countiesError = computed(() => this.countyState()?.error ?? null);
  open = computed(
    () =>
      this.showSuggestions() &&
      this.mode() === 'address' &&
      this.value().trim().length >= MIN_LOOKUP_QUERY &&
      this.lookup().query === this.value().trim(),
  );
  /** Clamped so a shorter result list never leaves a stale highlight. */
  active = computed(() =>
    this.activeIndex() < this.lookup().items.length ? this.activeIndex() : -1,
  );
  locationsError = computed(() => this.countiesError() ?? this.locations().error);
  constructor() {
    this.destroy.onDestroy(() =>
      this.store.dispatch(CatalogActions.lookupClosed({ key: this.listId })),
    );
  }
  ngOnInit() {
    const shared = this.locations();
    if (!shared.states.length) this.store.dispatch(L.loadStates());
    // Seed from the Explore selection once; later changes here stay local.
    if (shared.stateId !== null) {
      this.stateId.set(shared.stateId);
      this.countyId.set(shared.countyId);
      if (!shared.countiesByState[shared.stateId]?.counties.length)
        this.store.dispatch(L.loadCountiesFor({ stateId: shared.stateId }));
    }
  }
  selectState(stateId: number | null) {
    this.stateId.set(stateId);
    this.countyId.set(null);
    if (stateId !== null && !this.locations().countiesByState[stateId]?.counties.length)
      this.store.dispatch(L.loadCountiesFor({ stateId }));
  }
  retryLocations() {
    const stateId = this.stateId();
    if (this.countiesError() && stateId !== null)
      this.store.dispatch(L.loadCountiesFor({ stateId }));
    else this.store.dispatch(L.loadStates());
  }
  /** Why Search is disabled, written under it (DESIGN.md §12); empty when it can run. */
  readonly submitHint = computed(() => {
    if (this.mode() === 'folio' && !(this.countyId() !== null && this.countyId()! > 0))
      return 'Choose a state and county to search by folio.';
    if (!this.value().trim())
      return this.mode() === 'folio' ? 'Enter a folio number to search.' : 'Enter an address to search.';
    return '';
  });
  canSubmit() {
    return (
      !!this.value().trim() &&
      (this.mode() === 'address' || (this.countyId() !== null && this.countyId()! > 0))
    );
  }
  switchMode(mode: SearchMode) {
    this.mode.set(mode);
    this.value.set('');
    this.close();
    this.lookupQuery('');
  }
  onInput(value: string) {
    this.value.set(value);
    this.showSuggestions.set(true);
    this.activeIndex.set(-1);
    this.lookupQuery(this.mode() === 'address' ? value.trim() : '');
  }
  retryLookup() {
    this.showSuggestions.set(true);
    this.lookupQuery(this.value().trim(), true);
  }
  private lookupQuery(query: string, immediate = false) {
    this.store.dispatch(
      CatalogActions.lookup({ key: this.listId, source: 'address', query, immediate }),
    );
  }
  onKeydown(event: KeyboardEvent) {
    const items = this.lookup().items;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (this.mode() !== 'address' || !items.length) return;
        event.preventDefault();
        if (!this.open()) {
          this.showSuggestions.set(true);
          if (!this.open()) return;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const count = items.length;
        const from = this.active();
        this.activeIndex.set(from < 0 ? (step > 0 ? 0 : count - 1) : (from + step + count) % count);
        return;
      }
      case 'Enter':
        event.preventDefault();
        if (this.open() && this.active() >= 0) this.pickCard(items[this.active()]);
        else this.submit();
        return;
      case 'Escape':
        if (this.open()) event.preventDefault();
        this.close();
        return;
      case 'Tab':
        this.close();
        return;
    }
  }
  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null) {
    if (target instanceof Node && !this.host.nativeElement.contains(target)) this.close();
  }
  optionId(index: number) {
    return `${this.listId}-option-${index}`;
  }
  close() {
    this.showSuggestions.set(false);
    this.activeIndex.set(-1);
  }
  pickCard(p: PropertySearchItem) {
    this.value.set(p.address || p.folio);
    this.close();
    this.pick.emit(p);
  }
  place(p: PropertySearchItem) {
    return [p.city, p.zip, p.countyName].filter(Boolean).join(' · ') || 'Folio ' + p.folio;
  }
  facts(p: PropertySearchItem) {
    return [
      p.bedrooms !== null ? p.bedrooms + ' bd' : '',
      p.bathrooms !== null ? p.bathrooms + ' ba' : '',
      p.livingAreaSqft !== null ? Math.round(p.livingAreaSqft).toLocaleString() + ' sqft' : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  photo(id: number) {
    if (this.broken().has(id)) return null;
    const images = this.catalog().photos[id];
    return (images?.find((p) => p.primaryImage) || images?.[0])?.storagePath || null;
  }
  failedImage(id: number) {
    this.broken.update((ids) => new Set([...ids, id]));
  }
  submit() {
    if (!this.canSubmit()) return;
    this.close();
    const value = this.value().trim();
    this.search.emit(
      this.mode() === 'folio'
        ? { mode: 'folio', value, countyId: this.countyId()! }
        : { mode: 'address', value },
    );
  }
}
