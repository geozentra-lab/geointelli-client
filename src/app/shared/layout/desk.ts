import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ShellLayer } from './shell-layer';
import { RecordPane } from './record-pane';

export type DeskMode = 'docked' | 'sheet' | 'page';
const DOCKED = '(min-width: 1360px)';
const SHEET = '(min-width: 1024px)';

/**
 * The Desk's docked slot (DESIGN.md §5): a register with a 420 px record pane beside it.
 *
 *   <gz-desk [open]="!!selectedId" label="Application 1041" (closed)="selectedId = null">
 *     …page heading, stage links, table…
 *     <gz-record-pane deskSlot heading="Marisol Etienne" …>…ruled sections…</gz-record-pane>
 *   </gz-desk>
 *
 * - Desktop (>= 1360 px): the pane docks at the right edge, full height under the top bar, and the
 *   table hides its priority-3 columns (bind the table's `paneOpen`).
 * - Laptop (1024-1359 px): the pane is a sheet over the content with the shell scrim; the scrim and
 *   Escape close it, and everything behind it is inert.
 * - Tablet and phone: the record replaces the list; its Back button closes it.
 *
 * Put the gz-desk at the top of the page: in docked mode it reaches to the page's top and right
 * edges. Selection comes from the page (or, once added, a detail route), never from here.
 */
@Component({
  selector: 'gz-desk',
  template: `<div class="desk-main" [attr.inert]="mainInert() ? '' : null"><ng-content /></div>
    @if (open()) {
      <aside class="desk-slot" #slot tabindex="-1" [attr.aria-label]="label()">
        <ng-content select="[deskSlot]" />
      </aside>
    }`,
  host: {
    class: 'desk',
    '[class.open]': 'open()',
    '[attr.data-mode]': 'mode()',
    '(keydown.escape)': 'escape($event)',
  },
  styles: `
    :host {
      display: block;
    }
    .desk-main {
      min-width: 0;
    }
    :host(.open[data-mode='docked']) {
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--slot-w);
      margin: calc(-1 * var(--page-pt)) calc(-1 * var(--gutter)) calc(-1 * var(--page-pb)) 0;
    }
    :host(.open[data-mode='docked']) .desk-main {
      padding: var(--page-pt) var(--gutter) var(--page-pb) 0;
    }
    .desk-slot {
      background: var(--surface);
      outline: none;
    }
    :host(.open[data-mode='docked']) .desk-slot {
      position: sticky;
      top: var(--topbar-h);
      height: calc(100dvh - var(--topbar-h));
      overflow-y: auto;
      border-left: 1px solid var(--rule-strong);
    }
    :host(.open[data-mode='sheet']) .desk-slot {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-sheet);
      width: var(--slot-w);
      max-width: 100vw;
      overflow-y: auto;
      border-left: 1px solid var(--rule-strong);
      animation: desk-sheet-in var(--dur-pane) ease-out;
    }
    :host(.open[data-mode='page']) .desk-main {
      display: none;
    }
    :host(.open[data-mode='page']) .desk-slot {
      margin: calc(-1 * var(--page-pt)) calc(-1 * var(--gutter)) calc(-1 * var(--page-pb));
      min-height: calc(100dvh - var(--topbar-h) - var(--bottombar-h));
    }
    @keyframes desk-sheet-in {
      from {
        transform: translateX(100%);
      }
    }
  `,
})
export class Desk {
  readonly open = input(false);
  readonly label = input('Record');
  readonly closed = output<void>();
  readonly mode = signal<DeskMode>('docked');
  private readonly layer = inject(ShellLayer);
  private readonly injector = inject(Injector);
  private readonly slot = viewChild<ElementRef<HTMLElement>>('slot');
  private readonly pane = contentChild(RecordPane);
  /** Behind a sheet the register is inert; as its own page it is hidden. */
  readonly mainInert = computed(() => this.open() && this.mode() === 'sheet');

  constructor() {
    if (typeof matchMedia === 'function') {
      const docked = matchMedia(DOCKED);
      const sheet = matchMedia(SHEET);
      const update = () =>
        this.mode.set(docked.matches ? 'docked' : sheet.matches ? 'sheet' : 'page');
      update();
      docked.addEventListener('change', update);
      sheet.addEventListener('change', update);
      inject(DestroyRef).onDestroy(() => {
        docked.removeEventListener('change', update);
        sheet.removeEventListener('change', update);
      });
    }
    // A sheet registers with the shell: the scrim shows and closes it, the bars go inert.
    effect((onCleanup) => {
      if (this.open() && this.mode() === 'sheet') {
        const release = this.layer.openSheet(() => this.closed.emit());
        onCleanup(release);
      }
    });
    // Over the page or as its own page, the record takes focus so it is announced and reachable.
    effect(() => {
      if (!this.open() || this.mode() === 'docked') return;
      untracked(() =>
        afterNextRender(
          () => {
            if (this.mode() === 'page') window.scrollTo({ top: 0 });
            const pane = this.pane();
            if (pane) pane.focusHeading();
            else this.slot()?.nativeElement.focus();
          },
          { injector: this.injector },
        ),
      );
    });
  }
  protected escape(event: Event) {
    if (!this.open()) return;
    // Escape in a field is the field's (closing a select's list, leaving an input): the record
    // stays open and focus stays put.
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, select, textarea, [contenteditable]')) return;
    event.stopPropagation();
    this.closed.emit();
  }
}
