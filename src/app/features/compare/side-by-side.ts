import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PropertyPicker } from '../../shared/components/property-picker';
import { PropertyRef } from '../../shared/components/property-ref';
import { RequestStatus } from '../../shared/components/request-status';
import { TABLE_KIT } from '../../shared/table';
import {
  countOf,
  formatConfidenceValue,
  formatFolio,
  formatRecordDate,
  placeLine,
} from '../../shared/data/format';
import { PropertyCompareActions as A } from '../../store/property-compare/property-compare.actions';
import { selectPropertyCompare } from '../../store/property-compare/property-compare.selectors';
import { COMPARE_MAX, COMPARE_MIN } from '../../store/property-compare/property-compare.reducer';
import { PropertyComparison } from '../../core/models/api';

type Kind = 'text' | 'count' | 'money' | 'range' | 'date' | 'change' | 'score' | 'confidence';
type GroupKey = 'facts' | 'assessment' | 'lastSale' | 'valuation' | 'scores';
interface Field {
  label: string;
  key: string;
  kind: Kind;
  /** Mark the highest figure in the row ("Highest"), for figures where more is plainly more. */
  highest?: boolean;
  /** Why the value is missing when the rest of its group is there. */
  reason: string;
}
interface Group {
  key: GroupKey;
  title: string;
  /** Why the whole group is missing (one merged span per property). */
  missing: string;
  fields: Field[];
}

const NOT_IN_RECORD = 'Not in the county record';
const GROUPS: Group[] = [
  {
    key: 'facts',
    title: 'Facts',
    missing: 'No facts on record',
    fields: [
      { label: 'Property type', key: 'propertyType', kind: 'text', reason: NOT_IN_RECORD },
      { label: 'Bedrooms', key: 'bedrooms', kind: 'count', highest: true, reason: NOT_IN_RECORD },
      { label: 'Bathrooms', key: 'bathrooms', kind: 'count', highest: true, reason: NOT_IN_RECORD },
      { label: 'Living area, sq ft', key: 'livingAreaSqft', kind: 'count', highest: true, reason: NOT_IN_RECORD },
      { label: 'Lot, sq ft', key: 'lotSizeSqft', kind: 'count', highest: true, reason: NOT_IN_RECORD },
      { label: 'Year built', key: 'yearBuilt', kind: 'text', reason: NOT_IN_RECORD },
      { label: 'Floors', key: 'floors', kind: 'count', reason: NOT_IN_RECORD },
      { label: 'Units', key: 'units', kind: 'count', reason: NOT_IN_RECORD },
    ],
  },
  {
    key: 'assessment',
    title: 'Assessment',
    missing: 'No assessment on record',
    fields: [
      { label: 'Year', key: 'year', kind: 'text', reason: 'Not in the assessment record' },
      { label: 'Total value', key: 'totalValue', kind: 'money', reason: 'Not in the assessment record' },
      { label: 'Land value', key: 'landValue', kind: 'money', reason: 'Not in the assessment record' },
      { label: 'Building value', key: 'buildingValue', kind: 'money', reason: 'Not in the assessment record' },
      { label: 'Assessed value', key: 'assessedValue', kind: 'money', reason: 'Not in the assessment record' },
    ],
  },
  {
    key: 'lastSale',
    title: 'Last recorded sale',
    missing: 'No sale on record',
    fields: [
      { label: 'Date', key: 'date', kind: 'date', reason: 'Not in the sale record' },
      { label: 'Price', key: 'price', kind: 'money', reason: 'Not in the sale record' },
    ],
  },
  {
    key: 'valuation',
    title: 'ZentraValue',
    missing: 'No ZentraValue was returned for this property',
    fields: [
      { label: 'ZentraValue', key: 'predictedPrice', kind: 'money', reason: 'No estimate was returned' },
      { label: '80% range', key: 'range', kind: 'range', reason: 'No 80% range was returned' },
      { label: 'Confidence', key: 'confidenceScore', kind: 'confidence', highest: true, reason: 'Not stated with this ZentraValue' },
      { label: 'Change since last sale', key: 'growthPercentage', kind: 'change', highest: true, reason: 'Not returned with this ZentraValue' },
      { label: 'Estimated', key: 'predictionDate', kind: 'date', reason: 'Not returned with this ZentraValue' },
    ],
  },
  {
    key: 'scores',
    title: 'Location',
    missing: 'No location scores on record',
    fields: [
      { label: 'School score', key: 'schoolScore', kind: 'score', highest: true, reason: 'No score on record' },
      { label: 'Transportation score', key: 'transportationScore', kind: 'score', highest: true, reason: 'No score on record' },
    ],
  },
];

/** "+61.0%", "−4.2%", "0.0%" (a true minus sign, as on Opportunities). */
function signed(pct: number) {
  const v = Math.abs(pct).toFixed(1);
  return Number(v) === 0 ? v + '%' : (pct > 0 ? '+' : '−') + v + '%';
}
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/**
 * Compare, side by side (DESIGN.md §5 Compare, §7): the chosen properties as ruled rows with Remove,
 * the address picker and Compare (aria-disabled with its reason), then the comparison as a table of
 * fields by property. Missing values are the Unavailable marker with their reason; a group the
 * backend left out for a property is one merged span. The highest figure in a row says "Highest".
 */
@Component({
  selector: 'gz-side-by-side',
  imports: [PropertyPicker, PropertyRef, RouterLink, RequestStatus, ...TABLE_KIT],
  template: `
    <section class="cp-pick" aria-labelledby="cp-pick-title">
      <div class="cp-pick-head">
        <h2 id="cp-pick-title" tabindex="-1">Properties</h2>
        <p>Two to five. Add them by address here, or with Compare on any property.</p>
        <p class="cp-meta">{{ selection().length }} of {{ max }} chosen</p>
      </div>
      <div class="cp-pick-body">
        @if (selection().length) {
          <ul class="cp-chosen" aria-label="Chosen properties">
            @for (id of selection(); track id) {
              <li>
                <span class="cp-chosen-name">
                  @if (known(id); as name) {
                    <a [routerLink]="['/property', id]">{{ name }}</a>
                  } @else {
                    <gz-property-ref [propertyId]="id" />
                  }
                  @if (placeOf(id); as place) {
                    <small>{{ place }}</small>
                  }
                </span>
                <button
                  type="button"
                  class="linkbtn cp-remove"
                  [attr.aria-label]="'Remove ' + spoken(id) + ' from the comparison'"
                  (click)="remove(id)"
                >
                  Remove
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="cp-none">No properties chosen.</p>
        }
        <gz-property-picker
          mode="add"
          label="Add a property by address"
          [hint]="
            selection().length >= max
              ? 'Five are chosen, the most a comparison takes. Remove one to add another.'
              : 'Type at least 3 characters of the address, then pick a match to add it.'
          "
          [disabled]="selection().length >= max"
          [exclude]="selection()"
          (selected)="add($event)"
        />
        <div class="cp-actions">
          <button
            type="button"
            class="btn primary"
            [attr.aria-disabled]="why() ? 'true' : null"
            [attr.aria-describedby]="why() ? 'cp-why' : null"
            (click)="compare()"
          >
            {{ state().loading ? 'Comparing…' : 'Compare' }}
          </button>
          @if (selection().length) {
            <button type="button" class="btn" (click)="clear()">Clear all</button>
          }
          @if (why(); as reason) {
            <p class="cp-why" id="cp-why">{{ reason }}</p>
          }
        </div>
      </div>
    </section>

    <gz-request-status
      [loading]="state().loading && !shown()"
      loadingText="Comparing these properties…"
      [error]="state().error"
      (retry)="compare()"
    />
    @if (shown(); as r) {
      <section
        class="cp-result"
        aria-labelledby="cp-result-title"
        [class.busy]="state().loading"
        [attr.aria-busy]="state().loading ? 'true' : null"
      >
        <h2 id="cp-result-title" class="cp-count">
          {{ countOf(r.properties.length, 'property', 'properties') }} side by side
        </h2>
        @if (pending(r.requestedIds); as n) {
          <p class="cp-pending">
            {{ n === 1 ? '1 property was' : n + ' properties were' }} added after this comparison.
            Choose Compare to include {{ n === 1 ? 'it' : 'them' }}.
          </p>
        }
        @if (r.warnings.length) {
          @if (r.removed) {
            <!-- The backend's notes may count or name the properties removed since. -->
            <p class="cp-pending">
              {{ r.removed === 1 ? '1 property was' : r.removed + ' properties were' }} removed after
              this comparison, so its notes are left out. Choose Compare to update them.
            </p>
          } @else {
            <ul class="cp-notes">
              @for (warning of r.warnings; track warning) {
                <li>{{ warning }}</li>
              }
            </ul>
          }
        }
        @if (overflowing()) {
          <p class="cp-scroll">Scroll the table sideways to see all {{ r.properties.length }}.</p>
        }
        <div class="cp-wrap" #wrap>
          <table gz-table class="cp-table" [style.--cols]="r.properties.length">
            <caption class="sr-only">
              {{ countOf(r.properties.length, 'property', 'properties') }} compared field by field.
              Each column is a property; each row a field.
            </caption>
            <thead>
              <tr>
                <th scope="col" class="cp-corner"><span class="sr-only">Field</span></th>
                @for (p of r.properties; track p.propertyId) {
                  <th scope="col" class="cp-prop">
                    <a [routerLink]="['/property', p.propertyId]">{{ title(p) }}</a>
                    @if (place(p.countyName, p.stateCode); as where) {
                      <span class="cell-sub">{{ where }}</span>
                    }
                  </th>
                }
              </tr>
            </thead>
            @for (g of groups; track g.key) {
              <tbody>
                <tr class="cp-group">
                  <th scope="rowgroup" [attr.colspan]="r.properties.length + 1">
                    <span>{{ g.title }}</span>
                  </th>
                </tr>
                @for (f of g.fields; track f.key; let first = $first) {
                  <tr>
                    <th scope="row">{{ f.label }}</th>
                    @for (p of r.properties; track p.propertyId) {
                      @if (!p[g.key]) {
                        <!-- The backend left the whole group out: one merged span (DESIGN.md §6). -->
                        @if (first) {
                          <td
                            gz-cell
                            class="cp-merged"
                            [missing]="true"
                            [showReason]="true"
                            [reason]="g.missing"
                            [attr.rowspan]="g.fields.length"
                          ></td>
                        }
                      } @else {
                        @let text = show(p, g.key, f);
                        <td
                          gz-cell
                          [missing]="text === null"
                          [reason]="f.reason"
                          [showReason]="g.key !== 'facts'"
                          [class.cp-high]="highest(r.properties, g.key, f, p)"
                        >
                          {{ text }}
                          @if (highest(r.properties, g.key, f, p)) {
                            <span class="cp-high-word">Highest</span>
                          }
                        </td>
                      }
                    }
                  </tr>
                }
              </tbody>
            }
          </table>
        </div>
        @if (factsMissing(r.properties)) {
          <p class="table-note">Unavailable facts are not in the county record.</p>
        }
        <p class="table-note">
          @if (units(r.units); as u) {
            {{ u }}
          }
          ZentraValues are model estimates; assessments are not market values. “Highest” marks the
          largest figure in a row, not the better property.
        </p>
      </section>
    } @else if (!state().loading && !state().error && selection().length < min) {
      <div class="cp-empty">
        <p>Properties you compare appear here, field by field.</p>
        <a class="btn" routerLink="/explore">Explore properties</a>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    /* The selection: heading and one line on the left (4 of 12), the rows and the form on the right. */
    .cp-pick {
      display: grid;
      grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
      gap: var(--sp-16) var(--sp-24);
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    .cp-pick-head h2 {
      margin: 0;
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .cp-pick-head h2:focus {
      outline: none;
    }
    .cp-pick-head p {
      margin: var(--sp-4) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: 40ch;
    }
    .cp-pick-head .cp-meta {
      margin-top: var(--sp-8);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .cp-pick-body {
      min-width: 0;
    }
    .cp-chosen {
      margin: 0 0 var(--sp-16);
      padding: 0;
      list-style: none;
      border-top: 1px solid var(--rule);
    }
    .cp-chosen li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-12);
      padding: var(--sp-8) 0;
      border-bottom: 1px solid var(--rule);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .cp-chosen-name {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .cp-chosen small {
      display: block;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .cp-none {
      margin: 0 0 var(--sp-16);
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .cp-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
      margin-top: var(--sp-16);
    }
    .cp-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }

    /* The comparison. */
    .cp-result {
      margin-top: var(--sp-24);
      padding-top: var(--sp-16);
      border-top: 2px solid var(--ink);
    }
    .cp-result.busy {
      opacity: 0.6;
    }
    .cp-count {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .cp-pending {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--attention);
    }
    .cp-notes {
      margin: 0 0 var(--sp-12);
      padding: 0;
      list-style: none;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .cp-scroll {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .cp-table {
      table-layout: fixed;
    }
    .cp-table .cp-corner {
      width: 200px;
    }
    .cp-table thead .cp-prop {
      white-space: normal;
      vertical-align: bottom;
      color: var(--ink);
      font-weight: 500;
    }
    .cp-table thead .cp-prop a {
      overflow-wrap: anywhere;
    }
    .cp-table tbody th[scope='row'] {
      padding: 8px 10px;
      /* The global th rule keeps headers on one line; field names wrap in their column. */
      white-space: normal;
      overflow-wrap: anywhere;
      hyphens: auto;
      border-bottom: 1px solid var(--rule);
      color: var(--ink-2);
      font-weight: 400;
      text-align: left;
      vertical-align: top;
      background: var(--surface);
    }
    /* Group titles as in a record: 13 px/600 over a 1 px ink rule (no uppercase labels). */
    .cp-table tr.cp-group th {
      padding: 16px 10px 6px;
      border-bottom: 1px solid var(--ink);
      font-weight: 600;
      text-align: left;
      background: var(--surface);
    }
    .cp-table tbody:first-of-type tr.cp-group th {
      padding-top: 10px;
    }
    .cp-table tr.cp-group:hover > th,
    .cp-table tbody tr:hover > th {
      background: var(--surface);
    }
    .cp-table td {
      overflow-wrap: anywhere;
    }
    .cp-table td.cp-high {
      font-weight: 600;
    }
    .cp-high-word {
      display: block;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      font-weight: 400;
      color: var(--ink-2);
    }
    .cp-table td.cp-merged {
      vertical-align: middle;
    }
    .cp-empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-12);
      margin-top: var(--sp-24);
      padding: var(--sp-16) 0;
      border-top: 2px solid var(--ink);
    }
    .cp-empty p {
      margin: 0;
      max-width: var(--measure);
    }
    @media (max-width: 1023.98px) {
      .cp-pick {
        grid-template-columns: minmax(0, 1fr);
      }
      /* Each column is a property, so none can be dropped: the properties scroll sideways inside
         the table while the field names stay put. The page itself never scrolls sideways. */
      .cp-wrap {
        overflow-x: auto;
      }
      /* The frame is now the header's scroll container: offset by the top bar, the header would sit
         60 px down inside it, over the first rows. */
      .cp-table thead th {
        top: 0;
      }
      /* A fixed layout needs a set width (with width: auto the browser widens the field names to
         their text): the field names plus one column per property, and at least the frame. */
      .cp-table {
        --corner: 132px;
        --col: 160px;
        width: calc(var(--corner) + var(--cols, 2) * var(--col));
        min-width: 100%;
      }
      /* Widths include the padding, so the columns add up to what they say. */
      .cp-table th,
      .cp-table td {
        box-sizing: border-box;
      }
      .cp-table .cp-corner {
        width: var(--corner);
      }
      .cp-table thead .cp-prop {
        width: var(--col);
      }
      .cp-table .cp-corner,
      .cp-table tbody th[scope='row'] {
        position: sticky;
        left: 0;
        z-index: 1;
        box-shadow: inset -1px 0 0 var(--rule);
      }
      .cp-table thead .cp-corner {
        z-index: 3;
      }
      .cp-table tr.cp-group th span {
        position: sticky;
        left: 10px;
      }
    }
    @media (max-width: 700px) {
      .cp-pick {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
      /* 112 + 2 x 120 = 352 px: two properties fit beside the field names at 390 px, and the
         longest word in a field name ("Transportation") fits its column with 8 and 6 px padding. */
      .cp-table {
        --corner: 112px;
        --col: 120px;
      }
      .cp-table tbody th[scope='row'] {
        padding: 8px 6px 8px 8px;
      }
    }
  `,
})
export class SideBySide {
  readonly w = inject(Workspace);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly state = this.w.store.selectSignal(selectPropertyCompare);
  readonly selection = computed(() => this.state().selection);
  readonly groups = GROUPS;
  readonly min = COMPARE_MIN;
  readonly max = COMPARE_MAX;
  readonly place = placeLine;
  readonly countOf = countOf;

  /** The table is wider than its column (narrow screens, many properties): say it scrolls. */
  private readonly wrap = viewChild<ElementRef<HTMLElement>>('wrap');
  readonly overflowing = signal(false);
  constructor() {
    let observer: ResizeObserver | null = null;
    effect(() => {
      const el = this.wrap()?.nativeElement;
      observer?.disconnect();
      observer = null;
      if (!el || typeof ResizeObserver === 'undefined') {
        this.overflowing.set(false);
        return;
      }
      const measure = () => this.overflowing.set(el.scrollWidth > el.clientWidth + 1);
      observer = new ResizeObserver(measure);
      observer.observe(el);
      const table = el.querySelector('table');
      if (table) observer.observe(table);
    });
    inject(DestroyRef).onDestroy(() => observer?.disconnect());
  }

  /** The comparison on screen, without the properties removed since it ran (no stale columns). */
  readonly shown = computed(() => {
    const r = this.state().response;
    if (!r) return null;
    const selected = new Set(this.selection());
    const properties = r.properties.filter((p) => selected.has(p.propertyId));
    // Removed since it ran: counted against what was asked for, since a note may be about a
    // property the backend left out.
    const removed = r.requestedIds.filter((id) => !selected.has(id)).length;
    return properties.length >= COMPARE_MIN ? { ...r, properties, removed } : null;
  });

  /** Why Compare can't run, written beside it (DESIGN.md §12); null when it can. */
  readonly why = computed(() => {
    if (this.state().loading) return 'Comparing these properties…';
    const n = this.selection().length;
    if (n === 0) return 'Choose at least 2 properties.';
    if (n < COMPARE_MIN) return 'Choose one more property.';
    return null;
  });

  /** Addresses the comparison returned, by property. */
  private readonly names = computed(() => {
    const names: Record<number, { name: string | null; place: string }> = {};
    for (const p of this.state().response?.properties ?? []) {
      names[p.propertyId] = {
        name: p.address || (p.folio ? 'Folio ' + formatFolio(p.folio) : null),
        place: placeLine(p.countyName, p.stateCode),
      };
    }
    return names;
  });

  /** The property's name when the comparison or the catalog has it; otherwise gz-property-ref looks it up. */
  known(id: number): string | null {
    const fromCompare = this.names()[id]?.name;
    if (fromCompare) return fromCompare;
    const home = this.w.home(id);
    if (home?.address) return home.address;
    return home?.folio ? 'Folio ' + formatFolio(home.folio) : null;
  }
  placeOf(id: number): string | null {
    const fromCompare = this.names()[id]?.place;
    if (fromCompare) return fromCompare;
    const home = this.w.home(id);
    return home ? placeLine(home.city, home.stateCode, home.zip) || null : null;
  }
  /** For a button's spoken name: never "Property 42". */
  spoken(id: number) {
    return this.known(id) ?? 'the property with ID ' + id;
  }
  title(p: PropertyComparison) {
    return p.address || (p.folio ? 'Folio ' + formatFolio(p.folio) : 'Address unavailable');
  }
  /** Chosen after the comparison ran, so not in it yet. */
  pending(requested: number[]) {
    const asked = new Set(requested);
    return this.selection().filter((id) => !asked.has(id)).length;
  }
  units(units: Record<string, string>) {
    const parts = [
      units['currency'] ? 'money in ' + units['currency'] : null,
      units['area'] === 'sqft' ? 'areas in square feet' : units['area'] ? 'areas in ' + units['area'] : null,
    ].filter(Boolean);
    if (!parts.length) return null;
    const line = parts.join(', ');
    return line[0].toUpperCase() + line.slice(1) + '.';
  }
  factsMissing(properties: PropertyComparison[]) {
    return properties.some(
      (p) => p.facts && GROUPS[0].fields.some((f) => this.raw(p, 'facts', f) === null),
    );
  }

  private raw(p: PropertyComparison, group: GroupKey, f: Field): unknown {
    const g = p[group] as Record<string, unknown> | null;
    if (!g) return null;
    if (f.kind === 'range') {
      const low = g['low'];
      const high = g['high'];
      return typeof low === 'number' && typeof high === 'number' ? [low, high] : null;
    }
    const v = g[f.key];
    return v === undefined || v === '' ? null : v;
  }
  /** The value as written in the cell; null when it is missing (the Unavailable marker). */
  show(p: PropertyComparison, group: GroupKey, f: Field): string | null {
    const v = this.raw(p, group, f);
    if (v === null) return null;
    switch (f.kind) {
      case 'money':
        return typeof v === 'number' ? usd.format(v) : null;
      case 'count':
        return typeof v === 'number' ? count.format(v) : null;
      case 'range': {
        const [low, high] = v as [number, number];
        return usd.format(low) + ' to ' + usd.format(high);
      }
      case 'date':
        return formatRecordDate(String(v));
      case 'change':
        return typeof v === 'number' && Number.isFinite(v) ? signed(v) : null;
      case 'score':
        return typeof v === 'number' ? Math.round(v) + ' of 100' : null;
      case 'confidence':
        // DESIGN.md §9: the comparison sends the score without a band, so the score alone.
        return typeof v === 'number' ? formatConfidenceValue(v, null) : null;
      default:
        return String(v);
    }
  }
  /** The largest figure in the row, when at least two properties have one and they differ. */
  highest(properties: PropertyComparison[], group: GroupKey, f: Field, p: PropertyComparison) {
    if (!f.highest || properties.length < 2) return false;
    const mine = this.raw(p, group, f);
    if (typeof mine !== 'number') return false;
    const values = properties
      .map((x) => this.raw(x, group, f))
      .filter((x): x is number => typeof x === 'number');
    if (values.length < 2 || new Set(values).size === 1) return false;
    return mine === Math.max(...values);
  }

  add(id: number | null) {
    if (!id) return;
    if (this.selection().includes(id)) {
      this.w.toast('That property is already chosen.');
      return;
    }
    this.w.store.dispatch(A.toggle({ propertyId: id }));
  }
  remove(id: number) {
    const index = this.selection().indexOf(id);
    this.w.store.dispatch(A.toggle({ propertyId: id }));
    // Its row goes: focus moves to the Remove that takes its place, or to the heading.
    afterNextRender(
      () => {
        const buttons = this.host.nativeElement.querySelectorAll<HTMLElement>('.cp-remove');
        const next = buttons[Math.min(index, buttons.length - 1)];
        (next ?? this.host.nativeElement.querySelector<HTMLElement>('#cp-pick-title'))?.focus();
      },
      { injector: this.injector },
    );
  }
  clear() {
    this.w.store.dispatch(A.clear());
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('#cp-pick-title')?.focus(),
      { injector: this.injector },
    );
  }
  compare() {
    if (this.why()) return;
    this.w.store.dispatch(A.load());
  }
}
