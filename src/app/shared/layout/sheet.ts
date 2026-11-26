import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { Icon } from '../components/icon/icon';
import { ShellLayer } from './shell-layer';

let nextId = 0;

/**
 * A sheet over the page (DESIGN.md §12): 420 px at the right edge with a rule-strong left edge,
 * full screen on phones. While open it registers with the shell, so the one scrim shows, the rail
 * and top bar go inert, and the scrim or Escape close it. Make the page content beside it inert
 * too (`[attr.inert]`), as the Desk does. Focus moves to the heading on open and back to the
 * control that opened it on close.
 *
 *   <div [attr.inert]="askOpen() ? '' : null">…page…</div>
 *   <gz-sheet heading="Ask about this property" [open]="askOpen()" (closed)="askOpen.set(false)">
 *     <gz-contact-professional … />
 *   </gz-sheet>
 *
 * The projected content is created once, so a half-written form survives closing the sheet.
 */
@Component({
  selector: 'gz-sheet',
  imports: [Icon],
  template: `@if (open()) {
    <section class="sheet" role="dialog" aria-modal="true" [attr.aria-labelledby]="id + '-title'">
      <header class="sheet-head">
        <h2 class="sheet-title" [id]="id + '-title'" tabindex="-1" #title>{{ heading() }}</h2>
        <button type="button" class="iconbtn" aria-label="Close" (click)="closed.emit()">
          <gz-icon name="close" />
        </button>
      </header>
      <div class="sheet-body"><ng-content /></div>
    </section>
  }`,
  styles: `
    .sheet {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-sheet);
      display: flex;
      flex-direction: column;
      width: var(--slot-w);
      max-width: 100vw;
      background: var(--surface);
      border-left: 1px solid var(--rule-strong);
      animation: sheet-in var(--dur-pane) ease-out;
    }
    .sheet-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-12);
      min-height: var(--topbar-h);
      padding: 0 var(--sp-12) 0 20px;
      border-bottom: 1px solid var(--rule);
    }
    .sheet-title {
      margin: 0;
      font-size: var(--fs-title);
      line-height: var(--lh-title);
      outline: none;
    }
    .sheet-body {
      flex: 1;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: var(--sp-16) 20px var(--sp-24);
    }
    @keyframes sheet-in {
      from {
        transform: translateX(100%);
      }
    }
    @media (max-width: 700px) {
      .sheet {
        width: 100vw;
        border-left: 0;
      }
      .sheet-body {
        padding: var(--sp-16) var(--gutter) var(--sp-24);
      }
    }
  `,
})
export class Sheet {
  readonly open = input(false);
  readonly heading = input.required<string>();
  /** Close button, scrim or Escape: the page sets `open` to false. */
  readonly closed = output<void>();
  readonly id = 'gz-sheet-' + nextId++;
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');
  private readonly layer = inject(ShellLayer);
  private readonly injector = inject(Injector);
  private opener: HTMLElement | null = null;

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) return;
      untracked(() => {
        const active = document.activeElement;
        this.opener = active instanceof HTMLElement ? active : null;
        afterNextRender(() => this.title()?.nativeElement.focus(), { injector: this.injector });
      });
      const release = this.layer.openSheet(() => this.closed.emit());
      onCleanup(() => {
        release();
        const opener = this.opener;
        this.opener = null;
        // After the page beside the sheet stops being inert, so the opener can take focus again.
        // (Skipped when the sheet closes because the page itself is going away.)
        try {
          afterNextRender(() => opener?.isConnected && opener.focus(), { injector: this.injector });
        } catch {
          /* the injector is already destroyed */
        }
      });
    });
  }
}
