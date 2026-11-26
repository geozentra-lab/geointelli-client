import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';

/**
 * A navigation that finishes sooner than this shows no bar. 30 ms, as on angular.dev: about where a
 * wait starts to be noticeable.
 */
export const ROUTE_PROGRESS_DELAY_MS = 30;

/**
 * A thin line along the very top edge while the next page loads (its code, its resolvers), as on
 * angular.dev: one horizontal gradient in the app's two colours, copper into navy (DESIGN.md §4,
 * "Route progress"). It creeps towards 90 % while the navigation runs, fills when the page is ready,
 * then fades. It carries no text: the page title and the focused heading announce the new page.
 */
@Component({
  selector: 'gz-route-progress',
  template: `<div class="rp-line" [class.on]="visible()" [style.transform]="'scaleX(' + progress() + ')'"></div>`,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 70; /* above the bars (30), sheets, dialogs and toasts (60) */
      height: 3px;
      pointer-events: none;
    }
    /* Its own class name: the global .bar (the 88 x 6 px coverage bar) would size and space it. */
    .rp-line {
      position: absolute;
      inset: 0;
      margin: 0;
      transform-origin: 0 50%;
      opacity: 0;
      /* Light copper on the left (it shows on the navy rail too), copper, then navy. */
      background: linear-gradient(90deg, var(--copper-mark) 0%, var(--copper) 55%, var(--navy-2) 100%);
      transition:
        transform 250ms cubic-bezier(0.2, 0, 0, 1),
        opacity 250ms ease-out;
      will-change: transform, opacity;
    }
    .rp-line.on {
      opacity: 1;
    }
    /* Reduced motion: a still, full-width line while the page loads; no creeping. */
    @media (prefers-reduced-motion: reduce) {
      .rp-line {
        transition: none;
      }
      .rp-line.on {
        transform: scaleX(1) !important;
      }
    }
  `,
})
export class RouteProgress {
  readonly visible = signal(false);
  readonly progress = signal(0);
  private showTimer: ReturnType<typeof setTimeout> | undefined;
  private trickle: ReturnType<typeof setInterval> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const events = inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.start();
      else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError ||
        e instanceof NavigationSkipped
      )
        this.finish();
    });
    inject(DestroyRef).onDestroy(() => {
      events.unsubscribe();
      this.clearTimers();
    });
  }

  private start() {
    this.clearTimers();
    this.showTimer = setTimeout(() => {
      this.progress.set(0.08);
      this.visible.set(true);
      // Ever smaller steps towards 90 %: it never claims the page is ready before it is.
      this.trickle = setInterval(() => this.progress.update((p) => p + (0.9 - p) * 0.12), 250);
    }, ROUTE_PROGRESS_DELAY_MS);
  }

  private finish() {
    clearTimeout(this.showTimer);
    clearInterval(this.trickle);
    if (!this.visible()) return;
    this.progress.set(1);
    this.hideTimer = setTimeout(() => {
      this.visible.set(false);
      this.hideTimer = setTimeout(() => this.progress.set(0), 250);
    }, 200);
  }

  private clearTimers() {
    clearTimeout(this.showTimer);
    clearInterval(this.trickle);
    clearTimeout(this.hideTimer);
  }
}
