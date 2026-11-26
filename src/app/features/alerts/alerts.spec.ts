import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { AlertMonitoringDTO, AlertRuleDTO } from '../../core/models/api';
import { alertsActions as A } from '../../store/alerts/alerts.actions';
import { savedSearchesActions as S } from '../../store/saved-searches/saved-searches.actions';
import { Alerts } from './alerts';
import { checkNowBlocked, criteria, ruleStatus } from './alert-words';

const rule = (id: number, over: Partial<AlertRuleDTO> = {}): AlertRuleDTO => ({
  id,
  name: 'Rule ' + id,
  eventType: 'NEW_MATCH',
  propertyId: null,
  savedSearchId: 11,
  cadence: 'DAILY',
  paused: false,
  effectivePaused: false,
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
  minimumChangePercent: null,
  changeDirection: null,
  ...over,
});
const monitor = (id: number, over: Partial<AlertMonitoringDTO> = {}): AlertMonitoringDTO => ({
  alertRuleId: id,
  monitoringEnabled: true,
  publisherEnabled: true,
  effectivePaused: false,
  status: 'COMPLETED',
  baselineEstablished: true,
  generation: 3,
  scannedMatches: 12,
  lastEvaluatedAt: '2026-11-18T12:00:00Z',
  nextEvaluationAt: '2026-11-19T12:00:00Z',
  lastErrorCode: null,
  pendingEvents: 0,
  sentEvents: 4,
  failedEvents: 1,
  ...over,
});
const VALUE = rule(24, {
  name: '2847 SW 27th Ter: value moves 3% or more',
  eventType: 'VALUATION_CHANGED',
  savedSearchId: null,
  propertyId: 42,
  cadence: 'WEEKLY',
  minimumChangePercent: 3,
  changeDirection: 'ANY',
});
const LISTING = rule(26, { name: '640 NE 74th St listing price', eventType: 'LISTING_PRICE_CHANGED', savedSearchId: null, propertyId: 47 });
const WITH_PAUSED_SEARCH = rule(23, { name: 'Duplex matches', savedSearchId: 13, effectivePaused: true });

describe('Alerts', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: true };
  const confirm = vi.fn(async () => true);
  beforeEach(() => {
    auth.loggedIn = true;
    confirm.mockClear();
  });

  async function setup() {
    TestBed.configureTestingModule({
      imports: [Alerts],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: () => false } },
        { provide: ConfirmationService, useValue: { confirm } },
      ],
    });
    await TestBed.inject(Router).navigateByUrl('/');
    store = TestBed.inject(Store);
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const fixture = TestBed.createComponent(Alerts);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    return { fixture, el };
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  /** Text as read: each text node apart (a label and its value are separate blocks). */
  const spaced = (el: Element | null) => {
    const walk = document.createTreeWalker(el!, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    while (walk.nextNode()) out.push(walk.currentNode.textContent!);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  const of = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  function hold(fixture: { detectChanges(): void }, ...rules: AlertRuleDTO[]) {
    store.dispatch(S.optionsLoaded({ items: [
      { id: 11, name: '33133 houses, 3+ beds', filters: {}, filtersVersion: 1, cadence: 'DAILY', paused: false, createdAt: '', updatedAt: '' },
      { id: 13, name: 'Upper East Side duplexes', filters: {}, filtersVersion: 1, cadence: 'DAILY', paused: true, createdAt: '', updatedAt: '' },
    ] }));
    store.dispatch(A.loaded({ page: { content: rules, page: 0, size: 20, totalElements: rules.length, totalPages: 1 } }));
    fixture.detectChanges();
  }
  const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.al-table tbody tr')];

  it('asks a guest to sign in and loads nothing', async () => {
    auth.loggedIn = false;
    const { el } = await setup();
    expect(el.textContent).toContain('Sign in to follow changes');
    expect(of(A.load.type)).toHaveLength(0);
    expect(el.querySelector('button.primary')!.textContent!.trim()).toBe('Sign in');
  });

  it('lists the rules as a table in plain words, with what each follows', async () => {
    const { fixture, el } = await setup();
    expect(of(A.load.type)).toHaveLength(1);
    hold(fixture, rule(21, { name: 'New 33133 house matches' }), VALUE, LISTING, WITH_PAUSED_SEARCH);
    store.dispatch(A.monitoringLoaded({ id: 21, status: monitor(21) }));
    store.dispatch(A.monitoringLoaded({ id: 26, status: monitor(26, { status: 'BLOCKED', lastErrorCode: 'UNSUPPORTED_SOURCE', lastEvaluatedAt: null }) }));
    fixture.detectChanges();
    const r = rows(el).map((x) => spaced(x));
    expect(r[0]).toContain('New 33133 house matches Saved search: 33133 houses, 3+ beds');
    expect(r[0]).toContain('New matching property');
    expect(r[1]).toContain('ZentraValue change Moves 3% or more, up or down');
    expect(r[2]).toContain('Can’t run');
    expect(r[2]).toContain('Not yet');
    expect(r[3]).toContain('Paused with its search');
    expect(text(el.querySelector('.al-count'))).toBe('4 alerts · 1 paused');
    // No codes in the table.
    expect(el.textContent).not.toContain('BLOCKED');
    expect(el.textContent).not.toContain('UNSUPPORTED_SOURCE');
  });

  it('opens a rule in the pane with its checks in words, and says why Check now can’t run', async () => {
    const { fixture, el } = await setup();
    hold(fixture, VALUE, LISTING);
    store.dispatch(A.monitoringLoaded({ id: 24, status: monitor(24) }));
    store.dispatch(A.monitoringLoaded({ id: 26, status: monitor(26, { status: 'BLOCKED', lastErrorCode: 'UNSUPPORTED_SOURCE' }) }));
    fixture.detectChanges();
    rows(el)[0].querySelector('td')!.click();
    fixture.detectChanges();
    let pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(spaced(pane)).toContain('Notifies when it Moves 3% or more, up or down');
    expect(spaced(pane)).toContain('Status Checked');
    expect(spaced(pane)).toContain('Failed to send 1');
    const check = [...pane.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'Check now')!;
    expect(check.getAttribute('aria-disabled')).toBeNull();
    check.click();
    expect(of<ReturnType<typeof A.evaluate>>(A.evaluate.type)[0].id).toBe(24);
    // The listing-price rule: the reason beside Check now, the failure as a sentence, its code in details.
    rows(el)[1].querySelector('td')!.click();
    fixture.detectChanges();
    pane = el.querySelector('.desk-slot gz-record-pane')!;
    const blocked = [...pane.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'Check now')!;
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    expect(text(pane.querySelector('#al-check-why'))).toBe('Listing prices aren’t available yet.');
    expect(text(pane)).toContain('Listing prices aren’t available yet, so this rule can’t run.');
    expect(text(pane.querySelector('details'))).toContain('UNSUPPORTED_SOURCE');
    blocked.click();
    expect(of(A.evaluate.type)).toHaveLength(1);
  });

  it('changes a rule from one form, sending only what changed', async () => {
    const { fixture, el } = await setup();
    hold(fixture, VALUE);
    rows(el)[0].querySelector('td')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane)).toContain('Nothing has changed.');
    const min = pane.querySelector<HTMLInputElement>('input[type=number]')!;
    min.value = '5';
    min.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    pane.querySelector<HTMLFormElement>('.ar-form')!.dispatchEvent(new Event('submit'));
    expect(of<ReturnType<typeof A.update>>(A.update.type)[0]).toEqual(A.update({ id: 24, request: { minimumChangePercent: 5 } }));
  });

  it('opens New alert in the pane and says what is missing before Create', async () => {
    const { fixture, el } = await setup();
    hold(fixture, VALUE);
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'New alert')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane.querySelector('.pane-title'))).toBe('New alert');
    const create = [...pane.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'Create alert')!;
    expect(create.getAttribute('aria-disabled')).toBe('true');
    expect(text(pane.querySelector('#af-why'))).toBe('Enter a name.');
    const name = pane.querySelector<HTMLInputElement>('#alertName')!;
    name.value = 'Watch 33133';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text(pane.querySelector('#af-why'))).toBe('Choose a saved search to follow.');
    const target = pane.querySelector<HTMLSelectElement>('#targetId')!;
    target.selectedIndex = 1;
    target.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(pane.querySelector('#af-why')).toBeNull();
    create.click();
    expect(of<ReturnType<typeof A.create>>(A.create.type)[0].request).toEqual({
      name: 'Watch 33133',
      eventType: 'NEW_MATCH',
      cadence: 'DAILY',
      savedSearchId: 11,
    });
  });

  it('deletes a rule after confirming, with focus on New alert', async () => {
    const { fixture, el } = await setup();
    hold(fixture, VALUE);
    rows(el)[0].querySelector('td')!.click();
    fixture.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('.al-pane-actions button')].find((b) => text(b) === 'Delete')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(confirm).toHaveBeenCalled();
    expect(of<ReturnType<typeof A.remove>>(A.remove.type)[0].id).toBe(24);
    expect(document.activeElement!.textContent!.trim()).toBe('New alert');
  });

  it('says what alerts do, with New alert, when there are none', async () => {
    const { fixture, el } = await setup();
    hold(fixture);
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('Alerts tell you when a saved search has new matches or a ZentraValue moves.');
    expect(el.textContent).not.toMatch(/\b0 alerts\b/);
  });

  it('the pane follows the arrow keys, and its position with it', async () => {
    const { fixture, el } = await setup();
    hold(fixture, VALUE, LISTING, WITH_PAUSED_SEARCH);
    rows(el)[0].querySelector('td')!.click();
    fixture.detectChanges();
    rows(el)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane.querySelector('.pane-title'))).toBe(LISTING.name);
    expect(text(pane.querySelector('.pane-pos'))).toBe('2 of 3 on this page');
  });

  it('shows a failed change in the pane, and keeps what was typed when the rule answers again', async () => {
    const { fixture, el } = await setup();
    hold(fixture, VALUE);
    rows(el)[0].querySelector('td')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const pane = () => el.querySelector('.desk-slot gz-record-pane')!;
    const name = pane().querySelector<HTMLInputElement>('input[name=name]')!;
    name.value = 'Typed, not saved';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // Pause in the header: the rule comes back paused; the typed name stays.
    [...pane().querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'Pause')!.click();
    store.dispatch(A.saved({ item: { ...VALUE, paused: true, effectivePaused: true } }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(pane().querySelector<HTMLInputElement>('input[name=name]')!.value).toBe('Typed, not saved');
    expect(text(pane())).toContain('Resume');
    // A change that fails is said in the pane, where the user is.
    store.dispatch(A.update({ id: 24, request: { paused: false } }));
    store.dispatch(A.failed({ error: 'The rule could not be updated.', operation: 'save' }));
    fixture.detectChanges();
    expect(text(pane().querySelector('.al-pane-error'))).toBe('The rule could not be updated.');
  });

  it('opens a new rule with focus on its title, and Delete keeps focus once the list is back', async () => {
    const { fixture, el } = await setup();
    hold(fixture, VALUE);
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'New alert')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const name = el.querySelector<HTMLInputElement>('#alertName')!;
    name.value = 'Watch 33133';
    name.dispatchEvent(new Event('input'));
    const target = el.querySelector<HTMLSelectElement>('#targetId')!;
    fixture.detectChanges();
    await fixture.whenStable();
    target.selectedIndex = 1;
    target.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    [...el.querySelectorAll<HTMLButtonElement>('.desk-slot button')].find((b) => text(b) === 'Create alert')!.click();
    const created = rule(30, { name: 'Watch 33133' });
    store.dispatch(A.saved({ item: created }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text(el.querySelector('.desk-slot .pane-title'))).toBe('Watch 33133');
    expect(document.activeElement).toBe(el.querySelector('.desk-slot .pane-title'));
    // Delete: the pane goes, and focus lands on New alert after the register is back.
    [...el.querySelectorAll<HTMLButtonElement>('.al-pane-actions button')].find((b) => text(b) === 'Delete')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.desk-slot')).toBeNull();
    expect(document.activeElement!.textContent!.trim()).toBe('New alert');
  });

  it('says a followed search’s name is loading, or unavailable, never “not on this page”', async () => {
    const { fixture, el } = await setup();
    store.dispatch(A.loaded({ page: { content: [rule(21)], page: 0, size: 20, totalElements: 1, totalPages: 1 } }));
    fixture.detectChanges();
    expect(spaced(rows(el)[0])).toContain('Saved search (loading its name…)');
    store.dispatch(S.optionsFailed({ error: 'x' }));
    fixture.detectChanges();
    expect(spaced(rows(el)[0])).toContain('Saved search: Unavailable (its name could not load)');
  });
});

describe('Alert words', () => {
  it('writes criteria, statuses and why a check can’t run in plain words', () => {
    expect(criteria({ minimumChangePercent: 0, changeDirection: 'DECREASE' })).toBe('Any change, down only');
    expect(criteria({ minimumChangePercent: 5, changeDirection: 'INCREASE' })).toBe('Moves 5% or more, up only');
    expect(ruleStatus(rule(1, { paused: true, effectivePaused: true }), undefined).word).toBe('Paused');
    expect(ruleStatus(rule(1, { effectivePaused: true }), undefined).word).toBe('Paused with its search');
    expect(ruleStatus(rule(1), monitor(1, { monitoringEnabled: false }))).toEqual({ word: 'Checks are off', attention: true });
    expect(checkNowBlocked(rule(1, { paused: true }), monitor(1))).toBe('Resume the rule to check it.');
    expect(checkNowBlocked(rule(1), undefined)).toBe('Waiting for its status.');
    expect(checkNowBlocked(rule(1), monitor(1))).toBeNull();
  });
});
