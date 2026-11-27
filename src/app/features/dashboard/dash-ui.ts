import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Coverage } from '../../shared/components/missing';

/** $1.2M / $845K / $920: amounts on KPI tiles, where space is tight. Null stays unavailable. */
export function usdCompact(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`;
  if (abs >= 1e4) return `${sign}$${Math.round(abs / 1e3)}K`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

/** Coverage of a partial figure, from the backend's counts. */
export interface KpiCoverage {
  covered: number;
  total: number;
  /** "holdings valued" → "Partial: 3 of 5 holdings valued". */
  noun: string;
  /** False for a metric that is complete by definition: coverage without the Partial label. */
  partial?: boolean;
  /** Words before the counts when not partial ("From records on"). */
  lead?: string;
}

/**
 * One figure of the summary strip (DESIGN.md §12): `<dl class="kpi-row">` holds `<div gz-kpi>`
 * figures separated by 1 px rules under a 2 px ink rule, never tiles. Each figure is a label (dt),
 * the figure (dd.kpi-value, spec-asserted) and a caption. A null value is Unavailable on the hatch
 * with the reason as its caption, never zero or a dash; a partial figure carries "Partial: N of M …"
 * and a coverage bar (`coverage`). With `link` the label is a link that covers the whole figure.
 *
 * The strip's styles live here (not in the global sheet), so they load with the pages that use it.
 */
@Component({
  selector: 'div[gz-kpi]',
  imports: [RouterLink, Coverage],
  encapsulation: ViewEncapsulation.None,
  template: `
    <dt class="kpi-label">
      @if (link(); as href) {
        <a class="kpi-link" [routerLink]="href" [queryParams]="query()">{{ label() }}</a>
      } @else {
        {{ label() }}
      }
    </dt>
    @if (loading()) {
      <dd class="kpi-value skeleton"><span class="sr-only">Loading</span></dd>
    } @else if (value() === null) {
      <dd class="kpi-value na"><span class="na-word">Unavailable</span></dd>
      <dd class="kpi-caption">{{ unavailable() }}</dd>
    } @else {
      <dd class="kpi-value">{{ value() }}</dd>
      @if (coverage(); as c) {
        <dd class="kpi-caption">
          <gz-coverage
            [covered]="c.covered"
            [total]="c.total"
            [noun]="c.noun"
            [partial]="c.partial ?? true"
            [lead]="c.lead ?? ''"
          />
        </dd>
      } @else if (partialRest(); as rest) {
        <dd class="kpi-caption"><em class="partial-word">Partial:</em> {{ rest }}</dd>
      } @else if (caption()) {
        <dd class="kpi-caption">{{ caption() }}</dd>
      }
    }
  `,
  host: { class: 'kpi' },
  styles: `
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
      margin: 0;
      overflow: hidden;
      background: var(--surface);
      border-top: 2px solid var(--ink);
      border-bottom: 1px solid var(--rule);
      container-type: inline-size;
    }
    /* Two columns (a narrow section, a phone): an odd last figure takes the whole row, so no
       half-ruled empty cell sits beside it. */
    @container (max-width: 449.98px) {
      .kpi:last-child:nth-child(odd) {
        grid-column: 1 / -1;
      }
    }
    /* Rules between figures: every figure draws its left and top rule, and the strip clips the ones
       on its outer edge, so any count wraps cleanly (no grey gap cells). */
    .kpi {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      margin: -1px 0 0 -1px;
      padding: 14px 20px 16px;
      border-left: 1px solid var(--rule);
      border-top: 1px solid var(--rule);
      color: var(--ink);
      transition: background-color var(--dur-color) ease;
    }
    .kpi dd {
      margin: 0;
    }
    .kpi-label {
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .kpi-link {
      color: inherit;
    }
    .kpi-link::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .kpi:has(.kpi-link:hover) {
      background: var(--row-hover);
    }
    .kpi-link:hover {
      color: var(--ink);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .kpi-link:focus-visible {
      outline: none;
    }
    .kpi-link:focus-visible::after {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    /* .kpi-value is spec-asserted. Figures are proportional, not tabular (§3). */
    .kpi-value {
      font-size: var(--fs-page);
      line-height: var(--lh-page);
      font-weight: 600;
      letter-spacing: var(--track-24);
      font-variant-numeric: proportional-nums lining-nums;
    }
    .kpi-value.na {
      align-self: stretch;
      margin: 0 -20px;
      padding: 0 20px;
      letter-spacing: 0;
    }
    .kpi-value.na .na-word {
      font-size: var(--fs-body);
      font-weight: 500;
    }
    .kpi-value.skeleton {
      height: var(--lh-page);
      width: 60%;
    }
    .kpi-caption {
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .kpi-caption .covbar {
      margin: 4px 0 5px;
    }
    @media (max-width: 700px) {
      .kpi {
        padding: 12px 14px 14px;
      }
      .kpi-value.na {
        margin: 0 -14px;
        padding: 0 14px;
      }
    }
  `,
})
export class Kpi {
  label = input.required<string>();
  value = input<string | number | null>(null);
  caption = input('');
  /** The reason shown under "Unavailable" when the value is null. */
  unavailable = input('Not available yet');
  coverage = input<KpiCoverage | null>(null);
  link = input<string | null>(null);
  query = input<Record<string, string> | null>(null);
  loading = input(false);
  /** A caption written as "Partial: …" gets the Partial label's treatment. */
  readonly partialRest = computed(() => {
    const c = this.caption();
    return c.startsWith('Partial: ') ? c.slice('Partial: '.length) : null;
  });
}

export interface StageRow {
  key: string;
  label: string;
  count: number;
  /** Optional money total shown beside the count (lender volumes). */
  amount?: number | null;
  /** Muted rows are terminal "lost" stages (rejected, cancelled…). */
  muted?: boolean;
}

/**
 * Pipeline as horizontal bars, widest stage = full width (DESIGN.md §11): open stages in the
 * ordinal copper ramp, in pipeline order; terminal "lost" stages muted. Each row shows its count,
 * and the amount where one is given (Unavailable when the backend has none). Rows link to the
 * module filtered on that stage, so the chart is a way in, not only a picture.
 */
@Component({
  selector: 'gz-stage-bars',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <ol class="stages" [attr.aria-label]="label()">
      @for (r of rows(); track r.key) {
        <li
          [class.muted]="r.muted"
          [class.active]="r.key === active()"
          [style.--stage-color]="tone(r)"
        >
          @if (link(); as href) {
            <a [routerLink]="href" [queryParams]="queryFor(r)">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
            </a>
          } @else {
            <button
              type="button"
              [attr.aria-pressed]="r.key === active()"
              (click)="picked.emit(r.key === active() ? null : r.key)"
            >
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
            </button>
          }
        </li>
      }
    </ol>
    <ng-template #row let-r>
      <span class="stage-name">{{ r.label }}</span>
      <span class="stage-track"><span class="stage-fill" [style.width.%]="width(r)"></span></span>
      <span class="stage-count">{{ r.count }}</span>
      @if (r.amount !== undefined) {
        @if (money(r.amount); as m) {
          <span class="stage-amount">{{ m }}</span>
        } @else {
          <span class="stage-amount na"><span class="na-word">Unavailable</span></span>
        }
      }
    </ng-template>
  `,
})
export class StageBars {
  rows = input.required<StageRow[]>();
  label = input('Pipeline by stage');
  /** Module the rows open (filtered by `param`). Without a link the rows are buttons that emit. */
  link = input<string | null>(null);
  /** In-page mode: the stage currently filtered on, highlighted; clicking it again clears it. */
  active = input<string | null>(null);
  picked = output<string | null>();
  /** Query parameter that carries the stage to the module (e.g. "stage"). */
  param = input<string | null>(null);
  /** Other query parameters every row's link keeps (e.g. the module's tab). */
  query = input<Record<string, string> | null>(null);
  private max = computed(() => Math.max(1, ...this.rows().map((r) => r.count)));
  /** Open stages step through the five-colour ordinal ramp in pipeline order. */
  private ramp = computed(() => {
    const open = this.rows().filter((r) => !r.muted);
    return new Map(open.map((r, i) => [r.key, Math.min(5, i + 1)]));
  });
  width(r: StageRow) {
    return r.count ? Math.max(4, (r.count / this.max()) * 100) : 0;
  }
  tone(r: StageRow) {
    const step = this.ramp().get(r.key);
    return step ? `var(--chart-ord-${step})` : null;
  }
  queryFor(r: StageRow) {
    const p = this.param();
    const base = this.query();
    return p ? { ...base, [p]: r.key } : base;
  }
  money(v: number | null | undefined) {
    return usdCompact(v);
  }
}

/** The Opportunities page and the overview ask for the same list, so the store holds one answer. */
export const RECOMMENDATION_LIMIT = 20;

const OPPORTUNITY_EMPTY: Record<string, string> = {
  NOT_SCORED: 'Opportunity scores have not been calculated yet.',
  NO_ELIGIBLE_OPPORTUNITIES: 'No property has enough valuation evidence to be scored yet.',
  NO_MATCHES: 'No scored property matches these filters.',
};
export function opportunityEmptyText(status: string) {
  return OPPORTUNITY_EMPTY[status] ?? 'No scored opportunities yet.';
}
