import { Component, OnInit, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { CountyPicker } from '../../shared/components/county-picker';
import { RealtorLicense } from './realtor-license';
import { UserActions as A } from '../../store/user/user.actions';
import { UserPreferencesDTO, BackendPersona, UserDTO } from '../../core/models/api';
import { selectLocations } from '../../store/locations/locations.selectors';
import { DatePipe } from '@angular/common';
import { NotificationPreferencesActions as N } from '../../store/notification-preferences/notification-preferences.actions';
import { selectNotificationPreferences } from '../../store/notification-preferences/notification-preferences.selectors';
import { EmailCadence, NotificationPreferencesDTO } from '../../core/models/api';
const KNOWN_EVENTS = ['NEW_MATCH', 'CONTACT_REQUEST', 'VALUATION_CHANGED'];
@Component({
  imports: [FormsModule, DatePipe, PageHeading, RequestStatus, CountyPicker, RealtorLicense],
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  w = inject(Workspace);
  locations = this.w.store.selectSignal(selectLocations);
  firstName = '';
  lastName = '';
  persona: BackendPersona = 'USER';
  preferences: UserPreferencesDTO = {
    minBudget: null,
    maxBudget: null,
    targetLocations: [],
    investmentGoals: [],
  };
  goals = '';
  notify = this.w.store.selectSignal(selectNotificationPreferences);
  delivery = {
    inAppEnabled: true,
    emailEnabled: false,
    newMatch: true,
    contactRequest: true,
    valuationChanged: true,
    otherEvents: [] as string[],
    emailCadence: 'DAILY' as EmailCadence,
  };
  private seenDelivery: NotificationPreferencesDTO | null = null;
  private seenProfile: UserDTO | null = null;
  private seenPreferences: UserPreferencesDTO | null = null;
  constructor() {
    effect(() => {
      const p = this.w.account().profile;
      if (p && p !== this.seenProfile) {
        this.seenProfile = p;
        this.firstName = p.firstName ?? '';
        this.lastName = p.lastName ?? '';
        this.persona = p.persona;
      }
    });
    effect(() => {
      const p = this.notify().preferences;
      if (p && p !== this.seenDelivery) {
        this.seenDelivery = p;
        this.delivery = {
          inAppEnabled: p.inAppEnabled,
          emailEnabled: p.emailEnabled,
          newMatch: p.enabledEventTypes.includes('NEW_MATCH'),
          contactRequest: p.enabledEventTypes.includes('CONTACT_REQUEST'),
          valuationChanged: p.enabledEventTypes.includes('VALUATION_CHANGED'),
          // The PUT replaces the whole set: keep event types this form does not know yet.
          otherEvents: p.enabledEventTypes.filter((t) => !KNOWN_EVENTS.includes(t)),
          emailCadence: p.emailCadence,
        };
      }
    });
    effect(() => {
      const p = this.w.account().preferences;
      if (p && p !== this.seenPreferences) {
        this.seenPreferences = p;
        this.preferences = structuredClone(p);
        this.goals = p.investmentGoals.join('\n');
      }
    });
  }
  ngOnInit() {
    if (!this.w.account().profile) this.w.reloadUser();
    if (this.w.auth.isLoggedIn() && !this.notify().preferences) this.loadDelivery();
  }
  loadPreferences() {
    this.w.store.dispatch(A.loadPreferences());
  }
  loadDelivery() {
    this.w.store.dispatch(N.load());
  }
  saveDelivery() {
    if (this.notify().saving || !this.w.requireAccount()) return;
    const d = this.delivery;
    this.w.store.dispatch(
      N.save({
        request: {
          inAppEnabled: d.inAppEnabled,
          emailEnabled: d.emailEnabled,
          enabledEventTypes: [
            ...(d.newMatch ? ['NEW_MATCH'] : []),
            ...(d.contactRequest ? ['CONTACT_REQUEST'] : []),
            ...(d.valuationChanged ? ['VALUATION_CHANGED'] : []),
            ...d.otherEvents,
          ],
          emailCadence: d.emailCadence,
        },
      }),
    );
  }
  saveProfile() {
    if (this.w.account().savingProfile || !this.w.requireAccount()) return;
    const request = {
      ...(this.firstName.trim() ? { firstName: this.firstName.trim() } : {}),
      ...(this.lastName.trim() ? { lastName: this.lastName.trim() } : {}),
      persona: this.persona,
    };
    this.w.store.dispatch(A.saveProfile({ request }));
  }
  savePreferences() {
    if (this.w.account().savingPreferences || !this.w.requireAccount()) return;
    const p = this.preferences;
    if (p.minBudget !== null && p.maxBudget !== null && p.minBudget > p.maxBudget) {
      this.w.toast('Minimum budget must not exceed maximum budget.');
      return;
    }
    const goals = this.goals
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (goals.length > 20 || goals.some((g) => g.length > 200)) {
      this.w.toast('Use up to 20 goals, with at most 200 characters each.');
      return;
    }
    this.w.store.dispatch(
      A.savePreferences({
        preferences: {
          ...p,
          targetLocations: p.targetLocations.map(({ countyId }) => ({ countyId })),
          investmentGoals: this.goals
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    );
  }
  addCounty() {
    const county = this.locations().counties.find((c) => c.countyId === this.locations().countyId);
    if (
      county &&
      !this.preferences.targetLocations.some((c) => c.countyId === county.countyId) &&
      this.preferences.targetLocations.length < 20
    )
      this.preferences = {
        ...this.preferences,
        targetLocations: [...this.preferences.targetLocations, county],
      };
  }
  removeCounty(id: number) {
    this.preferences = {
      ...this.preferences,
      targetLocations: this.preferences.targetLocations.filter((c) => c.countyId !== id),
    };
  }
}
