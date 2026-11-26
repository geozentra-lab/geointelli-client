import { FavoriteButton } from './favorite-button';
import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PropertySearchItem } from '../../core/models/api';
import { Workspace } from '../data/workspace';
import { Icon } from './icon/icon';
import { CompareToggle } from './compare-toggle';
import { Cell } from './missing';
import { formatFolio, placeLine } from '../data/format';

/**
 * A property in a grid of results (Explore, Saved, Opportunities, until those become tables). The
 * address links to the record. Facts sit in a small ruled grid; a fact the record doesn't have is
 * marked Unavailable on the hatch, with the reason written once under the grid. No value is shown
 * as a dash or zero, and a missing folio is left out rather than printed as "null".
 */
@Component({
  selector: 'gz-property-card',
  imports: [FavoriteButton, RouterLink, DecimalPipe, Icon, CompareToggle, Cell],
  template: `<article class="property" [attr.aria-labelledby]="'property-' + home().id">
    <div class="propertyimage">
      <a [routerLink]="['/property', home().id]" tabindex="-1" aria-hidden="true">
        @if (photo(); as url) {
          <img
            [src]="url"
            alt=""
            loading="lazy"
            (error)="failedUrl.set(photo() || null)"
            decoding="async"
          />
        } @else {
          <div class="property-photo-empty">
            <gz-icon name="home" /><span>{{
              w.catalog().photoErrors[home().id] ? 'Photos unavailable' : 'No photo'
            }}</span>
          </div>
        }
      </a>
      @if (home().propertyType) {
        <span class="tag">{{ home().propertyType }}</span>
      }
      <gz-favorite-button [propertyId]="home().id" [address]="title()" />
    </div>
    <div class="propertybody">
      <a class="propertyaddress" [id]="'property-' + home().id" [routerLink]="['/property', home().id]">{{
        title()
      }}</a>
      @if (place()) {
        <div class="propertyplace">{{ place() }}</div>
      }
      <dl class="cardfacts">
        <div>
          <dt>Beds</dt>
          <dd gz-cell [missing]="home().bedrooms == null">{{ home().bedrooms }}</dd>
        </div>
        <div>
          <dt>Baths</dt>
          <dd gz-cell [missing]="home().bathrooms == null">{{ home().bathrooms }}</dd>
        </div>
        <div>
          <dt>Living area, sq ft</dt>
          <dd gz-cell [missing]="home().livingAreaSqft == null">
            {{ home().livingAreaSqft | number }}
          </dd>
        </div>
        <div>
          <dt>Year built</dt>
          <dd gz-cell [missing]="!home().yearBuilt">{{ home().yearBuilt }}</dd>
        </div>
      </dl>
      @if (missingFacts()) {
        <p class="cardnote">Unavailable: not in the property record.</p>
      }
      <div class="propertyfoot">
        @if (folio()) {
          <span class="num">Folio {{ folio() }}</span>
        }
        <gz-compare-toggle [propertyId]="home().id" [label]="title()" />
      </div>
    </div>
  </article>`,
  styles: `
    .property {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--surface);
      border: 1px solid var(--rule);
    }
    .propertyimage {
      position: relative;
      height: 176px;
      background: var(--paper);
      overflow: hidden;
    }
    .propertyimage > a {
      display: block;
      width: 100%;
      height: 100%;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .propertyimage .tag {
      position: absolute;
      top: 10px;
      left: 10px;
      color: var(--ink);
    }
    gz-favorite-button {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
    }
    .propertybody {
      display: flex;
      flex: 1;
      flex-direction: column;
      padding: var(--sp-12) var(--sp-16) var(--sp-16);
    }
    .propertyaddress {
      font-size: var(--fs-body);
      line-height: var(--lh-body);
      font-weight: 600;
      color: var(--ink);
      overflow-wrap: anywhere;
    }
    .propertyaddress:hover {
      color: var(--copper);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .propertyplace {
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .cardfacts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin: var(--sp-12) 0 0;
      border-top: 1px solid var(--ink);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .cardfacts > div {
      display: flex;
      flex-direction: column;
      min-width: 0;
      border-bottom: 1px solid var(--rule);
    }
    .cardfacts > div:nth-child(odd) {
      border-right: 1px solid var(--rule);
    }
    dt {
      padding: 6px 8px 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    dd {
      flex: 1;
      margin: 0;
      padding: 0 8px 6px;
      font-variant-numeric: tabular-nums lining-nums;
    }
    .cardnote {
      margin: 6px 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .propertyfoot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-8);
      margin-top: auto;
      padding-top: var(--sp-12);
      font-size: var(--fs-caption);
      color: var(--ink-2);
    }
    .propertyfoot gz-compare-toggle {
      margin-left: auto;
    }
  `,
})
export class PropertyCard {
  home = input.required<PropertySearchItem>();
  w = inject(Workspace);
  failedUrl = signal<string | null>(null);
  private photoUrl = computed(
    () =>
      this.w.catalog().photos[this.home().id]?.find((p) => p.primaryImage)?.storagePath ??
      this.w.catalog().photos[this.home().id]?.[0]?.storagePath ??
      null,
  );
  photo = computed(() => (this.failedUrl() === this.photoUrl() ? null : this.photoUrl()));
  folio = computed(() => formatFolio(this.home().folio));
  title = computed(() => this.home().address || (this.folio() ? 'Folio ' + this.folio() : 'Address unavailable'));
  place = computed(() => {
    const h = this.home();
    return placeLine(h.city || h.countyName, h.stateCode, h.zip);
  });
  missingFacts = computed(() => {
    const h = this.home();
    return h.bedrooms == null || h.bathrooms == null || h.livingAreaSqft == null || !h.yearBuilt;
  });
}
