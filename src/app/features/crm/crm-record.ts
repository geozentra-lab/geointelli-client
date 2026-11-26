import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { PropertyRef } from '../../shared/components/property-ref';
import { formatLocalDate, formatLocalDateTime, formatRecordDate } from '../../shared/data/format';
import {
  CrmClientDTO,
  CrmClientUpdateRequest,
  CrmLeadDTO,
  CrmTaskDTO,
  CrmTransactionDTO,
  crmLabel,
} from '../../core/models/crm';
import { CrmActions as A } from '../../store/crm/crm.actions';
import { selectCrm, selectCrmClientNames } from '../../store/crm/crm.selectors';
import { CrmHistory } from './crm-history';
import { sourceWord } from './crm-words';

/**
 * The CRM records in the record pane (DESIGN.md §5 Register): what the record holds as ruled rows,
 * then its history (with notes, for clients and leads). The pane's header holds the record's
 * stage actions and Delete; a client's details are changed here, in one form.
 */

/** Shared look of the CRM record bodies. */
const STYLES = `
  :host {
    display: block;
  }
  gz-record-section + gz-record-section {
    margin-top: var(--sp-16);
  }
  .cr-text {
    margin: var(--sp-8) 0 0;
    font-size: var(--fs-cell);
    line-height: var(--lh-cell);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .cr-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-12) var(--sp-16);
    margin-top: var(--sp-8);
  }
  .cr-wide {
    grid-column: 1 / -1;
  }
  .cr-actions {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-8) var(--sp-12);
  }
  .cr-why {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: var(--lh-caption);
    color: var(--ink-2);
  }
`;

/** A client's name from the CRM's own list, or why it isn't shown (never an id in prose). */
function useNames() {
  const w = inject(Workspace);
  const names = w.store.selectSignal(selectCrmClientNames);
  return (id: number | null) =>
    id === null ? null : (names()[id] ?? 'Unavailable (not among your 100 newest clients)');
}

@Component({
  selector: 'gz-crm-client-record',
  imports: [FormsModule, CrmHistory, ...RECORD_KIT],
  styles: STYLES,
  template: `
    @let c = client();
    <gz-record-section heading="Details">
      <form class="cr-form" (ngSubmit)="save()" aria-label="Change this client">
        <div class="formfield cr-wide">
          <label for="cc-name">Name</label>
          <input id="cc-name" name="name" maxlength="120" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        </div>
        <div class="formfield">
          <label for="cc-email">Email</label>
          <input id="cc-email" name="email" type="email" maxlength="254" [ngModel]="email()" (ngModelChange)="email.set($event)" />
        </div>
        <div class="formfield">
          <label for="cc-phone">Phone</label>
          <input id="cc-phone" name="phone" type="tel" maxlength="40" [ngModel]="phone()" (ngModelChange)="phone.set($event)" />
        </div>
        <div class="formfield cr-wide">
          <label for="cc-notes">Notes</label>
          <textarea id="cc-notes" name="notes" rows="3" maxlength="2000" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
        </div>
        <div class="cr-actions">
          <button class="btn" [attr.aria-disabled]="why() || saving() ? 'true' : null" [attr.aria-describedby]="why() ? 'cc-why' : null">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
          @if (why(); as reason) {
            <p class="cr-why" id="cc-why">{{ reason }}</p>
          }
        </div>
        @if (tried() && !saving() && crm().saveError; as error) {
          <p class="field-error cr-wide" role="alert">{{ error }}</p>
        }
      </form>
      <gz-record-group>
        <div gz-record-row label="Added">{{ day(c.createdAt) }}</div>
        <div gz-record-row label="Changed">{{ day(c.updatedAt) }}</div>
      </gz-record-group>
    </gz-record-section>
    <gz-record-section heading="Notes and history">
      <gz-crm-history subject="CLIENT" [id]="c.id" />
    </gz-record-section>
  `,
})
export class CrmClientRecord {
  readonly client = input.required<CrmClientDTO>();
  private readonly w = inject(Workspace);
  readonly crm = this.w.store.selectSignal(selectCrm);
  readonly saving = computed(() => this.crm().saving > 0);
  /** Save changes was pressed for this client, so a failed save is this form's. */
  readonly tried = signal(false);
  readonly name = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly notes = signal('');
  private base: CrmClientDTO | null = null;

  constructor() {
    // Another client: every field. The same client answered again: only the untouched fields.
    effect(() => {
      const c = this.client();
      untracked(() => {
        const was = this.base;
        const keep = was?.id === c.id;
        if (!keep || this.name() === was.name) this.name.set(c.name);
        if (!keep || this.email() === (was.email ?? '')) this.email.set(c.email ?? '');
        if (!keep || this.phone() === (was.phone ?? '')) this.phone.set(c.phone ?? '');
        if (!keep || this.notes() === (was.notes ?? '')) this.notes.set(c.notes ?? '');
        if (!keep) this.tried.set(false);
        this.base = c;
      });
    });
  }

  /** What changed; an emptied optional field is cleared with null (PATCH). */
  private readonly changes = computed<CrmClientUpdateRequest>(() => {
    const c = this.client();
    const out: CrmClientUpdateRequest = {};
    if (this.name().trim() !== c.name) out.name = this.name().trim();
    for (const [key, value] of [['email', this.email()], ['phone', this.phone()], ['notes', this.notes()]] as const) {
      const v = value.trim() || null;
      if (v !== (c[key] ?? null)) out[key] = v;
    }
    return out;
  });
  readonly why = computed(() => {
    if (!this.name().trim()) return 'Enter a name.';
    if (!this.email().trim() && !this.phone().trim()) return 'Add an email address or a phone number.';
    if (this.email().trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())) return 'Check the email address.';
    if (this.phone().trim() && !/^\+?[0-9][0-9 ().-]{5,38}$/.test(this.phone().trim())) return 'Check the phone number.';
    return Object.keys(this.changes()).length ? null : 'Nothing has changed.';
  });
  save() {
    if (this.why() || this.saving() || !this.w.requireAccount('update clients')) return;
    this.tried.set(true);
    this.w.store.dispatch(A.updateClient({ id: this.client().id, request: this.changes() }));
  }
  day(v: string | null) {
    return formatLocalDate(v);
  }
}

@Component({
  selector: 'gz-crm-lead-record',
  imports: [CrmHistory, PropertyRef, ...RECORD_KIT],
  styles: STYLES,
  template: `
    @let l = lead();
    <gz-record-section heading="Details">
      <gz-record-group>
        <div gz-record-row label="Stage">{{ label(l.stage) }}</div>
        <div gz-record-row label="Client">{{ clientName(l.clientId) }}</div>
        <div gz-record-row label="Source">{{ source(l.source) }}</div>
        @if (l.propertyId) {
          <div gz-record-row label="Property"><gz-property-ref [propertyId]="l.propertyId" /></div>
        }
        <div gz-record-row label="Captured">{{ day(l.createdAt) }}</div>
        <div gz-record-row label="Changed">{{ day(l.updatedAt) }}</div>
      </gz-record-group>
      @if (l.notes) {
        <p class="cr-text">{{ l.notes }}</p>
      }
    </gz-record-section>
    <gz-record-section heading="Notes and history">
      <gz-crm-history subject="LEAD" [id]="l.id" />
    </gz-record-section>
  `,
})
export class CrmLeadRecord {
  readonly lead = input.required<CrmLeadDTO>();
  readonly clientName = useNames();
  readonly source = sourceWord;
  readonly label = crmLabel;
  day(v: string | null) {
    return formatLocalDate(v);
  }
}

@Component({
  selector: 'gz-crm-task-record',
  imports: [CrmHistory, PropertyRef, ...RECORD_KIT],
  styles: STYLES,
  template: `
    @let t = task();
    <gz-record-section heading="Details">
      <gz-record-group>
        <div gz-record-row label="Status">{{ label(t.status) }}</div>
        <div gz-record-row label="Due">
          @if (t.dueAt) {
            {{ when(t.dueAt) }}
            @if (t.overdue) {
              <span class="attention">· Overdue</span>
            }
          } @else {
            No due date
          }
        </div>
        @if (t.completedAt) {
          <div gz-record-row label="Done">{{ when(t.completedAt) }}</div>
        }
        @if (t.clientId) {
          <div gz-record-row label="Client">{{ clientName(t.clientId) }}</div>
        }
        @if (t.leadId) {
          <div gz-record-row label="Lead">{{ leadTitle(t.leadId) }}</div>
        }
        @if (t.transactionId) {
          <div gz-record-row label="Deal">{{ dealTitle(t.transactionId) }}</div>
        }
        @if (t.propertyId) {
          <div gz-record-row label="Property"><gz-property-ref [propertyId]="t.propertyId" /></div>
        }
        <div gz-record-row label="Created">{{ day(t.createdAt) }}</div>
      </gz-record-group>
      @if (t.description) {
        <p class="cr-text">{{ t.description }}</p>
      }
    </gz-record-section>
    <gz-record-section heading="History">
      <gz-crm-history subject="TASK" [id]="t.id" />
    </gz-record-section>
  `,
})
export class CrmTaskRecord {
  readonly task = input.required<CrmTaskDTO>();
  private readonly crm = inject(Workspace).store.selectSignal(selectCrm);
  readonly clientName = useNames();
  readonly label = crmLabel;
  leadTitle(id: number) {
    return this.crm().options.leads.find((l) => l.id === id)?.title ?? 'Unavailable (not among your 100 newest leads)';
  }
  dealTitle(id: number) {
    return this.crm().options.deals.find((d) => d.id === id)?.title ?? 'Unavailable (not among your 100 newest deals)';
  }
  day(v: string | null) {
    return formatLocalDate(v);
  }
  when(v: string) {
    return when(v);
  }
}

@Component({
  selector: 'gz-crm-deal-record',
  imports: [CrmHistory, PropertyRef, ...RECORD_KIT],
  styles: STYLES,
  template: `
    @let d = deal();
    <gz-record-section heading="Details">
      <gz-record-group>
        <div gz-record-row label="Stage">{{ label(d.stage) }}</div>
        <div gz-record-row label="Client">{{ clientName(d.clientId) }}</div>
        @if (d.leadId) {
          <div gz-record-row label="Lead">{{ leadTitle(d.leadId) }}</div>
        }
        <div gz-record-row label="Property"><gz-property-ref [propertyId]="d.propertyId" /></div>
        @if (d.closedAt) {
          <div gz-record-row label="Closed">{{ day(d.closedAt) }}</div>
        } @else {
          <div gz-record-row label="Expected to close">{{ d.expectedCloseDate ? calendar(d.expectedCloseDate) : 'Not set' }}</div>
        }
        <div gz-record-row label="Created">{{ day(d.createdAt) }}</div>
      </gz-record-group>
      @if (d.description) {
        <p class="cr-text">{{ d.description }}</p>
      }
      <p class="cr-why">Moving a deal only updates your pipeline; no property or payment is transferred.</p>
    </gz-record-section>
    <gz-record-section heading="History">
      <gz-crm-history subject="TRANSACTION" [id]="d.id" />
    </gz-record-section>
  `,
})
export class CrmDealRecord {
  readonly deal = input.required<CrmTransactionDTO>();
  private readonly crm = inject(Workspace).store.selectSignal(selectCrm);
  readonly clientName = useNames();
  readonly label = crmLabel;
  leadTitle(id: number) {
    return this.crm().options.leads.find((l) => l.id === id)?.title ?? 'Unavailable (not among your 100 newest leads)';
  }
  day(v: string | null) {
    return formatLocalDate(v);
  }
  calendar(v: string) {
    return formatRecordDate(v);
  }
}

/** "Nov 18, 9:00 PM" on the viewer's own day (the shared helper since item 9). */
export const when = (v: string | null | undefined): string | null => formatLocalDateTime(v);
