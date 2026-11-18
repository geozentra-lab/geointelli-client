import { Component, computed, effect, inject, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardOverview } from '../dashboard-overview';
import { Workspace } from '../../../shared/data/workspace';
import { HoldingOccupancy, PortfolioMetric, PortfolioSummaryDTO } from '../../../core/models/api';
import { InvestorOccupancyExposureCardDTO } from '../../../core/models/dashboard';
import { Icon } from '../../../shared/components/icon/icon';
import { labelFor } from '../../../shared/pipes/label.pipe';
import { InvestorDashboardActions as A } from '../../../store/investor-dashboard/investor-dashboard.actions';
import {
  selectInvestorDashboard,
  selectSummaryTarget,
} from '../../../store/investor-dashboard/investor-dashboard.selectors';
import { Kpi, RecentActivity, TopOpportunities, usdCompact } from '../dash-ui';
import { AffordabilityCard } from '../finance-cards';

const CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Rent',
  OTHER_INCOME: 'Other income',
  REPAIRS: 'Repairs',
  MAINTENANCE: 'Maintenance',
  INSURANCE: 'Insurance',
  PROPERTY_TAX: 'Property tax',
  HOA: 'HOA',
  UTILITIES: 'Utilities',
  MANAGEMENT_FEE: 'Management',
  MORTGAGE_PAYMENT: 'Mortgage',
  OTHER_EXPENSE: 'Other expenses',
};
const OCCUPANCY: [HoldingOccupancy, string][] = [
  ['RENTED', 'Rented'],
  ['VACANT', 'Vacant'],
  ['OWNER_OCCUPIED', 'Owner occupied'],
  ['UNKNOWN', 'Not set'],
];

/**
 * Residential investor (SOW II.4.o): value, equity and debt and occupancy and exposure across all
 * portfolios or one, from the investor dashboard cards; income and expenses of a single portfolio
 * from its summary; scored opportunities and financing. Nothing is recalculated here.
 */
@Component({
  selector: 'gz-investor-dashboard',
  imports: [
    DashboardOverview,
    Kpi,
    TopOpportunities,
    RecentActivity,
    AffordabilityCard,
    DatePipe,
    DecimalPipe,
    RouterLink,
    Icon,
  ],
  template: `@if (signedIn()) {
      @if (d().portfolios.value; as page) {
        @if (page.content.length > 1) {
          <div class="dash-switch inline-filter">
            <label for="dash-portfolio">Portfolio</label>
            <select
              id="dash-portfolio"
              class="field"
              [value]="d().portfolioId ?? ''"
              (change)="select($any($event.target).value)"
            >
              <option value="">All portfolios · {{ holdings(page.content) }} holdings</option>
              @for (p of page.content; track p.id) {
                <option [value]="p.id">{{ p.name }} · {{ p.holdingCount }} holdings</option>
              }
            </select>
          </div>
        }
      }
      @let v = d().valueEquityDebt.value;
      @let o = d().occupancyExposure.value;
      @let s = d().summary.value;
      <div class="kpi-row section">
        <gz-kpi
          label="Portfolio value"
          icon="brief"
          link="/portfolio"
          [loading]="d().valueEquityDebt.loading && !v"
          [value]="amount(v?.value)"
          [caption]="coverage(v?.value, 'valued')"
          [unavailable]="noPortfolio() ? 'Create a portfolio to start' : 'No valuations yet'"
        />
        <gz-kpi
          label="Equity"
          icon="wallet"
          tone="green"
          link="/portfolio"
          [loading]="d().valueEquityDebt.loading && !v"
          [value]="amount(v?.equity)"
          [caption]="v ? 'Debt ' + (amount(v.debt) ?? 'not recorded') + asOf(v.asOfDate) : ''"
          unavailable="Needs values and loan balances"
        />
        <gz-kpi
          label="Net cash flow"
          icon="chart"
          tone="ink"
          link="/portfolio"
          [loading]="d().summary.loading && !s"
          [value]="cashFlow(s)"
          [caption]="period(s)"
          [unavailable]="target() === null ? 'Choose one portfolio' : 'Record income and expenses'"
        />
        <gz-kpi
          label="Rental occupancy"
          icon="home"
          tone="amber"
          link="/portfolio"
          [loading]="d().occupancyExposure.loading && !o"
          [value]="pct(o?.rentalOccupancyPercent)"
          [caption]="o ? o.rentalHoldings + ' rental of ' + o.totalHoldings + ' holdings' : ''"
          unavailable="Set occupancy on your holdings"
        />
      </div>
      @if (cardError(); as error) {
        <div class="insight danger section" role="alert">
          {{ error }}
          <button type="button" class="btn small" (click)="reload()">Retry</button>
        </div>
      }
      <div class="dash-grid section">
        <div class="dash-main">
          @if (noPortfolio()) {
            <section class="panel dash-card">
              <div class="empty-state">
                <gz-icon name="brief" />
                <p>Track what you own: value, equity, rent and expenses in one place.</p>
                <a class="btn primary small" routerLink="/portfolio">Create a portfolio</a>
              </div>
            </section>
          } @else {
            <section class="panel dash-card" aria-labelledby="card-value">
              <div class="panelhead">
                <div>
                  <h3 id="card-value">Value, equity and debt</h3>
                  <p class="smalltext muted">{{ scopeLabel() }} · by ownership share</p>
                </div>
                <a class="smalltext" routerLink="/portfolio">Manage holdings</a>
              </div>
              @if (d().valueEquityDebt.loading && !v) {
                @for (i of [1, 2, 3]; track i) {
                  <div class="row-skeleton"></div>
                }
              } @else if (v) {
                <div class="flow">
                  @for (m of metrics(); track m.key) {
                    <div>
                      <span class="smalltext muted">{{ m.label }}</span>
                      <b [class.green]="m.key === 'equity'">{{ amount(m.metric) ?? '—' }}</b>
                      <span class="smalltext muted">
                        {{
                          m.percent === null
                            ? 'No holdings'
                            : (m.percent | number: '1.0-0') + '% covered'
                        }}
                      </span>
                    </div>
                  }
                </div>
                <p class="sourcedata">
                  @if (v.newestValuationDate) {
                    Valuations {{ range(v.oldestValuationDate, v.newestValuationDate) }} ·
                  }
                  @if (v.newestBalanceDate) {
                    loan balances {{ range(v.oldestBalanceDate, v.newestBalanceDate) }} ·
                  }
                  {{ label(v.debtSource) }}. {{ v.note }}
                </p>
              }
            </section>
            <section class="panel dash-card" aria-labelledby="card-performance">
              <div class="panelhead">
                <div>
                  <h3 id="card-performance">Income and expenses</h3>
                  @if (s) {
                    <p class="smalltext muted">
                      {{ s.portfolioName }} · {{ s.fromDate | date: 'MMM d, y' }} –
                      {{ s.toDate | date: 'MMM d, y' }}
                    </p>
                  }
                </div>
              </div>
              @if (target() === null) {
                <div class="empty-state">
                  <gz-icon name="chart" />
                  <p>Recorded income and expenses are kept per portfolio. Choose one above.</p>
                </div>
              } @else if (d().summary.loading && !s) {
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="row-skeleton"></div>
                }
              } @else if (s?.financials; as f) {
                <div class="flow">
                  <div>
                    <span class="smalltext muted">Income</span>
                    <b class="green">{{ money(f.income) }}</b>
                  </div>
                  <div>
                    <span class="smalltext muted">Expenses</span>
                    <b>{{ money(f.expenses) }}</b>
                  </div>
                  <div>
                    <span class="smalltext muted">Cash flow</span>
                    <b [class.green]="f.cashFlow > 0" [class.amber]="f.cashFlow < 0">{{
                      signed(f.cashFlow)
                    }}</b>
                  </div>
                </div>
                @if (categories(s!).length) {
                  <ul class="mix" aria-label="Income and expenses by category">
                    @for (c of categories(s!); track c.category) {
                      <li [class.income]="c.type === 'INCOME'">
                        <span>{{ category(c.category) }}</span>
                        <span class="mix-track"
                          ><span class="mix-fill" [style.width.%]="c.share"></span
                        ></span>
                        <b>{{ money(c.amount) }}</b>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="sub">No income or expenses recorded in this period.</p>
                }
                <p class="sourcedata">
                  {{ f.recordCount }} records across {{ f.holdingsWithRecords }} of
                  {{ f.totalHoldings }} holdings · {{ f.basis }}
                </p>
              } @else if (s) {
                <p class="sub">Income and expenses are not available for this portfolio.</p>
              }
            </section>
            <section class="panel dash-card" aria-labelledby="card-exposure">
              <div class="panelhead">
                <div>
                  <h3 id="card-exposure">Occupancy and exposure</h3>
                  <p class="smalltext muted">{{ scopeLabel() }} · counted by holding</p>
                </div>
              </div>
              @if (d().occupancyExposure.loading && !o) {
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="row-skeleton"></div>
                }
              } @else if (o && o.totalHoldings) {
                <ul class="mix" aria-label="Holdings by occupancy">
                  @for (row of occupancyRows(o); track row.key) {
                    <li>
                      <span>{{ row.label }}</span>
                      <span class="mix-track"
                        ><span class="mix-fill" [style.width.%]="row.share"></span
                      ></span>
                      <b>{{ row.count }}</b>
                    </li>
                  }
                </ul>
                @if (o.counties.length) {
                  <h4 class="dash-subhead">By county</h4>
                  <ul class="mix" aria-label="Holdings by county">
                    @for (g of o.counties; track g.countyId ?? $index) {
                      <li>
                        <span>{{
                          g.unknown ? 'Unknown county' : g.countyName + ', ' + (g.stateCode ?? '')
                        }}</span>
                        <span class="mix-track"
                          ><span class="mix-fill ink" [style.width.%]="g.holdingPercent"></span
                        ></span>
                        <b>{{ g.holdingPercent | number: '1.0-0' }}%</b>
                      </li>
                    }
                  </ul>
                }
                <p class="sourcedata">
                  Occupancy known for {{ o.occupancyCoveragePercent ?? 0 | number: '1.0-0' }}% and
                  location for {{ o.geographyCoveragePercent ?? 0 | number: '1.0-0' }}% of holdings,
                  as reported by you · as of {{ o.asOfDate | date: 'mediumDate' }}
                </p>
              } @else if (o) {
                <p class="sub">Add holdings to see where they are and how they are used.</p>
              }
            </section>
          }
        </div>
        <div class="dash-side">
          <gz-top-opportunities [size]="4" />
          <gz-affordability-card />
          <gz-recent-activity />
        </div>
      </div>
    }
    <gz-dashboard-overview [compact]="false" />`,
})
export class InvestorDashboard {
  w = inject(Workspace);
  d = this.w.store.selectSignal(selectInvestorDashboard);
  target = this.w.store.selectSignal(selectSummaryTarget);
  signedIn = computed(() => this.w.auth.isLoggedIn() && !!this.w.account().profile);
  noPortfolio = computed(() => this.d().portfolios.value?.content.length === 0);
  label = labelFor;
  cardError = computed(() => {
    const s = this.d();
    return (
      s.portfolios.error ?? s.valueEquityDebt.error ?? s.occupancyExposure.error ?? s.summary.error
    );
  });
  scopeLabel = computed(() => {
    const s = this.d();
    if (s.portfolioId === null) {
      const n = s.portfolios.value?.content.length ?? 0;
      return n === 1 ? s.portfolios.value!.content[0].name : 'All portfolios';
    }
    return s.portfolios.value?.content.find((p) => p.id === s.portfolioId)?.name ?? 'Portfolio';
  });
  metrics = computed(() => {
    const v = this.d().valueEquityDebt.value;
    if (!v) return [];
    return [
      { key: 'value', label: 'Value', metric: v.value, percent: v.valueCoveragePercent },
      { key: 'debt', label: 'Debt', metric: v.debt, percent: v.debtCoveragePercent },
      { key: 'equity', label: 'Equity', metric: v.equity, percent: v.equityCoveragePercent },
    ];
  });
  constructor() {
    effect(() => {
      if (this.signedIn()) untracked(() => this.reload());
    });
  }
  reload() {
    this.w.store.dispatch(A.load());
  }
  /** The select gives "" for all portfolios. */
  select(value: string) {
    this.w.store.dispatch(A.selectScope({ portfolioId: value === '' ? null : Number(value) }));
  }
  holdings(list: { holdingCount: number }[]) {
    return list.reduce((n, p) => n + p.holdingCount, 0);
  }
  money(v: number | null | undefined) {
    return usdCompact(v);
  }
  /**
   * A metric's total, or the partial sum when some holdings are not covered (the caption then
   * says how many are). Null when nothing is known.
   */
  amount(m: PortfolioMetric | null | undefined) {
    if (!m) return null;
    if (m.total !== null) return usdCompact(m.total);
    return m.coveredHoldings ? usdCompact(m.knownTotal) : null;
  }
  coverage(m: PortfolioMetric | undefined, verb: string) {
    if (!m) return '';
    const partial = m.total === null && m.coveredHoldings ? 'Partial: ' : '';
    return `${partial}${m.coveredHoldings} of ${m.totalHoldings} holdings ${verb}`;
  }
  asOf(date: string | null | undefined) {
    return date ? ' · as of ' + date : '';
  }
  range(from: string | null, to: string | null) {
    return from && from !== to ? `${from} to ${to}` : (to ?? '');
  }
  signed(v: number) {
    const m = usdCompact(v);
    return m && v > 0 ? '+' + m : m;
  }
  cashFlow(s: PortfolioSummaryDTO | null) {
    return s?.financials ? this.signed(s.financials.cashFlow) : null;
  }
  pct(v: number | null | undefined) {
    return v === null || v === undefined ? null : Math.round(v) + '%';
  }
  period(s: PortfolioSummaryDTO | null) {
    return s?.financials ? `Recorded ${s.financials.fromDate} to ${s.financials.toDate}` : '';
  }
  category(c: string) {
    return CATEGORY_LABELS[c] ?? labelFor(c);
  }
  occupancyRows(o: InvestorOccupancyExposureCardDTO) {
    const max = Math.max(1, ...OCCUPANCY.map(([k]) => o.occupancyCounts[k] ?? 0));
    return OCCUPANCY.map(([key, label]) => {
      const count = o.occupancyCounts[key] ?? 0;
      return { key, label, count, share: count ? Math.max(2, (count / max) * 100) : 0 };
    });
  }
  /** Categories largest first, each as a share of the larger of income or expenses. */
  categories(s: PortfolioSummaryDTO) {
    const f = s.financials;
    if (!f) return [];
    const scale = Math.max(1, f.income, f.expenses);
    return [...f.categories]
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({ ...c, share: Math.max(2, (c.amount / scale) * 100) }));
  }
}
