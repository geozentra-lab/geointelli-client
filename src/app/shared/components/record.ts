import { Component, input } from '@angular/core';

/**
 * A single record is read as ruled sections, like a county property-record card (DESIGN.md §1, §12):
 *
 *   <gz-record-section heading="Building">
 *     <gz-record-group heading="Size" note="Not in the county record.">
 *       <div gz-record-row label="Bedrooms" [missing]="p.bedrooms === null">{{ p.bedrooms }}</div>
 *       <div gz-record-row label="Living area, sq ft">{{ p.area | number }}</div>
 *     </gz-record-group>
 *   </gz-record-section>
 *
 * A section is a white surface under a 2 px ink rule with a 16 px heading. A group has a 13 px title
 * over a 1 px ink rule, then label and value rows separated by rules. When adjacent values are
 * missing for one reason, give the reason once as the group's note.
 */
@Component({
  selector: 'gz-record-section',
  template: `@if (heading()) {
      <h2 class="record-heading">{{ heading() }}</h2>
    }
    <ng-content />`,
  host: { class: 'record-section' },
  styles: `
    :host {
      display: block;
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    :host(.flush) {
      padding-left: 0;
      padding-right: 0;
    }
    .record-heading {
      margin: 0 0 var(--sp-4);
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    @media (max-width: 700px) {
      :host {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
    }
  `,
})
export class RecordSection {
  readonly heading = input('');
}

@Component({
  selector: 'gz-record-group',
  template: `@if (heading()) {
      <h3 class="record-group-title">{{ heading() }}</h3>
    }
    <dl><ng-content /></dl>
    @if (note()) {
      <p class="record-note">{{ note() }}</p>
    }`,
  styles: `
    :host {
      display: block;
    }
    .record-group-title {
      margin: 0;
      padding: 12px 0 6px;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      font-weight: 600;
      border-bottom: 1px solid var(--ink);
    }
    dl {
      margin: 0;
    }
    .record-note {
      margin: 6px 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
      max-width: var(--measure);
    }
  `,
})
export class RecordGroup {
  readonly heading = input('');
  /** One reason shared by the missing values above it. */
  readonly note = input('');
}

/**
 * One label and value. `missing` puts the Unavailable marker in the value slot; `showReason`
 * writes the reason under the word (when the rows around it don't share one group note).
 */
@Component({
  selector: 'div[gz-record-row]',
  template: `<dt>{{ label() }}</dt>
    @if (missing()) {
      <dd class="na">
        <span class="na-word">Unavailable</span>
        @if (reason()) {
          @if (showReason()) {
            <span class="na-why">{{ reason() }}</span>
          } @else {
            <span class="sr-only">: {{ reason() }}</span>
          }
        }
      </dd>
    } @else {
      <dd [class.num]="numeric()"><ng-content /></dd>
    }`,
  host: { class: 'record-row' },
  styles: `
    :host {
      display: grid;
      grid-template-columns: 44% minmax(0, 1fr);
      min-height: 34px;
      border-bottom: 1px solid var(--rule);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    dt,
    dd {
      margin: 0;
      padding: 8px 0;
    }
    dt {
      color: var(--ink-2);
    }
    dd {
      padding-left: 10px;
      padding-right: 8px;
      overflow-wrap: anywhere;
    }
  `,
})
export class RecordRow {
  readonly label = input.required<string>();
  readonly missing = input(false);
  /** Read after the word by screen readers; write it out nearby too (the group's note). */
  readonly reason = input('');
  /** Writes the reason under the word instead of only for screen readers. */
  readonly showReason = input(false);
  readonly numeric = input(false);
}

export const RECORD_KIT = [RecordSection, RecordGroup, RecordRow] as const;
