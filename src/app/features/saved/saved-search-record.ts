import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { RequestStatus } from '../../shared/components/request-status';
import { countOf, formatLocalDate, placeLine } from '../../shared/data/format';
import { Cadence, SavedSearchDTO } from '../../core/models/api';
import { savedSearchesActions as A } from '../../store/saved-searches/saved-searches.actions';
import { selectSavedSearchesState } from '../../store/saved-searches/saved-searches.selectors';
import { searchWords } from './search-words';

/**
 * A saved search in the record pane (DESIGN.md §5 Register): what it matches in words, how it is
 * checked (name, how often, paused: one form, saved together), and the properties it matches today
 * (GET /saved-searches/{id}/results, the first 8). The pane's header holds Open in Explore and
 * Delete.
 */
@Component({
  selector: 'gz-saved-search-record',
  imports: [FormsModule, RouterLink, RequestStatus, ...RECORD_KIT],
  template: `
    <gz-record-section heading="What it matches">
      @if (words().length) {
        <ul class="ss-words">
          @for (w of words(); track w) {
            <li>{{ w }}</li>
          }
        </ul>
      } @else {
        <p class="ss-text">Every property: this search sets no filters.</p>
      }
      <gz-record-group>
        <div gz-record-row label="Saved">{{ day(search().createdAt) }}</div>
        <div gz-record-row label="Changed">{{ day(search().updatedAt) }}</div>
      </gz-record-group>
    </gz-record-section>

    <gz-record-section heading="Checking">
      <form class="ss-form" (ngSubmit)="save()">
        <div class="formfield">
          <label [for]="id + '-name'">Name</label>
          <input [id]="id + '-name'" name="name" maxlength="120"
            [ngModel]="name()" (ngModelChange)="name.set($event)" />
        </div>
        <div class="formfield">
          <label [for]="id + '-cadence'">Checked for new matches</label>
          <select [id]="id + '-cadence'" name="cadence" [ngModel]="cadence()" (ngModelChange)="cadence.set($event)">
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </div>
        <label class="ss-check">
          <input type="checkbox" name="paused" [ngModel]="paused()" (ngModelChange)="paused.set($event)" />
          Pause checks (its alerts pause with it)
        </label>
        <div class="ss-actions">
          <button class="btn" [attr.aria-disabled]="why() || saving() ? 'true' : null"
            [attr.aria-describedby]="why() ? id + '-why' : null">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
          @if (why(); as reason) {
            <p class="ss-why" [id]="id + '-why'">{{ reason }}</p>
          }
        </div>
        @if (writeError(); as error) {
          <p class="field-error" role="alert">{{ error }}</p>
        }
      </form>
    </gz-record-section>

    <gz-record-section heading="Matches today">
      @let p = preview();
      <gz-request-status
        [loading]="p.loading"
        loadingText="Running this search on current records…"
        [error]="p.error"
        (retry)="loadPreview()"
      />
      @if (!p.loading && p.value; as r) {
        <p class="ss-text">
          {{ r.totalElements ? countOf(r.totalElements, 'property matches', 'properties match') + ' today.' : 'No property matches these filters today.' }}
          @if (r.totalElements > r.content.length) {
            The first {{ r.content.length }}:
          }
        </p>
        @if (r.content.length) {
          <ul class="ss-matches">
            @for (m of r.content; track m.id) {
              <li>
                <a [routerLink]="['/property', m.id]">{{ m.address || 'Folio ' + m.folio }}</a>
                <span class="ss-sub">{{ place(m) }}</span>
              </li>
            }
          </ul>
        }
      }
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
    }
    gz-record-section + gz-record-section {
      margin-top: var(--sp-16);
    }
    .ss-words {
      margin: var(--sp-8) 0 var(--sp-12);
      padding: 0;
      list-style: none;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .ss-words li {
      padding: 6px 0;
      border-bottom: 1px solid var(--rule);
    }
    .ss-text {
      margin: var(--sp-8) 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .ss-form {
      display: grid;
      gap: var(--sp-12);
      margin-top: var(--sp-8);
    }
    .ss-check {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      font-size: var(--fs-cell);
    }
    .ss-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
    }
    .ss-why {
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .ss-matches {
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    .ss-matches li {
      display: flex;
      flex-direction: column;
      padding: 6px 0;
      border-bottom: 1px solid var(--rule);
    }
    .ss-matches a {
      color: var(--ink);
      font-weight: 500;
    }
    .ss-matches a:hover {
      color: var(--copper);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .ss-sub {
      font-size: var(--fs-caption);
      color: var(--ink-2);
    }
  `,
})
export class SavedSearchRecord {
  readonly search = input.required<SavedSearchDTO>();
  readonly countyName = input<string | null>(null);
  private readonly w = inject(Workspace);
  private readonly state = this.w.store.selectSignal(selectSavedSearchesState);
  readonly id = 'ss-' + Math.random().toString(36).slice(2, 8);
  readonly countOf = countOf;

  readonly name = signal('');
  readonly cadence = signal<Cadence>('DAILY');
  readonly paused = signal(false);
  readonly saving = computed(() => this.state().saving > 0);
  readonly writeError = computed(() => {
    const s = this.state();
    return s.errorOperation === 'save' ? s.error : null;
  });
  /** The search as last shown, to tell the user's edits from a fresh answer. */
  private base: SavedSearchDTO | null = null;
  readonly words = computed(() => searchWords(this.search().filters, this.countyName()));
  /** The properties it matches today: the slice's preview, when it is this search's. */
  readonly preview = computed(() => {
    const s = this.state();
    return s.previewId === this.search().id ? s.preview : { value: null, loading: true, error: null };
  });

  constructor() {
    // The form follows the search on screen. Another search: every field. The same search answered
    // again: only the fields the user hasn't edited, so typing survives.
    effect(() => {
      const s = this.search();
      untracked(() => {
        const was = this.base;
        const keep = was?.id === s.id;
        if (!keep || this.name() === was.name) this.name.set(s.name);
        if (!keep || this.cadence() === was.cadence) this.cadence.set(s.cadence);
        if (!keep || this.paused() === was.paused) this.paused.set(s.paused);
        this.base = s;
      });
    });
    // Its matches today (the first 8 the API sends), once per search opened.
    effect(() => {
      const id = this.search().id;
      if (untracked(() => this.state().previewId) !== id) untracked(() => this.loadPreview());
    });
  }

  /** Why Save changes can't run, written next to it (DESIGN.md §12). */
  readonly why = computed(() => {
    const s = this.search();
    if (!this.name().trim()) return 'Enter a name.';
    if (
      this.name().trim() === s.name &&
      this.cadence() === s.cadence &&
      this.paused() === s.paused
    )
      return 'Nothing has changed.';
    return null;
  });

  save() {
    if (this.why() || this.saving() || !this.w.requireAccount('update saved searches')) return;
    const s = this.search();
    this.w.store.dispatch(
      A.update({
        id: s.id,
        request: {
          ...(this.name().trim() !== s.name ? { name: this.name().trim() } : {}),
          ...(this.cadence() !== s.cadence ? { cadence: this.cadence() } : {}),
          ...(this.paused() !== s.paused ? { paused: this.paused() } : {}),
        },
      }),
    );
  }
  loadPreview() {
    this.w.store.dispatch(A.loadPreview({ id: this.search().id }));
  }
  day(v: string) {
    return formatLocalDate(v);
  }
  place(m: { city: string | null; countyName: string | null; stateCode: string | null; zip: string | null }) {
    return placeLine(m.city || m.countyName, m.stateCode, m.zip);
  }
}
