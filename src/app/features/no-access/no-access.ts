import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import {
  AREA_LABELS,
  FeatureKey,
  ProfessionalRole,
  ROLE_FEATURE,
  ROLE_LABELS,
} from '../../core/models/account';

const AREA_OF: Partial<Record<FeatureKey, string>> = {
  investment: AREA_LABELS.investor,
  realtorCrm: AREA_LABELS.realtor,
  lender: AREA_LABELS.lender,
  administration: 'Admin',
};

/**
 * Where a route guard sends a signed-in account that lacks the area's feature (backend SCRUM-204):
 * it says which area, whether its role is waiting for approval, and where to choose an account type.
 * Admin is never offered: it isn't an account type.
 */
@Component({
  imports: [RouterLink, PageHeading],
  template: `
    <div class="na-page">
      <gz-heading title="No access" />
      <p class="na-lede">{{ area() ? area() + ' is' : 'This area is' }} not part of your account.</p>
      @if (pendingHere(); as role) {
        <p>Your {{ word(role) }} access is waiting for approval. This area opens once an administrator approves it.</p>
      } @else if (role(); as role) {
        @if (!w.accountType()) {
          <p>It comes with the {{ word(role) }} account type, which an administrator approves. You can ask for it in Settings.</p>
        } @else {
          <p>Your account is a {{ word(w.accountType()!) }} account. To change your account type, contact support.</p>
        }
      }
      <div class="na-actions">
        <a class="btn primary" routerLink="/dashboard">Go to your overview</a>
        @if (role() && !w.accountType() && !pendingHere()) {
          <a class="btn" routerLink="/settings" fragment="account-type">Choose an account type</a>
        }
      </div>
    </div>
  `,
  styles: `
    .na-page {
      max-width: 720px;
    }
    p {
      margin: 0 0 var(--sp-12);
      max-width: var(--measure);
      color: var(--ink-2);
    }
    .na-lede {
      color: var(--ink);
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .na-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-8);
      margin-top: var(--sp-16);
    }
  `,
})
export class NoAccess {
  readonly w = inject(Workspace);
  private readonly feature = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('area') as FeatureKey | null)),
    { initialValue: null },
  );
  readonly area = computed(() => {
    const f = this.feature();
    return f ? (AREA_OF[f] ?? null) : null;
  });
  /** The professional role that opens this area (none for Admin). */
  readonly role = computed<ProfessionalRole | null>(() => {
    const f = this.feature();
    return (Object.keys(ROLE_FEATURE) as ProfessionalRole[]).find((r) => ROLE_FEATURE[r] === f) ?? null;
  });
  readonly pendingHere = computed(() => {
    const r = this.role();
    return r && this.w.pendingRoles().includes(r) ? r : null;
  });
  word(role: ProfessionalRole) {
    return ROLE_LABELS[role].toLowerCase();
  }
}
