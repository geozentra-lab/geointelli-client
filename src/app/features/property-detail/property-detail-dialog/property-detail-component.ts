import { FavoriteButton } from '../../../shared/components/favorite-button';
import { CompareToggle } from '../../../shared/components/compare-toggle';
import { selectCompareSelection } from '../../../store/property-compare/property-compare.selectors';
import { COMPARE_MIN } from '../../../store/property-compare/property-compare.reducer';
import { LoadingSpinner } from '../../../shared/components/loading-spinner';
import { EstimatePoint, SaleHistory } from '../../../shared/components/sale-history/sale-history';
import { Component, Inject, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { holdShellForDialog } from '../../../shared/layout/shell-layer';
import { Store } from '@ngrx/store';
import { PropertiesActions } from '../../../store/properties/properties.actions';
import { selectProperties } from '../../../store/properties/properties.selectors';
import { ValuationActions } from '../../../store/valuation/valuation.actions';
import { selectValuationDetail } from '../../../store/valuation/valuation.selectors';
import { PropertyImagesActions } from '../../../store/property-images/property-images.actions';
import { selectPropertyImages } from '../../../store/property-images/property-images.selectors';
import { PropertyGallery } from '../../../shared/components/property-gallery/property-gallery';
import { Icon } from '../../../shared/components/icon/icon';
import { ZentraValue } from '../../../shared/components/zentra-value';
import { amount, valuationShowsEstimate } from '../../../core/models/property-valuation';
import { formatFolio, placeLine } from '../../../shared/data/format';
import { PropertyFacts } from '../property-facts';
import { PropertyAssessments } from '../property-assessments';

/**
 * Quick look at a parcel from the live map (DESIGN.md §5, Live map): a Material dialog restyled to
 * the tokens, with the shared ZentraValue block beside the county record. The value is the same
 * canonical valuation as the property page (GET /properties/id/{id}/valuation), so a home never
 * shows two different ZentraValues depending on where it was opened. On phones it is full screen
 * with the ZentraValue first.
 */
@Component({
  imports: [
    FavoriteButton,
    CompareToggle,
    LoadingSpinner,
    SaleHistory,
    MatDialogModule,
    RouterLink,
    PropertyGallery,
    Icon,
    ZentraValue,
    PropertyFacts,
    PropertyAssessments,
  ],
  templateUrl: './property-detail-component.html',
  styleUrls: ['./property-detail-component.css'],
})
export class PropertyDetailComponent implements OnInit, OnDestroy {
  private store = inject(Store);
  state = this.store.selectSignal(selectProperties);
  photos = this.store.selectSignal(selectPropertyImages);
  /** Photos take room only when there are some, or while they load or fail (with a retry). */
  showGallery = computed(() => {
    const s = this.photos();
    return s.loading || !!s.error || s.images.length > 0;
  });
  /** The comparison tray is hidden behind the dialog, so the dialog offers the comparison itself. */
  compareSelection = this.store.selectSignal(selectCompareSelection);
  readonly compareMin = COMPARE_MIN;
  private detail = this.store.selectSignal(selectValuationDetail);
  /** The valuation state, only once it belongs to this dialog's property. */
  valuation = computed(() => {
    const s = this.detail();
    return s.propertyId === this.data.propertyId
      ? s
      : { valuation: null, loading: true, error: null, notFound: false };
  });
  /** The estimate point for the sale-history chart, when the model produced one. */
  saleEstimate = computed<EstimatePoint | null>(() => {
    const v = this.valuation().valuation;
    const value = amount(v?.estimate?.value);
    if (!valuationShowsEstimate(v) || value === null) return null;
    return { predictedPrice: value, predictionDate: v?.method?.predictionDate ?? '' };
  });
  /** The address, or the folio while the record loads or when it has no address. */
  title = computed(
    () => this.state().detail?.address?.address?.trim() || 'Folio ' + formatFolio(this.data.folio),
  );
  /** "Miami, FL 33133 · Folio 01-4137-012-0450 · Single family": the parts that are known. */
  factsLine = computed(() => {
    const p = this.state().detail;
    const place = placeLine(p?.address?.city || p?.countyName, p?.stateCode, p?.address?.zip);
    return [place, 'Folio ' + formatFolio(this.data.folio), p?.dorDescription ?? '']
      .map((s) => s.trim())
      .filter(Boolean);
  });
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { folio: string; propertyId: number; countyId: number },
  ) {
    // The shell stays inert and dimmed behind the dialog (DESIGN.md §14, bug 2).
    holdShellForDialog(inject(MatDialogRef, { optional: true }) ?? undefined);
  }
  ngOnInit() {
    this.load();
    this.loadImages();
  }
  load() {
    if (Number.isSafeInteger(this.data.countyId) && this.data.countyId > 0) {
      this.store.dispatch(
        PropertiesActions.loadDetail({ folio: this.data.folio, countyId: this.data.countyId }),
      );
    } else {
      this.store.dispatch(
        PropertiesActions.detailFailed({
          error: 'County information is missing for this property. Refresh the map and try again.',
        }),
      );
    }
    this.retryValuation();
  }
  loadImages() {
    this.store.dispatch(PropertyImagesActions.load({ propertyId: this.data.propertyId }));
  }
  retryValuation() {
    this.store.dispatch(ValuationActions.loadDetail({ propertyId: this.data.propertyId }));
  }
  ngOnDestroy() {
    this.store.dispatch(PropertyImagesActions.clear());
  }
}
