import { Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { Pagination } from '../../shared/components/pagination';
import { LabelPipe } from '../../shared/pipes/label.pipe';
import { AdminActions as A } from '../../store/admin/admin.actions';
import { selectAdmin } from '../../store/admin/admin.selectors';
import { DataQualityRule } from '../../core/models/admin';

/**
 * Data-quality report (GET /admin/data-quality/issues): missing, stale, conflicting, outlier and
 * duplicate records per rule, and the issues of one rule with their source file provenance.
 * Read-only; nothing is changed or deleted. Realm role "admin" only.
 */
@Component({
  imports: [DatePipe, DecimalPipe, RouterLink, PageHeading, RequestStatus, Pagination, LabelPipe],
  template: `<gz-heading
      eyebrow="ADMIN"
      title="Data quality"
      subtitle="Records that are missing, stale, conflicting, unusual or stored twice."
    >
      @if (allowed()) {
        <button
          type="button"
          class="btn"
          [disabled]="s().quality.loading"
          (click)="load(s().qualityRule, s().qualityPage)"
        >
          {{ s().quality.loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      }
    </gz-heading>
    @if (!w.auth.isLoggedIn()) {
      <div class="panel section guest-notice">
        <h3>Sign in as an administrator.</h3>
        <p class="sub spacer">The data-quality report is only visible to administrators.</p>
        <button type="button" class="btn primary spacer" (click)="w.signIn()">Sign in</button>
      </div>
    } @else if (!allowed()) {
      <div class="empty">
        Your account does not have the admin role, so the data-quality report is not available.
        <a class="btn spacer" routerLink="/dashboard">Back to overview</a>
      </div>
    } @else {
      <gz-request-status
        [loading]="s().quality.loading && !report()"
        loadingText="Counting issues…"
        [error]="s().quality.error"
        (retry)="load(s().qualityRule, s().qualityPage)"
      />
      @if (report(); as r) {
        <div class="panel section">
          <div class="panelhead">
            <div>
              <h3>Rules</h3>
              <p class="smalltext muted">
                {{ total() | number }} issues · counts from
                {{ r.generatedAt | date: 'mediumTime' }}
              </p>
            </div>
            @if (s().qualityRule) {
              <button type="button" class="linkbtn" (click)="load(null, 0)">Hide issues</button>
            }
          </div>
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Rule</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Reads</th>
                  <th scope="col" class="num">Issues</th>
                  <th scope="col"><span class="sr-only">Show</span></th>
                </tr>
              </thead>
              <tbody>
                @for (rule of r.summary; track rule.rule) {
                  <tr [class.selected]="rule.rule === s().qualityRule">
                    <td>
                      <b>{{ rule.description }}</b>
                      <div class="smalltext muted">{{ rule.rule }}</div>
                    </td>
                    <td>
                      <span class="tag" [class.amber]="rule.issueCount > 0">{{
                        rule.category | label
                      }}</span>
                    </td>
                    <td class="smalltext">{{ rule.source }}</td>
                    <td class="num">
                      <b>{{ rule.issueCount | number }}</b>
                    </td>
                    <td class="num">
                      @if (rule.issueCount) {
                        <button
                          type="button"
                          class="btn small"
                          [attr.aria-pressed]="rule.rule === s().qualityRule"
                          (click)="load(rule.rule, 0)"
                        >
                          {{ rule.rule === s().qualityRule ? 'Showing' : 'Show issues' }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (r.note) {
            <p class="sourcedata">{{ r.note }}</p>
          }
        </div>
        @if (r.issues; as page) {
          <div class="panel section" #issues tabindex="-1" aria-label="Issues of the selected rule">
            <div class="panelhead">
              <h3>{{ ruleName() }}</h3>
              <span class="smalltext muted">{{ page.totalElements | number }} issues</span>
            </div>
            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Issue</th>
                    <th scope="col">Property</th>
                    <th scope="col">Source file</th>
                  </tr>
                </thead>
                <tbody>
                  @for (i of page.content; track i.reference) {
                    <tr>
                      <td class="smalltext">
                        <code>{{ i.reference }}</code>
                      </td>
                      <td>{{ i.detail }}</td>
                      <td>
                        @if (i.propertyId) {
                          <a [routerLink]="['/property', i.propertyId]">{{
                            i.folio ? 'Folio ' + i.folio : 'Property #' + i.propertyId
                          }}</a>
                        } @else {
                          —
                        }
                      </td>
                      <td class="smalltext">
                        @if (i.sourceCounty || i.sourceState) {
                          {{ i.sourceCounty }}{{ i.sourceState ? ', ' + i.sourceState : '' }}
                          @if (i.sourcePropertyId !== null) {
                            · row {{ i.sourcePropertyId }}
                          }
                        } @else {
                          <span class="muted">Not imported from a file</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <gz-pagination
              [page]="page.page"
              [pages]="page.totalPages"
              [total]="page.totalElements"
              [loading]="s().quality.loading"
              [focusTarget]="issues"
              (changed)="load(s().qualityRule, $event)"
            />
            <p class="sourcedata">
              The issue list is read live, so it can differ slightly from a count calculated a few
              minutes ago.
            </p>
          </div>
        }
      }
    }`,
  styles: `
    .num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    tr.selected td {
      background: #f6eee8;
    }
    code {
      font-size: 12px;
      word-break: break-all;
    }
  `,
})
export class DataQuality implements OnInit {
  w = inject(Workspace);
  s = this.w.store.selectSignal(selectAdmin);
  allowed = computed(() => this.w.auth.isLoggedIn() && this.w.auth.hasRealmRole('admin'));
  report = computed(() => this.s().quality.value);
  total = computed(() => this.report()?.summary.reduce((n, r) => n + r.issueCount, 0) ?? 0);
  ruleName = computed(() => {
    const rule = this.s().qualityRule;
    return this.report()?.summary.find((r) => r.rule === rule)?.description ?? rule ?? '';
  });
  ngOnInit() {
    if (this.allowed() && !this.report()) this.load(null, 0);
  }
  load(rule: DataQualityRule | null, page: number) {
    this.w.store.dispatch(A.loadDataQuality({ rule, page }));
  }
}
