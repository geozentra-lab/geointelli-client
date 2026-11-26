import { Component, ElementRef, computed, effect, inject, untracked, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { RequestStatus } from '../../shared/components/request-status';
import { PropertyRef } from '../../shared/components/property-ref';
import { TABLE_KIT } from '../../shared/table';
import { countOf, formatFolio, formatLocalTime } from '../../shared/data/format';
import { labelFor } from '../../shared/pipes/label.pipe';
import { AdminActions as A } from '../../store/admin/admin.actions';
import { selectAdmin } from '../../store/admin/admin.selectors';
import { DataQualityIssue, DataQualityRule } from '../../core/models/admin';
import { AdminGate, adminAccess } from './admin-gate';

/**
 * Data quality (DESIGN.md §5 Register, Data quality): every rule with its count as a table; choosing
 * a rule (kept in the address as `?rule=`) lists its issues under it, server pages of 20, with the
 * property and the source county each came from. Read-only: nothing is changed or deleted.
 * Realm role "admin" only.
 */
@Component({
  imports: [DecimalPipe, RouterLink, PageHeading, RequestStatus, PropertyRef, AdminGate, ...TABLE_KIT],
  template: `
    <gz-heading title="Data quality" subtitle="Records that are missing, stale, conflicting, unusual or stored twice. Read-only: nothing here changes data.">
      @if (access() === 'admin') {
        <button type="button" class="btn" [attr.aria-disabled]="s().quality.loading ? 'true' : null" (click)="refresh()">
          {{ s().quality.loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      }
    </gz-heading>
    @if (access() !== 'admin') {
      <gz-admin-gate [access]="access()" what="the data-quality report" />
    } @else {
      <gz-request-status
        [loading]="s().quality.loading && !report()"
        loadingText="Counting issues across every record. The first count in 10 minutes can take a few minutes."
        [error]="s().quality.error"
        (retry)="refresh()"
      />
      @if (report(); as r) {
        <p class="dq-count" role="status">
          @if (total()) {
            {{ countOf(total(), 'issue') }} across {{ countOf(r.summary.length, 'rule') }}
          } @else {
            No issues: every record passes the {{ countOf(r.summary.length, 'rule') }}
          }
          @if (time(r.generatedAt); as at) {
            · counted at {{ at }}
          }
        </p>
        <table
          gz-table
          class="dq-rules"
          [selected]="rule()"
          (selectedChange)="choose($event)"
          (activated)="choose($event)"
          [attr.aria-busy]="s().quality.loading ? 'true' : null"
        >
          <caption class="sr-only">Data-quality rules. Choose a rule to list its issues below.</caption>
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col" data-priority="2">Kind</th>
              <th scope="col" data-priority="3">Tables read</th>
              <th scope="col" class="num">Issues</th>
            </tr>
          </thead>
          <tbody>
            @for (x of r.summary; track x.rule) {
              <tr [gz-row]="x.rule" [attr.aria-current]="x.rule === rule() ? 'true' : null">
                <td>
                  <span class="cell-main">{{ x.description }}</span>
                  <span class="m-only cell-sub">{{ label(x.category) }}</span>
                </td>
                <td data-priority="2">{{ label(x.category) }}</td>
                <td data-priority="3">{{ x.source }}</td>
                <td class="num" [class.dq-zero]="!x.issueCount">{{ x.issueCount | number }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (r.note) {
          <p class="table-note">{{ r.note }} Times are your own clock.</p>
        }

        @if (rule()) {
          <section class="dq-issues" aria-labelledby="dq-issues-title">
            <div class="dq-head">
              <h2 id="dq-issues-title" class="dq-title" #issuesTitle tabindex="-1">{{ ruleName() }}</h2>
              <button type="button" class="linkbtn" (click)="hide()">Hide issues</button>
            </div>
            @if (r.rule === rule() && r.issues; as page) {
              <p class="dq-sub">{{ countOf(page.totalElements, 'issue') }}</p>
              <table gz-table class="dq-issue-table" [attr.aria-busy]="s().quality.loading ? 'true' : null">
                <caption class="sr-only">Issues of the rule "{{ ruleName() }}"</caption>
                <thead>
                  <tr>
                    <th scope="col">Issue</th>
                    <th scope="col" data-priority="2">Property</th>
                    <th scope="col" data-priority="2">Source</th>
                    <th scope="col" data-priority="3">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  @for (i of page.content; track i.reference) {
                    <tr>
                      <td>
                        {{ i.detail }}
                                <span class="m-only cell-sub">
                          @if (i.propertyId && i.folio) {
                            <a [routerLink]="['/property', i.propertyId]">Folio {{ folio(i.folio) }}</a>
                          } @else if (i.propertyId) {
                            <gz-property-ref [propertyId]="i.propertyId" />
                          }
                          @if (place(i); as where) {
                            {{ i.propertyId ? ' · ' : '' }}{{ where }}
                          }
                        </span>
                      </td>
                      <td data-priority="2">
                        @if (i.propertyId && i.folio) {
                          <a [routerLink]="['/property', i.propertyId]">Folio {{ folio(i.folio) }}</a>
                        } @else if (i.propertyId) {
                          <gz-property-ref [propertyId]="i.propertyId" />
                        } @else {
                          <span class="muted">No property</span>
                        }
                      </td>
                      <td data-priority="2">
                        @if (i.sourceCounty || i.sourceState) {
                          {{ place(i) }}
                          @if (i.sourcePropertyId !== null) {
                            <span class="cell-sub">Source property ID {{ i.sourcePropertyId }}</span>
                          }
                        } @else {
                          <span class="muted">Not from a county file</span>
                        }
                      </td>
                      <td class="dq-ref" data-priority="3">{{ i.reference }}</td>
                    </tr>
                  } @empty {
                    <tr gz-empty-row [colspan]="4" message="No record breaks this rule in the latest count."></tr>
                  }
                </tbody>
              </table>
              <gz-pager
                [page]="page.page"
                [size]="page.size"
                [total]="page.totalElements"
                [loading]="s().quality.loading"
                (changed)="toPage($event)"
              />
              <p class="table-note">The issues are read live, so they can differ slightly from a count made a few minutes ago.</p>
            } @else if (s().quality.loading) {
              <p class="dq-sub">Loading the issues…</p>
            }
          </section>
        }
      }
    }
  `,
  styles: `
    .dq-count {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .dq-rules tr[aria-current='true'] .cell-main {
      font-weight: 600;
    }
    .dq-zero {
      color: var(--ink-2);
    }
    .dq-issues {
      margin-top: var(--sp-32);
    }
    .dq-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--sp-4) var(--sp-16);
    }
    .dq-title {
      margin: 0;
      font-size: var(--fs-section);
      line-height: var(--lh-section);
      outline: none;
      scroll-margin-top: calc(var(--topbar-h) + var(--sp-8));
    }
    .dq-sub {
      margin: var(--sp-4) 0 var(--sp-8);
      font-size: var(--fs-cell);
      color: var(--ink-2);
    }
    .dq-ref {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: var(--fs-caption);
      overflow-wrap: anywhere;
    }
  `,
})
export class DataQuality {
  readonly w = inject(Workspace);
  readonly s = this.w.store.selectSignal(selectAdmin);
  readonly access = adminAccess();
  private readonly router = inject(Router);
  private readonly issuesTitle = viewChild<ElementRef<HTMLElement>>('issuesTitle');
  /** The rule in the address (`?rule=`): the page follows it, Back included. */
  readonly rule = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => (q.get('rule') as DataQualityRule | null) || null)),
    { initialValue: null },
  );
  readonly report = computed(() => this.s().quality.value);
  readonly total = computed(() => this.report()?.summary.reduce((n, r) => n + r.issueCount, 0) ?? 0);
  readonly ruleName = computed(() => {
    const rule = this.rule();
    return this.report()?.summary.find((r) => r.rule === rule)?.description ?? labelFor(rule);
  });
  readonly countOf = countOf;
  private focusIssues = false;

  constructor() {
    // The report (and the chosen rule's first page) whenever the rule in the address changes.
    effect(() => {
      const rule = this.rule();
      if (this.access() !== 'admin') return;
      untracked(() => {
        const s = this.s();
        if (s.quality.value && s.qualityRule === rule && !s.quality.error) return;
        this.w.store.dispatch(A.loadDataQuality({ rule, page: 0 }));
      });
    });
    // After paging, the issues start from their heading, which takes focus (DESIGN.md §7 paging).
    effect(() => {
      if (this.s().quality.loading || !this.focusIssues) return;
      this.focusIssues = false;
      untracked(() => {
        const el = this.issuesTitle()?.nativeElement;
        el?.scrollIntoView?.({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    });
  }

  choose(rule: unknown) {
    if (typeof rule !== 'string' || rule === this.rule()) return;
    void this.router.navigate([], { queryParams: { rule }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  /** Back to the rules alone; focus goes to the rules table's chosen row, or the count. */
  hide() {
    void this.router.navigate([], { queryParams: { rule: null }, queryParamsHandling: 'merge', replaceUrl: true });
    document.querySelector<HTMLElement>('.dq-rules tr.gz-row.sel, .dq-rules tr.gz-row[tabindex="0"]')?.focus();
  }
  refresh() {
    if (this.s().quality.loading) return;
    this.w.store.dispatch(A.loadDataQuality({ rule: this.rule(), page: this.rule() ? this.s().qualityPage : 0 }));
  }
  toPage(page: number) {
    this.focusIssues = true;
    this.w.store.dispatch(A.loadDataQuality({ rule: this.rule(), page }));
  }
  label(code: string) {
    return labelFor(code);
  }
  folio(f: string) {
    return formatFolio(f);
  }
  time(v: string) {
    return formatLocalTime(v);
  }
  place(i: DataQualityIssue) {
    return [i.sourceCounty, i.sourceState].filter(Boolean).join(', ');
  }
}
