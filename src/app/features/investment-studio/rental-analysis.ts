import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { RequestStatus } from '../../shared/components/request-status';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT } from '../../shared/table';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { countOf, formatLocalDate, plainNote, plainNotes } from '../../shared/data/format';
import { InvestmentActions as A } from '../../store/investment/investment.actions';
import {
  selectActiveScenario,
  selectInvestment,
} from '../../store/investment/investment.selectors';
import {
  InvestmentAnalysisRequest,
  InvestmentOperatingResult,
  InvestmentProjectionResult,
  ScenarioDTO,
} from '../../core/models/investment';
import { joinList, money, percent, polarity, sameFigures, signedMoney } from './studio-format';
import { resultArrived } from './studio-focus';

/** The form's fields; null is "not supplied", which the server never fills in. */
interface Assumptions {
  monthlyRent: number | null;
  vacancyRatePercent: number | null;
  maintenanceRatePercent: number | null;
  managementRatePercent: number | null;
  annualPropertyTax: number | null;
  annualHomeInsurance: number | null;
  monthlyHoaFees: number | null;
  monthlyOtherExpenses: number | null;
  purchasePrice: number | null;
  downPayment: number | null;
  annualInterestRate: number | null;
  loanTermYears: number | null;
  closingCosts: number | null;
  horizonYears: number | null;
  annualAppreciationRatePercent: number | null;
}
const blank = (): Assumptions => ({
  monthlyRent: null,
  vacancyRatePercent: null,
  maintenanceRatePercent: null,
  managementRatePercent: null,
  annualPropertyTax: null,
  annualHomeInsurance: null,
  monthlyHoaFees: null,
  monthlyOtherExpenses: null,
  purchasePrice: null,
  downPayment: null,
  annualInterestRate: null,
  loanTermYears: null,
  closingCosts: null,
  horizonYears: null,
  annualAppreciationRatePercent: null,
});
/** Only the supplied numbers, so an empty field is sent as missing, never as zero. */
function supplied<K extends keyof Assumptions>(a: Assumptions, keys: K[]) {
  const out: Partial<Record<K, number>> = {};
  for (const k of keys) if (a[k] !== null && Number.isFinite(a[k])) out[k] = a[k] as number;
  return out;
}

/** One line of the income-and-costs table: monthly and yearly where the backend gives both. */
interface Line {
  label: string;
  monthly: number | null;
  yearly: number | null;
  /** The backend gives this line by the year only: the monthly cell is not applicable (blank). */
  yearOnly?: boolean;
  total?: boolean;
  signed?: boolean;
}
function lines(o: InvestmentOperatingResult): Line[] {
  return [
    { label: 'Gross rent', monthly: o.monthlyGrossRent, yearly: o.annualGrossRent },
    { label: 'Vacancy loss', monthly: o.monthlyVacancyLoss, yearly: o.annualVacancyLoss },
    { label: 'Effective income', monthly: o.monthlyEffectiveIncome, yearly: o.annualEffectiveIncome, total: true },
    { label: 'Maintenance', monthly: null, yearly: o.annualMaintenance, yearOnly: true },
    { label: 'Management', monthly: null, yearly: o.annualManagement, yearOnly: true },
    { label: 'Property tax', monthly: null, yearly: o.annualPropertyTax, yearOnly: true },
    { label: 'Insurance', monthly: null, yearly: o.annualInsurance, yearOnly: true },
    { label: 'HOA', monthly: null, yearly: o.annualHoaFees, yearOnly: true },
    { label: 'Other costs', monthly: null, yearly: o.annualOtherExpenses, yearOnly: true },
    { label: 'Operating costs', monthly: o.monthlyOperatingExpenses, yearly: o.annualOperatingExpenses, total: true },
    {
      label: 'Net operating income',
      monthly: o.monthlyNetOperatingIncome,
      yearly: o.annualNetOperatingIncome,
      total: true,
      signed: true,
    },
  ];
}

/**
 * Rental investment analysis (POST /calculations/investment): operating result, financed returns
 * and an optional equity projection, on the user's own inputs. Saved scenarios (/scenarios) keep
 * those inputs only, never property facts or results, so reopening one recalculates it.
 */
@Component({
  selector: 'gz-rental-analysis',
  imports: [FormsModule, RouterLink, RequestStatus, ...RECORD_KIT, ...TABLE_KIT],
  styleUrl: './studio.css',
  template: `
    <div class="st">
      <form class="st-form" (ngSubmit)="analyze()" aria-labelledby="ra-title">
        <h2 id="ra-title">{{ active()?.name ?? 'Your assumptions' }}</h2>
        <p class="st-lede">
          Leave a figure blank if you don't know it: what depends on it is reported as unavailable,
          never assumed.
        </p>
        <fieldset>
          <legend>Rent and running costs</legend>
          <div class="st-fields">
            <div class="formfield">
              <label for="ra-rent">Rent ($ a month)</label>
              <input id="ra-rent" name="monthlyRent" type="number" min="0" step="50"
                [ngModel]="a().monthlyRent" (ngModelChange)="set('monthlyRent', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-vacancy">Vacancy (% of rent)</label>
              <input id="ra-vacancy" name="vacancy" type="number" min="0" max="100" step="0.1"
                [ngModel]="a().vacancyRatePercent" (ngModelChange)="set('vacancyRatePercent', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-maintenance">Maintenance (% of rent)</label>
              <input id="ra-maintenance" name="maintenance" type="number" min="0" max="100" step="0.1"
                [ngModel]="a().maintenanceRatePercent" (ngModelChange)="set('maintenanceRatePercent', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-management">Management (% of rent)</label>
              <input id="ra-management" name="management" type="number" min="0" max="100" step="0.1"
                [ngModel]="a().managementRatePercent" (ngModelChange)="set('managementRatePercent', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-tax">Property tax ($ a year)</label>
              <input id="ra-tax" name="tax" type="number" min="0" step="100"
                [ngModel]="a().annualPropertyTax" (ngModelChange)="set('annualPropertyTax', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-insurance">Insurance ($ a year)</label>
              <input id="ra-insurance" name="insurance" type="number" min="0" step="100"
                [ngModel]="a().annualHomeInsurance" (ngModelChange)="set('annualHomeInsurance', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-hoa">HOA ($ a month)</label>
              <input id="ra-hoa" name="hoa" type="number" min="0" step="10"
                [ngModel]="a().monthlyHoaFees" (ngModelChange)="set('monthlyHoaFees', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-other">Other costs ($ a month)</label>
              <input id="ra-other" name="other" type="number" min="0" step="10"
                [ngModel]="a().monthlyOtherExpenses" (ngModelChange)="set('monthlyOtherExpenses', $event)" />
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Financing <span class="optional">(optional)</span></legend>
          <div class="st-fields">
            <div class="formfield">
              <label for="ra-price">Purchase price ($)</label>
              <input id="ra-price" name="price" type="number" min="0" step="1000"
                [ngModel]="a().purchasePrice" (ngModelChange)="set('purchasePrice', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-down">Down payment ($)</label>
              <input id="ra-down" name="down" type="number" min="0" step="1000"
                [ngModel]="a().downPayment" (ngModelChange)="set('downPayment', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-rate">Interest rate (% a year)</label>
              <input id="ra-rate" name="rate" type="number" min="0" max="100" step="0.01"
                [ngModel]="a().annualInterestRate" (ngModelChange)="set('annualInterestRate', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-term">Loan term (years)</label>
              <input id="ra-term" name="term" type="number" min="1" max="50" step="1"
                [ngModel]="a().loanTermYears" (ngModelChange)="set('loanTermYears', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-closing">Closing costs ($)</label>
              <input id="ra-closing" name="closing" type="number" min="0" step="100"
                [ngModel]="a().closingCosts" (ngModelChange)="set('closingCosts', $event)" />
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Holding period <span class="optional">(optional)</span></legend>
          <div class="st-fields">
            <div class="formfield">
              <label for="ra-horizon">Years to hold</label>
              <input id="ra-horizon" name="horizon" type="number" min="1" max="30" step="1"
                [ngModel]="a().horizonYears" (ngModelChange)="set('horizonYears', $event)" />
            </div>
            <div class="formfield">
              <label for="ra-growth">Value change (% a year)</label>
              <input id="ra-growth" name="growth" type="number" min="-50" max="50" step="0.1"
                aria-describedby="ra-growth-hint"
                [ngModel]="a().annualAppreciationRatePercent"
                (ngModelChange)="set('annualAppreciationRatePercent', $event)" />
              <p id="ra-growth-hint" class="smalltext muted">Blank keeps today's value.</p>
            </div>
          </div>
        </fieldset>
        <div class="st-actions">
          <button
            class="btn primary"
            [attr.aria-disabled]="blocked() || s().analysis.loading ? 'true' : null"
            [attr.aria-describedby]="blocked() ? 'ra-why' : null"
          >
            {{ s().analysis.loading ? 'Calculating…' : 'Calculate returns' }}
          </button>
          @if (blocked(); as why) {
            <p class="st-why" id="ra-why">{{ why }}</p>
          }
        </div>
        <p class="st-note">These figures don't change any property record.</p>
      </form>

      <gz-record-section aria-labelledby="ra-result">
        <h2 id="ra-result" #resultTitle tabindex="-1">Returns</h2>
        <gz-request-status
          [loading]="s().analysis.loading && !s().analysis.value"
          loadingText="Calculating…"
          [error]="s().analysis.error"
          (retry)="analyze()"
        />
        @if (s().analysis.value; as r) {
          @if (stale()) {
            <p class="st-note" role="status">
              The figures above changed since this result: Calculate returns to update it.
            </p>
          }
          <div class="st-figure" [attr.aria-busy]="s().analysis.loading ? 'true' : null">
            <span class="st-figure-label">{{ lead().label }}</span>
            @if (lead().value; as v) {
              <span class="st-figure-value" [class]="lead().tone">{{ v }}</span>
            } @else {
              <span class="st-figure-value na"><span class="na-word">Unavailable</span></span>
            }
            <span class="st-figure-caption">{{ lead().caption }}</span>
          </div>

          @if (r.operating; as o) {
            <table gz-table sticky="none" class="st-table">
              <caption class="sr-only">Rental income and costs, each month and each year</caption>
              <thead>
                <tr>
                  <th scope="col">Income and costs</th>
                  <th scope="col" class="num">Each month</th>
                  <th scope="col" class="num">Each year</th>
                </tr>
              </thead>
              <tbody>
                @for (line of operatingLines(o); track line.label) {
                  <tr [class.st-total]="line.total">
                    <th scope="row">{{ line.label }}</th>
                    @if (line.yearOnly) {
                      <td class="num"><span class="sr-only">Given by the year</span></td>
                    } @else {
                      <td gz-cell class="num" [missing]="line.monthly === null" reason="Left blank"
                        [class]="line.signed ? tone(line.monthly) : ''">
                        {{ line.signed ? signed(line.monthly) : money(line.monthly) }}
                      </td>
                    }
                    <td gz-cell class="num" [missing]="line.yearly === null" reason="Left blank"
                      [class]="line.signed ? tone(line.yearly) : ''">
                      {{ line.signed ? signed(line.yearly) : money(line.yearly) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="table-note">
              Costs given as a rate or by the year are shown by the year.
              @if (anyOperatingMissing(o)) {
                Unavailable: left blank, so it isn't counted.
              }
            </p>
          }

          @if (r.financing; as fin) {
            <gz-record-group
              heading="Financing and returns"
              [note]="anyReturnMissing() ? 'Unavailable: needs a figure that was left blank (see the notes below).' : ''"
            >
              <div gz-record-row label="Loan amount" [numeric]="true" [missing]="fin.loanAmount === null">
                {{ money(fin.loanAmount) }}
              </div>
              <div gz-record-row label="Loan payment, each month" [numeric]="true" [missing]="fin.monthlyDebtService === null">
                {{ money(fin.monthlyDebtService) }}
              </div>
              <div gz-record-row label="Cash flow, each month" [numeric]="true" [missing]="fin.monthlyCashFlow === null">
                <span [class]="tone(fin.monthlyCashFlow)">{{ signed(fin.monthlyCashFlow) }}</span>
              </div>
              <div gz-record-row label="Cash flow, each year" [numeric]="true" [missing]="fin.annualCashFlow === null">
                <span [class]="tone(fin.annualCashFlow)">{{ signed(fin.annualCashFlow) }}</span>
              </div>
              <div gz-record-row label="Cash invested" [numeric]="true" [missing]="fin.cashInvested === null">
                {{ money(fin.cashInvested) }}
              </div>
              <div gz-record-row label="Cap rate" [numeric]="true" [missing]="fin.capRatePercent === null">
                {{ percent(fin.capRatePercent) }}
              </div>
              <div gz-record-row label="Cash-on-cash return" [numeric]="true" [missing]="fin.cashOnCashPercent === null">
                {{ percent(fin.cashOnCashPercent) }}
              </div>
              <div gz-record-row label="Gross yield" [numeric]="true" [missing]="r.grossYieldPercent === null">
                {{ percent(r.grossYieldPercent) }}
              </div>
            </gz-record-group>
          } @else {
            <p class="st-note">
              Add the purchase price, down payment, rate and term to see the loan payment, cash flow
              and returns.
            </p>
          }

          @if (r.projection; as p) {
            @if (projectionEmpty()) {
              <!-- Nothing projected without a price (DESIGN.md §6: a section that doesn't apply is one sentence). -->
              <p class="st-note">
                After {{ countOf(p.horizonYears ?? 0, 'year') }}: add the purchase price and the loan
                to see the value, the loan balance and the equity.
              </p>
            } @else {
            <!-- How the value moves is the backend's own note (its projection assumptions), below. -->
            <gz-record-group
              [heading]="'After ' + countOf(p.horizonYears ?? 0, 'year')"
              [note]="projectionPartial() ? 'Unavailable: needs a figure that was left blank (see the notes below).' : ''"
            >
              <div gz-record-row label="Value" [numeric]="true" [missing]="p.projectedPropertyValue === null">
                {{ money(p.projectedPropertyValue) }}
              </div>
              <div gz-record-row label="Loan balance left" [numeric]="true" [missing]="p.remainingLoanBalance === null">
                {{ money(p.remainingLoanBalance) }}
              </div>
              <div gz-record-row label="Equity" [numeric]="true" [missing]="p.totalEquity === null">
                <b>{{ money(p.totalEquity) }}</b>
              </div>
              <div gz-record-row label="from the down payment" [numeric]="true" [missing]="p.equityFromDownPayment === null">
                {{ money(p.equityFromDownPayment) }}
              </div>
              <div gz-record-row label="from paying down the loan" [numeric]="true" [missing]="p.equityFromLoanPaydown === null">
                {{ money(p.equityFromLoanPaydown) }}
              </div>
              <div gz-record-row label="from the value change" [numeric]="true" [missing]="p.equityFromAppreciation === null">
                <span [class]="tone(p.equityFromAppreciation)">{{ signed(p.equityFromAppreciation) }}</span>
              </div>
              <div gz-record-row label="Cash flow over the period" [numeric]="true" [missing]="p.cumulativeCashFlow === null">
                <span [class]="tone(p.cumulativeCashFlow)">{{ signed(p.cumulativeCashFlow) }}</span>
              </div>
            </gz-record-group>
            }
          }

          @for (n of notes(); track n) {
            <p class="st-note">{{ n }}</p>
          }
        } @else if (!s().analysis.loading && !s().analysis.error) {
          <p class="st-empty">
            Enter the rent and the costs you know to see the net operating income; add financing
            for cash flow, cap rate and cash-on-cash return.
          </p>
        }
      </gz-record-section>
    </div>

    <section class="sc" aria-labelledby="sc-title">
      <div class="sc-head">
        <div>
          <h2 id="sc-title" #scTitle tabindex="-1">Saved scenarios</h2>
          @if (scenarioCount(); as count) {
            <p class="st-lede">{{ count }} · the figures only; opening one calculates it again</p>
          }
        </div>
        @if (active()) {
          <button type="button" class="btn" (click)="startNew()">New scenario</button>
        }
      </div>
      @if (!w.auth.isLoggedIn()) {
        <p class="st-empty">Sign in to save these figures and come back to them.</p>
        <div class="st-links">
          <button type="button" class="btn" (click)="w.signIn()">Sign in</button>
        </div>
      } @else {
        <form class="filterbar sc-save" (ngSubmit)="save()">
          <div class="formfield grow">
            <label for="scenario-name">{{ active() ? 'Scenario name' : 'Name these figures' }}</label>
            <input id="scenario-name" name="scenarioName" maxlength="120"
              [ngModel]="name()" (ngModelChange)="name.set($event)" />
          </div>
          <button class="btn" [attr.aria-disabled]="saveBlocked() || s().saving ? 'true' : null"
            [attr.aria-describedby]="saveBlocked() ? 'sc-why' : null">
            {{ s().saving ? 'Saving…' : active() ? 'Save changes' : 'Save scenario' }}
          </button>
          @if (active()) {
            <button type="button" class="btn" [attr.aria-disabled]="saveBlocked() || s().saving ? 'true' : null"
              (click)="save(true)">
              Save as new
            </button>
          }
        </form>
        @if (saveBlocked(); as why) {
          <p class="st-why sc-why" id="sc-why">{{ why }}</p>
        }
        @if (s().writeError; as error) {
          <p class="field-error" role="alert">
            {{ plain(error) ?? 'The scenario could not be saved. Check the figures and try again.' }}
          </p>
        }
        <gz-request-status
          [loading]="s().scenarios.loading && !s().scenarios.value"
          loadingText="Loading your scenarios…"
          [error]="s().scenarios.error"
          (retry)="loadScenarios()"
        />
        @if (s().scenarios.value; as page) {
          @if (page.content.length) {
            <table gz-table sticky="none" class="sc-table">
              <caption class="sr-only">Saved scenarios</caption>
              <thead>
                <tr>
                  <th scope="col">Scenario</th>
                  <th scope="col" class="num">Rent a month</th>
                  <th scope="col" data-priority="2">Property</th>
                  <th scope="col" data-priority="2">Changed</th>
                  <th scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (sc of page.content; track sc.id) {
                  <tr [class.sel]="sc.id === s().activeId">
                    <td>
                      <span class="cell-main">{{ sc.name }}</span>
                      @if (sc.id === s().activeId) {
                        <span class="cell-sub">In the form above</span>
                      }
                    </td>
                    <td class="num">{{ money(sc.assumptions.operating.monthlyRent) }}</td>
                    <td data-priority="2">
                      @if (sc.propertyId) {
                        <a [routerLink]="['/property', sc.propertyId]">Open the record</a>
                      }
                    </td>
                    <td data-priority="2">{{ day(sc.updatedAt) }}</td>
                    <td class="sc-actions">
                      <button type="button" class="btn small" (click)="open(sc)"
                        [attr.aria-label]="(sc.id === s().activeId ? 'Reload ' : 'Open ') + sc.name">
                        {{ sc.id === s().activeId ? 'Reload' : 'Open' }}
                      </button>
                      <button type="button" class="btn small" [attr.aria-disabled]="s().saving ? 'true' : null"
                        (click)="remove(sc)" [attr.aria-label]="'Delete ' + sc.name">
                        Delete
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="st-empty">Scenarios you save keep these figures, so you can come back to them.</p>
          }
          @if (page.totalElements > page.content.length) {
            <p class="table-note">
              Listed: {{ page.content.length }} of {{ countOf(page.totalElements, 'scenario') }}.
            </p>
          }
        }
      }
    </section>
  `,
  styles: `
    .st-table {
      margin-top: var(--sp-8);
    }
    .st-table th[scope='row'] {
      font-weight: 400;
      color: var(--ink-2);
    }
    .st-table tr.st-total th[scope='row'],
    .st-table tr.st-total td {
      font-weight: 600;
      color: var(--ink);
    }
    .sc {
      margin-top: var(--sp-32);
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    .sc-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sp-12);
    }
    .sc-save {
      margin-top: var(--sp-16);
    }
    .sc-save .formfield.grow {
      flex: 0 1 420px;
    }
    .sc-why {
      margin-top: var(--sp-8);
    }
    .sc-table {
      margin-top: var(--sp-16);
    }
    .sc-table tr.sel td:first-child {
      box-shadow: inset 2px 0 0 var(--copper);
    }
    .sc-actions {
      text-align: right;
      white-space: nowrap;
    }
    .sc-actions .btn + .btn {
      margin-left: var(--sp-8);
    }
    @media (max-width: 700px) {
      .sc {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
    }
  `,
})
export class RentalAnalysis implements OnInit {
  readonly w = inject(Workspace);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy = inject(DestroyRef);
  private readonly resultTitle = viewChild<ElementRef<HTMLElement>>('resultTitle');
  private readonly scTitle = viewChild<ElementRef<HTMLElement>>('scTitle');
  readonly plain = plainNote;
  /** The property the studio was opened from; saved with a new scenario as a link only. */
  readonly propertyId = input<number | null>(null);
  readonly s = this.w.store.selectSignal(selectInvestment);
  readonly active = this.w.store.selectSignal(selectActiveScenario);
  readonly money = money;
  readonly percent = percent;
  readonly signed = signedMoney;
  readonly tone = polarity;
  readonly countOf = countOf;
  readonly operatingLines = lines;

  /** What is typed; a signal, so the reasons beside the buttons follow it (the app is zoneless). */
  readonly a = signal<Assumptions>(blank());
  readonly name = signal('');
  set<K extends keyof Assumptions>(key: K, value: Assumptions[K] | '') {
    this.a.update((a) => ({ ...a, [key]: value === '' ? null : value }));
  }

  /** Why Calculate returns can't run yet, written next to it (DESIGN.md §12); null when it can. */
  readonly blocked = computed(() => {
    const a = this.a();
    if (a.monthlyRent === null) return 'Enter the rent first.';
    const amounts = [
      a.monthlyRent,
      a.annualPropertyTax,
      a.annualHomeInsurance,
      a.monthlyHoaFees,
      a.monthlyOtherExpenses,
      a.purchasePrice,
      a.downPayment,
      a.closingCosts,
    ];
    if (amounts.some((v) => v !== null && v < 0)) return 'An amount can’t be below $0.';
    const rates = [a.vacancyRatePercent, a.maintenanceRatePercent, a.managementRatePercent];
    if (rates.some((v) => v !== null && (v < 0 || v > 100))) return 'A rate of rent runs from 0% to 100%.';
    if (a.purchasePrice !== null && a.purchasePrice <= 0) return 'The price must be above $0.';
    if (a.purchasePrice !== null && a.downPayment !== null && a.downPayment > a.purchasePrice)
      return 'The down payment can’t be more than the price.';
    if (a.annualInterestRate !== null && (a.annualInterestRate < 0 || a.annualInterestRate > 100))
      return 'The rate runs from 0% to 100%.';
    if (a.loanTermYears !== null && (!Number.isInteger(a.loanTermYears) || a.loanTermYears < 1 || a.loanTermYears > 50))
      return 'The term is a whole number of years, 1 to 50.';
    if (a.horizonYears !== null && (!Number.isInteger(a.horizonYears) || a.horizonYears < 1 || a.horizonYears > 30))
      return 'Years to hold is a whole number, 1 to 30.';
    const g = a.annualAppreciationRatePercent;
    if (g !== null && (g < -50 || g > 50)) return 'The value change runs from −50% to 50% a year.';
    if (g !== null && a.horizonYears === null) return 'Enter the years to hold for the value change to count.';
    return null;
  });
  /** Saving checks what Calculate checks, so a saved scenario can always be calculated again. */
  readonly saveBlocked = computed(() => {
    const missing = [
      this.a().monthlyRent === null && 'the rent',
      !this.name().trim() && 'a name',
    ].filter((x): x is string => !!x);
    if (missing.length) return `Enter ${joinList(missing)} to save.`;
    const why = this.blocked();
    return why ? `${why} Then save.` : null;
  });

  readonly request = computed<InvestmentAnalysisRequest>(() => {
    const a = this.a();
    const financing = supplied(a, [
      'purchasePrice',
      'downPayment',
      'annualInterestRate',
      'loanTermYears',
      'closingCosts',
    ]);
    return {
      operating: {
        monthlyRent: a.monthlyRent ?? 0,
        ...supplied(a, [
          'vacancyRatePercent',
          'maintenanceRatePercent',
          'managementRatePercent',
          'annualPropertyTax',
          'annualHomeInsurance',
          'monthlyHoaFees',
          'monthlyOtherExpenses',
        ]),
      },
      ...(Object.keys(financing).length ? { financing } : {}),
      ...(a.horizonYears !== null
        ? {
            projection: {
              horizonYears: a.horizonYears,
              ...supplied(a, ['annualAppreciationRatePercent']),
            },
          }
        : {}),
    };
  });
  /** The result on screen was calculated from other figures than the ones in the form. */
  readonly stale = computed(() => {
    const done = this.s().analyzed;
    const r = this.s().analysis;
    return !!done && r.value !== null && !r.loading && !sameFigures(done, this.request());
  });

  /** The result's lead figure: cash flow when the loan is known, else net operating income. */
  readonly lead = computed(() => {
    const r = this.s().analysis.value;
    const cash = r?.financing?.monthlyCashFlow ?? null;
    if (cash !== null)
      return {
        label: 'Cash flow, each month',
        value: signedMoney(cash),
        tone: polarity(cash) ?? '',
        caption: `After the loan payment of ${money(r!.financing!.monthlyDebtService) ?? 'an unknown amount'}.`,
      };
    const noi = r?.operating?.monthlyNetOperatingIncome ?? null;
    return {
      label: 'Net operating income, each month',
      value: signedMoney(noi),
      tone: polarity(noi) ?? '',
      caption:
        noi === null
          ? 'Needs a cost that was left blank (see the notes below).'
          : 'Before any loan payment.',
    };
  });
  readonly anyReturnMissing = computed(() => {
    const r = this.s().analysis.value;
    const f = r?.financing;
    if (!f) return false;
    return [
      f.loanAmount,
      f.monthlyDebtService,
      f.monthlyCashFlow,
      f.annualCashFlow,
      f.cashInvested,
      f.capRatePercent,
      f.cashOnCashPercent,
      r!.grossYieldPercent,
    ].some((v) => v === null);
  });
  anyOperatingMissing(o: InvestmentOperatingResult) {
    return lines(o).some((l) => l.yearly === null || (!l.yearOnly && l.monthly === null));
  }
  /** The backend's notes, once each and in plain words (DESIGN.md §13). */
  readonly notes = computed(() => {
    const r = this.s().analysis.value;
    if (!r) return [];
    return [
      ...new Set(
        plainNotes([
          ...(r.notes ?? []),
          ...(r.operating?.notes ?? []),
          ...(r.financing?.notes ?? []),
          ...(r.projection?.assumptions ?? []),
          ...(r.projection?.notes ?? []),
        ]),
      ),
    ];
  });
  /** A holding period with nothing known to project (no price): one sentence instead of rows. */
  readonly projectionEmpty = computed(() => {
    const p = this.s().analysis.value?.projection;
    return !!p && projectionFigures(p).every((v) => v === null);
  });
  readonly projectionPartial = computed(() => {
    const p = this.s().analysis.value?.projection;
    return !!p && projectionFigures(p).some((v) => v === null);
  });
  readonly scenarioCount = computed(() => {
    const page = this.s().scenarios.value;
    return page && page.totalElements ? countOf(page.totalElements, 'scenario') : '';
  });

  constructor() {
    // The scenario list belongs to the account: load it once one is signed in.
    effect(() => {
      const s = this.s();
      if (this.w.auth.isLoggedIn() && !s.scenarios.value && !s.scenarios.loading && !s.scenarios.error)
        untracked(() => this.loadScenarios());
    });
  }
  private readonly expectResult = resultArrived(() => this.s().analysis, this.resultTitle);
  ngOnInit() {
    // Coming back to the studio reopens the scenario that was in the form.
    const active = this.active();
    if (active) this.fill(active);
  }
  loadScenarios() {
    this.w.store.dispatch(A.loadScenarios());
  }
  analyze() {
    if (this.blocked() || this.s().analysis.loading) return;
    this.w.store.dispatch(A.analyze({ request: this.request() }));
    this.expectResult();
  }
  /** Saves the inputs (not the results); asNew keeps the open scenario as it was. */
  save(asNew = false) {
    if (this.saveBlocked() || this.s().saving || !this.w.requireAccount('save scenarios')) return;
    const name = this.name().trim();
    const assumptions = this.request();
    const active = this.active();
    if (active && !asNew)
      this.w.store.dispatch(A.updateScenario({ id: active.id, request: { name, assumptions } }));
    else
      this.w.store.dispatch(
        A.createScenario({
          request: {
            name,
            scenarioType: 'INVESTMENT',
            assumptions,
            // The property the studio was opened from, else the open scenario's own link.
            ...((this.propertyId() ?? active?.propertyId)
              ? { propertyId: (this.propertyId() ?? active?.propertyId)! }
              : {}),
          },
        }),
      );
  }
  open(sc: ScenarioDTO) {
    this.w.store.dispatch(A.openScenario({ id: sc.id }));
    this.fill(sc);
    this.analyze();
  }
  startNew() {
    this.w.store.dispatch(A.openScenario({ id: null }));
    this.name.set('');
    // The button goes with the open scenario: focus moves to the name field.
    document.getElementById('scenario-name')?.focus();
  }
  async remove(sc: ScenarioDTO) {
    if (this.s().saving) return;
    if (
      (await this.confirmation.confirm({
        title: 'Delete scenario?',
        message: `Delete "${sc.name}"? Its linked property is not changed.`,
      })) &&
      !this.destroy.destroyed
    ) {
      // The row (and its Delete) goes when the server answers: focus waits on the heading.
      this.scTitle()?.nativeElement.focus();
      this.w.store.dispatch(A.removeScenario({ id: sc.id }));
    }
  }
  day(value: string) {
    return formatLocalDate(value);
  }
  private fill(sc: ScenarioDTO) {
    const { operating: o, financing: f, projection: p } = sc.assumptions;
    this.name.set(sc.name);
    this.a.set({ ...blank(), ...o, ...(f ?? {}), ...(p ?? {}) } as Assumptions);
  }
}

function projectionFigures(p: InvestmentProjectionResult) {
  return [
    p.projectedPropertyValue,
    p.remainingLoanBalance,
    p.totalEquity,
    p.equityFromDownPayment,
    p.equityFromLoanPaydown,
    p.equityFromAppreciation,
    p.cumulativeCashFlow,
  ];
}
