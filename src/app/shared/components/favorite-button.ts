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
    /* The heart is copper, filled once saved (DESIGN.md §2). */
    .favorite-control {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-8);
      min-width: var(--control-h);
      min-height: var(--control-h);
      padding: 0 8px;
      border: 1px solid var(--control);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink-2);
      transition:
        background-color var(--dur-color) ease,
        color var(--dur-color) ease;
    }
    .favorite-control.saved {
      color: var(--copper);
      border-color: var(--copper);
    }
    .favorite-control:hover:not(:disabled) {
      background: var(--copper-tint);
      color: var(--copper);
    }
    /* With a label it sits among page buttons, so it takes the standard button shape. */
    .favorite-control.with-label {
      padding: 0 14px;
      color: var(--ink);
      font-weight: 500;
      font-size: var(--fs-body);
      line-height: var(--lh-body);
    }
    .favorite-control.with-label.saved {
      background: var(--copper-tint);
      color: var(--copper-hover);
    }
    .favorite-control.with-label gz-icon {
      color: var(--copper);
    }
    .favorite-control.pending {
      cursor: progress;
      opacity: 1;
    }
    /* Waiting for the save: a thin bar along the bottom edge, no spinner. */
    .favorite-progress {
      position: absolute;
      left: 3px;
      right: 3px;
      bottom: 2px;
      height: 2px;
      background: var(--copper);
      opacity: 0.6;
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
