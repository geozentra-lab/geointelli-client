import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { CSV_DATASETS, ImportUploadKind } from '../../core/models/import-job';
import { ImportJobsActions as A } from '../../store/import-jobs/import-jobs.actions';
import { selectImportJobs } from '../../store/import-jobs/import-jobs.selectors';

const KINDS: { value: ImportUploadKind; label: string; what: string }[] = [
  { value: 'file', label: 'One CSV file', what: 'One dataset of a county.' },
  { value: 'owners', label: 'Owners', what: 'owners.csv and property_owner.csv, loaded together.' },
  { value: 'folder', label: 'A county folder', what: 'Every CSV of a county in one upload.' },
];

/**
 * Import county data, in the record pane (DESIGN.md §5: "New …" forms open in the pane, never above
 * the list): what to load, the county and the files. Start import says why it can't run; once the
 * job is queued the page opens it in place of the form.
 */
@Component({
  selector: 'gz-import-form',
  imports: [FormsModule, ...RECORD_KIT],
  template: `
    <gz-record-section>
      <form (ngSubmit)="submit()" aria-label="Import county data">
        <fieldset>
          <legend>What to load</legend>
          @for (k of kinds; track k.value) {
            <label class="if-choice">
              <input type="radio" name="kind" [value]="k.value" [ngModel]="kind()" (ngModelChange)="setKind($event)" />
              <span>{{ k.label }}</span>
              <small>{{ k.what }}</small>
            </label>
          }
        </fieldset>
        <fieldset>
          <legend>County</legend>
          <div class="if-fields">
            <div class="formfield">
              <label for="if-county">County</label>
              <input id="if-county" name="county" maxlength="100" [ngModel]="county()" (ngModelChange)="county.set($event)" />
            </div>
            <div class="formfield">
              <label for="if-state">State</label>
              <input id="if-state" name="state" maxlength="2" autocomplete="off" [ngModel]="state()" (ngModelChange)="state.set($event)" aria-describedby="if-state-hint" />
              <p class="if-hint" id="if-state-hint">Two letters, such as FL.</p>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Files</legend>
          @if (kind() === 'file') {
            <div class="formfield">
              <label for="if-dataset">Dataset</label>
              <select id="if-dataset" name="dataset" [ngModel]="dataset()" (ngModelChange)="dataset.set($event)">
                @for (d of datasets; track d) {
                  <option [value]="d">{{ d }}.csv</option>
                }
              </select>
            </div>
            <div class="formfield if-file">
              <label for="if-csv">{{ dataset() }}.csv</label>
              <input id="if-csv" type="file" accept=".csv" (change)="pick($event)" />
            </div>
          } @else if (kind() === 'owners') {
            <div class="formfield if-file">
              <label for="if-owners">owners.csv</label>
              <input id="if-owners" type="file" accept=".csv" (change)="pick($event, 0)" />
            </div>
            <div class="formfield if-file">
              <label for="if-property-owners">property_owner.csv</label>
              <input id="if-property-owners" type="file" accept=".csv" (change)="pick($event, 1)" />
            </div>
          } @else {
            <div class="formfield if-file">
              <label for="if-folder">The county’s CSV files</label>
              <input id="if-folder" type="file" accept=".csv" multiple (change)="pick($event)" />
            </div>
          }
          <p class="if-hint">
            @switch (kind()) {
              @case ('folder') {
                Needs properties, addresses, assessments, buildings, owners, property_owner, lands, sales,
                taxes and extra_features; parcels, predictions and images are optional. properties.csv
                loads first.
              }
              @case ('owners') {
                Both files load in one transaction.
              }
              @default {
                The county must already exist, except for properties.csv, which creates it. Existing
                properties are never overwritten: a duplicate folio fails the job.
              }
            }
          </p>
        </fieldset>
        <div class="if-actions">
          <button class="btn primary" [attr.aria-disabled]="why() || s().uploading ? 'true' : null"
            [attr.aria-describedby]="why() ? 'if-why' : null">
            {{ s().uploading ? 'Uploading…' : 'Start import' }}
          </button>
          @if (why(); as reason) {
            <p class="if-why" id="if-why">{{ reason }}</p>
          }
        </div>
        @if (tried() && !s().uploading && s().uploadError; as error) {
          <p class="field-error if-error" role="alert">The import could not start: {{ error }}</p>
        }
      </form>
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
    }
    fieldset {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    fieldset + fieldset {
      margin-top: var(--sp-16);
    }
    legend {
      width: 100%;
      margin: 0 0 var(--sp-12);
      padding: 0 0 var(--sp-4);
      border-bottom: 1px solid var(--ink);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      font-weight: 600;
    }
    .if-choice {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      column-gap: var(--sp-8);
      padding: var(--sp-8) 0;
      border-bottom: 1px solid var(--rule);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      cursor: pointer;
    }
    .if-choice:first-of-type {
      padding-top: 0;
    }
    .if-choice input {
      width: 16px;
      height: 16px;
      margin: 2px 0 0;
      accent-color: var(--ink);
    }
    .if-choice small {
      grid-column: 2;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .if-fields {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: var(--sp-12) var(--sp-16);
    }
    .if-file + .if-file,
    .formfield + .if-file {
      margin-top: var(--sp-12);
    }
    .if-file input[type='file'] {
      max-width: 100%;
      font-size: var(--fs-cell);
    }
    .if-hint,
    .if-why {
      margin: var(--sp-4) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    fieldset > .if-hint {
      margin-top: var(--sp-12);
    }
    .if-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
      margin-top: var(--sp-16);
    }
    .if-why {
      margin: 0;
    }
    .if-error {
      margin: var(--sp-8) 0 0;
    }
  `,
})
export class ImportForm {
  private readonly w = inject(Workspace);
  readonly s = this.w.store.selectSignal(selectImportJobs);
  readonly kinds = KINDS;
  readonly datasets = CSV_DATASETS;
  readonly kind = signal<ImportUploadKind>('file');
  readonly dataset = signal<string>(CSV_DATASETS[0]);
  readonly county = signal('');
  readonly state = signal('');
  private readonly files = signal<(File | null)[]>([]);
  /** Start import was pressed, so an upload error is this form's to show. */
  readonly tried = signal(false);

  readonly why = computed(() => {
    if (!this.county().trim() || !this.state().trim()) return 'Enter the county and its state.';
    const f = this.files();
    if (this.kind() === 'owners') return f[0] && f[1] ? null : 'Choose both files.';
    if (!f.length || !f.every(Boolean)) return this.kind() === 'folder' ? 'Choose the county’s CSV files.' : 'Choose the CSV file.';
    return null;
  });
  setKind(kind: ImportUploadKind) {
    this.kind.set(kind);
    this.files.set([]);
  }
  pick(event: Event, slot?: number) {
    const picked = Array.from((event.target as HTMLInputElement).files ?? []);
    if (slot === undefined) this.files.set(picked);
    else
      this.files.update((f) => {
        const next = [...f];
        next[slot] = picked[0] ?? null;
        return next;
      });
  }
  submit() {
    if (this.why() || this.s().uploading || !this.w.requireAccount('import county data')) return;
    this.tried.set(true);
    this.w.store.dispatch(
      A.upload({
        upload: {
          kind: this.kind(),
          dataset: this.dataset(),
          county: this.county().trim(),
          state: this.state().trim(),
          files: this.files().filter((f): f is File => !!f),
        },
      }),
    );
  }
}
