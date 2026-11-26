import { AlertMonitoringDTO, AlertRuleDTO, ValuationChangeDirection } from '../../core/models/api';
import { labelFor } from '../../shared/pipes/label.pipe';

/**
 * Alert rules and their checks in plain words (DESIGN.md §13): no status codes or error codes in
 * prose; a code the app doesn't know is written as words and its raw form is kept for a details row.
 */
export const DIRECTIONS: [ValuationChangeDirection, string][] = [
  ['ANY', 'Up or down'],
  ['INCREASE', 'Up only'],
  ['DECREASE', 'Down only'],
];

export function eventLabel(event: string): string {
  return (
    (
      {
        NEW_MATCH: 'New matching property',
        LISTING_PRICE_CHANGED: 'Listing price change',
        VALUATION_CHANGED: 'ZentraValue change',
      } as Record<string, string>
    )[event] ?? labelFor(event)
  );
}

/** "Moves 3% or more, up or down"; "Any change, down only". Valuation rules only. */
export function criteria(a: Pick<AlertRuleDTO, 'minimumChangePercent' | 'changeDirection'>): string {
  const min = a.minimumChangePercent ?? 0;
  const size = min > 0 ? `Moves ${min.toLocaleString('en-US')}% or more` : 'Any change';
  const way = DIRECTIONS.find((d) => d[0] === (a.changeDirection ?? 'ANY'))?.[1] ?? 'Up or down';
  return `${size}, ${way.toLowerCase()}`;
}

/** The rule's state in the table: its own pause, its saved search's, or a check that can't run. */
export function ruleStatus(a: AlertRuleDTO, m: AlertMonitoringDTO | undefined): { word: string; attention: boolean } {
  if (a.paused) return { word: 'Paused', attention: false };
  if (a.effectivePaused) return { word: 'Paused with its search', attention: false };
  if (m?.status === 'BLOCKED') return { word: 'Can’t run', attention: true };
  if (m && !m.monitoringEnabled) return { word: 'Checks are off', attention: true };
  return { word: 'Active', attention: false };
}

/** The last check, in words: what the monitor's status means for this rule. */
export function checkStatus(m: AlertMonitoringDTO): string {
  switch (m.status) {
    case 'READY':
      return 'Waiting for its first check';
    case 'BASELINED':
      return 'Starting point recorded; it notifies from the next change';
    case 'COMPLETED':
      return 'Checked';
    case 'EVALUATING':
    case 'RUNNING':
      return 'Checking now';
    case 'BLOCKED':
      return 'Can’t run';
    default:
      return labelFor(m.status);
  }
}

/** Why the last check failed or the rule can't run, as a sentence; the code goes in a details row. */
export function errorSentence(code: string): string {
  switch (code) {
    case 'UNSUPPORTED_SOURCE':
      return 'Listing prices aren’t available yet, so this rule can’t run. It starts once they are.';
    default:
      return 'The last check failed.';
  }
}

/** Why "Check now" can't run, written next to it (DESIGN.md §12); null when it can. */
export function checkNowBlocked(a: AlertRuleDTO, m: AlertMonitoringDTO | undefined): string | null {
  if (a.eventType === 'LISTING_PRICE_CHANGED') return 'Listing prices aren’t available yet.';
  if (a.paused) return 'Resume the rule to check it.';
  if (a.effectivePaused) return 'Its saved search is paused: resume the search to check it.';
  if (!m) return 'Waiting for its status.';
  if (!m.monitoringEnabled) return 'Background checks are switched off on the server.';
  return null;
}
