import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { TABLE_KIT, Sort, sortRows } from '../../shared/table';
import { formatLocalDate, formatLocalDateTime } from '../../shared/data/format';
import { labelFor } from '../../shared/pipes/label.pipe';
import {
  GRANT_SOURCE_LABELS,
  ProfessionalRole,
  ROLE_LABELS,
  RoleGrantEventDTO,
  isProfessionalRole,
} from '../../core/models/account';
import { AdminAccessActions as A } from '../../store/admin-access/admin-access.actions';
import { revokeKey } from '../../store/admin-access/admin-access.reducer';
import { currentRoles, selectAdminAccess } from '../../store/admin-access/admin-access.selectors';
import { AdminGate, adminAccess } from './admin-gate';

const REASON_MAX = 500;
/** Enough to catch a typo before asking the server, which checks the address itself. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

/**
 * Users (`/admin/users`): find an account by the email it signs in with
 * (GET /api/admin/users?email=), which opens its role history.
 *
 * A user's role history (backend SCRUM-204, `/admin/users/:userId`, `?email=` from the queue or
 * the search that linked here): every grant and revoke of a professional role, newest first, and
 * the roles the history says the user holds now, each with Revoke. Revoking is how support changes
 * an account type: revoke, then the user requests the new role and an admin approves it. A pending
 * request is not touched by a revoke. The search stays at the top to open another user. Realm role
 * "admin" only.
 */
@Component({
  imports: [FormsModule, RouterLink, PageHeading, RequestStatus, AdminGate, ...TABLE_KIT],
  template: `
    <gz-heading
      [title]="named() ? 'Role history' : 'Users'"
      [subtitle]="named() ? who() : 'Find an account by the email it signs in with, to see its role history or revoke a role.'"
    >
      @if (access() === 'admin' && userId() !== null) {
        <button type="button" class="btn" [attr.aria-disabled]="grants().loading ? 'true' : null" (click)="refresh()">
          {{ grants().loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      }
    </gz-heading>
    @if (access() === 'admin') {
      <form class="filterbar ur-find" role="search" aria-label="Find a user by email" (ngSubmit)="find()" novalidate>
        <div class="formfield grow">
          <label for="ur-email">{{ named() ? 'Find another user by email' : 'Email' }}</label>
          <input id="ur-email" name="email" type="email" maxlength="254" autocomplete="off" spellcheck="false"
            [attr.aria-describedby]="tried() && findWhy() ? 'ur-find-why' : null"
            [ngModel]="findEmail()" (ngModelChange)="findEmail.set($event)" />
        </div>
        <button class="btn" [attr.aria-disabled]="(tried() && findWhy()) || lookup()?.loading ? 'true' : null">
          {{ lookup()?.loading ? 'Finding…' : 'Find' }}
        </button>
      </form>
      @if (tried() && findWhy(); as why) {
        <p class="ur-why ur-find-note" id="ur-find-why">{{ why }}</p>
      }
      @if (lookup()?.error; as error) {
        <p class="field-error ur-find-note" role="alert">{{ error }}</p>
      }
    }
    @if (access() !== 'admin') {
      <gz-admin-gate [access]="access()" what="a user’s role history" />
    } @else if (!named()) {
      <!-- The search above is the page. -->
    } @else if (userId() === null) {
      <p class="ur-empty">This address doesn’t name a user: the user ID must be a whole number.</p>
    } @else {
      <gz-request-status
        [loading]="grants().loading && !events()"
        loadingText="Loading the role history…"
        [error]="grants().error"
        (retry)="refresh()"
      />
      @if (events(); as list) {
        @if (!list.length) {
          <p class="ur-empty">No role has been granted to or revoked from this user.</p>
        } @else {
          <section class="ur-section" aria-labelledby="ur-current-title" [attr.aria-busy]="grants().loading ? 'true' : null">
            <h2 id="ur-current-title" #currentTitle tabindex="-1">Current roles</h2>
            <p class="ur-text">To change the account type, revoke the role here. The user then requests the new one, and an admin approves it in Role requests.</p>
            @if (current().length) {
              <table gz-table class="ur-current" sticky="none">
                <caption class="sr-only">Roles the user holds now, going by the history</caption>
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col" class="num">Granted</th>
                    <th scope="col" data-priority="2">Source</th>
                    <th scope="col"><span class="sr-only">Revoke</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of current(); track c.role) {
                    <tr>
                      <td class="cell-main">{{ roleWord(c.role) }}</td>
                      <td class="num nowrap">{{ day(c.grantedBy.createdAt) }}</td>
                      <td data-priority="2">{{ sourceWord(c.grantedBy.source) }}</td>
                      <td class="ur-act">
                        @if (revokeFor() !== c.role) {
                          <button type="button" class="btn small" (click)="openRevoke(c.role)">Revoke {{ roleWord(c.role) }} access…</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="ur-text">The history shows no professional role held now.</p>
            }
            @if (revokeFor(); as role) {
              <form class="ur-form" (ngSubmit)="revoke(role)">
                <h3 class="ur-form-title">Revoke {{ roleWord(role) }} access</h3>
                <div class="formfield">
                  <label for="ur-reason">Reason</label>
                  <textarea
                    id="ur-reason"
                    name="reason"
                    rows="3"
                    required
                    [attr.maxlength]="reasonMax"
                    aria-describedby="ur-reason-hint"
                    [ngModel]="reason()"
                    (ngModelChange)="reason.set($event)"
                  ></textarea>
                  <p class="smalltext muted" id="ur-reason-hint">Required, up to {{ reasonMax }} characters.</p>
                </div>
                <div class="ur-form-actions">
                  <button
                    class="btn primary"
                    [attr.aria-disabled]="why() || revoking(role) ? 'true' : null"
                    [attr.aria-describedby]="why() ? 'ur-why' : null"
                  >
                    {{ revoking(role) ? 'Revoking…' : 'Revoke ' + roleWord(role) + ' access' }}
                  </button>
                  <button type="button" class="btn" (click)="closeRevoke()">Cancel</button>
                  @if (why(); as reasonWhy) {
                    <p class="ur-why" id="ur-why">{{ reasonWhy }}</p>
                  }
                </div>
                @if (errorOf(role); as error) {
                  <p class="field-error" role="alert">{{ error }}</p>
                }
              </form>
            }
            <p class="ur-note">A pending request is not changed by a revoke: reject it in <a routerLink="/admin/role-requests">Role requests</a>.</p>
          </section>

          <section class="ur-section ur-history" aria-labelledby="ur-history-title">
            <h2 id="ur-history-title">History</h2>
            <table gz-table class="ur-table" [(sort)]="sort" [attr.aria-busy]="grants().loading ? 'true' : null">
              <caption class="sr-only">Grants and revokes of the user’s professional roles</caption>
              <thead>
                <tr>
                  <th gz-sort="date" numeric>Date</th>
                  <th gz-sort="role">Role</th>
                  <th gz-sort="action">Action</th>
                  <th scope="col" data-priority="2">Source</th>
                  <th scope="col" data-priority="2">Reason</th>
                  <th scope="col" data-priority="3">Decided by</th>
                </tr>
              </thead>
              <tbody>
                @for (e of rows(); track e.id) {
                  <tr>
                    <td class="num nowrap">
                      {{ when(e.createdAt) }}
                      <span class="m-only cell-sub">{{ sourceWord(e.source) }}</span>
                    </td>
                    <td>{{ roleLabel(e.role) }}</td>
                    <td [class.negative]="e.action === 'REVOKE'">{{ e.action === 'GRANT' ? 'Granted' : 'Revoked' }}</td>
                    <td data-priority="2">{{ sourceWord(e.source) }}</td>
                    <td class="ur-reason" data-priority="2">{{ e.reason }}</td>
                    <td gz-cell class="nowrap" data-priority="3" [missing]="e.decidedByUserId === null" reason="The history names no admin for this change.">
                      User ID {{ e.decidedByUserId }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="table-note">
              {{ sort() ? '' : 'Newest first. ' }}Times are your own clock.
              @if (anyUndecided()) {
                Decided by is Unavailable where the history names no admin for the change.
              }
            </p>
          </section>
        }
      }
    }
  `,
  styles: `
    .ur-find {
      max-width: 560px;
      margin-bottom: var(--sp-16);
    }
    .ur-find-note {
      margin: calc(-1 * var(--sp-8)) 0 var(--sp-16);
    }
    .ur-empty {
      margin: 0;
      padding: var(--sp-16) 0;
      font-size: var(--fs-body);
      max-width: var(--measure);
    }
    .ur-section {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
    }
    .ur-history {
      margin-top: var(--sp-24);
    }
    h2 {
      margin: 0;
      font-size: var(--fs-section);
      line-height: var(--lh-section);
      outline: none;
    }
    .ur-text,
    .ur-note {
      margin: var(--sp-4) 0 var(--sp-12);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .ur-note {
      margin: var(--sp-12) 0 0;
    }
    .ur-current {
      max-width: 720px;
    }
    .ur-act {
      text-align: right;
      white-space: nowrap;
    }
    .ur-form {
      display: grid;
      gap: var(--sp-12);
      max-width: 560px;
      margin-top: var(--sp-16);
    }
    .ur-form-title {
      margin: 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      font-weight: 600;
    }
    .ur-form-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }
    .ur-why {
      flex-basis: 100%;
      margin: 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .ur-reason {
      max-width: 40ch;
      overflow-wrap: anywhere;
    }
    @media (max-width: 700px) {
      .ur-section {
        padding: var(--sp-12) var(--sp-16) var(--sp-16);
      }
    }
  `,
})
export class UserRoles {
  readonly w = inject(Workspace);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly s = this.w.store.selectSignal(selectAdminAccess);
  readonly access = adminAccess();
  private readonly currentTitle = viewChild<ElementRef<HTMLElement>>('currentTitle');
  readonly reasonMax = REASON_MAX;
  /** The user in the address; null when it isn't a whole number. */
  readonly userId = toSignal(
    this.route.paramMap.pipe(
      map((p) => {
        const v = p.get('userId') ?? '';
        const id = /^\d+$/.test(v) ? Number(v) : NaN;
        return Number.isSafeInteger(id) && id > 0 ? id : null;
      }),
    ),
    { initialValue: null },
  );
  /** Whether the address names a user at all: /admin/users alone is the search. */
  readonly named = toSignal(this.route.paramMap.pipe(map((p) => p.has('userId'))), { initialValue: false });
  readonly email = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('email')?.trim() || null)), {
    initialValue: null,
  });
  /** The email typed to find a user, the one this page sent, and whether Find was pressed. */
  readonly findEmail = signal('');
  private readonly asked = signal<string | null>(null);
  readonly tried = signal(false);
  readonly findWhy = computed(() => {
    const email = this.findEmail().trim();
    if (!email) return 'Enter the email they sign in with.';
    if (email.length > 254) return 'An email address is at most 254 characters.';
    if (!EMAIL_SHAPE.test(email)) return 'Enter an email address, like name@example.com.';
    return null;
  });
  /** The lookup this page sent, while it runs or when it failed. */
  readonly lookup = computed(() => {
    const s = this.s();
    return this.asked() !== null && s.userLookupEmail === this.asked() ? s.userLookup : null;
  });
  readonly who = computed(() => this.email() ?? (this.userId() !== null ? `User ID ${this.userId()}` : ''));
  readonly grants = computed(() => this.s().grants);
  /** The history of the user in the address; another user's is never shown. */
  readonly events = computed(() => (this.s().grantsUserId === this.userId() ? this.grants().value : null));
  readonly current = computed(() => currentRoles(this.events() ?? []));
  readonly anyUndecided = computed(() => (this.events() ?? []).some((e) => e.decidedByUserId === null));
  readonly sort = signal<Sort | null>(null);
  readonly rows = computed(() =>
    sortRows(this.events() ?? [], this.sort(), (e, key) =>
      key === 'date' ? e.createdAt : key === 'role' ? this.roleLabel(e.role) : key === 'action' ? e.action : null,
    ),
  );
  /** The role whose revoke form is open, and its reason. */
  readonly revokeFor = signal<ProfessionalRole | null>(null);
  readonly reason = signal('');
  private readonly sent = signal<ProfessionalRole | null>(null);

  constructor() {
    // The history whenever the user in the address changes (and on opening the page).
    effect(() => {
      const userId = this.userId();
      if (this.access() !== 'admin' || userId === null) return;
      untracked(() => {
        this.closeForm();
        this.w.store.dispatch(A.loadRoleGrants({ userId }));
      });
    });
    // A revoke was answered: done closes the form and focus goes to the current roles; a failure
    // keeps the form, with the error under it.
    effect(() => {
      const role = this.sent();
      const userId = this.userId();
      const s = this.s();
      if (role === null || userId === null || s.revoking[revokeKey(userId, role)]) return;
      untracked(() => {
        this.sent.set(null);
        // A failure keeps the form; so does a form opened meanwhile for another role.
        if (s.revokeErrors[revokeKey(userId, role)] || this.revokeFor() !== role) return;
        this.closeForm();
        afterNextRender(() => this.currentTitle()?.nativeElement.focus(), { injector: this.injector });
      });
    });
    // The account was found: its role history opens, with the email it signs in with.
    effect(() => {
      const user = this.lookup()?.value;
      if (!user) return;
      untracked(() => {
        this.asked.set(null);
        this.findEmail.set('');
        this.tried.set(false);
        void this.router.navigate(['/admin/users', user.id], { queryParams: { email: user.email } });
      });
    });
    // A role the history no longer shows as held has nothing to revoke: its form closes.
    effect(() => {
      const role = this.revokeFor();
      if (role && this.events() && !this.current().some((c) => c.role === role)) untracked(() => this.closeForm());
    });
  }

  roleWord(role: ProfessionalRole) {
    return ROLE_LABELS[role];
  }
  roleLabel(role: string) {
    const r = role?.toLowerCase() ?? '';
    return isProfessionalRole(r) ? ROLE_LABELS[r] : labelFor(role);
  }
  sourceWord(source: RoleGrantEventDTO['source']) {
    return GRANT_SOURCE_LABELS[source] ?? labelFor(source);
  }
  day(v: string) {
    return formatLocalDate(v);
  }
  when(v: string) {
    return formatLocalDateTime(v);
  }
  revoking(role: ProfessionalRole) {
    const id = this.userId();
    return id !== null && !!this.s().revoking[revokeKey(id, role)];
  }
  errorOf(role: ProfessionalRole) {
    const id = this.userId();
    return id === null ? null : (this.s().revokeErrors[revokeKey(id, role)] ?? null);
  }
  why() {
    const text = this.reason().trim();
    if (!text) return 'Write the reason first.';
    if (text.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters.`;
    return null;
  }

  find() {
    this.tried.set(true);
    if (this.findWhy() || this.lookup()?.loading) return;
    const email = this.findEmail().trim();
    this.asked.set(email);
    this.w.store.dispatch(A.findUser({ email }));
  }
  refresh() {
    const userId = this.userId();
    if (userId !== null && !this.grants().loading) this.w.store.dispatch(A.loadRoleGrants({ userId }));
  }
  openRevoke(role: ProfessionalRole) {
    this.revokeFor.set(role);
    this.reason.set('');
    afterNextRender(() => document.querySelector<HTMLElement>('#ur-reason')?.focus(), { injector: this.injector });
  }
  closeRevoke() {
    const role = this.revokeFor();
    this.closeForm();
    if (role)
      afterNextRender(() => this.currentTitle()?.nativeElement.focus(), { injector: this.injector });
  }
  private closeForm() {
    this.revokeFor.set(null);
    this.reason.set('');
  }
  revoke(role: ProfessionalRole) {
    const userId = this.userId();
    if (userId === null || this.why() || this.revoking(role)) return;
    this.sent.set(role);
    this.w.store.dispatch(A.revokeRole({ userId, role, reason: this.reason().trim() }));
  }
}
