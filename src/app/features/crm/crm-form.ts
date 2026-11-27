import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { PropertyPicker } from '../../shared/components/property-picker';
import { CrmActions as A } from '../../store/crm/crm.actions';
import { selectCrm } from '../../store/crm/crm.selectors';
import { CrmKind } from './crm-words';

const SOURCES = ['Website', 'Referral', 'Phone call', 'Email', 'Open house', 'Social media'];
const text = (v: string) => v.trim() || undefined;
interface Fields {
  name: string;
  email: string;
  phone: string;
  title: string;
  source: string;
  notes: string;
  dueAt: string;
  expectedCloseDate: string;
  clientId: number | null;
  leadId: number | null;
  transactionId: number | null;
  propertyId: number | null;
}
const id = (v: number | null) => (v && v > 0 ? v : undefined);

/**
 * New client, lead, task or deal, in the record pane (DESIGN.md §5: "New …" forms open in the
 * pane, never above the list). The create button is aria-disabled with the reason beside it until
 * the record can be sent; once saved, the page closes the pane (the list reloads with it).
 */
@Component({
  selector: 'gz-crm-form',
  imports: [FormsModule, PropertyPicker, ...RECORD_KIT],
  template: `
    <gz-record-section>
      <form class="cf" (ngSubmit)="create()">
        @if (crm().options.failed && kind() !== 'clients') {
          <p class="cf-hint cf-wide" role="alert">
            Your clients, leads and deals could not all be loaded, so the lists below may be missing some.
            <button type="button" class="linkbtn" (click)="retryOptions()">Retry</button>
          </p>
        }
        @switch (kind()) {
          @case ('clients') {
            <div class="formfield cf-wide">
              <label for="cf-name">Name</label>
              <input id="cf-name" name="name" maxlength="120" [ngModel]="f().name" (ngModelChange)="set('name', $event)" />
            </div>
            <div class="formfield">
              <label for="cf-email">Email</label>
              <input id="cf-email" name="email" type="email" maxlength="254" [ngModel]="f().email" (ngModelChange)="set('email', $event)" />
            </div>
            <div class="formfield">
              <label for="cf-phone">Phone</label>
              <input id="cf-phone" name="phone" type="tel" maxlength="40" [ngModel]="f().phone" (ngModelChange)="set('phone', $event)" />
            </div>
            <p class="cf-hint cf-wide">An email address or a phone number is needed.</p>
          }
          @case ('leads') {
            @if (noClients()) {
              <p class="cf-hint cf-wide">Leads belong to a client: add a client first.</p>
            }
            <div class="formfield cf-wide">
              <label for="cf-title">Title</label>
              <input id="cf-title" name="title" maxlength="160" placeholder="Looking for a 3-bed in Coral Gables"
                [ngModel]="f().title" (ngModelChange)="set('title', $event)" />
            </div>
            <div class="formfield">
              <label for="cf-client">Client</label>
              <select id="cf-client" name="clientId" [ngModel]="f().clientId" (ngModelChange)="set('clientId', $event)">
                <option [ngValue]="null">Choose a client</option>
                @for (c of crm().options.clients; track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <div class="formfield">
              <label for="cf-source">Source</label>
              <input id="cf-source" name="source" list="cf-sources" maxlength="80" [ngModel]="f().source" (ngModelChange)="set('source', $event)" />
              <datalist id="cf-sources">
                @for (s of sources; track s) {
                  <option [value]="s"></option>
                }
              </datalist>
            </div>
            <gz-property-picker class="cf-wide" label="Property (optional)" [propertyId]="f().propertyId" (selected)="set('propertyId', $event)" />
          }
          @case ('tasks') {
            <div class="formfield cf-wide">
              <label for="cf-title">Title</label>
              <input id="cf-title" name="title" maxlength="160" [ngModel]="f().title" (ngModelChange)="set('title', $event)" />
            </div>
            <div class="formfield">
              <label for="cf-due">Due (optional)</label>
              <input id="cf-due" name="dueAt" type="datetime-local" [ngModel]="f().dueAt" (ngModelChange)="set('dueAt', $event)" />
            </div>
            <div class="formfield">
              <label for="cf-client">Client (optional)</label>
              <select id="cf-client" name="clientId" [ngModel]="f().clientId" (ngModelChange)="set('clientId', $event)">
                <option [ngValue]="null">None</option>
                @for (c of crm().options.clients; track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <div class="formfield">
              <label for="cf-lead">Lead (optional)</label>
              <select id="cf-lead" name="leadId" [ngModel]="f().leadId" (ngModelChange)="set('leadId', $event)">
                <option [ngValue]="null">None</option>
                @for (l of crm().options.leads; track l.id) {
                  <option [ngValue]="l.id">{{ l.title }}</option>
                }
              </select>
            </div>
            <div class="formfield">
              <label for="cf-deal">Deal (optional)</label>
              <select id="cf-deal" name="transactionId" [ngModel]="f().transactionId" (ngModelChange)="set('transactionId', $event)">
                <option [ngValue]="null">None</option>
                @for (d of crm().options.deals; track d.id) {
                  <option [ngValue]="d.id">{{ d.title }}</option>
                }
              </select>
            </div>
            <gz-property-picker class="cf-wide" label="Property (optional)" [propertyId]="f().propertyId" (selected)="set('propertyId', $event)" />
            <p class="cf-hint cf-wide">A linked lead or deal fills in its client and property. Links can't be changed later.</p>
          }
          @case ('deals') {
            @if (noClients()) {
              <p class="cf-hint cf-wide">Deals belong to a client: add a client first.</p>
            }
            <div class="formfield cf-wide">
              <label for="cf-title">Title</label>
              <input id="cf-title" name="title" maxlength="160" [ngModel]="f().title" (ngModelChange)="set('title', $event)" />
            </div>
            <div class="formfield">
              <label for="cf-client">Client</label>
              <select id="cf-client" name="clientId" [ngModel]="f().clientId" (ngModelChange)="set('clientId', $event); set('leadId', null)">
                <option [ngValue]="null">Choose a client</option>
                @for (c of crm().options.clients; track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <div class="formfield">
              <label for="cf-lead">Lead (optional)</label>
              <select id="cf-lead" name="leadId" [ngModel]="f().leadId" (ngModelChange)="set('leadId', $event)">
                <option [ngValue]="null">{{ f().clientId ? 'None' : 'Choose a client first' }}</option>
                @for (l of clientLeads(); track l.id) {
                  <option [ngValue]="l.id">{{ l.title }}</option>
                }
              </select>
            </div>
            <gz-property-picker class="cf-wide" label="Property" [propertyId]="f().propertyId" (selected)="set('propertyId', $event)" />
            <div class="formfield">
              <label for="cf-close">Expected close (optional)</label>
              <input id="cf-close" name="expectedCloseDate" type="date" min="1900-01-01" max="2199-12-31"
                [ngModel]="f().expectedCloseDate" (ngModelChange)="set('expectedCloseDate', $event)" />
            </div>
          }
        }
        <div class="formfield cf-wide">
          <label for="cf-notes">{{ kind() === 'tasks' || kind() === 'deals' ? 'Description' : 'Notes' }} (optional)</label>
          <textarea id="cf-notes" name="notes" rows="3" maxlength="2000" [ngModel]="f().notes" (ngModelChange)="set('notes', $event)"></textarea>
        </div>
        <div class="cf-actions cf-wide">
          <button class="btn primary" [attr.aria-disabled]="why() || saving() ? 'true' : null" [attr.aria-describedby]="why() ? 'cf-why' : null">
            {{ saving() ? 'Saving…' : 'Create ' + noun() }}
          </button>
          @if (why(); as reason) {
            <p class="cf-why" id="cf-why">{{ reason }}</p>
          }
        </div>
        @if (tried() && crm().saveError; as error) {
          <p class="field-error cf-wide" role="alert">{{ error }}</p>
        }
      </form>
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
    }
    .cf {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-12) var(--sp-16);
    }
    .cf-wide {
      grid-column: 1 / -1;
    }
    .cf-hint,
    .cf-why {
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .cf-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
      margin-top: var(--sp-4);
    }
  `,
})
export class CrmForm {
  readonly kind = input.required<CrmKind>();
  /** Saved without an error: the page closes the pane. */
  readonly done = output<void>();
  private readonly w = inject(Workspace);
  readonly crm = this.w.store.selectSignal(selectCrm);
  readonly sources = SOURCES;
  readonly saving = computed(() => this.crm().saving > 0);
  readonly tried = signal(false);
  /** Retried submissions of the same lead reuse this key, so the server never duplicates it. */
  /** The server refuses a reused key with different input (409): an edited lead gets a fresh key. */
  private leadKey = crypto.randomUUID();
  private leadKeyBody = '';
  private submitted = false;

  readonly f = signal<Fields>({
    name: '',
    email: '',
    phone: '',
    title: '',
    source: '',
    notes: '',
    dueAt: '',
    expectedCloseDate: '',
    clientId: null as number | null,
    leadId: null as number | null,
    transactionId: null as number | null,
    propertyId: null as number | null,
  });
  set(key: keyof Fields, value: unknown) {
    this.f.update((f) => ({ ...f, [key]: value ?? (typeof f[key] === 'string' ? '' : null) }));
  }

  readonly noun = computed(() => ({ clients: 'client', leads: 'lead', tasks: 'task', deals: 'deal' })[this.kind()]);
  /** No client yet, as far as the list says: not when the list could not be read. */
  readonly noClients = computed(
    () => this.crm().options.loaded && !this.crm().options.failed && !this.crm().options.clients.length,
  );
  retryOptions() {
    this.w.store.dispatch(A.loadOptions());
  }
  readonly clientLeads = computed(() => this.crm().options.leads.filter((l) => l.clientId === this.f().clientId));

  constructor() {
    effect(() => {
      const s = this.crm();
      if (!this.submitted || s.saving) return;
      this.submitted = false;
      if (!s.saveError) this.done.emit();
    });
  }

  /** Why Create can't run yet, written next to it (DESIGN.md §12); null when it can. */
  readonly why = computed(() => {
    const f = this.f();
    switch (this.kind()) {
      case 'clients':
        if (!f.name.trim()) return 'Enter a name.';
        if (!f.email.trim() && !f.phone.trim()) return 'Add an email address or a phone number.';
        if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Check the email address.';
        if (f.phone.trim() && !/^\+?[0-9][0-9 ().-]{5,38}$/.test(f.phone.trim())) return 'Check the phone number.';
        return null;
      case 'leads':
        if (!f.title.trim()) return 'Enter a title.';
        if (!f.clientId) return 'Choose a client.';
        if (!f.source.trim()) return 'Enter where the lead came from.';
        return null;
      case 'tasks':
        if (!f.title.trim()) return 'Enter a title.';
        if (f.dueAt && Number.isNaN(new Date(f.dueAt).getTime())) return 'Check the due date.';
        return null;
      case 'deals':
        if (!f.title.trim()) return 'Enter a title.';
        if (!f.clientId) return 'Choose a client.';
        if (!id(f.propertyId)) return 'Choose the property.';
        return null;
    }
  });

  create() {
    if (this.why() || this.saving() || !this.w.requireAccount('add to your CRM')) return;
    const f = this.f();
    this.submitted = true;
    this.tried.set(true);
    switch (this.kind()) {
      case 'clients':
        this.w.store.dispatch(A.createClient({ request: { name: f.name.trim(), email: text(f.email), phone: text(f.phone), notes: text(f.notes) } }));
        return;
      case 'leads': {
        const request = { clientId: f.clientId!, propertyId: id(f.propertyId), title: f.title.trim(), source: f.source.trim(), notes: text(f.notes) };
        const body = JSON.stringify(request);
        if (this.leadKeyBody && body !== this.leadKeyBody) this.leadKey = crypto.randomUUID();
        this.leadKeyBody = body;
        this.w.store.dispatch(A.createLead({ request, idempotencyKey: this.leadKey }));
        return;
      }
      case 'tasks':
        this.w.store.dispatch(
          A.createTask({
            request: {
              title: f.title.trim(),
              description: text(f.notes),
              dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : undefined,
              clientId: id(f.clientId),
              leadId: id(f.leadId),
              propertyId: id(f.propertyId),
              transactionId: id(f.transactionId),
            },
          }),
        );
        return;
      case 'deals':
        this.w.store.dispatch(
          A.createDeal({
            request: {
              title: f.title.trim(),
              description: text(f.notes),
              clientId: f.clientId!,
              leadId: id(f.leadId),
              propertyId: f.propertyId!,
              expectedCloseDate: f.expectedCloseDate || undefined,
            },
          }),
        );
        return;
    }
  }
}
