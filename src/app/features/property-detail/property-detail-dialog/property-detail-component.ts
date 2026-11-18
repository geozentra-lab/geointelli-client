import { FavoriteButton } from '../../../shared/components/favorite-button';
import { CompareToggle } from '../../../shared/components/compare-toggle';
import { selectCompareSelection } from '../../../store/property-compare/property-compare.selectors';
import { COMPARE_MIN } from '../../../store/property-compare/property-compare.reducer';
import { LoadingSpinner } from '../../../shared/components/loading-spinner';
import { EstimatePoint, SaleHistory } from '../../../shared/components/sale-history/sale-history';
import { Component, Inject, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { PropertiesActions } from '../../../store/properties/properties.actions';
import { selectProperties } from '../../../store/properties/properties.selectors';
import { ValuationActions } from '../../../store/valuation/valuation.actions';
import { selectValuationDetail } from '../../../store/valuation/valuation.selectors';
import { PropertyImagesActions } from '../../../store/property-images/property-images.actions';
import { selectPropertyImages } from '../../../store/property-images/property-images.selectors';
import { PropertyGallery } from '../../../shared/components/property-gallery/property-gallery';
import { Icon } from '../../../shared/components/icon/icon';
import { CONFIDENCE } from '../../../shared/components/value-forecast';
import { amount, valuationShowsEstimate } from '../../../core/models/property-valuation';
import { placeLine } from '../../../shared/data/format';

/**
 * Quick look at a parcel from the map. The value shown is the same canonical valuation as the
 * property page (GET /properties/id/{id}/valuation), so a home never shows two different
 * ZentraValues depending on where it was opened.
 */
@Component({
  imports: [
    FavoriteButton,
    CompareToggle,
    LoadingSpinner,
    SaleHistory,
    MatDialogModule,
    CurrencyPipe,
    DecimalPipe,
    DatePipe,
    RouterLink,
    PropertyGallery,
    Icon,
  ],
  templateUrl: './property-detail-component.html',
  styleUrls: ['./property-detail-component.css'],
})
export class PropertyDetailComponent implements OnInit, OnDestroy {
  private store = inject(Store);
  state = this.store.selectSignal(selectProperties);
  photos = this.store.selectSignal(selectPropertyImages);
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
  showsEstimate = computed(() => valuationShowsEstimate(this.valuation().valuation));
  estimate = computed(() => amount(this.valuation().valuation?.estimate?.value));
  /** The 80% range, with the estimate's position along it for the marker. */
  range = computed(() => {
    const r = this.valuation().valuation?.estimate?.range80;
    const low = amount(r?.low),
      high = amount(r?.high),
      value = this.estimate();
    if (low === null || high === null || high <= low) return null;
    const at =
      value === null ? null : Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
    return { low, high, at };
  });
  confidence = computed(
    () =>
      CONFIDENCE[(this.valuation().valuation?.estimate?.confidence ?? '').toLowerCase()]?.label ??
      'Not stated',
  );
  oneYear = computed(() => {
    const value = amount(this.valuation().valuation?.forecasts?.oneYear?.value);
    const now = this.estimate();
    if (value === null) return null;
    return { value, change: now ? ((value - now) / now) * 100 : null };
  });
  reasons = computed(() => this.valuation().valuation?.reasons ?? []);
  lastSale = computed(() => {
    const s = this.valuation().valuation?.evidence?.lastSale;
    const price = amount(s?.price);
    return s?.hasSaleHistory && price !== null ? { price, date: s.date ?? null } : null;
  });
  /** The estimate point for the sale-history chart, when the model produced one. */
  saleEstimate = computed<EstimatePoint | null>(() => {
    const value = this.estimate();
    if (!this.showsEstimate() || value === null) return null;
    return {
      predictedPrice: value,
      predictionDate: this.valuation().valuation?.method?.predictionDate ?? '',
    };
  });
  location = computed(() =>
    placeLine(this.state().detail?.countyName, this.state().detail?.stateCode),
  );
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { folio: string; propertyId: number; countyId: number },
  ) {}
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
