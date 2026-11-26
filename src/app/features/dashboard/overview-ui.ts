import { Component, ElementRef, computed, input, viewChild } from '@angular/core';

let nextId = 0;

/**
 * One section of a overview (DESIGN.md §5 "Overview", §8): a white surface under a 2 px ink
 * rule, an h2 with an optional one-line caption, actions on the right, then the body. The same
 * frame as `gz-matches` (the buyer lead), so every overview reads as one page.
 *
 *   <section gz-overview-section #lead heading="Waiting for review" [caption]="waitingCaption()"
 *            [busy]="refetching()">
 *     <a actions class="btn primary" routerLink="/loan-review">Open Applications</a>
 *     …body… <button (click)="lead.retried(); load()">Retry</button>
 *   </section>
 *
 * `busy` marks a refetch: the previous render stays at 60% with aria-busy (DESIGN.md §6). A Retry
 * button disappears when it is pressed, so it calls `retried()` first: focus moves to the section's
 * heading instead of dropping to the page.
 */
@Component({
  selector: 'section[gz-overview-section]',
  template: `<div class="os-head">
      <div class="os-title">
        <h2 #title [id]="headingId" tabindex="-1">{{ heading() }}</h2>
        @if (caption()) {
          <p class="os-caption">{{ caption() }}</p>
        }
      </div>
      <div class="os-actions"><ng-content select="[actions]" /></div>
    </div>
    <ng-content />`,
  host: {
    '[attr.aria-labelledby]': 'headingId',
    '[attr.aria-busy]': "busy() ? 'true' : null",
    class: 'overview-section',
  },
  styles: `
    :host {
      display: block;
      min-width: 0;
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    .os-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sp-12) var(--sp-16);
      margin-bottom: var(--sp-12);
    }
    .os-title {
      min-width: 0;
    }
    h2 {
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    h2:focus {
      outline: none;
    }
    .os-caption {
      margin: 2px 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .os-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-16);
    }
    .os-actions:empty {
      display: none;
    }
    @media (max-width: 700px) {
      :host {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
    }
  `,
})
export class OverviewSection {
  readonly heading = input.required<string>();
  readonly caption = input('');
  /** A refetch is in flight while the previous figures are still shown. */
  readonly busy = input(false);
  readonly headingId = 'ov-section-' + nextId++;
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');
  /** Call before a Retry (or any control that removes itself): focus lands on the heading. */
  retried() {
    this.title().nativeElement.focus();
  }
}

export interface MixPart {
  key: string;
  label: string;
  value: number;
  /** A categorical colour token; null draws the part on the hatch (an unknown category). */
  color: string | null;
}

/**
 * One whole split into parts (DESIGN.md §11 "Loan mix"; the tall segmented bar): a 28 px bar whose
 * blocks are proportional to the values, 4 px corners, 2 px surface gaps, in the categorical
 * colours by fixed category order; an unknown category is the hatched block. A part at zero draws
 * nothing. Shares are not printed inside the blocks: the page puts the table twin (with swatches,
 * the legend) under the bar, and the bar's accessible name lists every part.
 */
@Component({
  selector: 'gz-mix-bar',
  template: `<div class="mix-bar" role="img" [attr.aria-label]="summary()">
    @for (p of shown(); track p.key) {
      <span
        class="mix-part"
        [class.na]="!p.color"
        [style.flex-grow]="p.value"
        [style.background-color]="p.color"
        [attr.title]="p.label + ': ' + p.value + ' (' + share(p) + ')'"
      ></span>
    }
  </div>`,
  styles: `
    .mix-bar {
      display: flex;
      gap: 2px;
      height: 28px;
    }
    .mix-part {
      flex: 0 1 0;
      min-width: 4px;
      border-radius: var(--radius-control);
    }
    .mix-part.na {
      background-color: var(--surface);
      box-shadow: inset 0 0 0 1px var(--rule-strong);
    }
    @media (forced-colors: active) {
      .mix-part {
        forced-color-adjust: none;
        border: 1px solid CanvasText;
      }
    }
  `,
})
export class MixBar {
  readonly parts = input.required<MixPart[]>();
  /** What the bar shows, read before the parts ("Funded loans by loan type"). */
  readonly label = input('');
  /** The whole the backend sends (e.g. the funded count); without it, the parts' sum. */
  readonly whole = input<number | null>(null, { alias: 'total' });
  readonly shown = computed(() => this.parts().filter((p) => p.value > 0));
  private readonly total = computed(
    () => this.whole() ?? this.shown().reduce((n, p) => n + p.value, 0),
  );
  share(p: MixPart) {
    return shareText(p.value, this.total());
  }
  readonly summary = computed(() =>
    [this.label(), ...this.shown().map((p) => `${p.label} ${p.value}, ${this.share(p)}`)]
      .filter(Boolean)
      .join('. '),
  );
}

/** "43%", or "<1%" for a sliver; from the counts on the page, never estimated. */
export function shareText(value: number, total: number): string {
  if (!total) return '';
  const pct = (value / total) * 100;
  return pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
}

/**
 * Layout shared by the overviews: the lead element full width, then at most two columns
 * (one below 1024 px), and the notes and empty states every section writes.
 */
export const OVERVIEW_STYLES = `
  .ov-cols {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-24);
    align-items: start;
    margin-top: var(--sp-24);
  }
  .ov-empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sp-12);
    padding: var(--sp-8) 0 var(--sp-4);
  }
  .ov-empty p,
  .ov-text {
    margin: 0;
    max-width: var(--measure);
    font-size: var(--fs-body);
  }
  .ov-note {
    margin: var(--sp-8) 0 0;
    max-width: 90ch;
    font-size: var(--fs-caption);
    line-height: var(--lh-caption);
    color: var(--ink-2);
  }
  .ov-alert {
    margin: 0;
  }
  .ov-alert span {
    flex: 1;
    min-width: 0;
  }
  .ov-sub {
    margin: var(--sp-24) 0 var(--sp-8);
  }
  /* Links are copper (DESIGN.md §2); the global sheet leaves anchors in ink. */
  .ov-link,
  .ov-note a,
  .ov-notice a {
    color: var(--copper);
    font-weight: 500;
  }
  .ov-link {
    font-size: var(--fs-cell);
  }
  .ov-link:hover,
  .ov-note a:hover,
  .ov-notice a:hover {
    color: var(--copper-hover);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .ov-table td a {
    color: var(--ink);
    font-weight: 500;
  }
  .ov-table td a:hover {
    color: var(--copper);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  @media (max-width: 1023.98px) {
    .ov-cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;
