import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeading } from './page-heading';
@Component({
  selector: 'gz-unavailable',
  imports: [PageHeading, RouterLink],
  template: `<gz-heading [eyebrow]="eyebrow()" [title]="title()" [subtitle]="description()" />
    <div class="empty">
      <p>This service is not available yet.</p>
      <a class="btn primary spacer" routerLink="/explore">Explore property records</a>
    </div>`,
})
export class Unavailable {
  eyebrow = input('YOUR WORKSPACE');
  title = input('Coming next');
  description = input('Continue your research with property records and comparable transactions.');
}
