import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, take } from 'rxjs';

/**
 * What sits above the page right now: a modal dialog, or a sheet (the record pane at laptop width,
 * the More sheet on phones). The shell reads this to show its one scrim and to make the rest of
 * the shell inert, so the rail and top bar are covered and unreachable while a layer is open
 * (DESIGN.md §4, bug 2 in §14). Plain signals: nothing here pulls Material or the CDK into the
 * initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class ShellLayer {
  private readonly modals = signal(0);
  private readonly sheet = signal<{ close: () => void } | null>(null);
  /** A modal dialog is open: the whole shell is inert behind it. */
  readonly modalOpen = computed(() => this.modals() > 0);
  /** A sheet is open over the page: the rail, top bar and the content beside it are inert. */
  readonly sheetOpen = computed(() => this.sheet() !== null);

  /** Marks a modal as open until the returned function is called (calling it twice is harmless). */
  holdModal(): () => void {
    this.modals.update((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.modals.update((n) => Math.max(0, n - 1));
    };
  }
  /** Registers the open sheet; the scrim and Escape close it through `close`. */
  openSheet(close: () => void): () => void {
    const entry = { close };
    this.sheet.set(entry);
    return () => {
      if (this.sheet() === entry) this.sheet.set(null);
    };
  }
  /** Scrim click or Escape: asks the open sheet to close. */
  dismissSheet() {
    this.sheet()?.close();
  }
}

/**
 * Call from a dialog component's constructor (injection context). The shell stays inert while the
 * dialog is open, and wakes up as soon as it starts closing, so focus can return to the control
 * that opened it.
 */
export function holdShellForDialog(ref?: { beforeClosed(): Observable<unknown> }) {
  const release = inject(ShellLayer).holdModal();
  ref?.beforeClosed().pipe(take(1)).subscribe(release);
  inject(DestroyRef).onDestroy(release);
}
