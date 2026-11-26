import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PropertyPicker } from '../../shared/components/property-picker';
import { RequestStatus } from '../../shared/components/request-status';
import { Reasons } from '../../shared/components/reasons';
import { TABLE_KIT } from '../../shared/table';
import { countOf, formatFolio, formatRecordDate } from '../../shared/data/format';
import { labelFor } from '../../shared/pipes/label.pipe';
import { ComparableDTO, ComparableResponse } from '../../core/models/api';
import { ComparablesActions as A } from '../../store/comparables/comparables.actions';
import { selectComparables } from '../../store/comparables/comparables.selectors';

const METERS_PER_MILE = 1609.344;
/** The API takes radiusMeters 100 to 10,000; in miles (DESIGN.md §13: one unit, miles), 0.1 to 6.2. */
const MILES_MIN = 0.1;
const MILES_MAX = 6.2;
const MONTHS_MAX = 120;
/** The most rows this page asks for. */
const LIMIT = 20;
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
/** The searched distance as typed: 1.25 miles reads "1.25", not "1.3". */
const searched = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** The facts a comparable can lack, in the page's words (DESIGN.md §13: no field names). */
const FACT_WORDS: Record<string, string> = {
  bedrooms: 'bedrooms',
  bathrooms: 'bathrooms',
  livingAreaSqft: 'living area',
  yearBuilt: 'year built',
  lotSize: 'lot size',
  lotSizeSqft: 'lot size',
};

/** "0.4", "< 0.1": a distance in miles for a column headed "Distance, mi". */
function miles(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  const mi = meters / METERS_PER_MILE;
  return mi < 0.1 ? '< 0.1' : mi.toFixed(1);
}

/**
 * Compare, comparable sales (DESIGN.md §5 Compare, §7): the recorded sales most like one property,
 * for a distance in miles and a sale history in months. The ranked table (rank, property with its
 * facts and what it lacks, sold, price, distance, match, evidence, why it was chosen; a row opens
 * the sold property), the backend's warnings as notes, and the selection and ranking versions and
 * weights under Method.
 */
@Component({
  selector: 'gz-comparable-sales',
  imports: [FormsModule, RouterLink, PropertyPicker, RequestStatus, Reasons, ...TABLE_KIT],
  template: `
    <form class="cs-form" (ngSubmit)="load()" aria-label="Find comparable sales">
      <gz-property-picker
        class="cs-picker"
        label="Property"
        [propertyId]="id()"
        (selected)="pick($event)"
      />
      <div class="formfield cs-num">
        <label for="cs-miles">Within, miles</label>
        <input
          id="cs-miles"
          name="miles"
          type="number"
          inputmode="decimal"
          [min]="milesMin"
          [max]="milesMax"
          step="0.05"
          [(ngModel)]="distance"
        />
      </div>
      <div class="formfield cs-num">
        <label for="cs-months">Sold in the last, months</label>
        <input
          id="cs-months"
          name="months"
          type="number"
          inputmode="numeric"
          min="1"
          [max]="monthsMax"
          step="1"
          [(ngModel)]="months"
        />
      </div>
      <div class="cs-go">
        <button
          type="submit"
          class="btn primary"
          [attr.aria-disabled]="why() ? 'true' : null"
          [attr.aria-describedby]="why() ? 'cs-why' : null"
        >
          Find comparable sales
        </button>
        @if (why(); as reason) {
          <p class="cs-why" id="cs-why">{{ reason }}</p>
        }
      </div>
    </form>

    <gz-request-status
      [loading]="mine() && state().loading"
      loadingText="Finding comparable sales…"
      [error]="mine() ? state().error : null"
      (retry)="load()"
    />
    @if (result(); as r) {
      <section class="cs-result" aria-labelledby="cs-title">
        <h2 id="cs-title">
          {{ r.returnedCount ? countOf(r.returnedCount, 'comparable sale') : 'No comparable sales' }}
        </h2>
        <p class="cs-line">{{ searchLine(r) }}</p>
        @if (subject(r); as facts) {
          <p class="cs-line">{{ facts }}</p>
        }
        @if (statusNote(r); as note) {
          <p class="cs-status">{{ note }}</p>
        }
        @if (r.warnings.length || r.candidatePoolLimitReached) {
          <ul class="cs-notes">
            @for (warning of r.warnings; track warning) {
              <li>{{ warning }}</li>
            }
            @if (r.candidatePoolLimitReached) {
              <li>
                The search stopped at its limit of {{ count(r.candidatePoolLimit) }} candidate
                sales; others were not considered.
              </li>
            }
          </ul>
        }
        @if (r.comparables.length) {
          <table gz-table class="cs-table" (activated)="open(r, $event)">
            <caption class="sr-only">
              Comparable sales, most similar first. Choose a row to open the sold property's
              record.
            </caption>
            <thead>
              <tr>
                <th scope="col" class="num">Rank</th>
                <th scope="col">Property</th>
                <th scope="col" class="num" data-priority="2">Sold</th>
                <th scope="col" class="num">Price</th>
                <th scope="col" class="num" data-priority="2">Distance, mi</th>
                <th scope="col" class="num" data-priority="2">Match</th>
                <th scope="col" class="num" data-priority="3">Evidence</th>
                <th scope="col" data-priority="3">Why it was chosen</th>
              </tr>
            </thead>
            <tbody>
              @for (c of r.comparables; track c.candidate.saleId) {
                <!-- Keyed by sale: one property can have two qualifying sales. -->
                <tr [gz-row]="c.candidate.saleId">
                  <td class="num">{{ c.rank }}</td>
                  <td>
                    <a class="cell-main" [routerLink]="['/property', c.candidate.propertyId]">{{
                      name(c)
                    }}</a>
                    @if (facts(c); as f) {
                      <span class="cell-sub">{{ f }}</span>
                    }
                    @if (lacks(c); as l) {
                      <span class="cell-sub">Not on record: {{ l }}</span>
                    }
                    <span class="cell-sub m-only">{{ phoneLine(c) }}</span>
                    <!-- Below 1024 px the reasons and evidence columns go; their words stay here. -->
                    <span class="cell-sub cs-why-sub">{{ whyLine(c) }}</span>
                  </td>
                  <td class="num nowrap" data-priority="2">{{ day(c.candidate.saleDate) }}</td>
                  <td class="num nowrap">{{ money(c.candidate.salePrice) }}</td>
                  <td
                    gz-cell
                    class="num"
                    data-priority="2"
                    [missing]="miles(c.candidate.distanceMeters) === null"
                    reason="No distance was returned"
                  >
                    {{ miles(c.candidate.distanceMeters) }}
                  </td>
                  <td class="num" data-priority="2">{{ match(c) }}%</td>
                  <td class="num" data-priority="3">{{ c.evidenceCoveragePercent }}%</td>
                  <td data-priority="3">
                    @if (c.selectionReasons.length) {
                      <gz-reasons
                        [reasons]="c.selectionReasons"
                        [label]="'Why ' + name(c) + ' was chosen'"
                      />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (noDistance(r)) {
            <p class="table-note">Unavailable distance: none was returned for that sale.</p>
          }
          <p class="table-note">
            Match is how alike the sale is to this property. Evidence is how much of what the
            ranking weighs was on record for it. Comparable sales are not appraisals or price
            estimates.
          </p>
        } @else if (!r.warnings.length) {
          <!-- With warnings, they say why; without, what might help. -->
          <p class="cs-none">Nothing matched this search. A longer distance or sale history may find some.</p>
        }
        <details class="cs-method">
          <summary>Method</summary>
          <p>Selection {{ r.selectionVersion }}; ranking {{ r.rankingVersion }}.</p>
          @if (weights(r); as w) {
            <p>The ranking weighs {{ w }}.</p>
          }
          @if (filters(r); as f) {
            <p>Sales pass when {{ f }}.</p>
          }
          <p>
            {{ countOf(r.consideredCandidates, 'recorded sale') }} considered; at least
            {{ r.minimumCandidates }} are needed for a reliable comparison.
          </p>
        </details>
      </section>
    } @else if (!id() && !state().loading) {
      <p class="cs-empty">Choose a property by address to list the recorded sales most like it.</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .cs-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr);
      align-items: start;
      gap: var(--sp-12) var(--sp-16);
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    .cs-picker {
      grid-column: 1 / -1;
    }
    .cs-num {
      margin: 0;
    }
    .cs-go {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
      /* Line the button up with the fields, under their labels. */
      padding-top: calc(var(--lh-cell) + 6px);
    }
    .cs-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .cs-result {
      margin-top: var(--sp-24);
      padding-top: var(--sp-16);
      border-top: 2px solid var(--ink);
    }
    .cs-result h2 {
      margin: 0 0 var(--sp-4);
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .cs-line {
      margin: 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .cs-status {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--attention);
    }
    .cs-notes {
      margin: var(--sp-8) 0 0;
      padding: 0;
      list-style: none;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .cs-table {
      margin-top: var(--sp-12);
    }
    .cs-why-sub {
      display: none;
    }
    /* Tablets: the reasons and evidence columns would push the table past the page (the pro shell
       leaves about 624 px at 768); their words move under the property. */
    @media (max-width: 1023.98px) {
      .cs-table [data-priority='3'] {
        display: none;
      }
      .cs-table .cs-why-sub {
        display: block;
      }
    }
    .cs-none,
    .cs-empty {
      margin: var(--sp-12) 0 0;
      max-width: var(--measure);
    }
    .cs-empty {
      margin-top: var(--sp-24);
    }
    .cs-method {
      margin-top: var(--sp-16);
      font-size: var(--fs-cell);
    }
    .cs-method summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
    .cs-method p {
      margin: var(--sp-8) 0 0;
      color: var(--ink-2);
      max-width: var(--measure);
    }
    @media (max-width: 700px) {
      .cs-form {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
      .cs-go {
        grid-column: 1 / -1;
        padding-top: 0;
      }
    }
  `,
})
export class ComparableSales {
  private readonly w = inject(Workspace);
  private readonly router = inject(Router);
  /** The property from the address (/compare/:id); picking another replaces it on the page. */
  readonly startId = input<number | null>(null);
  /** Another property picked here: the page puts it in the address, which comes back as startId. */
  readonly picked = output<number>();
  readonly id = linkedSignal(() => this.startId());
  readonly state = this.w.store.selectSignal(selectComparables);
  readonly milesMin = MILES_MIN;
  readonly milesMax = MILES_MAX;
  readonly monthsMax = MONTHS_MAX;
  readonly countOf = countOf;
  readonly miles = miles;
  /** 1.25 miles (2,012 m) covers the property page's 2 km search; 24 months as there. */
  distance: number | null = 1.25;
  months: number | null = 24;

  /** The store's answer when it is for the property on this page (another page's is never shown). */
  readonly mine = computed(() => this.id() !== null && this.state().propertyId === this.id());
  readonly result = computed<ComparableResponse | null>(() =>
    this.mine() ? this.state().response : null,
  );

  constructor() {
    // A property from the address is searched straight away.
    effect(() => {
      const id = this.startId();
      if (id !== null) untracked(() => this.load());
    });
  }

  /** What is missing or out of range in the search; null when it can be sent. */
  private invalid(): string | null {
    if (this.id() === null) return 'Choose a property first.';
    const d = this.distance;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < MILES_MIN || d > MILES_MAX)
      return `Enter a distance from ${MILES_MIN} to ${MILES_MAX} miles.`;
    const m = this.months;
    if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > MONTHS_MAX)
      return `Enter whole months from 1 to ${MONTHS_MAX}.`;
    return null;
  }
  /** Why the search can't run, beside the button (DESIGN.md §12); null when it can. */
  why(): string | null {
    return this.invalid() ?? (this.mine() && this.state().loading ? 'Finding comparable sales…' : null);
  }
  pick(id: number | null) {
    // "Change" clears the picker; the address keeps the last property until another is picked.
    if (id === null) {
      this.id.set(null);
      return;
    }
    this.id.set(id);
    if (id === this.startId()) this.load();
    else this.picked.emit(id);
  }
  load() {
    const id = this.id();
    if (id === null || this.why()) return;
    const radiusMeters = Math.min(10000, Math.max(100, Math.round(this.distance! * METERS_PER_MILE)));
    this.w.store.dispatch(
      A.load({ id, query: { radiusMeters, months: this.months!, limit: LIMIT } }),
    );
  }
  open(r: ComparableResponse, saleId: unknown) {
    const sale = r.comparables.find((c) => c.candidate.saleId === saleId);
    if (sale) void this.router.navigate(['/property', sale.candidate.propertyId]);
  }
  noDistance(r: ComparableResponse) {
    return r.comparables.some((c) => miles(c.candidate.distanceMeters) === null);
  }
  /** The reasons and evidence in one line, for screens without their columns. */
  whyLine(c: ComparableDTO) {
    return [...c.selectionReasons.slice(0, 2), 'evidence ' + c.evidenceCoveragePercent + '%'].join(
      ' · ',
    );
  }

  name(c: ComparableDTO) {
    const x = c.candidate;
    return x.address || (x.folio ? 'Folio ' + formatFolio(x.folio) : 'Address unavailable');
  }
  facts(c: ComparableDTO) {
    const x = c.candidate;
    return (
      [
        x.bedrooms !== null ? x.bedrooms + ' bd' : null,
        x.bathrooms !== null ? x.bathrooms + ' ba' : null,
        x.livingAreaSqft !== null ? whole.format(x.livingAreaSqft) + ' sq ft' : null,
        x.yearBuilt ? 'built ' + x.yearBuilt : null,
      ]
        .filter(Boolean)
        .join(' · ') || null
    );
  }
  /** What the backend says this sale lacks, in words; a field it names that we don't know is left out. */
  lacks(c: ComparableDTO) {
    const words = [...new Set(c.missingData.map((k) => FACT_WORDS[k]).filter(Boolean))];
    return words.length ? words.join(', ') : null;
  }
  phoneLine(c: ComparableDTO) {
    const d = miles(c.candidate.distanceMeters);
    return [
      this.day(c.candidate.saleDate) ? 'Sold ' + this.day(c.candidate.saleDate) : null,
      d ? d + ' mi' : 'distance unavailable',
      this.match(c) + '% match',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  day(value: string | null) {
    return formatRecordDate(value);
  }
  money(v: number) {
    return usd.format(v);
  }
  count(v: number) {
    return whole.format(v);
  }
  /** The API reports similarity as 0 to 1 or 0 to 100 depending on version (as on the property page). */
  match(c: ComparableDTO) {
    const s = c.similarityScore;
    return Math.round(s <= 1 ? s * 100 : s);
  }
  /** "Within 1.2 mi, sold since Nov 14, 2024, most similar first · records as of Nov 14, 2026". */
  searchLine(r: ComparableResponse) {
    const meters = r.search.radiusMeters;
    const d = typeof meters === 'number' && meters > 0 ? searched.format(meters / METERS_PER_MILE) : null;
    const since = formatRecordDate(r.saleDateFrom);
    const asOf = formatRecordDate(r.asOfDate);
    const head = [
      d ? 'Within ' + d + ' mi' : null,
      since ? 'sold since ' + since : null,
      'most similar first',
    ]
      .filter(Boolean)
      .join(', ');
    return head[0].toUpperCase() + head.slice(1) + (asOf ? ' · records as of ' + asOf : '');
  }
  subject(r: ComparableResponse) {
    const s = r.subject;
    const known = [
      s.bedrooms !== null ? s.bedrooms + ' bd' : null,
      s.bathrooms !== null ? s.bathrooms + ' ba' : null,
      s.livingAreaSqft !== null ? whole.format(s.livingAreaSqft) + ' sq ft' : null,
      s.yearBuilt ? 'built ' + s.yearBuilt : null,
    ].filter(Boolean);
    const missing = [
      s.bedrooms === null ? 'bedrooms' : null,
      s.bathrooms === null ? 'bathrooms' : null,
      s.livingAreaSqft === null ? 'living area' : null,
      !s.yearBuilt ? 'year built' : null,
    ].filter(Boolean);
    if (!known.length)
      return missing.length ? 'Not on record for this property: ' + missing.join(', ') : null;
    return (
      'This property: ' +
      known.join(' · ') +
      (missing.length ? '; not on record: ' + missing.join(', ') : '')
    );
  }
  /** A status other than "found", when the backend's warnings don't already say it. */
  statusNote(r: ComparableResponse) {
    if (r.status === 'COMPARABLES_FOUND' || r.warnings.length) return null;
    return r.status === 'INSUFFICIENT_DATA'
      ? `Not enough sales for a reliable comparison: at least ${r.minimumCandidates} are needed.`
      : labelFor(r.status) + '.';
  }
  weights(r: ComparableResponse) {
    const entries = Object.entries(r.scoringWeights ?? {}).filter(
      ([, v]) => typeof v === 'number' && Number.isFinite(v),
    );
    if (!entries.length) return null;
    return entries
      .map(([k, v]) => labelFor(k).toLowerCase() + ' ' + Math.round(v <= 1 ? v * 100 : v) + '%')
      .join(', ');
  }
  filters(r: ComparableResponse) {
    const q = r.search;
    const parts = [
      typeof q.areaTolerancePercent === 'number'
        ? `the living area is within ${q.areaTolerancePercent}% of this property's`
        : null,
      typeof q.bedroomTolerance === 'number'
        ? `the bedroom count is within ${q.bedroomTolerance} of this property's`
        : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' and ') : null;
  }
}
