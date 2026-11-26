import { Component, computed, input, output, signal } from '@angular/core';

/**
 * Paging over the server's pages (DESIGN.md §7): "1 to 20 of 22" with Previous and Next. The new
 * range is announced once it is requested; the page focuses the table when the rows arrive.
 */
@Component({
  selector: 'gz-pager',
  template: `@if (total() > 0) {
      <nav class="pager" aria-label="Pages">
        <span class="num">{{ from() }} to {{ to() }} of {{ total() }}</span>
        @if (total() > size()) {
          <span class="actions">
            <button
              type="button"
              class="btn small"
              [disabled]="loading() || page() <= 0"
              (click)="go(page() - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="btn small"
              [disabled]="loading() || to() >= total()"
              (click)="go(page() + 1)"
            >
              Next
            </button>
          </span>
        }
      </nav>
    }
    <span class="sr-only" aria-live="polite">{{ announcement() }}</span>`,
  styles: `
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-12);
      padding: 10px 0;
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
  `,
})
export class Pager {
  /** Zero-based page index, as the API counts. */
  readonly page = input(0);
  readonly size = input(20);
  readonly total = input(0);
  readonly loading = input(false);
  readonly changed = output<number>();
  readonly announcement = signal('');
  readonly from = computed(() => Math.min(this.total(), this.page() * this.size() + 1));
  readonly to = computed(() => Math.min(this.total(), (this.page() + 1) * this.size()));
  go(page: number) {
    if (this.loading() || page < 0 || page * this.size() >= this.total()) return;
    const from = page * this.size() + 1;
    const to = Math.min(this.total(), (page + 1) * this.size());
    this.announcement.set(`Showing ${from} to ${to} of ${this.total()}`);
    this.changed.emit(page);
  }
}
