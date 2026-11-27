import { LabelPipe } from '../../shared/pipes/label.pipe';
import { PropertyPicker } from '../../shared/components/property-picker';
import { PropertyRef } from '../../shared/components/property-ref';
import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { todayIso } from '../../shared/data/format';
import { portfolioActions as A } from '../../store/portfolio/portfolio.actions';
import { PortfolioMutation } from '../../store/portfolio/portfolio.model';
import {
  FinancialCategory,
  FinancialRecordDTO,
  HoldingDTO,
  HoldingRequest,
  PortfolioMetric,
} from '../../core/models/api';
const emptyHolding = () => ({
  propertyId: null as number | null,
  acquisitionDate: '',
  purchasePrice: null as number | null,
  acquisitionCosts: null as number | null,
  ownershipSharePercent: 100,
  financingType: 'UNKNOWN' as 'UNKNOWN' | 'CASH' | 'FINANCED',
  outstandingBalance: null as number | null,
  loanAmount: null as number | null,
  balanceAsOfDate: '',
  interestRatePercent: null as number | null,
  loanTermMonths: null as number | null,
  monthlyPayment: null as number | null,
  occupancyStatus: 'UNKNOWN' as 'UNKNOWN' | 'OWNER_OCCUPIED' | 'RENTED' | 'VACANT',
  monthlyRent: null as number | null,
  leaseStartDate: '',
  leaseEndDate: '',
});
type PortfolioForm = 'portfolio' | 'holding' | 'record';
const formOf = (kind: PortfolioMutation['kind']): PortfolioForm | null =>
  kind === 'create-portfolio' || kind === 'update-portfolio'
    ? 'portfolio'
    : kind === 'add-holding' || kind === 'update-holding'
      ? 'holding'
      : kind === 'add-record' || kind === 'update-record'
        ? 'record'
        : null;
@Component({
  imports: [
    PropertyPicker,
    PropertyRef,
    FormsModule,
    DatePipe,
    DecimalPipe,
    PageHeading,
    RequestStatus,
    Pagination,
    LabelPipe,
  ],
  templateUrl: './portfolio.html',
})
export class Portfolio implements OnInit {
  w = inject(Workspace);
  private confirmation = inject(ConfirmationService);
  private destroy = inject(DestroyRef);
  name = '';
  description = '';
  editingPortfolio: number | null = null;
  holding = emptyHolding();
  editingHolding: number | null = null;
  category: FinancialCategory = 'RENT';
  amount: number | null = null;
  transactionDate = '';
  recordDescription = '';
  periodStart = '';
  periodEnd = '';
  editingRecord: number | null = null;
  fromDate = '';
  toDate = '';
  recordFrom = '';
  recordTo = '';
  readonly categories: FinancialCategory[] = [
    'RENT',
    'OTHER_INCOME',
    'REPAIRS',
    'MAINTENANCE',
    'INSURANCE',
    'PROPERTY_TAX',
    'HOA',
    'UTILITIES',
    'MANAGEMENT_FEE',
    'MORTGAGE_PAYMENT',
    'OTHER_EXPENSE',
  ];
  /** The latest date the backend takes for cash, an acquisition or a loan balance (none in the future). */
  readonly today = () => todayIso();
  /** A date after today, which the backend refuses for those three; said under the field. */
  future(date: string) {
    return !!date && date > todayIso();
  }
  /**
   * The form whose save the server refused: its error is said under that form's button (and in the
   * toast). A failed removal, from a row's button, is said in the toast only.
   */
  failedForm: PortfolioForm | null = null;
  private submitted: PortfolioMutation | null = null;
  private lastPortfolio: number | null = null;
  private lastHolding: number | null = null;
  constructor() {
    effect(() => {
      const s = this.w.portfolio();
      if (this.submitted && !s.saving) {
        const kind = this.submitted.kind;
        this.submitted = null;
        this.failedForm = s.errors.save ? formOf(kind) : null;
        if (!s.errors.save) {
          if (kind === 'create-portfolio' || kind === 'update-portfolio') this.newPortfolio();
          if (kind === 'add-holding' || kind === 'update-holding') this.newHolding();
          if (kind === 'add-record' || kind === 'update-record') this.resetRecord();
        }
      }

      if (s.selectedId !== this.lastPortfolio) {
        this.lastPortfolio = s.selectedId;
        this.failedForm = null;
        this.holding = emptyHolding();
        this.editingHolding = null;
        this.editingPortfolio = null;
        this.name = '';
        this.description = '';
        this.fromDate = '';
        this.toDate = '';
      }
      if (s.selectedHoldingId !== this.lastHolding) {
        this.lastHolding = s.selectedHoldingId;
        if (this.failedForm === 'record') this.failedForm = null;
        // Another holding's list opens unfiltered: its dates go with it.
        this.recordFrom = '';
        this.recordTo = '';
        this.resetRecord();
      }
    });
  }
  ngOnInit() {
    if (this.w.auth.isLoggedIn()) this.page(0);
  }
  page(page: number) {
    this.w.store.dispatch(A.load({ page }));
  }
  select(id: number | null) {
    if (this.w.portfolio().saving) return;
    this.w.store.dispatch(A.select({ id }));
  }
  holdingsPage(page: number) {
    const id = this.w.portfolio().selectedId;
    if (id !== null) this.w.store.dispatch(A.loadHoldings({ id, page }));
  }
  /** The property behind a holding, by address when it is known, else by folio. */
  holdingName(holdingId: number) {
    const h = this.w.portfolio().holdingsPage?.content.find((x) => x.id === holdingId);
    if (!h) return 'selected holding';
    return this.w.home(h.propertyId)?.address || 'Folio ' + h.folio;
  }
  selectHolding(holdingId: number | null) {
    if (this.w.portfolio().saving) return;
    this.w.store.dispatch(A.selectHolding({ holdingId }));
  }
  /** Filter: the dates typed, from the first page. */
  filterRecords() {
    this.loadRecords(0, { fromDate: this.recordFrom || undefined, toDate: this.recordTo || undefined });
  }
  /** Paging and Retry: the dates the list was filtered with, not ones typed since without Filter. */
  recordPage(page: number) {
    this.loadRecords(page, this.w.portfolio().recordsQuery);
  }
  private loadRecords(page: number, dates: { fromDate?: string; toDate?: string }) {
    const s = this.w.portfolio();
    if (s.selectedId !== null && s.selectedHoldingId !== null)
      this.w.store.dispatch(A.loadRecords({ id: s.selectedId, holdingId: s.selectedHoldingId, page, ...dates }));
  }
  summary() {
    const id = this.w.portfolio().selectedId;
    if (id !== null)
      this.w.store.dispatch(
        A.loadSummary({
          id,
          fromDate: this.fromDate || undefined,
          toDate: this.toDate || undefined,
        }),
      );
  }
  savePortfolio() {
    if (!this.name.trim()) return;
    const body = { name: this.name.trim(), description: this.description.trim() || null };
    this.mutate(
      this.editingPortfolio === null
        ? { kind: 'create-portfolio', body }
        : { kind: 'update-portfolio', id: this.editingPortfolio, body },
    );
  }
  editPortfolio() {
    if (this.w.portfolio().saving) return;
    const p = this.w.portfolios().find((x) => x.id === this.w.portfolio().selectedId);
    if (p) {
      this.editingPortfolio = p.id;
      this.name = p.name;
      this.description = p.description ?? '';
    }
  }
  newPortfolio() {
    this.editingPortfolio = null;
    this.name = '';
    this.description = '';
  }
  saveHolding() {
    const id = this.w.portfolio().selectedId,
      h = this.holding;
    if (
      id === null ||
      !h.propertyId ||
      h.ownershipSharePercent <= 0 ||
      h.ownershipSharePercent > 100
    )
      return;
    // Said under the field as it is typed (the backend refuses a future date).
    if (this.future(h.acquisitionDate)) return;
    if (h.financingType === 'FINANCED' && this.future(h.balanceAsOfDate)) return;
    const body: HoldingRequest = {
      ...(this.editingHolding === null ? { propertyId: h.propertyId } : {}),
      acquisitionDate: h.acquisitionDate || null,
      purchasePrice: h.purchasePrice,
      acquisitionCosts: h.acquisitionCosts,
      ownershipSharePercent: h.ownershipSharePercent,
      financing: {
        type: h.financingType,
        ...(h.financingType === 'FINANCED'
          ? {
              loanAmount: h.loanAmount,
              outstandingBalance: h.outstandingBalance,
              balanceAsOfDate: h.balanceAsOfDate || null,
              interestRatePercent: h.interestRatePercent,
              loanTermMonths: h.loanTermMonths,
              monthlyPayment: h.monthlyPayment,
            }
          : {}),
      },
      occupancy: {
        status: h.occupancyStatus,
        ...(h.occupancyStatus === 'RENTED'
          ? {
              monthlyRent: h.monthlyRent,
              leaseStartDate: h.leaseStartDate || null,
              leaseEndDate: h.leaseEndDate || null,
            }
          : {}),
      },
    };
    this.mutate(
      this.editingHolding === null
        ? { kind: 'add-holding', id, body }
        : { kind: 'update-holding', id, holdingId: this.editingHolding, body },
    );
  }
  editHolding(h: HoldingDTO) {
    if (this.w.portfolio().saving) return;
    this.editingHolding = h.id;
    this.holding = {
      propertyId: h.propertyId,
      acquisitionDate: h.acquisitionDate ?? '',
      purchasePrice: h.purchasePrice ?? null,
      acquisitionCosts: h.acquisitionCosts ?? null,
      ownershipSharePercent: h.ownershipSharePercent ?? 100,
      financingType: h.financing?.type ?? 'UNKNOWN',
      loanAmount: h.financing?.loanAmount ?? null,
      outstandingBalance: h.financing?.outstandingBalance ?? null,
      balanceAsOfDate: h.financing?.balanceAsOfDate ?? '',
      interestRatePercent: h.financing?.interestRatePercent ?? null,
      loanTermMonths: h.financing?.loanTermMonths ?? null,
      monthlyPayment: h.financing?.monthlyPayment ?? null,
      occupancyStatus: h.occupancy?.status ?? 'UNKNOWN',
      monthlyRent: h.occupancy?.monthlyRent ?? null,
      leaseStartDate: h.occupancy?.leaseStartDate ?? '',
      leaseEndDate: h.occupancy?.leaseEndDate ?? '',
    };
  }
  newHolding() {
    this.holding = emptyHolding();
    this.editingHolding = null;
  }
  async removeHolding(h: HoldingDTO) {
    const label = this.w.home(h.propertyId)?.address || 'folio ' + h.folio;
    if (
      await this.confirmation.confirm({
        title: 'Remove holding?',
        message:
          'Remove ' +
          label +
          ' from this portfolio, including its financial records? This cannot be undone.',
        confirmLabel: 'Remove holding',
      })
    )
      this.mutateAfterConfirm({ kind: 'remove-holding', id: h.portfolioId, holdingId: h.id });
  }
  saveRecord() {
    const s = this.w.portfolio();
    if (
      s.selectedId === null ||
      s.selectedHoldingId === null ||
      this.amount === null ||
      this.amount <= 0 ||
      !this.transactionDate
    )
      return;
    if (this.future(this.transactionDate)) return;
    if (
      !!this.periodStart !== !!this.periodEnd ||
      (this.periodStart && this.periodEnd && this.periodStart > this.periodEnd)
    ) {
      this.w.toast('Provide both coverage dates in chronological order, or leave both blank.', 'error');
      return;
    }
    const body = {
      category: this.category,
      amount: this.amount,
      transactionDate: this.transactionDate,
      currency: 'USD' as const,
      description: this.recordDescription.trim() || null,
      periodStart: this.periodStart || null,
      periodEnd: this.periodEnd || null,
    };
    this.mutate(
      this.editingRecord === null
        ? { kind: 'add-record', id: s.selectedId, holdingId: s.selectedHoldingId, body }
        : {
            kind: 'update-record',
            id: s.selectedId,
            holdingId: s.selectedHoldingId,
            recordId: this.editingRecord,
            body,
          },
    );
  }
  editRecord(r: FinancialRecordDTO) {
    if (this.w.portfolio().saving) return;
    this.editingRecord = r.id;
    this.category = r.category;
    this.amount = r.amount;
    this.transactionDate = r.transactionDate;
    this.recordDescription = r.description ?? '';
    this.periodStart = r.periodStart ?? '';
    this.periodEnd = r.periodEnd ?? '';
  }
  resetRecord() {
    this.editingRecord = null;
    this.category = 'RENT';
    this.amount = null;
    this.transactionDate = '';
    this.recordDescription = '';
    this.periodStart = '';
    this.periodEnd = '';
  }
  async removeRecord(r: FinancialRecordDTO) {
    if (
      await this.confirmation.confirm({
        title: 'Delete financial record?',
        message:
          'Permanently delete the ' +
          this.humanize(r.category).toLowerCase() +
          ' record of ' +
          this.money(r.amount) +
          ' dated ' +
          r.transactionDate +
          '? This cannot be undone.',
        confirmLabel: 'Delete record',
      })
    )
      this.mutateAfterConfirm({
        kind: 'remove-record',
        id: r.portfolioId,
        holdingId: r.holdingId,
        recordId: r.id,
      });
  }
  async removePortfolio() {
    const id = this.w.portfolio().selectedId;
    if (id === null) return;
    const name = this.w.portfolios().find((p) => p.id === id)?.name || 'this portfolio';
    if (
      await this.confirmation.confirm({
        title: 'Delete portfolio?',
        message:
          'Delete "' +
          name +
          '" with all of its holdings and financial records? This cannot be undone.',
        confirmLabel: 'Delete portfolio',
      })
    )
      this.mutateAfterConfirm({ kind: 'remove-portfolio', id });
  }
  /** The dialog may close after the page was left or while another write is still running. */
  private mutateAfterConfirm(mutation: PortfolioMutation) {
    if (this.destroy.destroyed || this.w.portfolio().saving) return;
    this.mutate(mutation);
  }
  private mutate(mutation: PortfolioMutation) {
    if (this.w.portfolio().saving || !this.w.requireAccount('manage portfolios')) return;
    this.submitted = mutation;
    this.failedForm = null;
    this.w.store.dispatch(A.mutate({ mutation }));
  }
  metric(m: PortfolioMetric | null | undefined) {
    return m?.total == null ? 'Unavailable' : this.money(m.total);
  }
  money(value: number | null | undefined) {
    return value == null
      ? 'Not supplied'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(value);
  }
  /** Turns backend section keys such as "cash_flow" or "DATA_COVERAGE" into readable words. */
  humanize(key: string) {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .toLowerCase();
  }
}
