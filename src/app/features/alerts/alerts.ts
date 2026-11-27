import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { PropertyRef } from '../../shared/components/property-ref';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { TABLE_KIT } from '../../shared/table';
import { countOf, formatLocalDate } from '../../shared/data/format';
import { AlertRuleDTO } from '../../core/models/api';
import { alertsActions as A } from '../../store/alerts/alerts.actions';
import { selectSavedSearchesState } from '../../store/saved-searches/saved-searches.selectors';
import { savedSearchesActions as S } from '../../store/saved-searches/saved-searches.actions';
import { AlertRecord } from './alert-record';
import { AlertForm } from './alert-form';
import { checkNowBlocked, criteria, eventLabel, ruleStatus } from './alert-words';

/** What the pane shows: the selected rule (it follows the table's selection) or the New alert form. */
type Pane = 'rule' | 'new' | null;

/**
 * Alerts (DESIGN.md §5 Register, §7): the account's alert rules as a table (rule and what it
 * follows, what it watches for, how often, status, last check), server pages of 20. A row opens the
 * rule in the record pane with its checks in words and Pause or Resume, Check now and Delete;
 * New alert opens its form in the same pane, never above the list.
 */
@Component({
  imports: [
    RouterLink,
    PageHeading,
    RequestStatus,
    PropertyRef,
    Desk,
    RecordPane,
    AlertRecord,
    AlertForm,
    ...TABLE_KIT,
  ],
  template: `<gz-desk [open]="pane() !== null" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading title="Alerts" subtitle="Rules that notify you when a saved search has new matches or a ZentraValue moves.">
        @if (w.auth.isLoggedIn()) {
          <button type="button" class="btn primary" #newButton (click)="openNew()">New alert</button>
        }
      </gz-heading>
      @if (!w.auth.isLoggedIn()) {
        <section class="al-guest" aria-labelledby="al-guest-title">
          <h2 id="al-guest-title">Sign in to follow changes</h2>
          <p class="al-text">Alerts watch your saved searches and properties and notify you when something changes.</p>
          <div class="al-buttons">
            <button type="button" class="btn primary" (click)="w.signIn()">Sign in</button>
            <button type="button" class="btn" (click)="w.signUp()">Create account</button>
          </div>
        </section>
      } @else {
        <gz-request-status
          [loading]="w.alertState().loading && !rules().length"
          loadingText="Loading your alerts…"
          [error]="w.alertState().errorOperation === 'load' ? w.alertState().error : null"
          (retry)="page(w.alertState().page)"
        />
        @if (writeError(); as error) {
          <p class="field-error" role="alert">{{ error }}</p>
        }
        @if (rules().length) {
          <p class="al-count" #count tabindex="-1">{{ countText() }}</p>
          <table
            gz-table
            class="al-table"
            [(selected)]="selectedId"
            (activated)="openRule($event)"
            (dismissed)="closePane()"
            [paneOpen]="pane() !== null"
            [attr.aria-busy]="w.alertState().loading ? 'true' : null"
          >
            <caption class="sr-only">Alert rules. Choose a row to see its checks and change it.</caption>
            <thead>
              <tr>
                <th scope="col">Alert</th>
                <th scope="col" data-priority="2">Watches for</th>
                <th scope="col" data-priority="3">Checked</th>
                <th scope="col">Status</th>
                <th scope="col" class="num" data-priority="2">Last check</th>
              </tr>
            </thead>
            <tbody>
              @for (a of rules(); track a.id) {
                @let m = w.alertState().monitoring[a.id];
                @let st = status(a);
                <tr [gz-row]="a.id">
                  <td class="al-rule">
                    <span class="cell-main">{{ a.name }}</span>
                    <span class="cell-sub">
                      @if (a.savedSearchId) {
                        {{ followsSearch(a.savedSearchId) }}
                      } @else if (a.propertyId) {
                        <gz-property-ref [propertyId]="a.propertyId" [link]="false" />
                      }
                    </span>
                  </td>
                  <td data-priority="2">
                    {{ eventLabel(a.eventType) }}
                    @if (a.eventType === 'VALUATION_CHANGED') {
                      <span class="cell-sub">{{ criteria(a) }}</span>
                    }
                  </td>
                  <td data-priority="3">{{ a.cadence === 'WEEKLY' ? 'Weekly' : 'Daily' }}</td>
                  <td [class.attention]="st.attention">{{ st.word }}</td>
                  <td class="num" data-priority="2">
                    @if (m) {
                      {{ m.lastEvaluatedAt ? day(m.lastEvaluatedAt) : 'Not yet' }}
                    } @else if (w.alertState().monitoringErrors[a.id]) {
                      <span class="muted">Could not load</span>
                    } @else {
                      <span class="skeleton al-skel" aria-hidden="true"></span><span class="sr-only">Loading</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <gz-pager
            [page]="w.alertState().page"
            [size]="20"
            [total]="w.alertState().totalElements"
            [loading]="w.alertState().loading"
            (changed)="page($event)"
          />
          <p class="table-note">Dates are your own day. "Paused with its search": the saved search it follows is paused.</p>
        } @else if (!w.alertState().loading && !w.alertState().error) {
          <p class="al-text">
            Alerts tell you when a saved search has new matches or a ZentraValue moves. Create one
            for a <a routerLink="/saved" [queryParams]="{ view: 'searches' }">saved search</a> or a property.
          </p>
          <button type="button" class="btn primary" (click)="openNew()">New alert</button>
        }
      }

      @if (pane() === 'new') {
        <gz-record-pane deskSlot heading="New alert" noun="alert" backLabel="Alerts" (closed)="closePane()">
          <gz-alert-form (created)="opened($event)" />
        </gz-record-pane>
      } @else if (paneRule(); as a) {
        <gz-record-pane
          deskSlot
          [heading]="a.name"
          noun="alert"
          backLabel="Alerts"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() < rules().length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          <span paneMeta>{{ status(a).word }}</span>
          <div paneActions class="al-pane-actions">
            <button type="button" class="btn primary"
              [attr.aria-disabled]="checkBlocked(a) || evaluating(a) ? 'true' : null"
              [attr.aria-describedby]="checkBlocked(a) ? 'al-check-why' : null"
              (click)="checkNow(a)">
              {{ evaluating(a) ? 'Scheduling…' : 'Check now' }}
            </button>
            <button type="button" class="btn" [attr.aria-disabled]="saving() ? 'true' : null"
              [attr.aria-describedby]="saving() ? 'al-saving' : null" (click)="togglePause(a)">
              {{ a.paused ? 'Resume' : 'Pause' }}
            </button>
            <button type="button" class="btn" [attr.aria-disabled]="saving() ? 'true' : null"
              [attr.aria-describedby]="saving() ? 'al-saving' : null" (click)="remove(a)">Delete</button>
            @if (checkBlocked(a); as why) {
              <p class="al-why" id="al-check-why">{{ why }}</p>
            }
            @if (saving()) {
              <p class="al-why" id="al-saving">Saving a change to your alerts…</p>
            }
            <span class="sr-only" role="status">{{ saving() ? 'Saving a change to your alerts…' : '' }}</span>
          </div>
          @if (writeError(); as error) {
            <p class="field-error al-pane-error" role="alert">{{ error }}</p>
          }
          <gz-alert-record [rule]="a" [follows]="a.savedSearchId ? followsSearch(a.savedSearchId) : null" />
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    .al-guest {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
      max-width: 720px;
    }
    .al-guest h2 {
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .al-text {
      margin: var(--sp-8) 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .al-text a {
      color: var(--copper);
    }
    .al-buttons,
    .al-pane-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .al-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .al-pane-error {
      margin: var(--sp-8) 0;
    }
    .al-count {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    .al-rule {
      min-width: 200px;
      overflow-wrap: anywhere;
    }
    .al-skel {
      display: inline-block;
      width: 56px;
      height: 14px;
      vertical-align: middle;
    }
  `,
})
export class Alerts {
  readonly w = inject(Workspace);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly searches = this.w.store.selectSignal(selectSavedSearchesState);
  private readonly countEl = viewChild<ElementRef<HTMLElement>>('count');
  private readonly newButton = viewChild<ElementRef<HTMLElement>>('newButton');
  readonly eventLabel = eventLabel;
  readonly criteria = criteria;

  readonly rules = this.w.alerts;
  readonly selectedId = signal<unknown>(null);
  readonly pane = signal<Pane>(null);
  readonly paneIndex = computed(() => this.rules().findIndex((a) => a.id === this.selectedId()));
  readonly paneRule = computed(() =>
    this.pane() === 'rule' ? (this.rules()[this.paneIndex()] ?? null) : null,
  );
  readonly paneLabel = computed(() =>
    this.pane() === 'new' ? 'New alert' : 'Alert: ' + (this.paneRule()?.name ?? ''),
  );
  /** A failed change (pause, save, delete), shown where the user is; the form shows its own. */
  readonly writeError = computed(() => {
    const st = this.w.alertState();
    return st.errorOperation === 'save' && st.error && this.pane() !== 'new' ? st.error : null;
  });
  readonly position = computed(() =>
    this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.rules().length} on this page`,
  );
  readonly saving = computed(() => this.w.alertState().saving > 0);
  readonly countText = computed(() => {
    const st = this.w.alertState();
    const paused = this.rules().filter((a) => a.effectivePaused).length;
    return countOf(st.totalElements, 'alert') + (paused && st.totalPages <= 1 ? ` · ${paused} paused` : '');
  });
  private focusCount = false;
  /** Rules whose monitoring status this visit asked for, by id and last change. */
  private readonly monitored = new Set<string>();

  constructor() {
    // Each shown rule's monitoring status, again after the rule changes. Asked here, not on every
    // list load: the list also loads at start-up for the rest of the app, which never shows it.
    effect(() => {
      const rules = this.rules();
      untracked(() => {
        for (const r of rules) {
          const key = r.id + '|' + r.updatedAt;
          if (this.monitored.has(key)) continue;
          this.monitored.add(key);
          this.w.store.dispatch(A.monitoring({ id: r.id }));
        }
      });
    });
    // The rules (and every saved search's name, for the table), once signed in: fresh each visit.
    effect(() => {
      if (!this.w.auth.isLoggedIn()) return;
      untracked(() => {
        this.w.store.dispatch(A.load({ page: 0 }));
        const options = this.searches().options;
        if (!options.value && !options.loading) this.w.store.dispatch(S.loadOptions());
      });
    });
    // A rule that left the page (deleted, or another page) closes its pane, with focus kept.
    effect(() => {
      if (this.pane() === 'rule' && !this.paneRule()) untracked(() => this.closePane(true));
    });
    // After paging, the list starts from its count, which takes focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.w.alertState().loading || !this.focusCount) return;
      this.focusCount = false;
      untracked(() => {
        const el = this.countEl()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
  }

  status(a: AlertRuleDTO) {
    return ruleStatus(a, this.w.alertState().monitoring[a.id]);
  }
  checkBlocked(a: AlertRuleDTO) {
    return checkNowBlocked(a, this.w.alertState().monitoring[a.id]);
  }
  evaluating(a: AlertRuleDTO) {
    return !!this.w.alertState().evaluationPending[a.id];
  }
  /** "Saved search: <name>", or why its name isn't shown (DESIGN.md §6: never an id or a guess). */
  followsSearch(id: number): string {
    const name = this.searchName(id);
    if (name) return 'Saved search: ' + name;
    return this.searches().options.loading
      ? 'Saved search (loading its name…)'
      : 'Saved search: Unavailable (its name could not load)';
  }
  /** The saved search's name, from every saved search when loaded, else the page Saved holds. */
  searchName(id: number): string | null {
    return (
      (this.searches().options.value ?? []).find((s) => s.id === id)?.name ??
      this.w.searches().find((s) => s.id === id)?.name ??
      null
    );
  }
  day(v: string | null | undefined) {
    return formatLocalDate(v);
  }

  page(page: number) {
    this.focusCount = page !== this.w.alertState().page;
    this.w.store.dispatch(A.load({ page }));
  }
  openRule(id: unknown) {
    this.selectedId.set(id);
    this.pane.set('rule');
  }
  openNew() {
    this.selectedId.set(null);
    this.pane.set('new');
  }
  /**
   * A rule was created: open it (the newest of that name on the page). The form, and its focused
   * Create, go: focus moves to the rule's title. When the page on screen doesn't hold it (a later
   * page), the pane closes and a toast says where it went.
   */
  opened(name: string) {
    const rule = [...this.rules()].filter((a) => a.name === name).sort((a, b) => b.id - a.id)[0];
    if (!rule) {
      this.closePane(true);
      this.w.toast('Alert created. It is on the first page of your alerts.');
      return;
    }
    this.openRule(rule.id);
    afterNextRender(() => document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus(), {
      injector: this.injector,
    });
  }
  closePane(toNew = false) {
    const was = this.pane();
    if (!was) return;
    this.pane.set(null);
    // Once the register is back (not inert, not hidden): focus goes to the row the pane showed,
    // or to New alert.
    afterNextRender(
      () => {
        const row = document.querySelector<HTMLElement>('.al-table tr.gz-row.sel');
        (was === 'rule' && row && !toNew ? row : this.newButton()?.nativeElement)?.focus({ preventScroll: false });
      },
      { injector: this.injector },
    );
  }
  step(by: number) {
    const next = this.rules()[this.paneIndex() + by];
    if (next) this.openRule(next.id);
  }
  checkNow(a: AlertRuleDTO) {
    if (this.checkBlocked(a) || this.evaluating(a) || !this.w.requireAccount('check alerts')) return;
    this.w.store.dispatch(A.evaluate({ id: a.id }));
  }
  togglePause(a: AlertRuleDTO) {
    if (this.saving() || !this.w.requireAccount('update alerts')) return;
    this.w.store.dispatch(A.update({ id: a.id, request: { paused: !a.paused } }));
  }
  async remove(a: AlertRuleDTO) {
    if (this.saving()) return;
    if (
      (await this.confirmation.confirm({
        title: 'Delete alert?',
        message: `Stop following "${a.name}"? You can create a new alert later.`,
      })) &&
      !this.destroy.destroyed &&
      !this.saving()
    ) {
      // The pane and its row go: focus moves to New alert once the register is back.
      this.closePane(true);
      this.w.store.dispatch(A.remove({ id: a.id }));
    }
  }
}
