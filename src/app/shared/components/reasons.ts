import { Component, computed, input } from '@angular/core';
import { Icon } from './icon/icon';

/**
 * The reasons a property matched (DESIGN.md §14, bug 1): plain lines, not chips, at most two lines
 * in all, then "+N more". With two or more reasons each takes one line, cut with an ellipsis inside
 * its container; a single reason may wrap onto a second line before it is cut. Every reason stays
 * in the accessible text (and in the title of the lines shown). Used in the dashboard's
 * recommendation cards and in the Reasons column of the matches table (Opportunities).
 */
@Component({
  selector: 'gz-reasons',
  imports: [Icon],
  host: { '[class.one]': 'shown() === 1' },
  template: `<ul [attr.aria-label]="label()">
      @for (reason of reasons(); track reason; let i = $index) {
        <li [class.sr-only]="i >= max()" [attr.title]="i < max() ? reason : null">
          <gz-icon name="check" /><span>{{ reason }}</span>
        </li>
      }
    </ul>
    @if (hidden() > 0) {
      <span class="more" aria-hidden="true">+{{ hidden() }} more</span>
    }`,
  styles: `
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li:not(.sr-only) {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      min-width: 0;
    }
    li span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* One reason: up to two lines, then cut. */
    :host(.one) li:not(.sr-only) {
      align-items: flex-start;
    }
    :host(.one) li span {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    :host(.one) gz-icon {
      margin-top: 1px;
    }
    gz-icon {
      color: var(--positive);
    }
    gz-icon ::ng-deep svg {
      width: 14px;
      height: 14px;
    }
    .more {
      display: block;
      padding-left: 18px;
    }
  `,
})
export class Reasons {
  reasons = input.required<readonly string[]>();
  max = input(2);
  label = input('Why it matched');
  readonly hidden = computed(() => Math.max(0, this.reasons().length - this.max()));
  /** Lines in view: one reason may wrap onto a second line; two or more take one line each. */
  readonly shown = computed(() => Math.min(this.reasons().length, this.max()));
}
