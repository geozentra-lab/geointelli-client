import { Component, computed, input } from '@angular/core';

/**
 * Missing and partial values: one rule (DESIGN.md §6).
 *
 * - Unavailable: the backend has no value where one is expected. The word "Unavailable" on the
 *   hatch, with the reason visible nearby and in the accessible text. Never 0, "—", "null" or blank.
 * - Partial: an aggregate over some records. The figure, then "Partial: N of M …" and a coverage bar.
 * - Not applicable: leave the cell blank (no marker).
 */

/**
 * The marker inside running content: `<gz-na reason="No sale on record" />`. With `showReason` the
 * reason is written under the word; otherwise it is only in the accessible text, so put it nearby
 * (a group note, a footnote) when several values share it.
 */
@Component({
  selector: 'gz-na',
  template: `<span class="na-word">Unavailable</span>
    @if (reason()) {
      @if (showReason()) {
        <span class="na-why">{{ reason() }}</span>
      } @else {
        <span class="sr-only">: {{ reason() }}</span>
      }
    }`,
  host: { class: 'na', '[class.na-block]': 'showReason()' },
  styles: `
    :host {
      display: inline-block;
      padding: 0 4px;
    }
    :host(.na-block) {
      display: block;
      padding: 4px 6px;
    }
  `,
})
export class Na {
  reason = input('');
  showReason = input(false);
}

/**
 * A table cell or record value that may be missing: `<td gz-cell [missing]="v === null">…</td>`.
 * When missing, the hatch fills the cell from rule to rule and the word sits where the number
 * would, in the column's alignment; the projected content is not shown.
 */
@Component({
  selector: 'td[gz-cell], dd[gz-cell], th[gz-cell]',
  template: `@if (missing()) {
      <span class="na-word">Unavailable</span>
      @if (reason()) {
        @if (showReason()) {
          <span class="na-why">{{ reason() }}</span>
        } @else {
          <span class="sr-only">: {{ reason() }}</span>
        }
      }
    } @else {
      <ng-content />
    }`,
  host: { '[class.na]': 'missing()' },
})
export class Cell {
  missing = input(false);
  reason = input('');
  showReason = input(false);
}

/**
 * Coverage of an aggregate: the caption and an 88 x 6 px bar (ink for the covered share, hatch for
 * the rest). Counts come from the backend; nothing is estimated here.
 *
 *   <gz-coverage [covered]="3" [total]="5" noun="holdings valued" />
 *     → "Partial: 3 of 5 holdings valued"
 *   <gz-coverage [covered]="2" [total]="5" [partial]="false" lead="From records on" noun="holdings" />
 *     → "From records on 2 of 5 holdings" (complete by definition: no Partial label)
 *
 * Nothing renders when no record is covered: the figure itself is then Unavailable.
 */
@Component({
  selector: 'gz-coverage',
  template: `@if (show()) {
    <span class="covbar" aria-hidden="true"><i [style.width.%]="share()"></i></span>
    <span class="coverage-text"
      >@if (partial()) {
        <em class="partial-word">Partial:</em>
      } @else if (lead()) {
        {{ lead() }}
      }
      {{ covered() }} of {{ total() }} {{ noun() }}</span
    >
  }`,
  styles: `
    :host {
      display: block;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .covbar {
      margin: 4px 0 5px;
    }
  `,
})
export class Coverage {
  covered = input.required<number>();
  total = input.required<number>();
  noun = input('');
  partial = input(true);
  lead = input('');
  readonly show = computed(() => this.total() > 0 && this.covered() > 0);
  readonly share = computed(() =>
    Math.min(100, Math.max(0, (this.covered() / Math.max(1, this.total())) * 100)),
  );
}
