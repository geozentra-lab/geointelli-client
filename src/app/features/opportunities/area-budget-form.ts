import {
  Component,
  ElementRef,
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
import { CountyPicker } from '../../shared/components/county-picker';
import { UserActions } from '../../store/user/user.actions';
import { selectLocations } from '../../store/locations/locations.selectors';
import { RecommendationStatus } from '../../core/models/api';

/** Settings allows up to 20 target counties; so does this form. */
const MAX_COUNTIES = 20;
let nextId = 0;

/**
 * "Set your area and budget" (DESIGN.md §8, buyer lead): what the matches show instead of "0
 * matches" when no target county is saved (NO_PREFERENCES or LOCATION_REQUIRED). One county and an
 * optional budget, saved through the existing preferences action, which keeps the goals and the
 * counties already saved. The recommendations slice drops its answer when preferences are saved,
 * so the matches load again on their own. Goals and more counties stay in Settings.
 *
 * It saves only over preferences it has read: while they load it says so, and when the account or
 * the preferences fail to load it says which, with Retry (the existing load actions).
 */
@Component({
  selector: 'gz-area-budget-form',
  imports: [FormsModule, RouterLink, CountyPicker],
  host: { '[class.bare]': '!framed()' },
  template: `
    <section class="ab" [attr.aria-labelledby]="id + '-title'">
      <h2 #title [id]="id + '-title'" tabindex="-1">Set your area and budget</h2>
      <p class="ab-lede">{{ lede() }}</p>
      @if (loadFailure(); as failure) {
        <div class="insight danger ab-alert" role="alert">
          <span>{{ failure }}</span>
          <button type="button" class="btn small" (click)="retryLoad()">Retry</button>
        </div>
      }
      <form class="filterbar ab-form" (ngSubmit)="save()">
        <div class="formfield location">
          <span class="field-label">State and county</span>
          <gz-county-picker />
        </div>
        <div class="formfield ab-money">
          <label [for]="id + '-min'">Budget from ($)</label>
          <input
            [id]="id + '-min'"
            name="minBudget"
            type="number"
            min="0"
            step="1000"
            placeholder="Any"
            [ngModel]="minBudget()"
            (ngModelChange)="typed('min', $event)"
          />
        </div>
        <div class="formfield ab-money">
          <label [for]="id + '-max'">Budget up to ($)</label>
          <input
            [id]="id + '-max'"
            name="maxBudget"
            type="number"
            min="0"
            step="1000"
            placeholder="Any"
            [ngModel]="maxBudget()"
            (ngModelChange)="typed('max', $event)"
          />
        </div>
        <button
          class="btn primary ab-save"
          [disabled]="blocked() !== null || saving()"
          [attr.aria-describedby]="blocked() ? id + '-why' : null"
        >
          {{ saving() ? 'Saving…' : 'Show matches' }}
        </button>
      </form>
      @if (blocked(); as why) {
        <p class="ab-why" [id]="id + '-why'">{{ why }}</p>
      }
      @if (account().preferencesError; as error) {
        <p class="field-error" role="alert">Your area and budget were not saved. {{ error }}</p>
      }
      <p class="ab-note">
        Show matches saves the county and budget to your preferences. Goals and more counties are in
        <a routerLink="/settings">Settings</a>.
      </p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .ab {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    /* On a page of its own, like the other states of the matches: no frame. */
    :host(.bare) .ab {
      padding: 0;
      background: none;
      border-top: 0;
    }
    h2 {
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    /* Focused only by script, when Retry removes itself. */
    h2:focus {
      outline: none;
    }
    .ab-lede {
      margin: var(--sp-4) 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .ab-alert {
      margin-bottom: var(--sp-16);
    }
    .ab-alert span {
      flex: 1;
      min-width: 0;
    }
    .ab-form .formfield.location {
      flex: 2 1 380px;
    }
    .ab-form .ab-money {
      flex: 0 1 168px;
    }
    .ab-why,
    .ab-note {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .ab-note {
      margin-top: var(--sp-16);
    }
    @media (max-width: 700px) {
      .ab {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
      .ab-form .ab-money {
        flex: 1 1 140px;
      }
      .ab-save {
        width: 100%;
      }
    }
  `,
})
export class AreaBudgetForm {
  readonly status = input<RecommendationStatus>('NO_PREFERENCES');
  /** A white section under a 2 px ink rule; false on a page of its own (the Opportunities tab). */
  readonly framed = input(true);
  readonly id = 'gz-area-' + nextId++;
  private readonly w = inject(Workspace);
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');
  readonly account = this.w.account;
  private readonly locations = this.w.store.selectSignal(selectLocations);
  readonly minBudget = signal<number | null>(null);
  readonly maxBudget = signal<number | null>(null);
  readonly saving = computed(() => this.account().savingPreferences);

  readonly lede = computed(() =>
    this.status() === 'LOCATION_REQUIRED'
      ? 'Matches start from a county you want to buy in, and none is saved yet. Choose one to see matches.'
      : 'Matches start from a county you want to buy in. Choose one, and a budget if you have one.',
  );
  /** What failed to load, when the saved preferences can't be read (so they can't be saved over). */
  readonly loadFailure = computed(() => {
    const a = this.account();
    if (a.preferences) return null;
    if (a.preferencesLoadError)
      return 'Your saved preferences could not load, so saving here could overwrite them.';
    if (a.error && !a.loading) return 'Your account could not load, so your preferences are unknown.';
    return null;
  });
  /** Why Show matches can't be pressed yet, written next to it (DESIGN.md §12); null when it can. */
  readonly blocked = computed(() => {
    const a = this.account();
    if (this.loadFailure()) return 'Saving waits until your saved preferences load.';
    if (!a.preferences) return 'Loading your saved preferences…';
    if (this.locations().countyId === null) return 'Choose a state and a county first.';
    const min = this.minBudget();
    const max = this.maxBudget();
    if ((min !== null && min < 0) || (max !== null && max < 0)) return 'A budget can’t be below $0.';
    if (min !== null && max !== null && min > max)
      return 'The lowest budget must not be above the highest.';
    if (a.preferences.targetLocations.length >= MAX_COUNTIES)
      return `You already have ${MAX_COUNTIES} target counties. Remove one in Settings first.`;
    return null;
  });

  /** Fields the user has typed in keep what they typed when the saved budget arrives. */
  private readonly touched = { min: false, max: false };
  private seeded = false;
  constructor() {
    // The budget already saved (LOCATION_REQUIRED keeps one) fills the untouched fields, once.
    effect(() => {
      const p = this.account().preferences;
      if (!p || this.seeded) return;
      this.seeded = true;
      untracked(() => {
        if (!this.touched.min) this.minBudget.set(p.minBudget);
        if (!this.touched.max) this.maxBudget.set(p.maxBudget);
      });
    });
  }

  typed(field: 'min' | 'max', value: number | null) {
    this.touched[field] = true;
    (field === 'min' ? this.minBudget : this.maxBudget).set(value);
  }
  /** Retry what failed: the account (which then loads the preferences), or the preferences. */
  retryLoad() {
    // The alert and its Retry go while the load runs: focus moves to the heading first.
    this.title().nativeElement.focus();
    const a = this.account();
    this.w.store.dispatch(a.preferencesLoadError ? UserActions.loadPreferences() : UserActions.load());
  }
  save() {
    const p = this.account().preferences;
    const countyId = this.locations().countyId;
    if (this.blocked() !== null || this.saving() || !p || countyId === null) return;
    if (!this.w.requireAccount('save your area and budget')) return;
    const ids = [...new Set([...p.targetLocations.map((c) => c.countyId), countyId])];
    this.w.store.dispatch(
      UserActions.savePreferences({
        preferences: {
          minBudget: this.minBudget(),
          maxBudget: this.maxBudget(),
          targetLocations: ids.map((id) => ({ countyId: id })),
          investmentGoals: p.investmentGoals,
        },
      }),
    );
  }
}
