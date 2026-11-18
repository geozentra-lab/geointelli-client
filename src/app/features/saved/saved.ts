import { LoadingSpinner } from '../../shared/components/loading-spinner';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { DestroyRef } from '@angular/core';
import { Component, OnInit, computed, inject } from '@angular/core';
import { selectSavedSearchesState } from '../../store/saved-searches/saved-searches.selectors';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { PropertyCard } from '../../shared/components/property-card';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { SavedSearchDTO } from '../../core/models/api';
import { favoritesActions as F } from '../../store/favorites/favorites.actions';
import { savedSearchesActions as A } from '../../store/saved-searches/saved-searches.actions';
import { CatalogActions } from '../../store/catalog/catalog.actions';
@Component({
  imports: [
    LoadingSpinner,
    FormsModule,
    RouterLink,
    PageHeading,
    PropertyCard,
    RequestStatus,
    Pagination,
  ],
  template: `<gz-heading
      eyebrow="YOUR SHORTLIST"
      title="Keep the possibilities in view."
      subtitle="Your saved properties and search definitions."
      ><a class="btn primary" routerLink="/explore">Find more properties</a></gz-heading
    >
    @if (!w.auth.isLoggedIn()) {
      <div class="panel section guest-notice">
        <h3>Your shortlist, in one place.</h3>
        <p class="sub spacer">Sign in to save properties and searches across visits.</p>
        <button type="button" class="btn primary spacer" (click)="w.signIn()">Sign in</button>
      </div>
    } @else {
      <h2>Saved properties</h2>
      <gz-request-status
        [loading]="w.favoriteState().loading"
        [error]="w.favoriteState().error"
        (retry)="w.retryFavorite()"
      />
      <div class="propertygrid section">
        @for (favorite of w.favorites(); track favorite.propertyId) {
          @if (w.home(favorite.propertyId); as h) {
            <gz-property-card [home]="h" />
          } @else {
            <div class="panel">
              <h3>Property {{ favorite.propertyId }}</h3>
              @if (w.favoriteState().detailsPending.includes(favorite.propertyId)) {
                <gz-loading-spinner label="Loading saved property" />
              } @else {
                <p class="sub spacer">
                  {{
                    w.favoriteState().detailsErrors[favorite.propertyId] ||
                      'Property details are unavailable.'
                  }}
                </p>
              }
              <div class="actions spacer">
                <a class="btn small" [routerLink]="['/property', favorite.propertyId]"
                  >Open record</a
                ><button
                  class="btn small"
                  [disabled]="w.favoriteState().detailsPending.includes(favorite.propertyId)"
                  (click)="loadProperty(favorite.propertyId)"
                >
                  Retry details</button
                ><button
                  class="btn small"
                  [disabled]="w.favoriteState().pending.includes(favorite.propertyId)"
                  (click)="w.toggleSave(favorite.propertyId)"
                >
                  Remove favorite
                </button>
              </div>
            </div>
          }
        } @empty {
          @if (!w.favoriteState().loading && !w.favoriteState().error) {
            <div class="empty">No saved properties yet. Save a property from Explore.</div>
          }
        }
      </div>
      <div class="panel section" #searchList tabindex="-1" aria-label="Saved searches">
        <div class="panelhead">
          <h3>Saved searches</h3>
          <span class="tag">{{ w.searchState().totalElements }} searches</span>
        </div>
        <gz-request-status
          [loading]="w.searchState().loading"
          [error]="w.searchState().error"
          [showRetry]="w.searchState().errorOperation !== 'save'"
          (retry)="page(w.searchState().page)"
        />
        @for (s of w.searches(); track s.id) {
          <div class="alertrow">
            <div class="alertcontent">
              <input class="field" aria-label="Search name" [ngModel]="s.name" #name />
              <p>
                {{ s.paused ? 'Monitoring paused' : 'Monitoring enabled' }} ·
                {{ s.cadence === 'WEEKLY' ? 'Weekly' : 'Daily' }}
              </p>
            </div>
            <div class="actions">
              <select
                class="field"
                aria-label="Search cadence"
                [ngModel]="s.cadence"
                #cadenceSelect
                (ngModelChange)="update(s, { cadence: $event }); cadenceSelect.value = s.cadence"
                [disabled]="w.searchState().saving > 0"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option></select
              ><button
                class="btn small"
                (click)="update(s, { name: name.value })"
                [disabled]="!name.value.trim() || w.searchState().saving > 0"
              >
                Rename</button
              ><button
                class="btn small"
                (click)="update(s, { paused: !s.paused })"
                [disabled]="w.searchState().saving > 0"
              >
                {{ s.paused ? 'Resume' : 'Pause' }}</button
              ><button
                class="btn small"
                (click)="togglePreview(s.id)"
                [attr.aria-expanded]="previewId() === s.id"
                [attr.aria-controls]="'matches-' + s.id"
              >
                {{ previewId() === s.id ? 'Hide matches' : 'Matches' }}</button
              ><button class="btn small" (click)="open(s)">Open</button
              ><button
                class="btn small"
                (click)="remove(s.id)"
                [disabled]="w.searchState().saving > 0"
              >
                Delete
              </button>
            </div>
          </div>
          @if (previewId() === s.id) {
            <div class="matches" [id]="'matches-' + s.id" aria-live="polite">
              <gz-request-status
                [loading]="preview().loading"
                loadingText="Running this search on current records…"
                [error]="preview().error"
                (retry)="loadPreview(s.id)"
              />
              @if (preview().value; as r) {
                <p class="smalltext muted">
                  {{ r.totalElements }}
                  {{ r.totalElements === 1 ? 'property matches' : 'properties match' }}
                  today
                  @if (r.totalElements > r.content.length) {
                    · first {{ r.content.length }} shown
                  }
                </p>
                @for (m of r.content; track m.id) {
                  <a class="match" [routerLink]="['/property', m.id]"
                    ><span>{{ m.address || 'Folio ' + m.folio }}</span
                    ><span class="smalltext muted"
                      >{{ m.city || m.countyName }}
                      @if (m.bedrooms !== null) {
                        · {{ m.bedrooms }} bd
                      }
                      @if (m.livingAreaSqft) {
                        · {{ m.livingAreaSqft }} sqft
                      }
                    </span></a
                  >
                } @empty {
                  <p class="sub">No property matches these filters right now.</p>
                }
                @if (r.totalElements > r.content.length) {
                  <button type="button" class="btn small spacer" (click)="open(s)">
                    See all in Explore
                  </button>
                }
              }
            </div>
          }
        } @empty {
          @if (!w.searchState().loading && !w.searchState().error) {
            <p class="sub">Save a named search from Explore to find it here.</p>
          }
        }
        <gz-pagination
          [page]="w.searchState().page"
          [pages]="w.searchState().totalPages"
          [total]="w.searchState().totalElements"
          [loading]="w.searchState().loading"
          [focusTarget]="searchList"
          (changed)="page($event)"
        />
      </div>
    }`,
  styles: `
    .matches {
      padding: 12px 16px 16px;
      margin: 0 0 4px;
      background: #f7f5f1;
      border-bottom: 1px solid var(--line);
      border-radius: 0 0 10px 10px;
    }
    .match {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-top: 1px solid var(--line);
      font-size: 13px;
    }
    .match:hover span:first-child {
      color: var(--copper);
    }
  `,
})
export class Saved implements OnInit {
  w = inject(Workspace);
  router = inject(Router);
  confirmation = inject(ConfirmationService);
  destroy = inject(DestroyRef);
  private searches = this.w.store.selectSignal(selectSavedSearchesState);
  /** The saved search whose current matches are shown (GET /saved-searches/{id}/results). */
  previewId = computed(() => this.searches().previewId);
  preview = computed(() => this.searches().preview);
  ngOnInit() {
    if (this.w.auth.isLoggedIn()) {
      this.loadFavorites();
      this.page(0);
    }
  }
  loadProperty(propertyId: number) {
    if (!this.w.favoriteState().detailsPending.includes(propertyId))
      this.w.store.dispatch(F.loadProperty({ propertyId }));
  }
  loadFavorites() {
    this.w.store.dispatch(F.load());
  }
  page(page: number) {
    this.w.store.dispatch(A.load({ page }));
  }
  update(s: SavedSearchDTO, request: import('../../core/models/api').SavedSearchRequest) {
    if (this.w.searchState().saving || !this.w.requireAccount('update saved searches')) return;
    this.w.store.dispatch(A.update({ id: s.id, request }));
  }
  async remove(id: number) {
    const item = this.w.searches().find((s) => s.id === id);
    if (
      (await this.confirmation.confirm({
        title: 'Delete saved search?',
        message:
          'Delete "' +
          (item?.name || 'this search') +
          '" and its linked alert rules? This cannot be undone.',
      })) &&
      !this.destroy.destroyed &&
      !this.w.searchState().saving
    )
      this.w.store.dispatch(A.remove({ id }));
  }
  togglePreview(id: number) {
    if (this.previewId() === id) this.w.store.dispatch(A.closePreview());
    else this.loadPreview(id);
  }
  loadPreview(id: number) {
    this.w.store.dispatch(A.loadPreview({ id }));
  }
  open(s: SavedSearchDTO) {
    this.w.store.dispatch(CatalogActions.search({ query: { ...s.filters, page: 0, size: 20 } }));
    this.router.navigate(['/explore']);
  }
}
