import { Component, input } from '@angular/core';
@Component({
  selector: 'gz-heading',
  template: `<div class="pagehead">
    <div>
      <div class="eyebrow">{{ eyebrow() }}</div>
      <h1>{{ title() }}</h1>
      <p class="sub">{{ subtitle() }}</p>
    </div>
    <div class="actions"><ng-content /></div>
  </div>`,
})
export class PageHeading {
  eyebrow = input('');
  title = input('');
  subtitle = input('');
}
