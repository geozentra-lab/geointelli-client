import { FavoriteButton } from '../../shared/components/favorite-button';
import { CompareToggle } from '../../shared/components/compare-toggle';
import { ContactProfessional } from './contact-professional';
import { ComparablesMap, ComparablesMapSubject } from './comparables-map';
import { SaleHistory } from '../../shared/components/sale-history/sale-history';
import { PropertyValuationView } from './property-valuation';
import { PropertyFeatures } from './property-features';
import { SaleCandidates } from './sale-candidates';
import { PropertyOpportunity } from './property-opportunity';
import { ValuationHistory } from './valuation-history';
import { EstimatePoint } from '../../shared/components/sale-history/sale-history';
import { amount } from '../../core/models/property-valuation';
import { Property } from '../../core/models/property';
import { joinParts, placeLine } from '../../shared/data/format';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { PropertyGallery } from '../../shared/components/property-gallery/property-gallery';
import { CatalogActions as A } from '../../store/catalog/catalog.actions';
import { PropertyImagesActions as I } from '../../store/property-images/property-images.actions';
import { selectPropertyImages } from '../../store/property-images/property-images.selectors';
import { ValuationActions as V } from '../../store/valuation/valuation.actions';
import { selectValuationDetail } from '../../store/valuation/valuation.selectors';
@Component({
  imports: [
    ComparablesMap,
    ContactProfessional,
    FavoriteButton,
    CompareToggle,
    SaleHistory,
    PropertyValuationView,
    PropertyFeatures,
    SaleCandidates,
    PropertyOpportunity,
    ValuationHistory,
    CurrencyPipe,
    DecimalPipe,
    DatePipe,
    RouterLink,
    PageHeading,
    RequestStatus,
    PropertyGallery,
  ],
  templateUrl: './property-detail.html',
})
export class PropertyDetail implements OnDestroy {
  w = inject(Workspace);
  params = toSignal(inject(ActivatedRoute).paramMap);
  id = computed(() => {
    const id = Number(this.params()?.get('id'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  photos = this.w.store.selectSignal(selectPropertyImages);
  private valuationState = this.w.store.selectSignal(selectValuationDetail);
  /** The valuation state, only while it belongs to the property in the route. */
  valuation = computed(() => {
    const s = this.valuationState();
    const id = this.id();
    return s.propertyId === id
      ? s
      : { propertyId: id, valuation: null, loading: id !== null, error: null, notFound: false };
  });
  /** The estimate point for the sale-history chart, when the model produced one. */
  saleEstimate = computed<EstimatePoint | null>(() => {
    const v = this.valuation().valuation;
    const value = amount(v?.estimate?.value);
    if (!v || (v.status !== 'supported' && v.status !== 'limited') || value === null) return null;
    return { predictedPrice: value, predictionDate: v.method?.predictionDate ?? '' };
  });
  tab = signal('overview');
  /** The home the comparables map centres on; only once its detail matches the current route. */
  compSubject = computed<ComparablesMapSubject | null>(() => {
    const p = this.w.catalog().detail;
    if (!p || p.id !== this.id()) return null;
    return { folio: p.folio, countyId: p.countyId, address: p.address?.address ?? null };
  });
  constructor() {
    effect(() => {
      const id = this.id();
      if (id !== null) {
        this.w.store.dispatch(A.loadDetail({ id }));
        this.w.store.dispatch(I.load({ propertyId: id }));
        this.w.store.dispatch(V.loadDetail({ propertyId: id }));
      }
    });
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const button = event.currentTarget as HTMLButtonElement;
    const buttons = Array.from(
      button.parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]'),
    );
    const index = buttons.indexOf(button);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    this.tab.set(buttons[next].dataset['tab']!);
    buttons[next].focus();
  }
  private transportLabels: Record<string, string> = {
    RAIL: 'Metrorail station',
    PEOPLE_MOVER: 'Metromover station',
    BUS: 'bus stop',
    HIGHWAY: 'highway access',
  };
  transportLabel(category: string) {
    return this.transportLabels[category] ?? category.toLowerCase();
  }
  /** "Miami-Dade, FL · Folio 30-…": the parts that are known, never a stray comma. */
  place(p: Property) {
    return joinParts(' · ', placeLine(p.countyName, p.stateCode), 'Folio ' + p.folio);
  }
  distance(meters: number | null | undefined) {
    if (meters === null || meters === undefined) return 'Unknown';
    return meters < 1000
      ? Math.round(meters) + ' m'
      : (meters / 1000).toFixed(meters < 10000 ? 1 : 0) + ' km';
  }
  retryPrediction() {
    const id = this.id();
    if (id !== null) this.w.store.dispatch(V.loadDetail({ propertyId: id }));
  }
  reload() {
    const id = this.id();
    if (id !== null) this.w.store.dispatch(A.loadDetail({ id }));
  }
  reloadPhotos() {
    const id = this.id();
    if (id !== null) this.w.store.dispatch(I.load({ propertyId: id }));
  }
  ngOnDestroy() {
    this.w.store.dispatch(I.clear());
  }
}
