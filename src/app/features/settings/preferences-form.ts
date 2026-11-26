import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RequestStatus } from '../../shared/components/request-status';
import { CountyPicker } from '../../shared/components/county-picker';
import { UserPreferencesDTO } from '../../core/models/api';
import { UserActions as A } from '../../store/user/user.actions';
import { selectLocations } from '../../store/locations/locations.selectors';

type County = UserPreferencesDTO['targetLocations'][number];
const MAX_COUNTIES = 20;
const MAX_GOALS = 20;
const MAX_GOAL_LENGTH = 200;

/** A budget field's text as a number, or null when blank. */
const amount = (v: string) => (v.trim() === '' ? null : Number(v));
const goalsOf = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Settings, Property preferences: the budget, the counties and the goals that pick the properties
 * matched to the account. One Save that says why it can't run (no toast for a wrong budget).
 */
@Component({
  selector: 'gz-preferences-form',
  imports: [FormsModule, RequestStatus, CountyPicker],
  styleUrl: './settings.css',
  styles: `
    .pf-counties {
      margin: 0 0 var(--sp-12);
      padding: 0;
      list-style: none;
      border-top: 1px solid var(--rule);
    }
    .pf-counties li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-12);
      padding: var(--sp-8) 0;
      border-bottom: 1px solid var(--rule);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .pf-counties small {
      display: block;
      font-size: var(--fs-caption);
      color: var(--ink-2);
    }
    .pf-add {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
    }
    .pf-none {
      margin: 0 0 var(--sp-12);
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
  `,
  template: `
    <section class="se" aria-labelledby="se-prefs-title">
      <div class="se-head">
        <h2 id="se-prefs-title">Property preferences</h2>
        <p>Your budget and counties decide which properties are matched to you.</p>
      </div>
      <div class="se-body">
        @if (w.account().preferencesLoadError; as error) {
          <gz-request-status [error]="'Your preferences could not load. ' + error" (retry)="reload()" />
        } @else if (!w.account().preferences) {
          <gz-request-status [loading]="true" loadingText="Loading your preferences…" />
        } @else {
          <form (ngSubmit)="save()" aria-labelledby="se-prefs-title">
            <fieldset>
              <legend>Budget</legend>
              <div class="se-fields">
                <div class="formfield">
                  <label for="minBudget">Minimum ($)</label>
                  <input id="minBudget" name="minBudget" type="number" min="0" step="1000" inputmode="numeric"
                    [ngModel]="minBudget()" (ngModelChange)="minBudget.set(text($event))" />
                </div>
                <div class="formfield">
                  <label for="maxBudget">Maximum ($)</label>
                  <input id="maxBudget" name="maxBudget" type="number" min="0" step="1000" inputmode="numeric"
                    [ngModel]="maxBudget()" (ngModelChange)="maxBudget.set(text($event))" />
                </div>
              </div>
            </fieldset>
            <fieldset>
              <legend>Counties <span class="optional">(up to {{ maxCounties }})</span></legend>
              @if (counties().length) {
                <ul class="pf-counties">
                  @for (c of counties(); track c.countyId) {
                    <li>
                      <span>
                        @if (c.countyName) {
                          {{ c.countyName }}{{ c.stateName || c.stateCode ? ', ' + (c.stateName || c.stateCode) : '' }}
                        } @else {
                          <span class="na-word">Unavailable</span>
                          <small>The county’s name wasn’t sent (county ID {{ c.countyId }}).</small>
                        }
                      </span>
                      <button type="button" class="linkbtn" (click)="removeCounty(c.countyId)"
                        [attr.aria-label]="'Remove ' + (c.countyName || 'the county with ID ' + c.countyId)">Remove</button>
                    </li>
                  }
                </ul>
              } @else {
                <p class="pf-none">No counties chosen.</p>
              }
              <div class="pf-add">
                <gz-county-picker />
                <button type="button" class="btn" [attr.aria-disabled]="addWhy() ? 'true' : null"
                  [attr.aria-describedby]="addWhy() ? 'pf-add-why' : null" (click)="addCounty()">Add county</button>
                @if (addWhy(); as reason) {
                  <p class="se-why" id="pf-add-why">{{ reason }}</p>
                }
              </div>
            </fieldset>
            <fieldset>
              <legend>Investment goals <span class="optional">(optional)</span></legend>
              <div class="formfield">
                <label for="goals">One per line</label>
                <textarea id="goals" name="goals" rows="4" [ngModel]="goals()" (ngModelChange)="goals.set($event)"
                  aria-describedby="pf-goals-hint"></textarea>
                <p class="se-hint" id="pf-goals-hint">Up to {{ maxGoals }} goals of at most {{ maxGoalLength }} characters each.</p>
              </div>
            </fieldset>
            <div class="se-actions">
              <button class="btn primary" [attr.aria-disabled]="why() || saving() ? 'true' : null"
                [attr.aria-describedby]="why() ? 'se-prefs-why' : null">
                {{ saving() ? 'Saving…' : 'Save preferences' }}
              </button>
              @if (why(); as reason) {
                <p class="se-why" id="se-prefs-why">{{ reason }}</p>
              }
            </div>
            @if (tried() && !saving() && w.account().preferencesError; as error) {
              <p class="field-error se-error" role="alert">The preferences could not be saved: {{ error }}</p>
            }
          </form>
        }
      </div>
    </section>
  `,
})
export class PreferencesForm {
  readonly w = inject(Workspace);
  private readonly locations = this.w.store.selectSignal(selectLocations);
  readonly maxCounties = MAX_COUNTIES;
  readonly maxGoals = MAX_GOALS;
  readonly maxGoalLength = MAX_GOAL_LENGTH;
  readonly saving = computed(() => this.w.account().savingPreferences);
  /** The budget fields as typed (number inputs answer numbers or null; kept as text). */
  readonly minBudget = signal('');
  readonly maxBudget = signal('');
  readonly counties = signal<County[]>([]);
  readonly goals = signal('');
  readonly tried = signal(false);
  private base: UserPreferencesDTO | null = null;

  constructor() {
    // Answered again (saved or reloaded): only the untouched fields follow, so typing isn't lost.
    effect(() => {
      const p = this.w.account().preferences;
      if (!p) return;
      untracked(() => {
        const was = this.base;
        if (!was || amount(this.minBudget()) === was.minBudget) this.minBudget.set(this.text(p.minBudget));
        if (!was || amount(this.maxBudget()) === was.maxBudget) this.maxBudget.set(this.text(p.maxBudget));
        if (!was || sameCounties(this.counties(), was.targetLocations)) this.counties.set([...p.targetLocations]);
        if (!was || sameGoals(goalsOf(this.goals()), was.investmentGoals)) this.goals.set(p.investmentGoals.join('\n'));
        this.base = p;
      });
    });
  }

  text(v: unknown): string {
    return v === null || v === undefined ? '' : String(v);
  }

  /** The county chosen in the picker, if it can be added. */
  private readonly picked = computed(() => {
    const l = this.locations();
    return l.counties.find((c) => c.countyId === l.countyId) ?? null;
  });
  readonly addWhy = computed(() => {
    const c = this.picked();
    if (!c) return 'Choose a state and a county first.';
    if (this.counties().some((x) => x.countyId === c.countyId)) return 'That county is already in the list.';
    if (this.counties().length >= MAX_COUNTIES) return `Up to ${MAX_COUNTIES} counties.`;
    return null;
  });
  addCounty() {
    const c = this.picked();
    if (this.addWhy() || !c) return;
    const state = this.locations().states.find((s) => s.id === this.locations().stateId);
    this.counties.update((list) => [
      ...list,
      { countyId: c.countyId, countyName: c.countyName, stateCode: state?.code, stateName: state?.name },
    ]);
  }
  removeCounty(id: number) {
    this.counties.update((list) => list.filter((c) => c.countyId !== id));
  }

  private readonly changed = computed(() => {
    const p = this.w.account().preferences;
    if (!p) return false;
    return (
      amount(this.minBudget()) !== p.minBudget ||
      amount(this.maxBudget()) !== p.maxBudget ||
      !sameCounties(this.counties(), p.targetLocations) ||
      !sameGoals(goalsOf(this.goals()), p.investmentGoals)
    );
  });
  readonly why = computed(() => {
    const min = amount(this.minBudget());
    const max = amount(this.maxBudget());
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)))
      return 'A budget is a dollar amount of 0 or more.';
    if (min !== null && max !== null && min > max) return 'The minimum is more than the maximum.';
    const goals = goalsOf(this.goals());
    if (goals.length > MAX_GOALS || goals.some((g) => g.length > MAX_GOAL_LENGTH))
      return `Use up to ${MAX_GOALS} goals of at most ${MAX_GOAL_LENGTH} characters each.`;
    return this.changed() ? null : 'Nothing has changed.';
  });
  save() {
    if (this.why() || this.saving() || !this.w.requireAccount()) return;
    this.tried.set(true);
    this.w.store.dispatch(
      A.savePreferences({
        preferences: {
          minBudget: amount(this.minBudget()),
          maxBudget: amount(this.maxBudget()),
          targetLocations: this.counties().map(({ countyId }) => ({ countyId })),
          investmentGoals: goalsOf(this.goals()),
        },
      }),
    );
  }
  reload() {
    this.w.store.dispatch(A.loadPreferences());
  }
}

function sameCounties(a: readonly County[], b: readonly County[]) {
  const ids = (l: readonly County[]) => l.map((c) => c.countyId).sort((x, y) => x - y).join(',');
  return ids(a) === ids(b);
}
function sameGoals(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((g, i) => g === b[i]);
}
