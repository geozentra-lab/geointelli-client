import { Component, input } from '@angular/core';

/**
 * A page header (DESIGN.md §8): the h1 is the page's name, with an optional one-line description
 * that adds information, and actions on the right. No eyebrow, slogan or breadcrumb.
 */
@Component({
  selector: 'gz-heading',
  template: `<div class="pagehead">
    <div>
      <h1>{{ title() }}</h1>
      @if (subtitle()) {
        <p class="sub">{{ subtitle() }}</p>
      }
    </div>
    <div class="actions"><ng-content /></div>
  </div>`,
})
export class PageHeading {
  /** @deprecated Eyebrows are gone (DESIGN.md §8); ignored until the pages stop passing it. */
  eyebrow = input('');
  title = input('');
  subtitle = input('');
}
