import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Workspace } from '../../shared/data/workspace';
import { RequestStatus } from '../../shared/components/request-status';
import { ContactRequestsActions as A } from '../../store/contact-requests/contact-requests.actions';
import { selectContactRequests } from '../../store/contact-requests/contact-requests.selectors';
import {
  CONTACT_CONSENT_VERSION,
  CONTACT_PHONE_PATTERN,
  PropertyContactRequest,
} from '../../core/models/contact';

/**
 * Lets a signed-in user ask a registered professional to contact them about this property.
 * The backend requires explicit, versioned consent to share the details below with that person.
 */
@Component({
  selector: 'gz-contact-professional',
  imports: [FormsModule, DatePipe, RequestStatus],
  template: `<section class="panel section" aria-labelledby="contact-title">
    <h3 id="contact-title">Talk to a professional about this property</h3>
    @if (!w.auth.isLoggedIn()) {
      <p class="sub spacer">
        Sign in to ask a registered real-estate professional to contact you about this property.
      </p>
      <button type="button" class="btn primary spacer" (click)="w.signIn()">Sign in</button>
    } @else if (sent(); as r) {
      <div class="insight section" role="status">
        <strong>Request sent {{ r.submittedAt | date: 'medium' }}.</strong>
        {{ professionalName(r.professionalUserId) }} can now see your details and message and will
        contact you by
        {{
          r.contactEmail && r.contactPhone ? 'email or phone' : r.contactEmail ? 'email' : 'phone'
        }}.
      </div>
      <button type="button" class="btn spacer" (click)="startOver()">Contact someone else</button>
    } @else {
      <gz-request-status
        [loading]="state().professionalsLoading"
        loadingText="Loading professionals…"
        [error]="state().professionalsError"
        (retry)="loadProfessionals()"
      />
      @if (state().professionalsLoaded && !choices().length) {
        <p class="sub spacer">
          No registered professionals are available yet. Check back later, or save this property to
          come back to it.
        </p>
      } @else if (state().professionalsLoaded) {
        <form #f="ngForm" (ngSubmit)="f.valid && hasContact() && submit()" novalidate>
          <fieldset class="formgrid section" [disabled]="state().submitting">
            <div class="formfield full">
              <label for="contactPro">Professional</label
              ><select
                id="contactPro"
                name="professional"
                [(ngModel)]="draft.professionalUserId"
                required
              >
                <option [ngValue]="null" disabled>Choose a professional</option>
                @for (p of choices(); track p.id) {
                  <option [ngValue]="p.id">{{ p.name }}</option>
                }
              </select>
              <p class="smalltext muted">
                Registered accounts. Being listed does not verify a licence or mean they represent
                this property.
              </p>
            </div>
            <div class="formfield">
              <label for="contactName">Your name</label
              ><input
                id="contactName"
                name="contactName"
                [(ngModel)]="draft.contactName"
                maxlength="120"
                autocomplete="name"
                required
                #name="ngModel"
              />
              @if (name.invalid && (name.touched || f.submitted)) {
                <p class="field-error" role="alert">Enter your name.</p>
              }
            </div>
            <div class="formfield">
              <label for="contactEmail">Email</label
              ><input
                id="contactEmail"
                name="contactEmail"
                type="email"
                [(ngModel)]="draft.contactEmail"
                maxlength="254"
                autocomplete="email"
                email
                #email="ngModel"
              />
              @if (email.invalid && (email.touched || f.submitted)) {
                <p class="field-error" role="alert">Enter a valid email address.</p>
              }
            </div>
            <div class="formfield">
              <label for="contactPhone">Phone</label
              ><input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                [(ngModel)]="draft.contactPhone"
                maxlength="40"
                autocomplete="tel"
                [pattern]="phonePattern"
                #phone="ngModel"
              />
              @if (phone.invalid && (phone.touched || f.submitted)) {
                <p class="field-error" role="alert">Use digits, spaces and + ( ) . - only.</p>
              }
            </div>
            @if (f.submitted && !hasContact()) {
              <p class="field-error full" role="alert">Add an email address or a phone number.</p>
            }
            <div class="formfield full">
              <label for="contactMessage">Message (optional)</label
              ><textarea
                class="field"
                id="contactMessage"
                name="message"
                rows="3"
                maxlength="2000"
                [(ngModel)]="draft.message"
                placeholder="What would you like to know?"
              ></textarea>
            </div>
            <label class="checkbox full"
              ><input type="checkbox" name="consent" [(ngModel)]="draft.consent" required />
              <span
                >I agree to share my name, the contact details above and my message with
                {{ selectedName() || 'the selected professional' }} so they can contact me about
                this property. This is not consent to marketing.</span
              ></label
            >
          </fieldset>
          <gz-request-status [error]="state().submitError" (retry)="submit()" />
          <button
            class="btn primary spacer"
            [disabled]="state().submitting || !draft.consent || !draft.professionalUserId"
          >
            {{ state().submitting ? 'Sending…' : 'Send request' }}
          </button>
        </form>
      }
    }
  </section>`,
  styles: `
    .full {
      grid-column: 1/-1;
    }
  `,
})
export class ContactProfessional {
  w = inject(Workspace);
  propertyId = input.required<number>();
  state = this.w.store.selectSignal(selectContactRequests);
  readonly phonePattern = CONTACT_PHONE_PATTERN;
  draft = {
    professionalUserId: null as number | null,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    message: '',
    consent: false,
  };
  /** A retried identical submission reuses its key so the server never creates a second lead. */
  private key = crypto.randomUUID();
  private keyBody = '';
  /** ID of a confirmation the user closed with "Contact someone else". */
  private dismissedId = signal<number | null>(null);
  /** You cannot ask yourself; hide your own account if you are a registered professional. */
  choices = computed(() =>
    this.state().professionals.filter((p) => p.id !== this.w.account().profile?.id),
  );
  sent = computed(() => {
    const r = this.state().sent[this.propertyId()];
    return r && r.id !== this.dismissedId() ? r : null;
  });
  constructor() {
    effect(() => {
      if (this.w.auth.isLoggedIn() && this.w.account().profile)
        untracked(() => {
          if (!this.state().professionalsLoaded && !this.state().professionalsLoading)
            this.loadProfessionals();
        });
    });
    // Prefill from the profile once it is available, without overwriting what the user typed.
    effect(() => {
      const p = this.w.account().profile;
      if (!p) return;
      untracked(() => {
        if (!this.draft.contactName)
          this.draft.contactName = [p.firstName, p.lastName].filter(Boolean).join(' ');
        if (!this.draft.contactEmail) this.draft.contactEmail = p.email ?? '';
      });
    });
  }
  loadProfessionals() {
    this.w.store.dispatch(A.loadProfessionals());
  }
  hasContact() {
    return !!(this.draft.contactEmail.trim() || this.draft.contactPhone.trim());
  }
  selectedName() {
    return this.choices().find((p) => p.id === this.draft.professionalUserId)?.name ?? '';
  }
  professionalName(id: number) {
    return this.state().professionals.find((p) => p.id === id)?.name ?? 'The professional';
  }
  submit() {
    const d = this.draft;
    if (this.state().submitting || !this.w.requireAccount('contact a professional')) return;
    if (!d.professionalUserId || !d.consent || !d.contactName.trim() || !this.hasContact()) return;
    const request: PropertyContactRequest = {
      propertyId: this.propertyId(),
      professionalUserId: d.professionalUserId,
      contactName: d.contactName.trim(),
      ...(d.contactEmail.trim() ? { contactEmail: d.contactEmail.trim() } : {}),
      ...(d.contactPhone.trim() ? { contactPhone: d.contactPhone.trim() } : {}),
      ...(d.message.trim() ? { message: d.message.trim() } : {}),
      consent: true,
      consentVersion: CONTACT_CONSENT_VERSION,
    };
    // The server rejects a reused key with different input (409); edits get a fresh key.
    const body = JSON.stringify(request);
    if (body !== this.keyBody) {
      this.key = crypto.randomUUID();
      this.keyBody = body;
    }
    this.w.store.dispatch(A.submit({ request, idempotencyKey: this.key }));
  }
  startOver() {
    this.dismissedId.set(this.sent()?.id ?? null);
    this.draft = { ...this.draft, professionalUserId: null, message: '', consent: false };
    this.keyBody = '';
  }
}
