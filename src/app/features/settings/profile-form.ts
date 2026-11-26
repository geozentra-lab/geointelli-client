import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { RECORD_KIT } from '../../shared/components/record';
import { UserDTO, UserProfileUpdate } from '../../core/models/api';
import { UserActions as A } from '../../store/user/user.actions';

/**
 * Settings, Profile: the name, in a form that sends only what changed and says why it can't run.
 * The account type has its own section (an administrator approves it). The email comes from the sign-in account and is shown, not
 * edited.
 */
@Component({
  selector: 'gz-profile-form',
  imports: [FormsModule, ...RECORD_KIT],
  styleUrl: './settings.css',
  template: `
    @let p = profile();
    <section class="se" aria-labelledby="se-profile-title">
      <div class="se-head">
        <h2 id="se-profile-title">Profile</h2>
        <p>Your name as GeoZentra shows it.</p>
      </div>
      <form class="se-body" (ngSubmit)="save()" aria-labelledby="se-profile-title">
        <fieldset>
          <legend>Name</legend>
          <div class="se-fields">
            <div class="formfield">
              <label for="firstName">First name</label>
              <input id="firstName" name="firstName" maxlength="100" autocomplete="given-name"
                [ngModel]="firstName()" (ngModelChange)="firstName.set($event)" />
            </div>
            <div class="formfield">
              <label for="lastName">Last name</label>
              <input id="lastName" name="lastName" maxlength="100" autocomplete="family-name"
                [ngModel]="lastName()" (ngModelChange)="lastName.set($event)" />
            </div>
          </div>
        </fieldset>
        <div class="se-block">
          <gz-record-group>
            <div gz-record-row label="Email" [missing]="!p.email" reason="Not on your sign-in account" [showReason]="true">{{ p.email }}</div>
          </gz-record-group>
          <p class="se-hint">From your sign-in account; it is changed there.</p>
        </div>
        <div class="se-actions">
          <button class="btn primary" [attr.aria-disabled]="why() || saving() ? 'true' : null"
            [attr.aria-describedby]="why() ? 'se-profile-why' : null">
            {{ saving() ? 'Saving…' : 'Save profile' }}
          </button>
          @if (why(); as reason) {
            <p class="se-why" id="se-profile-why">{{ reason }}</p>
          }
        </div>
        @if (tried() && !saving() && w.account().profileError; as error) {
          <p class="field-error se-error" role="alert">The profile could not be saved: {{ error }}</p>
        }
      </form>
    </section>
  `,
})
export class ProfileForm {
  readonly w = inject(Workspace);
  /** The settings page shows this form only once the profile has loaded. */
  readonly profile = computed(() => this.w.account().profile as UserDTO);
  readonly saving = computed(() => this.w.account().savingProfile);
  readonly firstName = signal('');
  readonly lastName = signal('');
  /** Save profile was pressed, so a failed save is this form's to show. */
  readonly tried = signal(false);
  private base: UserDTO | null = null;

  constructor() {
    // The profile answered again (saved, reloaded, or a license submitted): only untouched fields
    // follow it, so typing isn't lost.
    effect(() => {
      const p = this.w.account().profile;
      if (!p) return;
      untracked(() => {
        const was = this.base;
        if (!was || this.firstName() === (was.firstName ?? '')) this.firstName.set(p.firstName ?? '');
        if (!was || this.lastName() === (was.lastName ?? '')) this.lastName.set(p.lastName ?? '');
        this.base = p;
      });
    });
  }

  /** What changed. A name is changed, never removed (the profile update has no way to clear it). */
  private readonly changes = computed<UserProfileUpdate>(() => {
    const p = this.profile();
    const out: UserProfileUpdate = {};
    const first = this.firstName().trim();
    const last = this.lastName().trim();
    if (first && first !== (p.firstName ?? '')) out.firstName = first;
    if (last && last !== (p.lastName ?? '')) out.lastName = last;
    return out;
  });
  readonly why = computed(() => {
    const p = this.profile();
    if ((p.firstName && !this.firstName().trim()) || (p.lastName && !this.lastName().trim()))
      return 'A name can be changed here, not removed.';
    return Object.keys(this.changes()).length ? null : 'Nothing has changed.';
  });
  save() {
    if (this.why() || this.saving() || !this.w.requireAccount()) return;
    this.tried.set(true);
    this.w.store.dispatch(A.saveProfile({ request: this.changes() }));
  }
}
