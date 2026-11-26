import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from '../components/icon/icon';

/**
 * The record pane and sheet (DESIGN.md §12): previous, next and close; the title (20 px); meta and
 * actions; then ruled sections. On tablets and phones, where the record replaces the list, Back
 * stands in for close and the position is dropped.
 *
 *   <gz-record-pane deskSlot heading="Marisol Etienne" noun="application" backLabel="Applications"
 *       position="1 of 20 on this page" [hasPrev]="i > 0" [hasNext]="i < n - 1"
 *       (prev)="…" (next)="…" (closed)="…">
 *     <div paneMeta>…</div>
 *     <div paneActions><button class="btn primary">Record approval</button></div>
 *     <gz-record-section …>…</gz-record-section>
 *   </gz-record-pane>
 */
@Component({
  selector: 'gz-record-pane',
  imports: [Icon],
  template: `
    <header class="pane-head">
      <div class="pane-nav">
        <button type="button" class="pane-back" (click)="closed.emit()">
          <gz-icon name="chevron-left" />{{ backLabel() }}
        </button>
        @if (position()) {
          <span class="pane-pos num">{{ position() }}</span>
        }
        <span class="pane-tools">
          <button
            type="button"
            class="iconbtn"
            [disabled]="!hasPrev()"
            [attr.aria-label]="'Previous ' + noun()"
            #prevBtn
            (click)="step('prev')"
          >
            <gz-icon name="chevron-up" />
          </button>
          <button
            type="button"
            class="iconbtn"
            [disabled]="!hasNext()"
            [attr.aria-label]="'Next ' + noun()"
            #nextBtn
            (click)="step('next')"
          >
            <gz-icon name="chevron-down" />
          </button>
          <button type="button" class="iconbtn pane-close" aria-label="Close record" (click)="closed.emit()">
            <gz-icon name="close" />
          </button>
        </span>
      </div>
      <h2 class="pane-title" tabindex="-1" #titleEl>{{ heading() }}</h2>
      <div class="pane-meta"><ng-content select="[paneMeta]" /></div>
      <div class="pane-actions"><ng-content select="[paneActions]" /></div>
    </header>
    <div class="pane-body"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      background: var(--surface);
    }
    .pane-head {
      padding: 10px 20px 14px;
      border-bottom: 1px solid var(--rule);
    }
    .pane-nav {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .pane-pos {
      margin-right: auto;
    }
    .pane-tools {
      display: flex;
      margin-left: auto;
    }
    .pane-back {
      display: none;
      align-items: center;
      gap: 2px;
      min-height: var(--control-h);
      margin-right: auto;
      padding: 0 6px 0 0;
      background: none;
      color: var(--copper);
      font-size: var(--fs-body);
      font-weight: 500;
    }
    .pane-title {
      margin: 6px 0 2px;
      font-size: var(--fs-title);
      line-height: var(--lh-title);
      outline: none;
    }
    .pane-meta:empty,
    .pane-actions:empty {
      display: none;
    }
    .pane-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .pane-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: var(--sp-12);
    }
    .pane-body {
      flex: 1;
      padding: 0 20px var(--sp-24);
    }
    @media (max-width: 1023px) {
      .pane-back {
        display: inline-flex;
      }
      .pane-pos,
      .pane-close {
        display: none;
      }
      .pane-head,
      .pane-body {
        padding-left: var(--gutter);
        padding-right: var(--gutter);
      }
    }
  `,
})
export class RecordPane {
  readonly heading = input.required<string>();
  /** "1 of 20 on this page": previous and next work within the loaded page. */
  readonly position = input('');
  readonly hasPrev = input(false);
  readonly hasNext = input(false);
  /** What a record is called, for the buttons' names ("Previous application"). */
  readonly noun = input('record');
  /** Where Back returns to on tablets and phones ("Applications"). */
  readonly backLabel = input('Back');
  readonly prev = output<void>();
  readonly next = output<void>();
  readonly closed = output<void>();
  private readonly headingEl = viewChild.required<ElementRef<HTMLElement>>('titleEl');
  private readonly prevBtn = viewChild.required<ElementRef<HTMLButtonElement>>('prevBtn');
  private readonly nextBtn = viewChild.required<ElementRef<HTMLButtonElement>>('nextBtn');
  private readonly injector = inject(Injector);
  focusHeading() {
    this.headingEl().nativeElement.focus();
  }
  /**
   * Previous or next. Reaching the first or last record disables the button that has focus, and
   * the browser would drop focus to the page: it moves to the other button, or the title.
   */
  protected step(which: 'prev' | 'next') {
    const button = (which === 'prev' ? this.prevBtn() : this.nextBtn()).nativeElement;
    (which === 'prev' ? this.prev : this.next).emit();
    afterNextRender(
      () => {
        if (!button.disabled || !button.isConnected) return;
        const active = document.activeElement;
        if (active && active !== document.body && active !== button) return;
        const other = (which === 'prev' ? this.nextBtn() : this.prevBtn()).nativeElement;
        if (!other.disabled) other.focus();
        else this.focusHeading();
      },
      { injector: this.injector },
    );
  }
}
