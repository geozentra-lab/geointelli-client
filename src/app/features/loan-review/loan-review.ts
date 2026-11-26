import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { PropertyRef } from '../../shared/components/property-ref';
import { RECORD_KIT } from '../../shared/components/record';
import { Desk } from '../../shared/layout/desk';
import { RecordPane } from '../../shared/layout/record-pane';
import { StageLink, TABLE_KIT } from '../../shared/table';
import { countOf, formatLocalDate, plainNote } from '../../shared/data/format';
import { Kpi, StageBars, StageRow, usdCompact } from '../dashboard/dash-ui';
import {
  LENDER_IMPORT_EXAMPLE,
  LENDER_IMPORT_MAX_ROWS,
  LENDER_STAGES,
  LenderApplicationDTO,
  LenderApplicationStage,
  LenderMemberLookupDTO,
  TERMINAL_LENDER_STAGES,
  lenderStageLabels,
  loanTypeLabels,
  nextLenderStages,
  parseLenderImport,
} from '../../core/models/lender';
import { LenderActions as A } from '../../store/lender/lender.actions';
import { selectLender, selectLenderOrganization } from '../../store/lender/lender.selectors';
import { ApplicationRecord } from './application-record';
import { ApplicationForm } from './application-form';

type Tab = 'pipeline' | 'applications' | 'import' | 'team';
/** Enough to catch a typo before asking the server, which checks the address itself. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;
const TABS: [Tab, string][] = [
  ['pipeline', 'Pipeline'],
  ['applications', 'Applications'],
  ['import', 'Import'],
  ['team', 'Team'],
];
/** The button for an application's next stage, in the words of what it does. */
const MOVE: Record<LenderApplicationStage, string> = {
  DRAFT: 'Back to draft',
  SUBMITTED: 'Submit',
  UNDER_REVIEW: 'Start review',
  APPROVED: 'Approve…',
  FUNDED: 'Mark funded…',
  REJECTED: 'Reject',
  WITHDRAWN: 'Withdraw',
};
const IMPORT_REASON: Record<string, string> = {
  INVALID_ROW: 'Missing or invalid fields',
  INVALID_TRANSITION: 'Stage change not allowed',
  CONFLICT_RETRY_ROW: 'Changed at the same time: import this row again',
};
const money = (v: number | null | undefined) =>
  v === null || v === undefined
    ? null
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(v);

/**
 * Loan review (DESIGN.md §5 Register; the lender's rail: Pipeline, Applications, Import, Team as
 * ?tab=). The organization is chosen in the header. Pipeline: the summary strip and the stages
 * (each opens Applications on it). Applications: stage links with the pipeline's counts and a
 * table; a row opens the application in the Desk's pane with its stage actions, amounts, source and
 * LTV. New application and New organization open in the pane. Import: a partner snapshot and its
 * row-by-row result. Team: who has access (the list sends user IDs only); the owner finds a
 * colleague by the email they sign in with and gives them access.
 */
@Component({
  imports: [
    FormsModule,
    NgTemplateOutlet,
    PageHeading,
    RequestStatus,
    PropertyRef,
    Desk,
    RecordPane,
    Kpi,
    StageBars,
    ApplicationRecord,
    ApplicationForm,
    ...RECORD_KIT,
    ...TABLE_KIT,
  ],
  template: `<gz-desk [open]="pane() !== null" [label]="paneLabel()" (closed)="closePane()">
      <gz-heading [title]="title()" [subtitle]="org() ? '' : 'Loan applications for your lending organization, stage by stage.'">
        @if (org(); as o) {
          <div class="lr-org">
            @if (lender().organizations.length > 1) {
              <label class="lr-org-label" for="orgSelect">Organization</label>
              <select id="orgSelect" [ngModel]="o.id" (ngModelChange)="chooseOrganization($event)">
                @for (x of lender().organizations; track x.id) {
                  <option [ngValue]="x.id">{{ x.name }}</option>
                }
              </select>
            } @else {
              <span class="lr-org-name">{{ o.name }}</span>
            }
            <span class="lr-role">{{ isOwner() ? 'Owner' : 'Member' }}</span>
          </div>
          @if (tab() === 'applications') {
            <button type="button" class="btn primary" #newButton (click)="openNew()">New application</button>
          } @else {
            <button type="button" class="btn" #newButton (click)="openOrg()">New organization</button>
          }
        }
      </gz-heading>

      @if (!w.auth.isLoggedIn()) {
        <section class="lr-section lr-narrow" aria-labelledby="lr-guest-title">
          <h2 id="lr-guest-title">Sign in to review applications</h2>
          <p class="lr-text">Create or join a lending organization to track its applications. Records are visible only to its members.</p>
          <button type="button" class="btn primary" (click)="w.signIn()">Sign in</button>
        </section>
      } @else {
        <gz-request-status
          [loading]="lender().organizationsLoading && !lender().organizationsLoaded"
          loadingText="Loading your organizations…"
          [error]="lender().organizationsError"
          (retry)="reload()"
        />
        @if (lender().organizationsLoaded && !lender().organizations.length) {
          <section class="lr-section lr-narrow" aria-labelledby="lr-noorg-title">
            <h2 id="lr-noorg-title">Create your lending organization</h2>
            <p class="lr-text">
              You aren't a member of an organization yet. Create one to track applications: you become its owner
              and can give teammates access. To join one, ask its owner to add you by the email you sign in
              with{{ myEmail() ? ' (' + myEmail() + ')' : '' }}.
            </p>
            <ng-container *ngTemplateOutlet="orgForm" />
          </section>
        }
        @if (org(); as o) {
          <div class="tabs" role="tablist" aria-label="Loan review">
            @for (t of tabs; track t[0]) {
              <button type="button" role="tab" [id]="'lender-tab-' + t[0]" [attr.data-tab]="t[0]" aria-controls="lender-panel"
                [attr.aria-selected]="tab() === t[0]" [attr.tabindex]="tab() === t[0] ? 0 : -1" [class.active]="tab() === t[0]"
                (keydown)="onTabKey($event)" (click)="select(t[0])">{{ t[1] }}</button>
            }
          </div>
          @if (pane() === null && writeError(); as error) {
            <p class="field-error" role="alert">{{ error }}</p>
          }
          <div role="tabpanel" id="lender-panel" [attr.aria-labelledby]="'lender-tab-' + tab()">
            @switch (tab()) {
              @case ('pipeline') {
                <gz-request-status [loading]="lender().pipelineLoading && !lender().pipeline" loadingText="Summarizing the pipeline…"
                  [error]="lender().pipelineError" (retry)="loadPipeline()" />
                @if (lender().pipeline; as p) {
                  @if (p.total) {
                    <dl class="kpi-row">
                      <div gz-kpi label="Applications" [value]="p.total" caption="Every stage"></div>
                      <div gz-kpi label="Approved" [value]="p.approvedCount" [caption]="compact(p.approvedAmount) + ' approved · funded included'"></div>
                      <div gz-kpi label="Funded" [value]="p.fundedCount" [caption]="compact(p.fundedAmount) + ' funded'"></div>
                    </dl>
                    <section class="lr-section" aria-labelledby="lr-stages-title">
                      <h2 id="lr-stages-title">By stage</h2>
                      <p class="lr-caption">Count and requested amount · choose a stage to list it</p>
                      <gz-stage-bars [rows]="stageRows()" label="Applications by stage" (picked)="openStage($event)" />
                      <p class="table-note">
                        Current stage counts and requested amounts in {{ p.currency }}, as of {{ day(p.asOf) }}.
                        @if (plain(p.scope); as scope) {
                          {{ scope }}
                        }
                      </p>
                    </section>
                  } @else {
                    <p class="lr-text">Applications you record or import appear here by stage.</p>
                    <button type="button" class="btn primary" (click)="select('applications'); openNew()">New application</button>
                  }
                }
              }
              @case ('applications') {
                <gz-stage-links [stages]="stageLinks()" [active]="lender().stage" label="Filter applications by stage" (picked)="filterStage($any($event))" />
                <gz-request-status [loading]="lender().applicationsLoading && !lender().applicationsLoaded" loadingText="Loading applications…"
                  [error]="lender().applicationsError" (retry)="loadApplications(lender().page)" />
                @if (lender().applications.length) {
                  <p class="lr-count" #count tabindex="-1">{{ countText() }}</p>
                  <table gz-table class="lr-table" [(selected)]="selectedId" (activated)="openApplication($event)" (dismissed)="closePane()"
                    [paneOpen]="pane() !== null" [attr.aria-busy]="lender().applicationsLoading ? 'true' : null">
                    <caption class="sr-only">Applications. Choose a row to open it.</caption>
                    <thead>
                      <tr>
                        <th scope="col">Applicant</th>
                        <th scope="col">Stage</th>
                        <th scope="col" class="num">Requested</th>
                        <th scope="col" class="num" data-priority="2">Approved or funded</th>
                        <th scope="col" data-priority="3">Property</th>
                        <th scope="col" class="num" data-priority="2">Changed</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (a of lender().applications; track a.id) {
                        <tr [gz-row]="a.id">
                          <td><span class="cell-main">{{ a.applicantName }}</span><span class="cell-sub">{{ loanType(a) }}</span></td>
                          <td [class.positive]="a.stage === 'APPROVED' || a.stage === 'FUNDED'" [class.muted]="a.stage === 'REJECTED' || a.stage === 'WITHDRAWN'">{{ label(a.stage) }}</td>
                          <td class="num">{{ money(a.requestedAmount) }}</td>
                          <td class="num" data-priority="2">
                            @if (a.fundedAmount !== null) {
                              {{ money(a.fundedAmount) }}<span class="cell-sub">funded</span>
                            } @else if (a.approvedAmount !== null) {
                              {{ money(a.approvedAmount) }}<span class="cell-sub">approved</span>
                            }
                          </td>
                          <td data-priority="3">
                            @if (a.propertyId) {
                              <gz-property-ref [propertyId]="a.propertyId" [link]="false" />
                            } @else {
                              <span class="muted">None linked</span>
                            }
                          </td>
                          <td class="num" data-priority="2">{{ day(a.updatedAt) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  <gz-pager [page]="lender().page" [size]="20" [total]="lender().totalElements" [loading]="lender().applicationsLoading" (changed)="page($event)" />
                  <p class="table-note">Recording a stage doesn’t approve credit or move any funds. LTV is checked per application, in its record.</p>
                } @else if (lender().applicationsLoaded && !lender().applicationsLoading && !lender().applicationsError) {
                  @if (lender().stage; as st) {
                    <p class="lr-text">No applications in {{ label(st) }}.</p>
                    <button type="button" class="btn" (click)="filterStage(null)">Clear filter</button>
                  } @else {
                    <p class="lr-text">Applications you record or import appear here.</p>
                    <button type="button" class="btn primary" (click)="openNew()">New application</button>
                  }
                }
              }
              @case ('import') {
                <section class="lr-section" aria-labelledby="lr-import-title">
                  <h2 id="lr-import-title">Import a partner snapshot</h2>
                  <p class="lr-text">
                    Paste JSON with a <code>source</code> name and 1 to {{ maxRows }} <code>rows</code>. Each row needs
                    <code>externalId</code>, <code>applicantName</code>, <code>requestedAmount</code>, <code>currency</code>
                    ("USD") and <code>stage</code>; approved and funded rows also need their amounts and UTC dates.
                    Importing the same row again changes nothing, and rows are saved one by one, so a rejected row
                    doesn't undo the others.
                  </p>
                  <form (ngSubmit)="runImport()">
                    <div class="formfield">
                      <label for="importJson">Snapshot JSON</label>
                      <textarea id="importJson" name="importJson" class="lr-json" rows="12" spellcheck="false"
                        [attr.aria-describedby]="importError() ? 'import-error' : null"
                        [ngModel]="importText()" (ngModelChange)="importText.set($event); importError.set(null)"></textarea>
                    </div>
                    @if (importError(); as err) {
                      <p id="import-error" class="field-error" role="alert">{{ err }}</p>
                    } @else if (lender().pendingWrite === 'import' && lender().saveError; as error) {
                      <p class="field-error" role="alert">{{ error }}</p>
                    }
                    <div class="lr-actions">
                      <button class="btn primary" [attr.aria-disabled]="!importText().trim() || saving() ? 'true' : null"
                        [attr.aria-describedby]="!importText().trim() ? 'import-why' : null">
                        {{ lender().pendingWrite === 'import' && saving() ? 'Importing…' : 'Import' }}
                      </button>
                      <button type="button" class="btn" (click)="useExample()">Insert an example</button>
                      @if (!importText().trim()) {
                        <p class="lr-why" id="import-why">Paste a snapshot first.</p>
                      }
                    </div>
                  </form>
                </section>
                @if (lender().importResult; as r) {
                  <section class="lr-section" aria-labelledby="lr-result-title" aria-live="polite">
                    <h2 id="lr-result-title">Import result</h2>
                    <dl class="kpi-row">
                      <div gz-kpi label="Created" [value]="r.created"></div>
                      <div gz-kpi label="Updated" [value]="r.updated"></div>
                      <div gz-kpi label="Unchanged" [value]="r.unchanged"></div>
                      <div gz-kpi label="Rejected" [value]="r.rejected" [caption]="r.rejected ? 'See the rows below' : ''"></div>
                    </dl>
                    <table gz-table sticky="none">
                      <caption class="sr-only">Outcome of each imported row</caption>
                      <thead>
                        <tr>
                          <th scope="col" class="num">Row</th>
                          <th scope="col">Result</th>
                          <th scope="col" class="num">Application ID</th>
                          <th scope="col">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of r.rows; track row.row) {
                          <tr>
                            <td class="num">{{ row.row }}</td>
                            <td [class.attention]="row.status === 'REJECTED'">{{ resultWord(row.status) }}</td>
                            <td class="num">{{ row.applicationId }}</td>
                            <td>{{ importReason(row.errorCode) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </section>
                }
              }
              @case ('team') {
                <section class="lr-section" aria-labelledby="lr-team-title">
                  <h2 id="lr-team-title" tabindex="-1">Team access</h2>
                  <p class="lr-text">
                    Every member can record and update {{ o.name }}'s applications.
                    {{ isOwner() ? 'As the owner, you add teammates by the email they sign in with, and remove them.' : 'Only the owner can change who has access.' }}
                  </p>
                  <gz-request-status [loading]="lender().membersLoading && !lender().members.length" loadingText="Loading members…"
                    [error]="lender().membersError" (retry)="loadMembers()" />
                  @if (lender().members.length) {
                    <table gz-table sticky="none" class="lr-team">
                      <caption class="sr-only">Members of {{ o.name }}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Name</th>
                          <th scope="col" class="num">User ID</th>
                          <th scope="col">Role</th>
                          <th scope="col"><span class="sr-only">Remove</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (id of lender().members; track id; let first = $first) {
                          <tr>
                            @if (first) {
                              <td class="na lr-names" [attr.rowspan]="lender().members.length">
                                <span class="na-word">Unavailable</span>
                                <span class="na-why">The team list sends user IDs only.</span>
                              </td>
                            }
                            <td class="num">{{ id }}</td>
                            <td>{{ id === o.ownerUserId ? 'Owner' : 'Member' }}{{ id === myId() ? ' · You' : '' }}</td>
                            <td class="lr-remove">
                              @if (isOwner() && id !== o.ownerUserId) {
                                <button type="button" class="btn small" [attr.aria-disabled]="saving() ? 'true' : null"
                                  [attr.aria-label]="'Remove access for user ID ' + id" (click)="removeMember(id)">Remove</button>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                  @if (isOwner()) {
                    <form class="filterbar lr-add" (ngSubmit)="findMember()" novalidate>
                      <div class="formfield grow">
                        <label for="memberEmail">Give access by email</label>
                        <input id="memberEmail" name="memberEmail" type="email" maxlength="254" autocomplete="off" spellcheck="false"
                          aria-describedby="member-hint" [ngModel]="memberEmail()" (ngModelChange)="memberEmail.set($event)" />
                      </div>
                      <button class="btn" [attr.aria-disabled]="memberWhy() || found()?.loading ? 'true' : null"
                        [attr.aria-describedby]="memberWhy() ? 'member-why' : null">{{ found()?.loading ? 'Finding…' : 'Find' }}</button>
                    </form>
                    <p class="lr-why" id="member-hint">The email they sign in to GeoZentra with. They need to have signed in once.</p>
                    @if (memberWhy(); as why) {
                      <p class="lr-why" id="member-why">{{ why }}</p>
                    }
                    <div class="lr-found" aria-live="polite">
                      @if (found(); as f) {
                        @if (f.error) {
                          <p class="field-error" role="alert">{{ f.error }}</p>
                        } @else if (f.value; as p) {
                          <div class="lr-person">
                            <span class="lr-person-who"
                              ><span class="lr-person-name">{{ personName(p) }}</span
                              >@if (personName(p) !== p.email) {<span class="lr-person-email">{{ p.email }}</span>}</span
                            >
                            @if (p.member || lender().members.includes(p.userId)) {
                              <span class="lr-person-note">Already has access to {{ o.name }}.</span>
                            } @else {
                              <button type="button" class="btn primary" [attr.aria-disabled]="saving() ? 'true' : null" (click)="addMember(p)">
                                {{ lender().pendingWrite === 'member' && saving() ? 'Giving access…' : 'Give access' }}
                              </button>
                            }
                          </div>
                        }
                      }
                    </div>
                  }
                </section>
              }
            }
          </div>
        }
      }

      <ng-template #orgForm>
        <form class="filterbar" (ngSubmit)="createOrganization()">
          <div class="formfield grow">
            <label for="orgName">Organization name</label>
            <input id="orgName" name="orgName" maxlength="160" autocomplete="organization" [ngModel]="orgName()" (ngModelChange)="orgName.set($event)" />
          </div>
          <button class="btn primary" [attr.aria-disabled]="!orgName().trim() || saving() ? 'true' : null"
            [attr.aria-describedby]="!orgName().trim() ? 'org-why' : null">
            {{ lender().pendingWrite === 'organization' && saving() ? 'Creating…' : 'Create organization' }}
          </button>
        </form>
        @if (!orgName().trim()) {
          <p class="lr-why" id="org-why">Enter a name.</p>
        }
        @if (lender().pendingWrite === 'organization' && lender().saveError; as error) {
          <p class="field-error" role="alert">{{ error }}</p>
        }
      </ng-template>

      @if (pane() === 'new') {
        <gz-record-pane deskSlot heading="New application" noun="application" backLabel="Applications" (closed)="closePane()">
          <gz-application-form (done)="closePane(true)" />
        </gz-record-pane>
      } @else if (pane() === 'org') {
        <gz-record-pane deskSlot heading="New organization" noun="organization" [backLabel]="title()" (closed)="closePane()">
          <gz-record-section>
            <p class="lr-text">You become its owner and can give teammates access.</p>
            <ng-container *ngTemplateOutlet="orgForm" />
          </gz-record-section>
        </gz-record-pane>
      } @else if (paneApp(); as a) {
        <gz-record-pane
          deskSlot
          [heading]="a.applicantName"
          noun="application"
          backLabel="Applications"
          [position]="position()"
          [hasPrev]="paneIndex() > 0"
          [hasNext]="paneIndex() < lender().applications.length - 1"
          (prev)="step(-1)"
          (next)="step(1)"
          (closed)="closePane()"
        >
          <span paneMeta>{{ label(a.stage) }} · {{ money(a.requestedAmount) }} requested</span>
          <div paneActions class="lr-pane-actions">
            @for (to of nextStages(a.stage); track to) {
              <button type="button" class="btn" [class.primary]="to !== 'REJECTED' && to !== 'WITHDRAWN'"
                [attr.aria-disabled]="saving() ? 'true' : null" (click)="startMove(a, to)">{{ moveWord(to) }}</button>
            } @empty {
              <p class="lr-why">Final stage: it can't be moved again.</p>
            }
          </div>
          @if (writeError(); as error) {
            <p class="field-error lr-pane-error" role="alert">{{ error }}</p>
          }
          <gz-application-record [app]="a" [amountFor]="amountFor()" (confirmed)="move(a, amountFor()!, $event)" (cancelled)="amountFor.set(null)" />
        </gz-record-pane>
      }
    </gz-desk>`,
  styles: `
    h2 {
      font-size: var(--fs-section);
      line-height: var(--lh-section);
      margin: 0 0 var(--sp-8);
    }
    h2:focus {
      outline: none;
    }
    .lr-org {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-4) var(--sp-8);
      max-width: 100%;
      min-width: 0;
      font-size: var(--fs-cell);
    }
    .lr-org select {
      min-width: 0;
      max-width: 100%;
    }
    .lr-org-label,
    .lr-role {
      color: var(--ink-2);
    }
    .lr-org-name {
      font-weight: 500;
    }
    .lr-section {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
      margin-bottom: var(--sp-24);
    }
    .lr-narrow {
      max-width: 760px;
    }
    .lr-text {
      margin: 0 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .lr-caption {
      margin: 0 0 var(--sp-12);
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .kpi-row {
      margin-bottom: var(--sp-24);
    }
    .lr-count {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    gz-stage-links {
      display: block;
      margin-bottom: var(--sp-12);
    }
    .lr-json {
      width: 100%;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
    }
    .lr-actions,
    .lr-pane-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-12);
      margin-top: var(--sp-12);
    }
    .lr-pane-actions {
      margin-top: 0;
    }
    .lr-why {
      margin: var(--sp-4) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .lr-pane-actions .lr-why,
    .lr-actions .lr-why {
      margin: 0;
    }
    .lr-pane-error {
      margin: var(--sp-8) 0;
    }
    .lr-remove {
      width: 1%;
      text-align: right;
    }
    .lr-add {
      margin-top: var(--sp-16);
      max-width: 560px;
    }
    .lr-person {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-16);
      max-width: 560px;
      margin-top: var(--sp-12);
      padding: var(--sp-8) 0;
      border-top: 1px solid var(--rule);
      border-bottom: 1px solid var(--rule);
      scroll-margin-bottom: calc(var(--bottombar-h) + var(--sp-16));
    }
    .lr-person-who {
      display: grid;
      flex: 1 1 240px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .lr-person-name {
      font-size: var(--fs-cell);
      font-weight: 600;
    }
    .lr-person-email,
    .lr-person-note {
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .lr-found .field-error {
      margin: var(--sp-8) 0 0;
    }
    .grow {
      flex: 1 1 260px;
    }
  `,
})
export class LoanReview {
  readonly w = inject(Workspace);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly countEl = viewChild<ElementRef<HTMLElement>>('count');
  private readonly newButton = viewChild<ElementRef<HTMLElement>>('newButton');
  readonly lender = this.w.store.selectSignal(selectLender);
  readonly org = this.w.store.selectSignal(selectLenderOrganization);
  readonly tabs = TABS;
  readonly maxRows = LENDER_IMPORT_MAX_ROWS;
  readonly nextStages = nextLenderStages;
  readonly money = money;
  readonly plain = plainNote;

  /** The tab follows ?tab= (the rail's Pipeline, Applications, Import, Team). */
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly tab = linkedSignal<Tab>(() => {
    const t = this.query().get('tab');
    return TABS.some(([key]) => key === t) ? (t as Tab) : 'pipeline';
  });
  readonly title = computed(() => TABS.find(([key]) => key === this.tab())![1]);
  readonly myId = computed(() => this.w.account().profile?.id ?? null);
  readonly isOwner = computed(() => {
    const o = this.org();
    return !!o && this.myId() !== null && o.ownerUserId === this.myId();
  });
  readonly saving = computed(() => this.lender().saving > 0);
  /** The last stage move or member change sent from this page, and the application it was for. */
  private readonly lastWrite = signal<{ kind: 'update' | 'member'; id: number | null } | null>(null);
  /** Its failure, shown where it belongs: in that application's pane, or on the page (members). */
  readonly writeError = computed(() => {
    const s = this.lender();
    const w = this.lastWrite();
    if (!w || s.saving || !s.saveError || s.pendingWrite !== w.kind) return null;
    if (w.kind === 'member') return this.tab() === 'team' && this.pane() === null ? s.saveError : null;
    const open = this.paneApp();
    return this.pane() === null || (open && open.id === w.id) ? s.saveError : null;
  });

  readonly stageRows = computed<StageRow[]>(() => {
    const p = this.lender().pipeline;
    return LENDER_STAGES.map((stage) => ({
      key: stage,
      label: lenderStageLabels[stage],
      count: p?.stages[stage]?.count ?? 0,
      amount: p?.stages[stage]?.requestedAmount ?? 0,
      muted: stage === 'REJECTED' || stage === 'WITHDRAWN',
    }));
  });
  /** Stage links with the pipeline's own counts (null while it hasn't answered). */
  readonly stageLinks = computed<StageLink[]>(() => {
    const p = this.lender().pipeline;
    return [
      { key: null, label: 'All', count: p?.total ?? null },
      ...LENDER_STAGES.map((st) => ({ key: st, label: lenderStageLabels[st], count: p ? (p.stages[st]?.count ?? 0) : null })),
    ];
  });
  readonly countText = computed(() => {
    const s = this.lender();
    const n = countOf(s.totalElements, 'application');
    return s.stage ? `${n} · ${lenderStageLabels[s.stage]}` : n;
  });

  // The pane: the selected application (it follows the table's selection), or a New form.
  readonly selectedId = signal<unknown>(null);
  readonly pane = signal<'record' | 'new' | 'org' | null>(null);
  readonly paneIndex = computed(() => this.lender().applications.findIndex((a) => a.id === this.selectedId()));
  readonly paneApp = computed(() => (this.pane() === 'record' ? (this.lender().applications[this.paneIndex()] ?? null) : null));
  readonly paneLabel = computed(() =>
    this.pane() === 'new' ? 'New application' : this.pane() === 'org' ? 'New organization' : 'Application: ' + (this.paneApp()?.applicantName ?? ''),
  );
  readonly position = computed(() =>
    this.paneIndex() < 0 ? '' : `${this.paneIndex() + 1} of ${this.lender().applications.length} on this page`,
  );
  /** Approve or Fund chosen: the record asks for the amount. */
  readonly amountFor = signal<LenderApplicationStage | null>(null);

  readonly orgName = signal('');
  readonly myEmail = computed(() => this.w.account().profile?.email ?? null);
  /** The colleague's email, then the account the backend found for it. */
  readonly memberEmail = signal('');
  readonly memberWhy = computed(() => {
    const email = this.memberEmail().trim();
    if (!email) return 'Enter their email.';
    if (email.length > 254) return 'An email address is at most 254 characters.';
    if (!EMAIL_SHAPE.test(email)) return 'Enter an email address, like name@example.com.';
    return null;
  });
  /** The lookup for the email in the field; another email typed since hides it. */
  readonly found = computed(() => {
    const s = this.lender();
    const email = this.memberEmail().trim().toLowerCase();
    return email && s.memberLookupEmail?.toLowerCase() === email ? s.memberLookup : null;
  });
  readonly importText = signal('');
  readonly importError = signal<string | null>(null);

  private focusCount = false;
  private pendingOrg = false;
  private moving = false;
  private addingMember = false;

  constructor() {
    // The organizations, fresh each visit (their pipeline, applications and members follow).
    effect(() => {
      if (this.w.auth.isLoggedIn()) untracked(() => this.reload());
    });
    // Another tab: a record's pane closes, and New application unless the tab is Applications.
    effect(() => {
      const tab = this.tab();
      untracked(() => {
        if (this.pane() === 'record' || (this.pane() === 'new' && tab !== 'applications')) this.pane.set(null);
        this.lastWrite.set(null);
      });
    });
    // Another application in the pane: Approve or Fund (and an earlier write's error) were the other's.
    effect(() => {
      const id = this.paneApp()?.id;
      untracked(() => {
        this.amountFor.set(null);
        const w = this.lastWrite();
        if (w && w.kind === 'update' && w.id !== id) this.lastWrite.set(null);
      });
    });
    effect(() => {
      if (this.pane() === 'record' && !this.paneApp()) untracked(() => this.closePane(true));
    });
    // After paging, the list starts from its count, which takes focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.lender().applicationsLoading || !this.focusCount) return;
      this.focusCount = false;
      untracked(() => {
        const el = this.countEl()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
    // The colleague was found: their row and Give access come into view (on a phone they would
    // otherwise sit under the keyboard or the bottom bar). Focus stays in the email field.
    effect(() => {
      if (!this.found()?.value) return;
      untracked(() =>
        afterNextRender(
          () => document.querySelector('.lr-person')?.scrollIntoView?.({ block: 'nearest' }),
          { injector: this.injector },
        ),
      );
    });
    // A write from this page that settled: its form clears (only once, for that write).
    effect(() => {
      const s = this.lender();
      if (s.saving) return;
      untracked(() => {
        if (this.moving) {
          this.moving = false;
          if (!s.saveError) this.amountFor.set(null);
        }
        if (this.addingMember) {
          this.addingMember = false;
          if (!s.saveError) {
            this.memberEmail.set('');
            this.w.store.dispatch(A.clearMemberLookup());
          }
        }
        if (this.pendingOrg) {
          this.pendingOrg = false;
          if (!s.saveError) {
            this.orgName.set('');
            if (this.pane() === 'org') this.closePane(true);
            // The no-organization section gave way to the tabs: focus goes to the first one.
            afterNextRender(() => document.getElementById('lender-tab-' + this.tab())?.focus(), { injector: this.injector });
          }
        }
      });
    });
  }

  reload() {
    this.w.store.dispatch(A.loadOrganizations());
  }
  select(tab: Tab) {
    this.tab.set(tab);
    if (this.route.snapshot.queryParamMap.get('tab') !== tab)
      void this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  onTabKey(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const order = TABS.map(([t]) => t);
    const i = order.indexOf(this.tab());
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length;
    this.select(order[next]);
    document.getElementById('lender-tab-' + order[next])?.focus();
  }
  chooseOrganization(id: number) {
    this.pane.set(null);
    this.lastWrite.set(null);
    this.w.store.dispatch(A.selectOrganization({ organizationId: Number(id) }));
  }
  createOrganization() {
    const name = this.orgName().trim();
    if (!name || name.length > 160 || this.saving() || !this.w.requireAccount('create an organization')) return;
    this.pendingOrg = true;
    this.w.store.dispatch(A.createOrganization({ name }));
  }
  loadPipeline() {
    this.w.store.dispatch(A.loadPipeline());
  }
  loadMembers() {
    this.w.store.dispatch(A.loadMembers());
  }
  loadApplications(page: number, stage = this.lender().stage) {
    this.w.store.dispatch(A.loadApplications({ page, stage }));
  }
  page(page: number) {
    this.focusCount = true;
    this.pane.set(null);
    this.loadApplications(page);
  }
  openStage(stage: string | null) {
    this.select('applications');
    this.filterStage(stage as LenderApplicationStage | null);
    this.focusCount = true;
    afterNextRender(() => document.getElementById('lender-tab-applications')?.focus(), { injector: this.injector });
  }
  /** A stage link: the pane closes without moving focus, which stays on the link. */
  filterStage(stage: LenderApplicationStage | null) {
    this.pane.set(null);
    this.loadApplications(0, stage);
  }

  openApplication(id: unknown) {
    this.amountFor.set(null);
    this.selectedId.set(id);
    this.pane.set('record');
  }
  openNew() {
    this.selectedId.set(null);
    this.pane.set('new');
  }
  openOrg() {
    this.selectedId.set(null);
    this.pane.set('org');
  }
  closePane(toNew = false) {
    const was = this.pane();
    if (!was) return;
    this.pane.set(null);
    this.amountFor.set(null);
    afterNextRender(
      () => {
        const row = document.querySelector<HTMLElement>('.lr-table tr.gz-row.sel');
        (was === 'record' && row && !toNew ? row : this.newButton()?.nativeElement)?.focus({ preventScroll: false });
      },
      { injector: this.injector },
    );
  }
  step(by: number) {
    const next = this.lender().applications[this.paneIndex() + by];
    if (next) this.openApplication(next.id);
  }

  startMove(a: LenderApplicationDTO, to: LenderApplicationStage) {
    if (this.saving()) return;
    if (to === 'APPROVED' || to === 'FUNDED') {
      this.amountFor.set(to);
      return;
    }
    void this.move(a, to);
  }
  async move(a: LenderApplicationDTO, to: LenderApplicationStage, amount?: number) {
    if (!nextLenderStages(a.stage).includes(to) || this.saving() || !this.w.requireAccount('update applications')) return;
    if (TERMINAL_LENDER_STAGES.includes(to)) {
      const word = lenderStageLabels[to].toLowerCase();
      const ok = await this.confirmation.confirm({
        title: `Mark as ${word}?`,
        message: `${a.applicantName}'s application will be recorded as ${word}. Its stage can't be changed afterwards.`,
        confirmLabel: `Mark ${word}`,
      });
      if (!ok || this.destroy.destroyed || this.saving()) return;
    }
    this.moving = true;
    this.lastWrite.set({ kind: 'update', id: a.id });
    document.querySelector<HTMLElement>('.desk-slot .pane-title')?.focus();
    this.w.store.dispatch(
      A.updateApplication({
        id: a.id,
        request: {
          stage: to,
          ...(to === 'APPROVED' ? { approvedAmount: amount } : {}),
          ...(to === 'FUNDED' ? { fundedAmount: amount } : {}),
        },
      }),
    );
  }
  findMember() {
    if (this.memberWhy() || this.found()?.loading || !this.w.requireAccount('manage team access')) return;
    this.w.store.dispatch(A.lookUpMember({ email: this.memberEmail().trim() }));
  }
  /** Their name when the account has one, otherwise the email. */
  personName(p: LenderMemberLookupDTO) {
    return [p.firstName, p.lastName].filter((v) => v?.trim()).join(' ') || p.email;
  }
  addMember(p: LenderMemberLookupDTO) {
    if (p.member || this.lender().members.includes(p.userId)) return;
    if (this.saving() || !this.w.requireAccount('manage team access')) return;
    this.addingMember = true;
    this.lastWrite.set({ kind: 'member', id: null });
    this.w.store.dispatch(A.addMember({ userId: p.userId, who: this.personName(p) }));
  }
  async removeMember(userId: number) {
    const o = this.org();
    if (!o || userId === o.ownerUserId || this.saving()) return;
    const ok = await this.confirmation.confirm({
      title: 'Remove access?',
      message: `The member with user ID ${userId} will no longer see ${o.name}'s applications. Applications they recorded stay with the organization.`,
      confirmLabel: 'Remove access',
    });
    if (!ok || this.destroy.destroyed || this.saving() || !this.w.requireAccount('manage team access')) return;
    document.getElementById('lr-team-title')?.focus();
    this.lastWrite.set({ kind: 'member', id: null });
    this.w.store.dispatch(A.removeMember({ userId }));
  }
  useExample() {
    this.importText.set(LENDER_IMPORT_EXAMPLE);
    this.importError.set(null);
  }
  runImport() {
    if (!this.importText().trim() || this.saving()) return;
    const parsed = parseLenderImport(this.importText());
    if ('error' in parsed) {
      this.importError.set(parsed.error);
      return;
    }
    this.importError.set(null);
    if (!this.w.requireAccount('import applications')) return;
    this.w.store.dispatch(A.importApplications({ request: parsed.request }));
  }

  label(stage: LenderApplicationStage) {
    return lenderStageLabels[stage];
  }
  moveWord(to: LenderApplicationStage) {
    return MOVE[to];
  }
  loanType(a: LenderApplicationDTO) {
    return a.loanType && a.loanType !== 'UNKNOWN' ? loanTypeLabels[a.loanType] : 'Loan type: Unavailable';
  }
  compact(v: number) {
    return usdCompact(v) ?? '';
  }
  resultWord(status: string) {
    return { CREATED: 'Created', UPDATED: 'Updated', UNCHANGED: 'Unchanged', REJECTED: 'Rejected' }[status] ?? status;
  }
  importReason(code: string | null) {
    return code ? (IMPORT_REASON[code] ?? 'Rejected by the server') : '';
  }
  day(v: string | null | undefined) {
    return formatLocalDate(v);
  }
}
