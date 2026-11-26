import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { RequestStatus } from '../../shared/components/request-status';
import { CrmActions as A } from '../../store/crm/crm.actions';
import { selectCrm } from '../../store/crm/crm.selectors';
import { CrmSubjectType, crmLabel } from '../../core/models/crm';
/** Activity history of one CRM record, with a note form for clients and leads. */
@Component({
  selector: 'gz-crm-history',
  imports: [DatePipe, FormsModule, RequestStatus],
  template: `<div class="crm-history">
    @if (canNote()) {
      <form class="crm-note" (ngSubmit)="addNote()">
        <label class="sr-only" [for]="'note-' + key()">Add a note</label>
        <textarea
          class="field fullwidth"
          [id]="'note-' + key()"
          name="note"
          rows="2"
          maxlength="2000"
          placeholder="Add a note about this conversation…"
          [(ngModel)]="note"
        ></textarea>
        <div class="crm-note-actions">
          <button class="btn small primary" [attr.aria-disabled]="!note.trim() || crm().saving > 0 ? 'true' : null"
            [attr.aria-describedby]="!note.trim() ? 'note-why-' + key() : null">
            {{ submitted !== null ? 'Saving…' : 'Add note' }}
          </button>
          @if (!note.trim()) {
            <span class="smalltext muted" [id]="'note-why-' + key()">Write the note first.</span>
          }
        </div>
      </form>
    }
    @if (active()) {
      <gz-request-status
        [loading]="crm().history.loading && !crm().history.page"
        loadingText="Loading history…"
        [error]="crm().history.error"
        (retry)="load(crm().history.page?.page ?? 0)"
      />
      @if (crm().history.page; as page) {
        <ol class="crm-timeline" aria-label="Activity history">
          @for (a of page.content; track a.id) {
            <li>
              <strong>{{ label(a.activityType) }}</strong>
              @if (a.description) {
                <p>{{ a.description }}</p>
              }
              <span class="smalltext muted">{{ a.createdAt | date: 'MMM d, y, h:mm a' }}</span>
            </li>
          } @empty {
            <li class="sub">No activity recorded yet.</li>
          }
        </ol>
        @if (page.totalPages > 1) {
          <div class="actions">
            <button
              type="button"
              class="btn small"
              [disabled]="crm().history.loading || page.page <= 0"
              (click)="load(page.page - 1)"
            >
              Newer</button
            ><button
              type="button"
              class="btn small"
              [disabled]="crm().history.loading || page.page + 1 >= page.totalPages"
              (click)="load(page.page + 1)"
            >
              Older
            </button>
          </div>
        }
      }
    }
  </div>`,
  styles: `
    .crm-history {
      margin-top: var(--sp-8);
    }
    .crm-note {
      display: grid;
      gap: var(--sp-8);
      margin-bottom: var(--sp-12);
    }
    .crm-note-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .crm-timeline {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .crm-timeline li {
      padding: 10px 0 10px 14px;
      border-left: 2px solid var(--rule);
    }
    .crm-timeline p {
      margin: 4px 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class CrmHistory {
  private store = inject(Store);
  subject = input.required<CrmSubjectType>();
  id = input.required<number>();
  crm = this.store.selectSignal(selectCrm);
  key = computed(() => this.subject() + ':' + this.id());
  active = computed(() => this.crm().history.key === this.key());
  canNote = computed(() => this.subject() === 'CLIENT' || this.subject() === 'LEAD');
  label = crmLabel;
  note = '';
  submitted: string | null = null;
  constructor() {
    // The record's history, newest first: again whenever the pane steps to another record.
    effect(() => {
      const key = this.key();
      if (key === this.loadedKey) return;
      this.loadedKey = key;
      untracked(() => this.load(0));
    });
    effect(() => {
      const s = this.crm();
      if (this.submitted !== null && !s.saving) {
        if (!s.saveError && this.note.trim() === this.submitted) this.note = '';
        this.submitted = null;
      }
    });
  }
  private loadedKey: string | null = null;
  load(page: number) {
    this.store.dispatch(A.loadHistory({ subject: this.subject(), id: this.id(), page }));
  }
  addNote() {
    const description = this.note.trim();
    if (!description || this.crm().saving || !this.canNote()) return;
    this.submitted = description;
    this.store.dispatch(
      A.addNote({ subject: this.subject() as 'CLIENT' | 'LEAD', id: this.id(), description }),
    );
  }
}
