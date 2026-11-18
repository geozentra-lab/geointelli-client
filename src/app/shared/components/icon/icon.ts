import { Component, input } from '@angular/core';
import { ICON_PATHS } from './icon-paths';
@Component({
  selector: 'gz-icon',
  template:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path [attr.fill]="filled() ? \'currentColor\' : \'none\'" [attr.d]="paths[name()] || paths[\'home\']" /></svg>',
  styles: [':host {display:inline-flex;align-items:center;flex-shrink:0}'],
})
export class Icon {
  readonly name = input('home');
  readonly filled = input(false);
  readonly paths = ICON_PATHS;
}
