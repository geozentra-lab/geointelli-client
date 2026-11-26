import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RequestStatus } from '../../shared/components/request-status';
import { formatLocalDate, formatLocalDateTime } from '../../shared/data/format';
import { EmailCadence, NotificationPreferencesDTO } from '../../core/models/api';
import { NotificationPreferencesActions as N } from '../../store/notification-preferences/notification-preferences.actions';
import { selectNotificationPreferences } from '../../store/notification-preferences/notification-preferences.selectors';

/** The event types this form knows, in the order shown. */
const EVENTS = [
  { type: 'NEW_MATCH', label: 'New matches', what: 'New properties for your alert rules’ saved searches.' },
  { type: 'CONTACT_REQUEST', label: 'Contact requests', what: 'People asking you about a property.' },
  { type: 'VALUATION_CHANGED', label: 'ZentraValue changes', what: 'On the properties and searches your alert rules follow.' },
] as const;
const KNOWN = EVENTS.map((e) => e.type) as string[];
const CADENCES: { value: EmailCadence; label: string }[] = [
  { value: 'IMMEDIATE', label: 'As it happens' },
  { value: 'DAILY', label: 'Daily digest' },
  { value: 'WEEKLY', label: 'Weekly digest' },
];

interface Delivery {
  events: Record<string, boolean>;
  inApp: boolean;
  email: boolean;
  cadence: EmailCadence;
}
const deliveryOf = (p: NotificationPreferencesDTO): Delivery => ({
  events: Object.fromEntries(KNOWN.map((t) => [t, p.enabledEventTypes.includes(t)])),
  inApp: p.inAppEnabled,
  email: p.emailEnabled,
  cadence: p.emailCadence,
});
const sameDelivery = (a: Delivery, b: Delivery) =>
  a.inApp === b.inApp &&
  a.email === b.email &&
  a.cadence === b.cadence &&
  KNOWN.every((t) => a.events[t] === b.events[t]);

/**
 * Settings, Notifications: what the account hears about and where (the bell, email and how often).
 * The PUT replaces the whole set, so event types this form doesn't know are sent back unchanged.
 */
@Component({
  selector: 'gz-notification-form',
  imports: [FormsModule, RequestStatus],
  styleUrl: './settings.css',
  template: `
    <section class="se" aria-labelledby="se-notify-title">
      <div class="se-head">
        <h2 id="se-notify-title">Notifications</h2>
        <p>What you hear about, and where.</p>
        @if (s().preferences?.updatedAt; as at) {
          <p class="se-meta">Changed {{ day(at) }}</p>
        }
      </div>
      <div class="se-body">
        @if (!s().preferences) {
          <gz-request-status
            [loading]="s().loading"
            loadingText="Loading your notification settings…"
            [error]="s().errorOperation === 'load' ? s().error : null"
            (retry)="load()"
          />
        } @else {
          @let p = s().preferences!;
          <form (ngSubmit)="save()" aria-labelledby="se-notify-title">
            <fieldset>
              <legend>Tell me about</legend>
              @for (e of events; track e.type) {
                <label class="se-choice">
                  <input type="checkbox" [name]="e.type" [ngModel]="form().events[e.type]" (ngModelChange)="setEvent(e.type, $event)" />
                  <span>{{ e.label }}</span>
                  <small>{{ e.what }}</small>
                </label>
              }
            </fieldset>
            <fieldset>
              <legend>Where</legend>
              <label class="se-choice">
                <input type="checkbox" name="inApp" [ngModel]="form().inApp" (ngModelChange)="patch({ inApp: $event })" />
                <span>In the notification bell</span>
              </label>
              <label class="se-choice">
                <input type="checkbox" name="email" [ngModel]="form().email" (ngModelChange)="patch({ email: $event })" />
                <span>By email</span>
                @if (p.emailAddress) {
                  <small>To {{ p.emailAddress }}</small>
                }
              </label>
              @if (form().email) {
                <div class="formfield se-cadence">
                  <label for="emailCadence">How often</label>
                  <select id="emailCadence" name="emailCadence" [ngModel]="form().cadence" (ngModelChange)="patch({ cadence: $event })">
                    @for (c of cadences; track c.value) {
                      <option [value]="c.value">{{ c.label }}</option>
                    }
                  </select>
                </div>
                @if (!p.emailDeliveryEnabled) {
                  <p class="se-note">Email isn’t switched on for this environment yet. Your choice is saved and takes effect when it is.</p>
                } @else if (p.emailEnabled && p.nextEmailAt) {
                  <p class="se-note">Next email: {{ dayTime(p.nextEmailAt) }}.</p>
                }
              }
            </fieldset>
            <div class="se-actions">
              <button class="btn primary" [attr.aria-disabled]="why() || s().saving ? 'true' : null"
                [attr.aria-describedby]="why() ? 'se-notify-why' : null">
                {{ s().saving ? 'Saving…' : 'Save notification settings' }}
              </button>
              @if (why(); as reason) {
                <p class="se-why" id="se-notify-why">{{ reason }}</p>
              }
            </div>
            @if (tried() && !s().saving && s().errorOperation === 'save' && s().error; as error) {
              <p class="field-error se-error" role="alert">The notification settings could not be saved: {{ error }}</p>
            }
          </form>
        }
      </div>
    </section>
  `,
  styles: `
    .se-cadence {
      max-width: 280px;
      margin-top: var(--sp-12);
    }
  `,
})
export class NotificationForm {
  readonly w = inject(Workspace);
  readonly s = this.w.store.selectSignal(selectNotificationPreferences);
  readonly events = EVENTS;
  readonly cadences = CADENCES;
  readonly form = signal<Delivery>({ events: {}, inApp: true, email: false, cadence: 'DAILY' });
  readonly tried = signal(false);
  private base: Delivery | null = null;

  constructor() {
    // Load once signed in, unless the settings are already here.
    effect(() => {
      if (!this.w.auth.isLoggedIn()) return;
      untracked(() => {
        if (!this.s().preferences && !this.s().loading) this.load();
      });
    });
    // Answered again (saved or reloaded): only what wasn't touched follows, so a change isn't lost.
    effect(() => {
      const p = this.s().preferences;
      if (!p) return;
      untracked(() => {
        const next = deliveryOf(p);
        const was = this.base;
        const cur = this.form();
        if (!was) this.form.set(next);
        else
          this.form.set({
            events: Object.fromEntries(KNOWN.map((t) => [t, cur.events[t] === was.events[t] ? next.events[t] : cur.events[t]])),
            inApp: cur.inApp === was.inApp ? next.inApp : cur.inApp,
            email: cur.email === was.email ? next.email : cur.email,
            cadence: cur.cadence === was.cadence ? next.cadence : cur.cadence,
          });
        this.base = next;
      });
    });
  }

  setEvent(type: string, on: boolean) {
    this.form.update((f) => ({ ...f, events: { ...f.events, [type]: on } }));
  }
  patch(change: Partial<Delivery>) {
    this.form.update((f) => ({ ...f, ...change }));
  }
  readonly why = computed(() => {
    const p = this.s().preferences;
    return p && sameDelivery(this.form(), deliveryOf(p)) ? 'Nothing has changed.' : null;
  });
  load() {
    this.w.store.dispatch(N.load());
  }
  save() {
    const p = this.s().preferences;
    if (!p || this.why() || this.s().saving || !this.w.requireAccount()) return;
    this.tried.set(true);
    const f = this.form();
    this.w.store.dispatch(
      N.save({
        request: {
          inAppEnabled: f.inApp,
          emailEnabled: f.email,
          enabledEventTypes: [
            ...KNOWN.filter((t) => f.events[t]),
            // The PUT replaces the whole set: event types this form doesn't know yet go back as they were.
            ...p.enabledEventTypes.filter((t) => !KNOWN.includes(t)),
          ],
          emailCadence: f.cadence,
        },
      }),
    );
  }
  day(v: string) {
    return formatLocalDate(v);
  }
  dayTime(v: string) {
    return formatLocalDateTime(v);
  }
}
