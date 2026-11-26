import { Component, booleanAttribute, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { OpportunityFactor } from '../../core/models/opportunity';
import { labelFor } from '../pipes/label.pipe';
import { plainNotes } from '../data/format';
import { TABLE_KIT } from '../table';

/**
 * The backend's score notes split by whether they name the scoring version ("Version
 * opportunity-v1 scores …"): model version strings belong under Method only (DESIGN.md §9), so
 * those notes go there and the rest stay under the table. Field names in them are written in plain
 * words, or the note is left out (`plainNote`, DESIGN.md §13). Used wherever a score's notes are
 * shown.
 */
export function splitVersionNotes(notes: readonly string[], version: string | null | undefined) {
  const v = (version ?? '').trim();
  const all = plainNotes(notes);
  const method = v ? all.filter((n) => n.includes(v)) : [];
  return { method, plain: all.filter((n) => !method.includes(n)) };
}

/**
 * The factors of an opportunity score (DESIGN.md §11, opportunity factors): one row per factor of
 * the scoring version, with the backend's explanation under its name and its points out of the
 * factor's weight as a horizontal bar in one hue. A factor whose evidence is missing is the
 * Unavailable marker on the hatch, never a zero-width bar or "0"; its explanation (backend copy)
 * says what is missing. Used by the property page's
 * opportunity score and the Opportunities record pane, so a score reads the same in both.
 *
 *   <gz-score-factors [factors]="s.factors" />                  Factor, Evidence and Points
 *   <gz-score-factors [factors]="o.factors" [compact]="true" />  Factor and Points (narrow panes;
 *                                                                 the evidence is in the explanation)
 */
@Component({
  selector: 'gz-score-factors',
  imports: [DecimalPipe, ...TABLE_KIT],
  template: `
    <table gz-table sticky="none" class="score-factors">
      <caption class="sr-only">
        {{ caption() }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Factor</th>
          @if (!compact()) {
            <th scope="col" class="num" data-priority="2">Evidence</th>
          }
          <th scope="col" class="num">Points</th>
        </tr>
      </thead>
      <tbody>
        @for (f of factors(); track f.code) {
          @let available = f.status === 'AVAILABLE';
          <tr>
            <td class="wrap">
              <span class="cell-main">{{ f.label }}</span>
              <span class="cell-sub">{{ category(f.category) }} · {{ f.explanation }}</span>
            </td>
            @if (!compact()) {
              <td
                gz-cell
                class="num nowrap"
                data-priority="2"
                [missing]="!available || f.signal === null"
                [reason]="f.explanation || 'No evidence on record'"
              >
                {{ evidence(f) }}
              </td>
            }
            <td
              gz-cell
              class="num nowrap"
              [missing]="!available || f.points === null"
              reason="No evidence on record, so no points"
            >
              <span class="points"
                ><span class="points-bar" aria-hidden="true"
                  ><i [style.width.%]="share(f.points ?? 0, f.weight)"></i></span
                >{{ f.points | number: '1.0-2' }} of {{ f.weight }}</span
              >
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    td.wrap {
      white-space: normal;
    }
    /* Points out of the factor's weight: one hue; a missing factor is hatched by its cell (§11). */
    .points {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-8);
    }
    .points-bar {
      position: relative;
      width: 56px;
      height: 6px;
      background: var(--rule);
    }
    .points-bar i {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--ink-2);
    }
  `,
})
export class ScoreFactors {
  readonly factors = input.required<readonly OpportunityFactor[]>();
  /** Leaves out the Evidence column (narrow panes); the explanation still states the evidence. */
  readonly compact = input(false, { transform: booleanAttribute });
  readonly caption = input('Opportunity score factors');
  category = labelFor;
  share(part: number, whole: number) {
    return whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;
  }
  /** PERCENT evidence with its sign; SCORE evidence out of 100. Missing evidence is a marker. */
  evidence(f: OpportunityFactor) {
    if (f.signal === null) return '';
    if (f.signalUnit === 'PERCENT') return (f.signal > 0 ? '+' : '') + f.signal.toFixed(2) + '%';
    if (f.signalUnit === 'SCORE') return Math.round(f.signal) + ' of 100';
    return String(f.signal);
  }
}
