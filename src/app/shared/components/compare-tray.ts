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
    .compare-tray {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px 10px 18px;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 999px;
      box-shadow: 0 10px 30px rgba(23, 39, 53, 0.16);
      font-size: 13px;
    }
    .disabled {
      opacity: 0.55;
      pointer-events: auto;
      cursor: not-allowed;
    }
    @media (max-width: 760px) {
      .compare-tray {
        bottom: 76px;
        left: 12px;
        right: 12px;
        transform: none;
        border-radius: 14px;
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
