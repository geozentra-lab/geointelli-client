import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../data/workspace';
import { formatFolio } from '../data/format';
import { CatalogActions } from '../../store/catalog/catalog.actions';

/**
 * Links to a property referenced by ID, labelled with its address once the catalog knows it
 * ("Folio 01-4137-012-0450" when the record has no address). While the address loads, a skeleton;
 * when it can't load, "Address unavailable" (DESIGN.md §6), never "Property #42".
 * link=false renders the label alone, for use inside a row that is already a link.
 */
@Component({
  selector: 'gz-property-ref',
  imports: [RouterLink],
  template: `@if (name(); as label) {
      @if (link()) {
        <a [routerLink]="['/property', propertyId()]">{{ label }}</a>
      } @else {
        {{ label }}
      }
    } @else if (failed()) {
      @if (link()) {
        <a class="pr-na" [routerLink]="['/property', propertyId()]">Address unavailable<span class="sr-only">: the record could not load; open it to try again</span></a>
      } @else {
        <span class="pr-na">Address unavailable<span class="sr-only">: the record could not load</span></span>
      }
    } @else {
      <span class="skeleton pr-skel" aria-hidden="true"></span><span class="sr-only">Loading the address</span>
    }`,
  styles: `
    .pr-skel {
      display: inline-block;
      width: 9em;
      max-width: 100%;
      height: 0.9em;
      vertical-align: middle;
    }
    span.pr-na {
      color: var(--ink-2);
    }
  `,
})
export class PropertyRef {
  private w = inject(Workspace);
  propertyId = input.required<number>();
  link = input(true);
  /** The address, or the folio when the record has none; null until the property is known. */
  readonly name = computed(() => {
    const p = this.w.home(this.propertyId());
    if (!p) return null;
    const folio = formatFolio(p.folio);
    return p.address || (folio ? 'Folio ' + folio : 'Address unavailable');
  });
  readonly failed = computed(() => !!this.w.catalog().unresolved[this.propertyId()]);
  constructor() {
    // Once per property shown: reading the catalog untracked keeps every other property's arrival
    // (and its photos) from asking again for each one still on its way.
    effect(() => {
      const id = this.propertyId();
      untracked(() => {
        if (!this.w.home(id) && !this.w.catalog().unresolved[id])
          this.w.store.dispatch(CatalogActions.resolveProperty({ id }));
      });
    });
  }
}
