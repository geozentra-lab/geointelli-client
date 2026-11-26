import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

export interface StageLink {
  /** null is "All". */
  key: string | null;
  label: string;
  /** From a backend summary (e.g. the lender pipeline); null when the backend gives none. */
  count: number | null;
}

/**
 * A register's stage filter (DESIGN.md §7): links with counts under the page heading; on phones
 * one picker. With `param` the links set that query parameter (shareable, Back works); without it
 * they are buttons that emit `picked`.
 */
@Component({
  selector: 'gz-stage-links',
  imports: [RouterLink],
  template: `
    <nav class="stage-links" [attr.aria-label]="label()">
      @for (s of stages(); track s.key) {
        @if (param()) {
          <a
            [routerLink]="[]"
            [queryParams]="queryFor(s.key)"
            queryParamsHandling="merge"
            [attr.aria-current]="s.key === active() ? 'true' : null"
            >{{ s.label }}
            @if (s.count !== null) {
              <b class="num">{{ s.count }}</b>
            }
          </a>
        } @else {
          <button
            type="button"
            [attr.aria-pressed]="s.key === active()"
            (click)="pick(s.key)"
          >
            {{ s.label }}
            @if (s.count !== null) {
              <b class="num">{{ s.count }}</b>
            }
          </button>
        }
      }
    </nav>
    <label class="stage-select">
      <span class="sr-only">{{ label() }}</span>
      <select (change)="pick(keyAt($any($event.target).selectedIndex))">
        @for (s of stages(); track s.key) {
          <option [selected]="s.key === active()">
            {{ s.label }}{{ s.count !== null ? ', ' + s.count : '' }}
          </option>
        }
      </select>
    </label>
  `,
  styles: `
    .stage-links {
      display: flex;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--rule);
      font-size: var(--fs-cell);
    }
    a,
    button {
      display: inline-flex;
      align-items: baseline;
      gap: 5px;
      padding: 6px 12px 8px;
      background: none;
      color: var(--ink-2);
      font-size: var(--fs-cell);
      white-space: nowrap;
    }
    a:first-child,
    button:first-child {
      padding-left: 0;
    }
    a:hover,
    button:hover {
      color: var(--ink);
    }
    b {
      font-weight: 500;
      color: var(--ink);
    }
    [aria-current='true'],
    [aria-pressed='true'] {
      color: var(--ink);
      box-shadow: inset 0 -2px 0 var(--copper);
    }
    a:focus-visible,
    button:focus-visible {
      outline-offset: -2px;
    }
    .stage-select {
      display: none;
    }
    @media (max-width: 700px) {
      .stage-links {
        display: none;
      }
      .stage-select {
        display: block;
      }
      select {
        width: 100%;
      }
    }
  `,
})
export class StageLinks {
  readonly stages = input.required<StageLink[]>();
  readonly active = input<string | null>(null);
  readonly label = input('Filter by stage');
  /** Query parameter the links set; omit for in-page buttons. */
  readonly param = input<string | null>(null);
  readonly picked = output<string | null>();
  private readonly router = inject(Router);
  queryFor(key: string | null) {
    return { [this.param()!]: key };
  }
  keyAt(index: number) {
    return this.stages()[index]?.key ?? null;
  }
  pick(key: string | null) {
    const p = this.param();
    if (p) void this.router.navigate([], { queryParams: { [p]: key }, queryParamsHandling: 'merge' });
    else this.picked.emit(key);
  }
}
