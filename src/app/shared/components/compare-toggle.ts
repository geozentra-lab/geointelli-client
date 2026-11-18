import { Component, computed, inject, input } from '@angular/core';
import { Store } from '@ngrx/store';
import { PropertyCompareActions as A } from '../../store/property-compare/property-compare.actions';
import { selectCompareSelection } from '../../store/property-compare/property-compare.selectors';
import { COMPARE_MAX } from '../../store/property-compare/property-compare.reducer';
import { UiActions } from '../../store/ui/ui.actions';
/** Adds or removes a property from the side-by-side comparison tray. */
@Component({
  selector: 'gz-compare-toggle',
  template: `<button
    type="button"
    class="btn"
    [class.small]="small()"
    [class.primary]="selected()"
    [attr.aria-pressed]="selected()"
    [attr.aria-label]="(selected() ? 'Remove from' : 'Add to') + ' comparison: ' + label()"
    (click)="toggle()"
  >
    {{ selected() ? '✓ Comparing' : '+ Compare' }}
  </button>`,
})
export class CompareToggle {
  propertyId = input.required<number>();
  label = input('property');
  /** Small inside cards; full size among page-heading buttons. */
  small = input(true);
  private store = inject(Store);
  private selection = this.store.selectSignal(selectCompareSelection);
  selected = computed(() => this.selection().includes(this.propertyId()));
  toggle() {
    if (!this.selected() && this.selection().length >= COMPARE_MAX) {
      this.store.dispatch(
        UiActions.toast({
          message: 'You can compare up to ' + COMPARE_MAX + ' properties. Remove one first.',
        }),
      );
      return;
    }
    this.store.dispatch(A.toggle({ propertyId: this.propertyId() }));
  }
}
