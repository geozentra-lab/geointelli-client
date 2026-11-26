import { Component, input } from '@angular/core';

@Component({
  selector: 'gz-loading-spinner',
  template: `<div
    class="spinner-container"
    [class.compact]="compact()"
    role="status"
    [attr.aria-label]="label()"
  >
    <span class="spinner" aria-hidden="true"></span>
  </div>`,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .spinner-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 140px;
      width: 100%;
    }
    .spinner {
      display: block;
      width: 32px;
      height: 32px;
      border: 3px solid var(--rule);
      border-top-color: var(--copper);
      border-radius: var(--radius-round);
      animation: spin 0.8s linear infinite;
    }
    .compact {
      min-height: 32px;
    }
    .compact .spinner {
      width: 20px;
      height: 20px;
      border-width: 2px;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 2s;
      }
    }
  `,
})
export class LoadingSpinner {
  label = input('Loading');
  compact = input(false);
}
