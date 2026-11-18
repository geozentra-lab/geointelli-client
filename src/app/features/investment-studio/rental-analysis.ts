import { Component, DestroyRef, OnInit, computed, effect, inject, input } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { RequestStatus } from '../../shared/components/request-status';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { InvestmentActions as A } from '../../store/investment/investment.actions';
import {
  selectActiveScenario,
  selectInvestment,
} from '../../store/investment/investment.selectors';
import { InvestmentAnalysisRequest, ScenarioDTO } from '../../core/models/investment';

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

/**
 * Rental investment analysis (POST /calculations/investment): operating result, financed returns
 * and an optional equity projection, on the user's own inputs. Saved scenarios (/scenarios) keep
 * those inputs only, never property facts or results, so reopening one recalculates it.
 */
@Component({
  selector: 'gz-rental-analysis',
  imports: [FormsModule, CurrencyPipe, DatePipe, RouterLink, RequestStatus],
  template: `
    <div class="grid cols2">
      <form class="panel" #form="ngForm" (ngSubmit)="form.valid && analyze()">
        <h3>Rental income and costs</h3>
        <div class="formgrid section">
          <div class="formfield">
            <label for="ra-rent">Monthly rent ($)</label
            ><input
              id="ra-rent"
              name="monthlyRent"
              type="number"
              min="0"
              step="0.01"
              required
              [(ngModel)]="a.monthlyRent"
            />
          </div>
          <div class="formfield">
            <label for="ra-vacancy">Vacancy (% of rent)</label
            ><input
              id="ra-vacancy"
              name="vacancy"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Not supplied"
              [(ngModel)]="a.vacancyRatePercent"
            />
          </div>
          <div class="formfield">
            <label for="ra-maintenance">Maintenance (% of rent)</label
            ><input
              id="ra-maintenance"
              name="maintenance"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Not supplied"
              [(ngModel)]="a.maintenanceRatePercent"
            />
          </div>
          <div class="formfield">
            <label for="ra-management">Management (% of rent)</label
            ><input
              id="ra-management"
              name="management"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Not supplied"
              [(ngModel)]="a.managementRatePercent"
            />
          </div>
          <div class="formfield">
            <label for="ra-tax">Annual property tax ($)</label
            ><input
              id="ra-tax"
              name="tax"
              type="number"
              min="0"
              step="0.01"
              placeholder="Not supplied"
              [(ngModel)]="a.annualPropertyTax"
            />
          </div>
          <div class="formfield">
            <label for="ra-insurance">Annual insurance ($)</label
            ><input
              id="ra-insurance"
              name="insurance"
              type="number"
              min="0"
              step="0.01"
              placeholder="Not supplied"
              [(ngModel)]="a.annualHomeInsurance"
            />
          </div>
          <div class="formfield">
            <label for="ra-hoa">Monthly HOA ($)</label
            ><input
              id="ra-hoa"
              name="hoa"
              type="number"
              min="0"
              step="0.01"
              placeholder="Not supplied"
              [(ngModel)]="a.monthlyHoaFees"
            />
          </div>
          <div class="formfield">
            <label for="ra-other">Other monthly costs ($)</label
            ><input
              id="ra-other"
              name="other"
              type="number"
              min="0"
              step="0.01"
              placeholder="Not supplied"
              [(ngModel)]="a.monthlyOtherExpenses"
            />
          </div>
        </div>
        <h3 class="spacer">Financing <span class="smalltext muted">(optional)</span></h3>
        <div class="formgrid section">
          <div class="formfield">
            <label for="ra-price">Purchase price ($)</label
            ><input
              id="ra-price"
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Not supplied"
              [(ngModel)]="a.purchasePrice"
            />
          </div>
          <div class="formfield">
            <label for="ra-down">Down payment ($)</label
            ><input
              id="ra-down"
              name="down"
              type="number"
              min="0"
              step="0.01"
              placeholder="Not supplied"
              [(ngModel)]="a.downPayment"
            />
          </div>
          <div class="formfield">
            <label for="ra-rate">Interest rate (%)</label
            ><input
              id="ra-rate"
              name="rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Not supplied"
              [(ngModel)]="a.annualInterestRate"
            />
          </div>
          <div class="formfield">
            <label for="ra-term">Loan term (years)</label
            ><input
              id="ra-term"
              name="term"
              type="number"
              min="1"
              max="50"
              step="1"
              placeholder="Not supplied"
              [(ngModel)]="a.loanTermYears"
            />
          </div>
          <div class="formfield">
            <label for="ra-closing">Closing costs ($)</label
            ><input
              id="ra-closing"
              name="closing"
              type="number"
              min="0"
              step="0.01"
              placeholder="Not supplied"
              [(ngModel)]="a.closingCosts"
            />
          </div>
        </div>
        <h3 class="spacer">Projection <span class="smalltext muted">(optional)</span></h3>
        <div class="formgrid section">
          <div class="formfield">
            <label for="ra-horizon">Years to hold</label
            ><input
              id="ra-horizon"
              name="horizon"
              type="number"
              min="1"
              max="30"
              step="1"
              placeholder="No projection"
              [(ngModel)]="a.horizonYears"
            />
          </div>
          <div class="formfield">
            <label for="ra-growth">Yearly value change (%)</label
            ><input
              id="ra-growth"
              name="growth"
              type="number"
              min="-50"
              max="50"
              step="0.1"
              placeholder="Value held flat"
              [(ngModel)]="a.annualAppreciationRatePercent"
              [disabled]="a.horizonYears === null"
            />
          </div>
        </div>
        @if (downTooHigh()) {
          <p class="field-error">The down payment cannot be more than the purchase price.</p>
        }
        <button
          class="btn primary spacer"
          [disabled]="form.invalid || downTooHigh() || s().analysis.loading"
        >
          {{ s().analysis.loading ? 'Calculating…' : 'Calculate returns' }}
        </button>
        <p class="sourcedata">
          Leave unknown figures blank: what depends on them is reported as unavailable, never
          assumed. These assumptions do not change any property record.
        </p>
      </form>
      <div>
        <gz-request-status [error]="s().analysis.error" (retry)="analyze()" />
        @if (s().analysis.value; as r) {
          <div class="panel darkpanel">
            @if (
              r.financing?.monthlyCashFlow !== null && r.financing?.monthlyCashFlow !== undefined
            ) {
              <h3>Monthly cash flow</h3>
              <div class="bigvalue">
                {{ r.financing!.monthlyCashFlow | currency: 'USD' : 'symbol' : '1.0-0' }}
              </div>
            } @else {
              <h3>Monthly net operating income</h3>
              <div class="bigvalue">{{ usd(r.operating?.monthlyNetOperatingIncome) }}</div>
            }
            <div class="lineitem">
              <span>Effective rent</span
              ><strong>{{ usd(r.operating?.monthlyEffectiveIncome) }} /mo</strong>
            </div>
            <div class="lineitem">
              <span>Operating costs</span
              ><strong>{{ usd(r.operating?.monthlyOperatingExpenses) }} /mo</strong>
            </div>
            <div class="lineitem">
              <span>Net operating income</span
              ><strong>{{ usd(r.operating?.annualNetOperatingIncome) }} /yr</strong>
            </div>
            <div class="lineitem">
              <span>Debt service</span
              ><strong>{{ usd(r.financing?.monthlyDebtService) }} /mo</strong>
            </div>
            <div class="lineitem">
              <span>Cap rate</span><strong>{{ pct(r.financing?.capRatePercent) }}</strong>
            </div>
            <div class="lineitem">
              <span>Cash-on-cash return</span
              ><strong>{{ pct(r.financing?.cashOnCashPercent) }}</strong>
            </div>
            <div class="lineitem">
              <span>Gross yield</span><strong>{{ pct(r.grossYieldPercent) }}</strong>
            </div>
            <div class="lineitem">
              <span>Cash invested</span><strong>{{ usd(r.financing?.cashInvested) }}</strong>
            </div>
            @if (r.projection; as p) {
              <h3 class="spacer">After {{ p.horizonYears }} years</h3>
              <div class="lineitem">
                <span>Projected value</span><strong>{{ usd(p.projectedPropertyValue) }}</strong>
              </div>
              <div class="lineitem">
                <span>Loan balance left</span><strong>{{ usd(p.remainingLoanBalance) }}</strong>
              </div>
              <div class="lineitem">
                <span>Total equity</span><strong>{{ usd(p.totalEquity) }}</strong>
              </div>
              <div class="lineitem">
                <span>· from the down payment</span
                ><strong>{{ usd(p.equityFromDownPayment) }}</strong>
              </div>
              <div class="lineitem">
                <span>· from paying down the loan</span
                ><strong>{{ usd(p.equityFromLoanPaydown) }}</strong>
              </div>
              <div class="lineitem">
                <span>· from value change</span><strong>{{ usd(p.equityFromAppreciation) }}</strong>
              </div>
              <div class="lineitem">
                <span>Cash flow over the period</span
                ><strong>{{ usd(p.cumulativeCashFlow) }}</strong>
              </div>
            }
            @for (n of notes(); track n) {
              <p class="sourcedata">{{ n }}</p>
            }
          </div>
        } @else {
          <div class="panel">
            <h3>Model a rental</h3>
            <p class="sub spacer">
              Enter the rent and the costs you know to see net operating income, then add financing
              for cash flow, cap rate and cash-on-cash return.
            </p>
          </div>
        }
        <section class="panel section" aria-labelledby="scenarios-title">
          <div class="panelhead">
            <h3 id="scenarios-title">Saved scenarios</h3>
            @if (active()) {
              <button type="button" class="linkbtn" (click)="startNew()">New scenario</button>
            }
          </div>
          @if (!w.auth.isLoggedIn()) {
            <p class="sub">
              <button type="button" class="linkbtn" (click)="w.signIn()">Sign in</button> to save
              these assumptions and come back to them.
            </p>
          } @else {
            <form class="filterbar" #sf="ngForm" (ngSubmit)="sf.valid && save()">
              <div class="formfield grow">
                <label for="scenario-name">{{
                  active() ? 'Scenario name' : 'Name this scenario'
                }}</label>
                <input
                  id="scenario-name"
                  name="scenarioName"
                  maxlength="120"
                  required
                  [(ngModel)]="name"
                />
              </div>
              <button class="btn" [disabled]="sf.invalid || s().saving || a.monthlyRent === null">
                {{ s().saving ? 'Saving…' : active() ? 'Save changes' : 'Save scenario' }}
              </button>
              @if (active()) {
                <button
                  type="button"
                  class="btn ghost"
                  [disabled]="sf.invalid || s().saving || a.monthlyRent === null"
                  (click)="save(true)"
                >
                  Save as new
                </button>
              }
            </form>
            @if (s().writeError; as error) {
              <p class="field-error" role="alert">{{ error }}</p>
            }
            <gz-request-status
              [loading]="s().scenarios.loading && !s().scenarios.value"
              loadingText="Loading your scenarios…"
              [error]="s().scenarios.error"
              (retry)="loadScenarios()"
            />
            @if (s().scenarios.value; as page) {
              <ul class="list">
                @for (sc of page.content; track sc.id) {
                  <li>
                    <span class="scenario-row" [class.active]="sc.id === s().activeId">
                      <span class="list-main">
                        <b>{{ sc.name }}</b>
                        <small class="muted">
                          Rent
                          {{
                            sc.assumptions.operating.monthlyRent
                              | currency: 'USD' : 'symbol' : '1.0-0'
                          }}
                          · updated {{ sc.updatedAt | date: 'MMM d, y' }}
                          @if (sc.propertyId) {
                            · <a [routerLink]="['/property', sc.propertyId]">property</a>
                          }
                        </small>
                      </span>
                      <span class="actions">
                        <button type="button" class="btn small" (click)="open(sc)">
                          {{ sc.id === s().activeId ? 'Reload' : 'Open' }}
                        </button>
                        <button
                          type="button"
                          class="btn small"
                          [disabled]="s().saving"
                          (click)="remove(sc)"
                        >
                          Delete
                        </button>
                      </span>
                    </span>
                  </li>
                } @empty {
                  <li class="empty-line">No saved scenarios yet.</li>
                }
              </ul>
            }
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .grow {
      flex: 1 1 220px;
    }
    .scenario-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 8px;
      border-radius: var(--radius);
    }
    .scenario-row.active {
      background: #f6eee8;
    }
    .scenario-row .actions {
      flex-wrap: nowrap;
    }
  `,
})
export class RentalAnalysis implements OnInit {
  w = inject(Workspace);
  private confirmation = inject(ConfirmationService);
  private destroy = inject(DestroyRef);
  /** The property the studio was opened from; saved with a new scenario as a link only. */
  propertyId = input<number | null>(null);
  s = this.w.store.selectSignal(selectInvestment);
  active = this.w.store.selectSignal(selectActiveScenario);
  a: Assumptions = blank();
  name = '';
  notes = computed(() => {
    const r = this.s().analysis.value;
    if (!r) return [];
    return [
      ...(r.notes ?? []),
      ...(r.operating?.notes ?? []),
      ...(r.financing?.notes ?? []),
      ...(r.projection?.assumptions ?? []),
      ...(r.projection?.notes ?? []),
    ];
  });
  constructor() {
    // The scenario list belongs to the account: load it once one is signed in.
    effect(() => {
      if (this.w.auth.isLoggedIn() && !this.s().scenarios.value && !this.s().scenarios.loading)
        this.loadScenarios();
    });
  }
  ngOnInit() {
    // Coming back to the studio reopens the scenario that was in the form.
    const active = this.active();
    if (active) this.fill(active);
  }
  loadScenarios() {
    this.w.store.dispatch(A.loadScenarios());
  }
  downTooHigh() {
    const { purchasePrice: p, downPayment: d } = this.a;
    return p !== null && d !== null && d > p;
  }
  request(): InvestmentAnalysisRequest {
    const a = this.a;
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
  }
  analyze() {
    if (this.a.monthlyRent === null || this.downTooHigh()) return;
    this.w.store.dispatch(A.analyze({ request: this.request() }));
  }
  /** Saves the inputs (not the results); asNew keeps the open scenario as it was. */
  save(asNew = false) {
    if (
      this.a.monthlyRent === null ||
      !this.name.trim() ||
      !this.w.requireAccount('save scenarios')
    )
      return;
    const assumptions = this.request();
    const active = this.active();
    if (active && !asNew)
      this.w.store.dispatch(
        A.updateScenario({ id: active.id, request: { name: this.name.trim(), assumptions } }),
      );
    else
      this.w.store.dispatch(
        A.createScenario({
          request: {
            name: this.name.trim(),
            scenarioType: 'INVESTMENT',
            assumptions,
            ...(this.propertyId() ? { propertyId: this.propertyId()! } : {}),
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
    this.name = '';
  }
  async remove(sc: ScenarioDTO) {
    if (
      (await this.confirmation.confirm({
        title: 'Delete scenario?',
        message: `Delete "${sc.name}"? Its linked property is not changed.`,
      })) &&
      !this.destroy.destroyed
    )
      this.w.store.dispatch(A.removeScenario({ id: sc.id }));
  }
  private fill(sc: ScenarioDTO) {
    const { operating: o, financing: f, projection: p } = sc.assumptions;
    this.name = sc.name;
    this.a = {
      ...blank(),
      ...o,
      ...(f ?? {}),
      ...(p ?? {}),
    } as Assumptions;
  }
  usd(v: number | null | undefined) {
    return v === null || v === undefined
      ? 'Not available'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(v);
  }
  pct(v: number | null | undefined) {
    return v === null || v === undefined ? 'Not available' : v.toFixed(2) + '%';
  }
}
