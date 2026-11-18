import { Component, input } from '@angular/core';
@Component({
  selector: 'gz-metric',
  template: `<div class="metric">
    <div class="label">{{ label() }}</div>
    <div class="number">{{ value() }}</div>
    <div class="detail" [class.green]="positive()">{{ detail() }}</div>
  </div>`,
})
export class Metric {
  label = input('');
  value = input<string | number>('');
  detail = input('');
  positive = input(false);
}
