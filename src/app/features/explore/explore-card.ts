import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PropertySearchItem } from '../../core/models/api';
import { PropertyValuePrediction } from '../../core/models/property_prediction_value';
import { Workspace } from '../../shared/data/workspace';
import { formatConfidence, isLowConfidence, joinParts, placeLine } from '../../shared/data/format';
import { FavoriteButton } from '../../shared/components/favorite-button';
import { CompareToggle } from '../../shared/components/compare-toggle';
import { Icon } from '../../shared/components/icon/icon';
import { rowTitle } from './explore-row';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const n = (v: number) => v.toLocaleString('en-US');

/**
 * One result on Explore, as a photo card beside the map (Zillow-like, asked for on Nov 19, 2026).
 * The ZentraValue leads, as a price would; it is GeoZentra's estimate, never an asking price, and
 * missing values say Unavailable. A click on the card (or "Show on map") picks it on the map; the
 * address opens the property record.
 */
@Component({
  selector: 'gz-explore-card',
  imports: [RouterLink, FavoriteButton, CompareToggle, Icon],
  host: {
    '[class.sel]': 'selected()',
    '(click)': 'onClick($event)',
  },
  template: `
    <div class="xc-photo">
      @if (photo(); as url) {
        <img [src]="url" alt="" loading="lazy" decoding="async" (error)="failedUrl.set(url)" />
      } @else {
        <div class="xc-nophoto">
          <gz-icon name="home" /><span>{{ photoError() ? 'Photos unavailable' : 'No photo' }}</span>
        </div>
      }
      @if (home().propertyType) {
        <span class="xc-type">{{ home().propertyType }}</span>
      }
      <gz-favorite-button class="xc-fav" [propertyId]="home().id" [address]="title()" />
    </div>
    <div class="xc-body">
      @if (prediction(); as p) {
        <p class="xc-value">
          <span class="xc-figure">{{ money(p.predictedPrice) }}</span>
          <span class="xc-label">ZentraValue</span>
        </p>
        <p class="xc-conf" [class.low]="low(p)">{{ confidence(p) }}</p>
      } @else if (valuesLoading()) {
        <p class="xc-value"><span class="xc-skel" aria-hidden="true"></span></p>
        <p class="xc-conf"><span class="sr-only">Loading ZentraValue</span>&nbsp;</p>
      } @else {
        <p class="xc-value na">
          <span class="na-word">Unavailable</span><span class="xc-label">ZentraValue</span>
        </p>
        <p class="xc-conf">{{ valuesError() ? 'ZentraValues could not load.' : 'No estimate was returned for this property.' }}</p>
      }
      <p class="xc-facts">{{ facts() }}</p>
      @if (missing()) {
        <p class="xc-missing">{{ missing() }}</p>
      }
      <a class="xc-address" [routerLink]="['/property', home().id]">{{ title() }}</a>
      @if (place()) {
        <p class="xc-place">{{ place() }}</p>
      }
      <div class="xc-foot">
        <label class="xc-compare">
          <gz-compare-toggle [propertyId]="home().id" [label]="title()" [check]="true" />
          Compare
        </label>
        <button
          type="button"
          class="xc-show"
          [attr.aria-label]="'Show on map: ' + title()"
          (click)="picked.emit()"
        >
          Show on map
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: var(--surface);
      border: 1px solid var(--rule);
      cursor: pointer;
      transition: border-color var(--dur-color) ease;
    }
    :host(:hover) {
      border-color: var(--rule-strong);
    }
    /* Picked: the copper of the map's selected pin and boundary. */
    :host(.sel) {
      border-color: var(--copper);
      box-shadow: inset 0 0 0 1px var(--copper);
    }
    .xc-photo {
      position: relative;
      aspect-ratio: 16 / 10;
      background: var(--paper);
      overflow: hidden;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .xc-nophoto {
      display: grid;
      place-items: center;
      align-content: center;
      gap: var(--sp-8);
      height: 100%;
      color: var(--ink-2);
      font-size: var(--fs-caption);
    }
    .xc-type {
      position: absolute;
      top: 8px;
      left: 8px;
      padding: 2px 6px;
      background: var(--surface);
      color: var(--ink);
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
    }
    .xc-fav {
      position: absolute;
      top: 6px;
      right: 6px;
    }
    .xc-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      padding: 10px 12px 10px;
    }
    p {
      margin: 0;
    }
    .xc-value {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-height: 30px;
    }
    .xc-value.na {
      padding: 2px 6px;
      margin: 0 -6px;
    }
    .xc-figure {
      font-size: var(--fs-title);
      line-height: var(--lh-title);
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .xc-label,
    .xc-conf,
    .xc-place,
    .xc-missing {
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .xc-conf.low {
      color: var(--attention);
    }
    .xc-skel {
      display: block;
      width: 120px;
      height: 24px;
      background: var(--skeleton);
    }
    .xc-facts {
      margin-top: var(--sp-8);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      font-variant-numeric: tabular-nums lining-nums;
    }
    .xc-address {
      margin-top: 2px;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      font-weight: 500;
      color: var(--ink);
      overflow-wrap: anywhere;
    }
    .xc-address:hover {
      color: var(--copper);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .xc-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-8);
      margin-top: auto;
      padding-top: var(--sp-8);
      font-size: var(--fs-caption);
      color: var(--ink-2);
    }
    .xc-compare {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .xc-show {
      padding: 4px 0;
      background: transparent;
      color: var(--copper);
      font-size: var(--fs-caption);
      font-weight: 500;
    }
    .xc-show:hover {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
  `,
})
export class ExploreCard {
  readonly home = input.required<PropertySearchItem>();
  /** The page's predictions answer for this property; undefined when none was returned. */
  readonly prediction = input<PropertyValuePrediction | null | undefined>(null);
  readonly valuesLoading = input(false);
  readonly valuesError = input(false);
  readonly selected = input(false);
  /** Show this property on the map. */
  readonly picked = output<void>();

  private readonly w = inject(Workspace);
  readonly failedUrl = signal<string | null>(null);
  private readonly photoUrl = computed(() => {
    const images = this.w.catalog().photos[this.home().id];
    return (images?.find((p) => p.primaryImage) ?? images?.[0])?.storagePath ?? null;
  });
  readonly photo = computed(() => (this.failedUrl() === this.photoUrl() ? null : this.photoUrl()));
  readonly photoError = computed(() => !!this.w.catalog().photoErrors[this.home().id]);
  readonly title = computed(() => rowTitle(this.home()));
  readonly place = computed(() => {
    const h = this.home();
    const where = placeLine(h.city || h.countyName, h.stateCode, h.zip);
    return h.address ? where : joinParts('. ', 'No street address on record', where);
  });
  /** "3 beds · 2 baths · 1,840 sq ft · Built 1952": what the record has, a figure kept with its unit. */
  readonly facts = computed(() => {
    const h = this.home();
    const count = (v: number | null, one: string, many: string) =>
      v == null ? null : `${n(v)} ${v === 1 ? one : many}`;
    return joinParts(
      ' · ',
      count(h.bedrooms, 'bed', 'beds'),
      count(h.bathrooms, 'bath', 'baths'),
      h.livingAreaSqft == null ? null : `${n(h.livingAreaSqft)} sq ft`,
      h.yearBuilt ? 'Built ' + h.yearBuilt : null,
    );
  });
  /** "Unavailable: beds, year built", for what the record lacks; never shown as 0 or a dash. */
  readonly missing = computed(() => {
    const h = this.home();
    const m = [
      h.bedrooms == null && 'beds',
      h.bathrooms == null && 'baths',
      h.livingAreaSqft == null && 'living area',
      !h.yearBuilt && 'year built',
    ].filter(Boolean);
    return m.length ? 'Unavailable: ' + m.join(', ') : '';
  });

  money(v: number) {
    return usd.format(v);
  }
  /** DESIGN.md §9: "Confidence 78 of 100 · Medium", the score and the band as the prediction sends them. */
  confidence(p: PropertyValuePrediction) {
    return formatConfidence(p.confidenceScore, p.confidence);
  }
  low(p: PropertyValuePrediction) {
    return isLowConfidence(p.confidence);
  }
  /** The whole card picks it on the map; links, buttons and the checkbox inside keep their own job. */
  onClick(event: MouseEvent) {
    const hit = (event.target as HTMLElement).closest('a, button, input, label');
    if (!hit) this.picked.emit();
  }
}
