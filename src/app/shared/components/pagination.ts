import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
@Component({
  selector: 'gz-pagination',
  template: `@if (total() > 0) {
      <nav class="resultshead section" aria-label="Pagination">
        <span #status tabindex="-1" class="pagestatus"
          >{{ total() }} {{ total() === 1 ? 'record' : 'records' }}
          @if (pages() > 1) {
            &middot; Page {{ page() + 1 }} of {{ pages() }}
          }
        </span>
        @if (pages() > 1) {
          <div class="actions">
            <button
              type="button"
              class="btn small"
              [disabled]="loading() || page() <= 0"
              (click)="go(page() - 1)"
            >
              Previous</button
            ><button
              type="button"
              class="btn small"
              [disabled]="loading() || page() + 1 >= pages()"
              (click)="go(page() + 1)"
            >
              Next
            </button>
          </div>
        }
      </nav>
    }
    <span class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement() }}</span>`,
})
export class Pagination {
  page = input(0);
  pages = input(0);
  total = input(0);
  loading = input(false);
  /**
   * Element that receives focus and is scrolled into view once the requested page has loaded,
   * usually the list container with tabindex="-1". Without it, focus lands on the page status.
   */
  focusTarget = input<HTMLElement | null | undefined>(null);
  changed = output<number>();
  readonly announcement = signal('');
  private status = viewChild<ElementRef<HTMLElement>>('status');
  /** Page requested by the user, kept until the new page has loaded. */
  private requested: number | null = null;
  constructor() {
    effect(() => {
      const page = this.page();
      if (this.requested === null || this.loading()) return;
      if (page !== this.requested) return; // Load failed or was superseded; keep focus where it is.
      this.requested = null;
      untracked(() => {
        this.announcement.set(
          `Page ${page + 1} of ${this.pages()}. ${this.total()} ${this.total() === 1 ? 'record' : 'records'}.`,
        );
        const target = this.focusTarget();
        const element = target ?? this.status()?.nativeElement;
        element?.focus({ preventScroll: true });
        if (target) target.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      });
    });
  }
  go(page: number) {
    if (
      !this.loading() &&
      Number.isInteger(page) &&
      page >= 0 &&
      page < this.pages() &&
      page !== this.page()
    ) {
      this.requested = page;
      this.changed.emit(page);
    }
  }
}
