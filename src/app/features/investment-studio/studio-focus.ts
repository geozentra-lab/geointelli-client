import { ElementRef, Injector, afterNextRender, effect, inject, untracked } from '@angular/core';

/**
 * When a calculation this calculator asked for has answered (or failed), focus moves to the
 * result's heading, so a screen reader reads it and, below 1024 px where the result sits under the
 * form, the page scrolls to it. Call from a constructor (an injection context); call the function it
 * returns when the request is sent. `state` is the slice part that changes with every answer.
 */
export function resultArrived(
  state: () => { loading: boolean },
  target: () => ElementRef<HTMLElement> | undefined,
): () => void {
  const injector = inject(Injector);
  let waiting = false;
  effect(() => {
    // Every answer is a new state object, so this runs even when loading flipped within one tick.
    const s = state();
    if (!waiting || s.loading) return;
    waiting = false;
    untracked(() =>
      afterNextRender(
        () => {
          const el = target()?.nativeElement;
          if (!el) return;
          const stacked =
            typeof matchMedia === 'function' && matchMedia('(max-width: 1023.98px)').matches;
          el.focus({ preventScroll: true });
          // Stacked, the result is under the form: bring it to the top. Side by side it is usually
          // in view already, but not after opening a scenario from the table far below it.
          el.scrollIntoView?.({ block: stacked ? 'start' : 'nearest' });
        },
        { injector },
      ),
    );
  });
  return () => {
    waiting = true;
  };
}
