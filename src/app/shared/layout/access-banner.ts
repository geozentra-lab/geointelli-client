import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../data/workspace';
import { Icon } from '../components/icon/icon';
import { AREA_LABELS, ROLE_FEATURE, ROLE_LABELS } from '../../core/models/account';
import { AccountActions } from '../../store/account/account.actions';
import { AREAS } from '../data/navigation';
import { formatLocalTime } from '../data/format';

/**
 * The account-type banner above every page (backend SCRUM-204, section 3):
 * - while a role waits for an admin: "Your investor access is waiting for approval" with Check
 *   status (the store also checks on load and every 2 minutes);
 * - after an approval and a token refresh: the area is ready, with a link to it;
 * - after a rejection: the admin's reason, and where to choose again.
 * The home-buyer pages work throughout.
 */
@Component({
  selector: 'gz-access-banner',
  imports: [RouterLink, Icon],
  template: `
    @if (notice(); as n) {
      <div class="ab" [class.ready]="n.kind === 'ready'" [class.rejected]="n.kind === 'rejected'" role="status">
        @if (n.kind === 'ready') {
          <gz-icon name="check" />
          <p>
            Your {{ roleWord(n.role) }} access is ready: {{ area(n.role) }} is now in your menu.
          </p>
          @if (areaPath(n.role); as path) {
            <a class="btn small primary" [routerLink]="path" (click)="dismiss()">Open {{ area(n.role) }}</a>
          }
        } @else {
          <gz-icon name="close" />
          <p>
            Your {{ roleWord(n.role) }} request was declined:
            {{ n.reason ? n.reason : 'no reason was given.' }}
            You keep the home buyer pages, and you can choose again.
          </p>
          <a class="btn small" routerLink="/settings" fragment="account-type" (click)="dismiss()">Choose an account type</a>
        }
        <button type="button" class="ab-close" aria-label="Dismiss" (click)="dismiss()">
          <gz-icon name="close" />
        </button>
      </div>
    } @else if (pending(); as role) {
      <div class="ab" role="status">
        <gz-icon name="clock" />
        <p>
          Your {{ roleWord(role) }} access is waiting for approval. You can use the home buyer pages meanwhile.
          @if (a().checkedAt; as at) {
            <span class="ab-meta">Checked at {{ time(at) }}.</span>
          }
          @if (a().checkError; as error) {
            <span class="ab-meta attention">The status could not be checked: {{ error }}</span>
          }
        </p>
        <button type="button" class="btn small" [attr.aria-disabled]="a().checking ? 'true' : null" (click)="check()">
          {{ a().checking ? 'Checking…' : 'Check status' }}
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .ab {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-8) var(--sp-12);
      margin: 0 0 var(--sp-16);
      padding: var(--sp-12) var(--sp-16);
      background: var(--surface);
      border: 1px solid var(--rule);
      box-shadow: inset 3px 0 0 var(--attention);
      font-size: var(--fs-body);
      line-height: var(--lh-body);
    }
    .ab.ready {
      box-shadow: inset 3px 0 0 var(--positive);
    }
    .ab.rejected {
      box-shadow: inset 3px 0 0 var(--negative);
    }
    .ab > gz-icon {
      flex: none;
      color: var(--ink-2);
    }
    .ab p {
      flex: 1 1 320px;
      margin: 0;
      color: var(--ink);
      max-width: var(--measure);
    }
    .ab-meta {
      display: block;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .ab-meta.attention {
      color: var(--attention);
    }
    .ab-close {
      display: grid;
      place-items: center;
      min-width: 32px;
      min-height: 32px;
      padding: 0;
      background: transparent;
      color: var(--ink-2);
      border-radius: var(--radius-control);
    }
    .ab-close:hover {
      background: var(--row-hover);
    }
  `,
})
export class AccessBanner {
  readonly w = inject(Workspace);
  readonly a = this.w.access;
  readonly notice = computed(() => this.a().notice);
  /** At most one professional role per account, so at most one waits. */
  readonly pending = computed(() => this.w.pendingRoles()[0] ?? null);

  roleWord(role: keyof typeof ROLE_LABELS) {
    return ROLE_LABELS[role].toLowerCase();
  }
  area(role: keyof typeof AREA_LABELS) {
    return AREA_LABELS[role];
  }
  /** The area's overview, once the new token has turned its feature on. */
  areaPath(role: keyof typeof ROLE_FEATURE) {
    if (!this.w.features()[ROLE_FEATURE[role]]) return null;
    return AREAS.find((x) => x.role === role)?.items[0]?.path ?? null;
  }
  time(iso: string) {
    return formatLocalTime(iso);
  }
  check() {
    if (this.a().checking) return;
    this.w.store.dispatch(AccountActions.checkStatus());
  }
  dismiss() {
    this.w.store.dispatch(AccountActions.dismissNotice());
  }
}
