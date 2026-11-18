import { Component, OnInit, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { LocationsActions as A } from '../../store/locations/locations.actions';
import { selectLocations } from '../../store/locations/locations.selectors';
@Component({
  selector: 'gz-county-picker',
  imports: [FormsModule],
  template: `<div class="actions">
    <select
      class="field"
      aria-label="State"
      [ngModel]="locations().stateId"
      (ngModelChange)="state($event)"
    >
      <option [ngValue]="null">All states</option>
      @for (s of locations().states; track s.id) {
        <option [ngValue]="s.id">{{ s.name }}</option>
      }</select
    ><select
      class="field"
      aria-label="County"
      [ngModel]="locations().countyId"
      (ngModelChange)="county($event)"
      [disabled]="!locations().stateId || locations().loading"
    >
      <option [ngValue]="null">
        {{ locations().loading ? 'Loading counties…' : 'All counties' }}
      </option>
      @for (c of locations().counties; track c.countyId) {
        <option [ngValue]="c.countyId">{{ c.countyName }}</option>
      }
    </select>
    @if (locations().error) {
      <span class="smalltext" role="alert">{{ locations().error }}</span
      ><button type="button" class="btn small" (click)="retry()">Retry locations</button>
    }
  </div>`,
})
export class CountyPicker implements OnInit {
  store = inject(Store);
  locations = this.store.selectSignal(selectLocations);
  changed = output<{ state?: string; countyId?: number }>();
  ngOnInit() {
    if (!this.locations().states.length) this.store.dispatch(A.loadStates());
  }
  state(stateId: number | null) {
    this.store.dispatch(A.selectState({ stateId }));
    this.emit();
  }
  county(countyId: number | null) {
    this.store.dispatch(A.selectCounty({ countyId }));
    this.emit();
  }
  retry() {
    const id = this.locations().stateId;
    this.store.dispatch(id === null ? A.loadStates() : A.selectState({ stateId: id }));
  }
  private emit() {
    const s = this.locations();
    this.changed.emit({
      state: s.states.find((x) => x.id === s.stateId)?.code,
      countyId: s.countyId ?? undefined,
    });
  }
}
