import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../data/workspace';
import { PropertyCompareActions as A } from '../../store/property-compare/property-compare.actions';
import { selectCompareSelection } from '../../store/property-compare/property-compare.selectors';
import { COMPARE_MAX, COMPARE_MIN } from '../../store/property-compare/property-compare.reducer';
/** Persistent shortcut to the comparison while properties are selected. */
@Component({
  selector: 'gz-compare-tray',
  imports: [RouterLink],
  template: `@if (selection().length) {
    <aside class="compare-tray" aria-label="Comparison selection">
      <span
        ><strong>{{ selection().length }}</strong> of {{ max }} selected
        @if (selection().length < min) {
          <span class="muted"> · add {{ min - selection().length }} more</span>
        }
      </span>
      <button type="button" class="btn small" (click)="clear()">Clear</button
      ><a
        class="btn small primary"
        routerLink="/compare"
        [queryParams]="{ ids: selection().join(',') }"
        [class.disabled]="selection().length < min"
        [attr.aria-disabled]="selection().length < min"
        (click)="selection().length < min && $event.preventDefault()"
        >Compare side by side</a
      >
    </aside>
  }`,
  styles: `
    /* A floating bar: the menu shadow and a rule-strong border, square corners. */
    .compare-tray {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      z-index: var(--z-bar);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 8px 8px 16px;
      background: var(--surface);
      border: 1px solid var(--rule-strong);
      box-shadow: var(--shadow-menu);
      font-size: var(--fs-cell);
    }
    .disabled {
      opacity: 0.55;
      pointer-events: auto;
      cursor: not-allowed;
    }
    @media (max-width: 700px) {
      .compare-tray {
        bottom: calc(var(--bottombar-h) + 12px);
        left: 12px;
        right: 12px;
        transform: none;
        justify-content: space-between;
      }
    }
  `,
})
export class CompareTray {
  private w = inject(Workspace);
  selection = this.w.store.selectSignal(selectCompareSelection);
  readonly min = COMPARE_MIN;
  readonly max = COMPARE_MAX;
  clear() {
    this.w.store.dispatch(A.clear());
  }
}
