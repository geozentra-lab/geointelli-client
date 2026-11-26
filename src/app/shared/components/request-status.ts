import { Workspace } from '../data/workspace';
import { LoadingSpinner } from './loading-spinner';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
@Component({
  selector: 'gz-request-status',
  imports: [LoadingSpinner],
  template: `@if (loading()) {
      <gz-loading-spinner [label]="loadingText()" />
    }
    @if (error() && !dismissed()) {
      <div class="insight danger section" role="alert">
        <span class="request-message">{{ error() }}</span>
        @if (showRetry() || needsSignIn()) {
          <button type="button" class="btn small" (click)="retryRequest()">
            {{ needsSignIn() ? 'Sign in' : retryLabel() }}
          </button>
        }
        <button
          type="button"
          class="dismiss-message"
          aria-label="Dismiss message"
          title="Dismiss"
          (click)="dismissed.set(true)"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    }`,
  styles: `
    .insight {
      align-items: center;
    }
    .request-message {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .dismiss-message {
      display: grid;
      place-items: center;
      flex: 0 0 32px;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--ink-2);
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
    }
    .dismiss-message:hover {
      background: var(--row-hover);
      color: var(--ink);
    }
  `,
})
export class RequestStatus {
  private workspace = inject(Workspace);
  retryLabel = input('Retry');
  showRetry = input(true);
  needsSignIn = computed(() => !!this.error()?.startsWith('Sign in'));
  retryRequest() {
    if (this.needsSignIn()) this.workspace.signIn();
    else this.retry.emit();
  }
  loading = input(false);
  loadingText = input('Loading…');
  error = input<string | null | undefined>(null);
  retry = output<void>();
  dismissed = signal(false);
  constructor() {
    effect(() => {
      this.error();
      this.loading();
      this.dismissed.set(false);
    });
  }
}
