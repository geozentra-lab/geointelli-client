import { FavoriteButton } from './favorite-button';
import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PropertySearchItem } from '../../core/models/api';
import { Workspace } from '../data/workspace';
import { Icon } from './icon/icon';
import { CompareToggle } from './compare-toggle';
import { placeLine } from '../data/format';
@Component({
  selector: 'gz-property-card',
  imports: [FavoriteButton, RouterLink, DecimalPipe, Icon, CompareToggle],
  template: `<article class="property">
    <div class="propertyimage">
      <a
        [routerLink]="['/property', home().id]"
        [attr.aria-label]="'View ' + (home().address || home().folio)"
      >
        @if (photo(); as url) {
          <img
            [src]="url"
            [alt]="home().address || 'Property photo'"
            loading="lazy"
            (error)="failedUrl.set(photo() || null)"
            decoding="async"
          />
        } @else {
          <div class="property-photo-empty">
            <gz-icon name="home" /><span>{{
              w.catalog().photoErrors[home().id] ? 'Photos unavailable' : 'Property record'
            }}</span>
          </div>
        }
      </a>
      @if (home().propertyType) {
        <span class="tag">{{ home().propertyType }}</span>
      }
      <gz-favorite-button [propertyId]="home().id" [address]="home().address || home().folio" />
    </div>
    <div class="propertybody">
      <a [routerLink]="['/property', home().id]"
        ><div class="propertyaddress">{{ home().address || 'Folio ' + home().folio }}</div>
        <div class="muted smalltext">{{ place() }}</div></a
      >
      <div class="facts">
        <span>{{ home().bedrooms == null ? '—' : home().bedrooms }} beds</span
        ><span>{{ home().bathrooms == null ? '—' : home().bathrooms }} baths</span
        ><span
          >{{ home().livingAreaSqft == null ? '—' : (home().livingAreaSqft | number) }} sqft</span
        >
      </div>
      <div class="propertyfoot">
        <span>Folio {{ home().folio }}</span
        ><span>{{ home().yearBuilt || 'Year unknown' }}</span>
      </div>
      <div class="row spacer">
        <a class="btn small" [routerLink]="['/property', home().id]">View record</a
        ><gz-compare-toggle [propertyId]="home().id" [label]="home().address || home().folio" />
      </div>
    </div>
  </article>`,
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
  place = computed(() => {
    const h = this.home();
    return placeLine(h.city || h.countyName, h.stateCode, h.zip);
  });
}
