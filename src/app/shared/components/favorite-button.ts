import { Component, computed, inject, input } from '@angular/core';
import { Workspace } from '../data/workspace';
import { Icon } from './icon/icon';
@Component({
  selector: 'gz-favorite-button',
  imports: [Icon],
  template: `<button
    type="button"
    class="favorite-control"
    [class.saved]="saved()"
    [class.with-label]="showLabel()"
    [class.pending]="pending()"
    [disabled]="
      pending() || w.favoriteState().loading || (w.auth.isLoggedIn() && !w.favoriteState().loaded)
    "
    [attr.aria-pressed]="saved()"
    [attr.aria-busy]="pending()"
    [attr.aria-label]="label()"
    [title]="label()"
    (click)="toggle($event)"
  >
    <gz-icon name="heart" [filled]="saved()" />
    @if (showLabel()) {
      <span>{{
        pending() ? (saved() ? 'Saving…' : 'Removing…') : saved() ? 'Saved' : 'Save property'
      }}</span>
    }
    @if (pending()) {
      <span class="favorite-progress" aria-hidden="true"></span>
    }
  </button>`,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
    .favorite-control {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-width: 44px;
      min-height: 44px;
      padding: 10px;
      border: 1px solid #dce3e7;
      border-radius: 50%;
      background: #fffffff5;
      color: var(--ink-2);
      box-shadow: 0 2px 8px #1727350a;
      transition:
        background 0.15s,
        transform 0.15s,
        color 0.15s;
    }
    .favorite-control.saved {
      color: #d73550;
      background: #fff5f6;
      border-color: #f2c4ce;
    }
    .favorite-control:hover:not(:disabled) {
      transform: translateY(-1px);
      background: #f9ecef;
    }
    /* With a label it sits among page buttons, so it takes the standard button shape. */
    .favorite-control.with-label {
      min-width: 0;
      min-height: var(--control-h);
      padding: 0 16px;
      border-color: var(--field-border);
      border-radius: var(--radius);
      background: #fff;
      color: var(--ink);
      box-shadow: none;
      font-weight: 600;
      font-size: 13px;
      line-height: 20px;
    }
    .favorite-control.with-label.saved {
      border-color: #f2c4ce;
      background: #fff5f6;
      color: #d73550;
    }
    .favorite-control.pending {
      cursor: progress;
      opacity: 1;
    }
    .favorite-progress {
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 12px;
      height: 12px;
      border: 2px solid #e3d8dc;
      border-top-color: #d73550;
      border-radius: 50%;
      animation: favorite-spin 0.7s linear infinite;
    }
    @keyframes favorite-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .favorite-control {
        transition: none;
      }
      .favorite-progress {
        animation-duration: 2s;
      }
    }
  `,
})
export class FavoriteButton {
  w = inject(Workspace);
  propertyId = input.required<number>();
  address = input('property');
  showLabel = input(false);
  saved = computed(() => this.w.isSaved(this.propertyId()));
  pending = computed(() => this.w.favoriteState().pending.includes(this.propertyId()));
  label = computed(() =>
    this.pending()
      ? this.saved()
        ? 'Saving property'
        : 'Removing favorite'
      : (this.saved() ? 'Remove from favorites: ' : 'Save to favorites: ') + this.address(),
  );
  toggle(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.pending()) this.w.toggleSave(this.propertyId());
  }
}
