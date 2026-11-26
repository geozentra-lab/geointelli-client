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
import { ZentraValue } from '../../shared/components/zentra-value';
import { RECORD_KIT } from '../../shared/components/record';
import { Sheet } from '../../shared/layout/sheet';
import { amount } from '../../core/models/property-valuation';
import { Property } from '../../core/models/property';
import { formatFolio, placeLine } from '../../shared/data/format';
import { HistorySeries, historySeries } from './valuation-series';
import { PropertyFacts } from './property-facts';
import { PropertyAssessments } from './property-assessments';
import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { Page } from '../../core/models/api';
import { ValuationHistoryEntry } from '../../core/models/property-valuation';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Workspace } from '../../shared/data/workspace';
import { RequestStatus } from '../../shared/components/request-status';
import { PropertyGallery } from '../../shared/components/property-gallery/property-gallery';
import { CatalogActions as A } from '../../store/catalog/catalog.actions';
import { PropertyImagesActions as I } from '../../store/property-images/property-images.actions';
import { selectPropertyImages } from '../../store/property-images/property-images.selectors';
import { ValuationActions as V } from '../../store/valuation/valuation.actions';
import { selectValuationDetail } from '../../store/valuation/valuation.selectors';
import { PropertyInsightsActions as P } from '../../store/property-insights/property-insights.actions';
import { selectPropertyInsights } from '../../store/property-insights/property-insights.selectors';

export const PROPERTY_TABS = [
  ['overview', 'Overview'],
  ['valuation', 'Valuation'],
  ['location', 'Location'],
  ['sales', 'Sales'],
  ['features', 'Features'],
  ['comparables', 'Comparables'],
] as const;
export type PropertyTab = (typeof PROPERTY_TABS)[number][0];

/**
 * The property page, a record (DESIGN.md §5): the address as h1 with one facts line, sticky tabs,
 * then 8 columns of content and a sticky ZentraValue aside (4 columns). The aside carries the
 * page's actions, and "Ask about this property" opens the contact form in a sheet. On the
 * Comparables tab the aside shrinks to one line above the table. Phones get one column with the
 * ZentraValue under the header.
 */
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
    ZentraValue,
    Sheet,
    DecimalPipe,
    NgTemplateOutlet,
    RouterLink,
    RequestStatus,
    PropertyGallery,
    PropertyFacts,
    PropertyAssessments,
    ...RECORD_KIT,
  ],
  templateUrl: './property-detail.html',
  styleUrl: './property-detail.css',
})
export class PropertyDetail implements OnDestroy {
  w = inject(Workspace);
  readonly tabs = PROPERTY_TABS;
  params = toSignal(inject(ActivatedRoute).paramMap);
  id = computed(() => {
    const id = Number(this.params()?.get('id'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  /** The record, only once it belongs to the property in the route. */
  detail = computed(() => {
    const p = this.w.catalog().detail;
    return p && p.id === this.id() ? p : null;
  });
  photos = this.w.store.selectSignal(selectPropertyImages);
  /** Photos take room only when there are some, or while they load or fail (with a retry). */
  showGallery = computed(() => {
    const s = this.photos();
    return s.loading || !!s.error || s.images.length > 0;
  });
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
  private insights = this.w.store.selectSignal(selectPropertyInsights);
  /** The latest page of published valuations (newest first), for the monthly line on the chart. */
  private historyPage = computed(() => {
    const s = this.insights();
    return s.propertyId === this.id() ? s.history.value : null;
  });
  history = linkedSignal<Page<ValuationHistoryEntry> | null, HistorySeries>({
    source: this.historyPage,
    computation: (h, previous) =>
      !h
        ? { line: [], band: [] }
        : h.page === 0
          ? historySeries(h.content)
          : (previous?.value ?? { line: [], band: [] }),
  });
  tab = signal<PropertyTab>('overview');
  askOpen = signal(false);
  /** The home the comparables map centres on; only once its detail matches the current route. */
  compSubject = computed<ComparablesMapSubject | null>(() => {
    const p = this.detail();
    if (!p) return null;
    return { folio: p.folio, countyId: p.countyId, address: p.address?.address ?? null };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id === null) return;
      untracked(() => {
        this.tab.set('overview');
        this.askOpen.set(false);
        this.w.store.dispatch(A.loadDetail({ id }));
        this.w.store.dispatch(I.load({ propertyId: id }));
        this.w.store.dispatch(V.loadDetail({ propertyId: id }));
        this.w.store.dispatch(P.loadHistory({ propertyId: id, page: 0 }));
      });
    });
  }
  selectTab(tab: PropertyTab) {
    this.tab.set(tab);
    // The sales chart reads the newest page of valuations; the Valuation tab may have paged away.
    const id = this.id();
    const h = this.historyPage();
    if ((tab === 'overview' || tab === 'sales') && id !== null && h && h.page !== 0)
      this.w.store.dispatch(P.loadHistory({ propertyId: id, page: 0 }));
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
    this.selectTab(buttons[next].dataset['tab'] as PropertyTab);
    buttons[next].focus();
  }

  /** The address, or the folio when the record has no address. */
  title(p: Property) {
    return p.address?.address?.trim() || 'Folio ' + formatFolio(p.folio);
  }
  /** "Miami, FL 33133 · Folio 01-4137-012-0450 · Single family · Silver Bluff": the known parts. */
  factsLine(p: Property) {
    const place = placeLine(p.address?.city || p.countyName, p.stateCode, p.address?.zip);
    const folio = formatFolio(p.folio);
    return [place, folio ? 'Folio ' + folio : '', p.dorDescription, p.neighborhoodDescription]
      .map((s) => (s ?? '').trim())
      .filter(Boolean);
  }
  /** A number from the record, or null when it is missing (never 0 for unknown). */
  num(v: number | null | undefined) {
    return amount(v);
  }
  /** True when any of the values is missing, so the group writes the reason once. */
  anyMissing(...values: unknown[]) {
    return values.some((v) => v === null || v === undefined);
  }

  private transportLabels: Record<string, string> = {
    RAIL: 'Metrorail station',
    PEOPLE_MOVER: 'Metromover station',
    BUS: 'bus stop',
    HIGHWAY: 'highway access',
  };
  transportLabel(category: string) {
    return this.transportLabels[category] ?? category.toLowerCase().replace(/_/g, ' ');
  }
  distance(meters: number | null | undefined) {
    const m = amount(meters);
    if (m === null) return null;
    return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
  }

  openAsk() {
    this.askOpen.set(true);
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
