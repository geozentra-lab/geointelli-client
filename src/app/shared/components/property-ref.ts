import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../data/workspace';
import { CatalogActions } from '../../store/catalog/catalog.actions';

/**
 * Links to a property referenced by ID, labelled with its address once the catalog knows it.
 * link=false renders the label alone, for use inside a row that is already a link.
 */
@Component({
  selector: 'gz-property-ref',
  imports: [RouterLink],
  template: `@if (link()) {
      <a [routerLink]="['/property', propertyId()]">{{ name() }}</a>
    } @else {
      {{ name() }}
    }`,
})
export class PropertyRef {
  private w = inject(Workspace);
  propertyId = input.required<number>();
  link = input(true);
  name = computed(() => {
    const p = this.w.home(this.propertyId());
    return p?.address || (p ? 'Folio ' + p.folio : 'Property #' + this.propertyId());
  });
  constructor() {
    effect(() => {
      const id = this.propertyId();
      if (!this.w.home(id) && !this.w.catalog().unresolved[id])
        this.w.store.dispatch(CatalogActions.resolveProperty({ id }));
    });
  }
}
