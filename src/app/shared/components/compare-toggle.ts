import { Component, computed, inject, input } from '@angular/core';
import { Store } from '@ngrx/store';
import { PropertyCompareActions as A } from '../../store/property-compare/property-compare.actions';
import { selectCompareSelection } from '../../store/property-compare/property-compare.selectors';
import { COMPARE_MAX } from '../../store/property-compare/property-compare.reducer';
import { UiActions } from '../../store/ui/ui.actions';
/**
 * Adds or removes a property from the side-by-side comparison tray. A button on cards and pages;
 * `check` gives a 16 px checkbox for a table's Compare column (DESIGN.md §12), where twenty
 * "+ Compare" buttons would crowd the rows.
 */
@Component({
  selector: 'gz-compare-toggle',
  template: `@if (check()) {
      <input
        type="checkbox"
        class="checkbox compare-check"
        [checked]="selected()"
        [attr.aria-label]="'Compare ' + label()"
        (change)="onCheck($event)"
      />
    } @else {
      <button
        type="button"
        class="btn"
        [class.small]="small()"
        [attr.aria-pressed]="selected()"
        [attr.aria-label]="(selected() ? 'Remove from' : 'Add to') + ' comparison: ' + label()"
        (click)="toggle()"
      >
        {{ selected() ? '✓ Comparing' : '+ Compare' }}
      </button>
    }`,
  styles: `
    .compare-check {
      width: 16px;
      height: 16px;
      margin: 0;
      vertical-align: middle;
      cursor: pointer;
    }
  `,
})
export class CompareToggle {
  propertyId = input.required<number>();
  label = input('property');
  /** Small inside cards; full size among page-heading buttons. */
  small = input(true);
  /** A checkbox instead of a button, for a Compare column in a table. */
  check = input(false);
  private store = inject(Store);
  private selection = this.store.selectSignal(selectCompareSelection);
  selected = computed(() => this.selection().includes(this.propertyId()));
  /** Returns false when the tray is full and nothing changed. */
  toggle() {
    if (!this.selected() && this.selection().length >= COMPARE_MAX) {
      this.store.dispatch(
        UiActions.toast({
          message: 'You can compare up to ' + COMPARE_MAX + ' properties. Remove one first.',
        }),
      );
      return false;
    }
    this.store.dispatch(A.toggle({ propertyId: this.propertyId() }));
    return true;
  }
  onCheck(event: Event) {
    // A full tray refuses the change: put the box back to what the store says.
    if (!this.toggle()) (event.target as HTMLInputElement).checked = this.selected();
  }
}
