import { savedSearchesActions } from '../../store/saved-searches/saved-searches.actions';
import { LoadingSpinner } from '../../shared/components/loading-spinner';
import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { PropertyCard } from '../../shared/components/property-card';
import { CountyPicker } from '../../shared/components/county-picker';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { Map as ParcelExplorer } from './live-map/map';
@Component({
  imports: [
    LoadingSpinner,
    FormsModule,
    RouterLink,
    PageHeading,
    PropertyCard,
    CountyPicker,
    RequestStatus,
    Pagination,
    ParcelExplorer,
  ],
  templateUrl: './explore.html',
})
export class Explore implements OnInit {
  w = inject(Workspace);
  view = signal<'map' | 'grid'>('grid');
  saveName = '';
  private submittedName: string | null = null;
  constructor() {
    effect(() => {
      const state = this.w.searchState();
      if (this.submittedName !== null && !state.saving) {
        if (!state.error && this.saveName.trim() === this.submittedName) this.saveName = '';
        this.submittedName = null;
      }
    });
  }

  ngOnInit() {
    this.w.search({}, false);
  }
  retrySavedSearch() {
    if (this.w.searchState().errorOperation === 'load')
      this.w.store.dispatch(savedSearchesActions.load({ page: this.w.searchState().page }));
    else this.save();
  }
  retry() {
    this.w.search({}, false);
  }
  page(page: number) {
    this.w.search({ page }, false);
  }
  save() {
    if (
      this.w.searchState().saving ||
      !this.saveName.trim() ||
      !this.w.requireAccount('save searches')
    )
      return;
    this.submittedName = this.saveName.trim();
    this.w.saveSearch(this.submittedName);
  }
  reset() {
    this.w.store.dispatch(LocationsActions.selectState({ stateId: null }));
    this.w.store.dispatch(
      CatalogActions.search({ query: { page: 0, size: 20, sortBy: 'id', direction: 'asc' } }),
    );
  }
}
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { LocationsActions } from '../../store/locations/locations.actions';
