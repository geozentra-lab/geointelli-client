import { Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../../shared/data/workspace';
import { PageHeading } from '../../../shared/components/page-heading';
import { TABLE_KIT } from '../../../shared/table';
import { countOf, formatRecordDate, joinParts, plainNote } from '../../../shared/data/format';
import { labelFor } from '../../../shared/pipes/label.pipe';
import { HoldingOccupancy, PortfolioMetric } from '../../../core/models/api';
import {
  InvestorIncomeExpensesReturnsCardDTO,
  InvestorOccupancyExposureCardDTO,
} from '../../../core/models/dashboard';
import { InvestorDashboardActions as A } from '../../../store/investor-dashboard/investor-dashboard.actions';
import { selectInvestorDashboard } from '../../../store/investor-dashboard/investor-dashboard.selectors';
import { Kpi, KpiCoverage, opportunityEmptyText, usdCompact } from '../dash-ui';
import { OVERVIEW_STYLES, OverviewSection } from '../overview-ui';

const CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Rent',
  OTHER_INCOME: 'Other income',
  REPAIRS: 'Repairs',
  MAINTENANCE: 'Maintenance',
  INSURANCE: 'Insurance',
  PROPERTY_TAX: 'Property tax',
  HOA: 'HOA',
  UTILITIES: 'Utilities',
  MANAGEMENT_FEE: 'Management fee',
  MORTGAGE_PAYMENT: 'Mortgage payment',
  OTHER_EXPENSE: 'Other expenses',
};
const OCCUPANCY: [HoldingOccupancy, string][] = [
  ['RENTED', 'Rented'],
  ['VACANT', 'Vacant'],
  ['OWNER_OCCUPIED', 'Owner occupied'],
  ['UNKNOWN', 'Not recorded'],
];
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
type Category = NonNullable<InvestorIncomeExpensesReturnsCardDTO['actual']>['categories'][number];
/** "Nov 2025": a whole month of the income card, read as a calendar month (no time zone shift). */
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthDate = (yyyyMm: string) => new Date(yyyyMm + '-01T00:00:00Z');

/**
 * Investor overview (DESIGN.md §6, §8; SOW IV "Residential Investor"), from the four cards of
 * GET /dashboards/investor for the scope in one request. The lead is the portfolio summary strip
 * (value, debt and equity, by ownership share), each partial figure labelled "Partial: N of M …"
 * with its coverage bar, and the one action that raises coverage: holdings without a loan balance
 * and "Add balances in Portfolio". Then two columns: occupancy (as reported, with exposure by
 * county) and income and returns (recorded cash over the last 12 complete months, for one
 * portfolio or all of them; contract rent and gross yield kept apart, never added to it). Last, the
 * best stored opportunity scores, holdings marked. Nothing is recalculated here.
 *
 * The holding pane can't be opened from here (Portfolio has no holding route or parameter), so
 * the action opens Portfolio (PROGRESS.md, needs store or route work).
 */
@Component({
  selector: 'gz-investor-dashboard',
  imports: [RouterLink, PageHeading, Kpi, OverviewSection, ...TABLE_KIT],
  template: `@let page = d().portfolios.value;
    <gz-heading title="Investments">
      @if (page && page.content.length > 1) {
        <label class="ov-scope" for="dash-portfolio">
          <span>Portfolio</span>
          <select id="dash-portfolio" (change)="select($any($event.target).value)">
            <option value="" [selected]="d().portfolioId === null">
              All portfolios{{ allHoldingsText() }}
            </option>
            @for (p of page.content; track p.id) {
              <option [value]="p.id" [selected]="p.id === d().portfolioId">
                {{ p.name }} · {{ countOf(p.holdingCount, 'holding') }}
              </option>
            }
          </select>
        </label>
      }
    </gz-heading>
    @let v = shownValue();
    @let o = shownOccupancy();
    @let ie = shownIncome();
    <section
      gz-overview-section
      #leadSection
      [heading]="scopeLabel()"
      [caption]="leadCaption()"
      [busy]="d().valueEquityDebt.loading && !!v"
    >
      @if (page && page.content.length) {
        <a actions class="ov-link" routerLink="/portfolio">Open Portfolio</a>
      }
      @if (d().portfolios.error) {
        <div class="insight danger ov-alert" role="alert">
          <span>Your portfolios could not load.</span>
          <button type="button" class="btn small" (click)="leadSection.retried(); reload()">Retry</button>
        </div>
      } @else if (noPortfolio()) {
        <div class="ov-empty">
          <p>The value, debt and equity of what you own will appear here.</p>
          <a class="btn primary" routerLink="/portfolio">Create a portfolio</a>
        </div>
      } @else if (d().valueEquityDebt.error) {
        <div class="insight danger ov-alert" role="alert">
          <span>Value, debt and equity could not load.</span>
          <button type="button" class="btn small" (click)="leadSection.retried(); reload()">Retry</button>
        </div>
      } @else if (!v) {
        <dl class="kpi-row">
          <div gz-kpi label="Value" [loading]="true"></div>
          <div gz-kpi label="Debt" [loading]="true"></div>
          <div gz-kpi label="Equity" [loading]="true"></div>
        </dl>
      } @else if (!v.totalHoldings) {
        <div class="ov-empty">
          <p>Add a holding to see its value, debt and equity here.</p>
          <a class="btn primary" routerLink="/portfolio">Add a holding</a>
        </div>
      } @else {
        <dl class="kpi-row">
          <div
            gz-kpi
            label="Value"
            [value]="amount(v.value)"
            [coverage]="coverage(v.value, 'holdings valued')"
            [caption]="complete(v.value, 'valued')"
            unavailable="No holding has a ZentraValue estimate yet"
          ></div>
          <div
            gz-kpi
            label="Debt"
            [value]="amount(v.debt)"
            [coverage]="coverage(v.debt, 'holdings with a known balance')"
            [caption]="complete(v.debt, 'with a known balance')"
            unavailable="No loan balance is recorded yet"
          ></div>
          <div
            gz-kpi
            label="Equity"
            [value]="amount(v.equity)"
            [coverage]="coverage(v.equity, 'holdings with value and debt')"
            [caption]="complete(v.equity, 'with value and debt')"
            unavailable="Needs a value and a loan balance on the same holding"
          ></div>
        </dl>
        <div class="iv-action">
          @if (missingBalances(); as n) {
            <p class="ov-text">
              {{ countOf(n, 'holding') }} {{ n === 1 ? 'has' : 'have' }} no loan balance, so debt
              and equity leave {{ n === 1 ? 'it' : 'them' }} out.
            </p>
            <a class="btn primary" routerLink="/portfolio">Add balances in Portfolio</a>
          } @else {
            <!-- Covered debt is a loan balance or a cash purchase (debt 0), not always a loan. -->
            <p class="ov-text">Every holding has a loan balance or is recorded as bought with cash.</p>
            <a class="btn primary" routerLink="/portfolio">Add a holding</a>
          }
        </div>
        <p class="ov-note">{{ sources() }} {{ plainNote(v.note) }}</p>
      }
    </section>
    @if (page && page.content.length && !d().portfolios.error) {
      <div class="ov-cols">
        <section
          gz-overview-section
          #occupancySection
          heading="Occupancy"
          [caption]="occupancyCaption()"
          [busy]="d().occupancyExposure.loading && !!o"
        >
          @if (d().occupancyExposure.error) {
            <div class="insight danger ov-alert" role="alert">
              <span>Occupancy could not load.</span>
              <button type="button" class="btn small" (click)="occupancySection.retried(); reload()">
                Retry
              </button>
            </div>
          } @else if (!o) {
            @for (i of skeleton; track i) {
              <div class="row-skeleton" aria-hidden="true"></div>
            }
          } @else if (!o.totalHoldings) {
            <p class="ov-text">How your holdings are used will appear here once you add one.</p>
          } @else {
            <dl class="kpi-row">
              <div
                gz-kpi
                label="Rental occupancy"
                [value]="pct(o.rentalOccupancyPercent)"
                [caption]="rentedCaption(o)"
                unavailable="No rented or vacant holding is recorded"
              ></div>
            </dl>
            <table gz-table class="ov-table iv-occ" sticky="none">
              <caption class="sr-only">Holdings by occupancy</caption>
              <thead>
                <tr>
                  <th scope="col">Occupancy</th>
                  <th scope="col" class="num">Holdings</th>
                </tr>
              </thead>
              <tbody>
                @for (row of occupancyRows(o); track row.key) {
                  <tr>
                    <td [class.muted]="row.key === 'UNKNOWN'">
                      {{ row.label }}
                      <span class="iv-bar" aria-hidden="true"><i [style.width.%]="row.share"></i></span>
                    </td>
                    <td class="num">{{ row.count }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="ov-note">
              Each bar is drawn against all {{ countOf(o.totalHoldings, 'holding') }}. Occupancy is
              recorded for {{ o.knownOccupancyHoldings }} of them; rental occupancy counts rented and
              vacant holdings only.
            </p>
            @if (o.counties.length) {
              <h3 class="ov-sub">By county</h3>
              <table gz-table class="ov-table" sticky="none">
                <caption class="sr-only">Holdings by county</caption>
                <thead>
                  <tr>
                    <th scope="col">County</th>
                    <th scope="col" class="num">Holdings</th>
                    <th scope="col" class="num">Share</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- A string key for the row without a county, so it can't equal a county id. -->
                  @for (g of o.counties; track g.countyId ?? 'none-' + $index) {
                    <tr>
                      <td [class.muted]="g.unknown">
                        {{ g.unknown ? 'County not recorded' : joinParts(', ', g.countyName, g.stateCode) }}
                      </td>
                      <td class="num">{{ g.holdingCount }}</td>
                      <td class="num">{{ percentText(g.holdingPercent) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <p class="ov-note">Counted by holding, not weighted by value.</p>
            }
          }
        </section>
        <section
          gz-overview-section
          #cashSection
          heading="Income and returns"
          [caption]="cashCaption()"
          [busy]="d().incomeExpensesReturns.loading && !!ie"
        >
          @if (d().incomeExpensesReturns.error) {
            <div class="insight danger ov-alert" role="alert">
              <span>Income and returns could not load.</span>
              <button type="button" class="btn small" (click)="cashSection.retried(); reload()">Retry</button>
            </div>
          } @else if (!ie) {
            @for (i of skeleton; track i) {
              <div class="row-skeleton" aria-hidden="true"></div>
            }
          } @else if (!ie.totalHoldings) {
            <p class="ov-text">Income, expenses and rent will appear here once you add a holding.</p>
          } @else {
            @let f = ie.actual;
            @if (!f || f.status !== 'RECORDED') {
              <div class="ov-empty">
                <p>No income or expense was recorded {{ periodWords() }}.</p>
                <a class="btn" routerLink="/portfolio">Record income or an expense</a>
              </div>
            } @else {
              <dl class="kpi-row">
                <div gz-kpi label="Income" [value]="money(f.income)"></div>
                <div gz-kpi label="Expenses" [value]="money(f.expenses)"></div>
                <div
                  gz-kpi
                  label="Net cash flow"
                  [value]="signedCompact(f.cashFlow)"
                  [coverage]="cashCoverage()"
                ></div>
              </dl>
              <table gz-table class="ov-table iv-cats" sticky="none">
                <caption class="sr-only">Income and expenses by category</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" data-priority="2">Type</th>
                    <th scope="col" class="num" data-priority="2">Records</th>
                    <th scope="col" class="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of categories(f.categories); track c.category) {
                    <tr>
                      <td>
                        {{ category(c.category) }}
                        <span class="cell-sub m-only">{{ c.type === 'INCOME' ? 'Income' : 'Expense' }}</span>
                      </td>
                      <td data-priority="2">{{ c.type === 'INCOME' ? 'Income' : 'Expense' }}</td>
                      <td class="num" data-priority="2">{{ c.recordCount }}</td>
                      <td class="num" [class.positive]="c.type === 'INCOME'" [class.negative]="c.type !== 'INCOME'">
                        {{ signedFull(c) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (missingCosts(); as missing) {
                <p class="ov-note">No record of {{ missing }}: a missing cost, not a cost of $0.</p>
              }
            }
            @let r = ie.projected;
            <h3 class="ov-sub">Contract rent</h3>
            @if (r && r.status === 'AVAILABLE') {
              <dl class="kpi-row">
                <div gz-kpi label="Rent a month" [value]="money(r.monthlyGrossRent)" [caption]="rentCaption()"></div>
                <div
                  gz-kpi
                  label="Rent for the period"
                  [value]="money(r.periodGrossRent)"
                  caption="Comparable with recorded income"
                ></div>
                <div
                  gz-kpi
                  label="Gross yield"
                  [value]="pct(r.grossYieldPercent, 1)"
                  caption="Annual rent ÷ purchase price"
                  unavailable="A purchase price is missing"
                ></div>
              </dl>
              <p class="ov-note">
                Today's lease figures, kept apart from the recorded cash above and never added to it.
                Net operating income isn't worked out: holdings store no operating costs.
              </p>
            } @else {
              <p class="ov-text">{{ rentUnavailable() }}</p>
            }
            @if (plainNote(ie.note); as note) {
              <p class="ov-note">{{ note }}</p>
            }
          }
        </section>
      </div>
      @let op = shownOpportunities();
      <section
        gz-overview-section
        #oppSection
        heading="Opportunities"
        [caption]="oppCaption()"
        [busy]="d().opportunities.loading && !!op"
      >
        <a actions class="ov-link" routerLink="/opportunities">Open Opportunities</a>
        @if (d().opportunities.error) {
          <div class="insight danger ov-alert" role="alert">
            <span>Opportunities could not load.</span>
            <button type="button" class="btn small" (click)="oppSection.retried(); reload()">Retry</button>
          </div>
        } @else if (!op) {
          @for (i of skeleton; track i) {
            <div class="row-skeleton" aria-hidden="true"></div>
          }
        } @else if (!op.items.length) {
          <p class="ov-text">{{ oppEmpty(op.candidateStatus ?? '') }}</p>
        } @else {
          <table gz-table class="ov-table iv-opp" sticky="none">
            <caption class="sr-only">Highest opportunity scores, best first</caption>
            <thead>
              <tr>
                <th scope="col" class="num">Rank</th>
                <th scope="col">Property</th>
                <th scope="col" class="num">Score, of 100</th>
                <th scope="col" class="num" data-priority="2">ZentraValue</th>
                <th scope="col" class="num" data-priority="2">Next 12 months</th>
              </tr>
            </thead>
            <tbody>
              @for (o of op.items; track o.propertyId; let i = $index) {
                <tr>
                  <td class="num">{{ i + 1 }}</td>
                  <td>
                    <a [routerLink]="['/property', o.propertyId]">{{ o.address || 'Folio ' + o.folio }}</a>
                    <span class="cell-sub">{{ place(o.city, o.countyName, o.stateCode) }}</span>
                    @if (o.alreadyHeld) {
                      <span class="cell-sub iv-held">In your portfolio</span>
                    }
                  </td>
                  <td class="num">
                    <b>{{ score(o.score) }}</b>
                    @if (o.coveragePercent !== null) {
                      <span class="cell-sub">Evidence covers {{ score(o.coveragePercent) }} of {{ o.maxScore }}</span>
                    }
                  </td>
                  <td gz-cell class="num" data-priority="2" [missing]="o.estimatedValue === null"
                    reason="No estimate was stored with this score">
                    {{ money(o.estimatedValue) }}
                  </td>
                  <td gz-cell class="num" data-priority="2" [missing]="o.forecastGrowth1yPct === null"
                    reason="No one-year forecast was stored with this score">
                    {{ signedPct(o.forecastGrowth1yPct) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p class="ov-note">
            Scores are research input, not advice: each one is stored with its evidence, and
            Opportunities explains it.
          </p>
        }
      </section>
    }`,
  styles: [
    OVERVIEW_STYLES,
    `
      .ov-scope {
        display: flex;
        align-items: center;
        gap: var(--sp-8);
        font-size: var(--fs-cell);
        color: var(--ink-2);
      }
      .ov-scope select {
        min-width: 240px;
      }
      .iv-action {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--sp-12) var(--sp-16);
        margin-top: var(--sp-16);
      }
      .ov-cols .kpi-row {
        margin-bottom: var(--sp-12);
      }
      .iv-bar {
        display: block;
        max-width: 240px;
        height: 6px;
        margin-top: 4px;
      }
      .iv-bar i {
        display: block;
        height: 100%;
        background: var(--ink);
        border-radius: 0 2px 2px 0;
      }
      .ov-cols + .overview-section {
        margin-top: var(--sp-24);
      }
      .iv-held {
        color: var(--copper);
        font-weight: 600;
      }
      .iv-opp td:first-child {
        width: 1%;
      }
      @media (max-width: 700px) {
        .ov-scope {
          width: 100%;
        }
        .ov-scope select {
          flex: 1;
          min-width: 0;
        }
      }
    `,
  ],
})
export class InvestorDashboard {
  readonly w = inject(Workspace);
  /** Backend notes without developer field names (DESIGN.md §13). */
  readonly plainNote = plainNote;
  readonly d = this.w.store.selectSignal(selectInvestorDashboard);
  readonly skeleton = [0, 1, 2];
  readonly countOf = countOf;
  readonly joinParts = joinParts;
  readonly noPortfolio = computed(() => this.d().portfolios.value?.content.length === 0);
  /** The all-portfolios holding count, as the card for that scope sends it (never summed here). */
  readonly allHoldingsText = computed(() => {
    // Through shownValue: a failed card's stand-in has no holdings count (null).
    const v = this.shownValue();
    return v && v.portfolioId === null ? ' · ' + countOf(v.totalHoldings, 'holding') : '';
  });
  readonly scopeLabel = computed(() => {
    const s = this.d();
    const list = s.portfolios.value?.content ?? [];
    if (s.portfolioId === null)
      return list.length === 1 ? list[0].name : list.length ? 'All portfolios' : 'Portfolio';
    return list.find((p) => p.id === s.portfolioId)?.name ?? 'Portfolio';
  });
  /**
   * The cards answer for the scope they were asked for. When the list drops a portfolio deleted
   * elsewhere, the slice moves the scope to all portfolios but nothing asks again, so a card of
   * another scope is never shown (the section waits) and the component asks for the scope in view.
   */
  readonly shownValue = computed(() => this.shown(this.d().valueEquityDebt.value));
  readonly shownOccupancy = computed(() => this.shown(this.d().occupancyExposure.value));
  readonly shownIncome = computed(() => this.shown(this.d().incomeExpensesReturns.value));
  readonly shownOpportunities = computed(() => this.shown(this.d().opportunities.value));
  /**
   * A card for the scope in view, never the backend's stand-in for a card that failed: that one
   * carries only its status and error (items, totals and holdings are null), and the section says
   * the failure with Retry instead.
   */
  private shown<T extends { portfolioId: number | null; status: string }>(card: T | null): T | null {
    return card && card.portfolioId === this.d().portfolioId && card.status !== 'ERROR' ? card : null;
  }
  readonly leadCaption = computed(() => {
    const v = this.shownValue();
    if (!v || !v.totalHoldings || this.d().valueEquityDebt.error) return '';
    return joinParts(
      ' · ',
      countOf(v.totalHoldings, 'holding'),
      'by ownership share',
      formatRecordDate(v.asOfDate) ? 'as of ' + formatRecordDate(v.asOfDate) : null,
    );
  });
  /** Holdings the debt metric could not cover: financed without a balance, or financing unknown. */
  readonly missingBalances = computed(() => {
    const debt = this.shownValue()?.debt;
    return debt ? Math.max(0, debt.totalHoldings - debt.coveredHoldings) : 0;
  });
  readonly sources = computed(() => {
    const v = this.shownValue();
    if (!v) return '';
    const estimates = this.range(v.oldestValuationDate, v.newestValuationDate);
    const balances = this.range(v.oldestBalanceDate, v.newestBalanceDate);
    const who = v.debtSource === 'OWNER_REPORTED_FINANCING' ? 'as you reported them' : labelFor(v.debtSource);
    return joinParts(
      ' ',
      estimates ? `ZentraValue estimates of ${estimates};` : null,
      balances ? `loan balances ${who}, dated ${balances}.` : `Loan balances ${who}.`,
    );
  });
  readonly occupancyCaption = computed(() => {
    const o = this.shownOccupancy();
    return o && o.totalHoldings && !this.d().occupancyExposure.error
      ? `${countOf(o.totalHoldings, 'holding')}, as you reported them`
      : '';
  });
  /** The whole months of the income card: "Nov 2025 to Oct 2026", with the record count. */
  readonly cashCaption = computed(() => {
    const c = this.shownIncome();
    if (!c || !c.totalHoldings || this.d().incomeExpensesReturns.error) return '';
    return joinParts(
      ' · ',
      this.months(),
      c.actual?.recordCount ? countOf(c.actual.recordCount, 'record') : null,
      c.actual?.recordsUpdatedAt ? 'updated ' + formatRecordDate(c.actual.recordsUpdatedAt) : null,
    );
  });
  readonly months = computed(() => {
    const p = this.shownIncome()?.period;
    if (!p) return '';
    const a = MONTH.format(monthDate(p.fromMonth));
    const b = MONTH.format(monthDate(p.toMonth));
    return a === b ? a : `${a} to ${b}`;
  });
  /** "from Nov 2025 to Oct 2026", for sentences. */
  readonly periodWords = computed(() => {
    const m = this.months();
    return m.includes(' to ') ? 'from ' + m : m ? 'in ' + m : 'in this period';
  });

  /** Cash flow is complete by definition (recorded amounts): coverage without the Partial label. */
  readonly cashCoverage = computed<KpiCoverage | null>(() => {
    const c = this.shownIncome();
    const f = c?.actual;
    return f && c.totalHoldings
      ? { covered: f.holdingsWithRecords, total: c.totalHoldings, noun: 'holdings', partial: false, lead: 'From records on' }
      : null;
  });
  /** Expense categories without a record in the period: missing costs, listed by name. */
  readonly missingCosts = computed(() => {
    const list = this.shownIncome()?.actual?.expenseCategoriesWithoutRecords ?? [];
    return list.map((c) => this.category(c).toLowerCase()).join(', ');
  });
  readonly rentCaption = computed(() => {
    const r = this.shownIncome()?.projected;
    return r ? `${r.holdingsWithRent} of ${countOf(r.rentedHoldings, 'rented holding')} with a lease rent` : '';
  });
  /** Why the contract rent can't be shown, in the backend's words, or what it is missing. */
  readonly rentUnavailable = computed(() => {
    const r = this.shownIncome()?.projected;
    const reason = plainNote(r?.reason);
    if (reason) return reason;
    if (r?.missingInputs?.length) return 'Missing: ' + r.missingInputs.map((m) => labelFor(m).toLowerCase()).join(', ') + '.';
    return 'No rented holding has a lease rent recorded.';
  });
  readonly oppCaption = computed(() => {
    const c = this.shownOpportunities();
    if (!c || !c.items.length || this.d().opportunities.error) return '';
    return c.totalCandidates !== null
      ? `Top ${c.items.length} of ${c.totalCandidates.toLocaleString('en-US')} scored properties`
      : `Top ${c.items.length} scored properties`;
  });
  readonly oppEmpty = opportunityEmptyText;

  /** A boolean, so the cards load once when the account arrives, not on every account change. */
  private readonly signedIn = computed(() => this.w.auth.isLoggedIn() && !!this.w.account().profile);
  /** The scope the cards were last asked for (undefined before the first load). */
  private askedFor: number | null | undefined;
  constructor() {
    effect(() => {
      if (this.signedIn()) untracked(() => this.reload());
    });
    // The list moved the scope (a portfolio deleted elsewhere): ask for the scope now in view, with
    // the existing scope action (PROGRESS.md, needs store work).
    effect(() => {
      const s = this.d();
      if (this.askedFor === undefined || !s.portfolios.value || s.portfolios.loading) return;
      if (s.portfolioId !== this.askedFor)
        untracked(() => {
          this.askedFor = s.portfolioId;
          this.w.store.dispatch(A.selectScope({ portfolioId: s.portfolioId }));
        });
    });
  }
  reload() {
    this.askedFor = this.d().portfolioId;
    this.w.store.dispatch(A.load());
  }
  /** The select gives "" for all portfolios. */
  select(value: string) {
    const portfolioId = value === '' ? null : Number(value);
    this.askedFor = portfolioId;
    this.w.store.dispatch(A.selectScope({ portfolioId }));
  }
  money(v: number | null | undefined) {
    return usdCompact(v);
  }
  /**
   * A metric's total, or the partial sum when some holdings are not covered (its caption then says
   * how many are). Null, so Unavailable, when nothing is known: never $0, never "Partial: 0 of 5".
   */
  amount(m: PortfolioMetric) {
    if (m.total !== null) return usdCompact(m.total);
    return m.coveredHoldings ? usdCompact(m.knownTotal) : null;
  }
  coverage(m: PortfolioMetric, noun: string): KpiCoverage | null {
    return m.total === null && m.coveredHoldings
      ? { covered: m.coveredHoldings, total: m.totalHoldings, noun }
      : null;
  }
  /** The caption of a complete figure: "2 of 2 holdings valued", without the Partial label. */
  complete(m: PortfolioMetric, words: string) {
    return m.total !== null ? `${m.coveredHoldings} of ${countOf(m.totalHoldings, 'holding')} ${words}` : '';
  }
  range(from: string | null, to: string | null) {
    const a = formatRecordDate(from);
    const b = formatRecordDate(to);
    if (!b) return '';
    return a && a !== b ? `${a} to ${b}` : b;
  }
  pct(v: number | null | undefined, digits = 0) {
    if (v === null || v === undefined) return null;
    return (digits ? v.toFixed(digits) : String(Math.round(v))) + '%';
  }
  /** "+4.2%", "−1.0%": the score's one-year forecast. */
  signedPct(v: number | null) {
    if (v === null) return '';
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';
  }
  score(v: number) {
    return (Math.round(v * 10) / 10).toString();
  }
  place(city: string | null, county: string | null, state: string | null) {
    return joinParts(', ', city, county ? county + ' County' : null, state);
  }
  rentedCaption(o: InvestorOccupancyExposureCardDTO) {
    return o.rentalHoldings
      ? `${o.occupancyCounts.RENTED ?? 0} of ${countOf(o.rentalHoldings, 'rental holding')} rented`
      : '';
  }
  /** Each status against every holding in scope, so the bars add up to the whole. */
  occupancyRows(o: InvestorOccupancyExposureCardDTO) {
    const total = Math.max(1, o.totalHoldings);
    return OCCUPANCY.map(([key, label]) => {
      const count = o.occupancyCounts[key] ?? 0;
      return { key, label, count, share: count ? Math.max(2, (count / total) * 100) : 0 };
    });
  }
  /** A percent the backend sends: "60%", "<1%" for a sliver. */
  percentText(v: number | null | undefined) {
    if (v === null || v === undefined) return '';
    return v > 0 && v < 1 ? '<1%' : Math.round(v) + '%';
  }
  signedCompact(v: number) {
    const m = usdCompact(v);
    return m && v > 0 ? '+' + m : m;
  }
  /** Income first, then expenses, each largest first. */
  categories(list: Category[]) {
    return [...list].sort(
      (a, b) => (a.type === b.type ? b.amount - a.amount : a.type === 'INCOME' ? -1 : 1),
    );
  }
  category(c: string) {
    return CATEGORY_LABELS[c] ?? labelFor(c);
  }
  /** Full money with a true sign: income +, expenses − (DESIGN.md §14). */
  signedFull(c: Category) {
    return (c.type === 'INCOME' ? '+' : '−') + usd.format(Math.abs(c.amount));
  }
}
