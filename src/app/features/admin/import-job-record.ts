import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { RECORD_KIT } from '../../shared/components/record';
import { TABLE_KIT } from '../../shared/table';
import { RouterLink } from '@angular/router';
import { RequestStatus } from '../../shared/components/request-status';
import { formatLocalDateTime } from '../../shared/data/format';
import { labelFor } from '../../shared/pipes/label.pipe';
import { ImportJobDTO } from '../../core/models/import-job';
import { BACKFILL, itemWhere, jobActive, jobKind, jobPlace, jobRef, jobStatus, writtenWord } from './import-words';

const FIRST = 50;

/**
 * One import job in the record pane: its progress as ruled rows, a failure as a sentence with its
 * code under Details, and the records that failed or were skipped (an image backfill: each
 * property's result). The detail answer carries the records; until it arrives the list row's
 * figures show.
 */
@Component({
  selector: 'gz-import-job-record',
  imports: [DecimalPipe, SlicePipe, RouterLink, RequestStatus, ...RECORD_KIT, ...TABLE_KIT],
  template: `
    @let j = job();
    @if (j.errorMessage || j.errorCode) {
      <gz-record-section heading="What went wrong">
        <p class="jr-text attention">{{ j.errorMessage || 'The job stopped with an error; the server sent no message.' }}</p>
        @if (j.errorCode || j.inputStorage) {
          <details class="jr-details">
            <summary>Details</summary>
            <gz-record-group>
              @if (j.errorCode) {
                <div gz-record-row label="Code">{{ j.errorCode }}</div>
              }
              @if (j.inputStorage) {
                <div gz-record-row label="Input files">{{ j.inputStorage }}</div>
              }
            </gz-record-group>
          </details>
        }
      </gz-record-section>
    }
    <gz-record-section heading="Progress">
      <gz-record-group>
        <div gz-record-row label="Status">
          {{ status(j.status) }}
          @if (j.currentStep && active(j)) {
            <span class="jr-sub">{{ j.currentStep }}</span>
          }
        </div>
        <div gz-record-row label="Processed" [numeric]="true">{{ j.processed | number }} of {{ j.total | number }}</div>
        <div gz-record-row [label]="written(j)" [numeric]="true">{{ j.completed | number }}</div>
        <div gz-record-row label="Skipped" [numeric]="true">{{ j.skipped | number }}</div>
        <div gz-record-row label="Failed" [numeric]="true">{{ j.failed | number }}</div>
        <div gz-record-row label="Queued">{{ when(j.createdAt) }}</div>
        @if (j.startedAt) {
          <div gz-record-row label="Started">{{ when(j.startedAt) }}</div>
        }
        <div gz-record-row label="Finished">{{ j.finishedAt ? when(j.finishedAt) : 'Not yet' }}</div>
      </gz-record-group>
    </gz-record-section>
    <gz-record-section heading="Job">
      <gz-record-group>
        @if (kind(j); as k) {
          <div gz-record-row label="Kind">{{ k }}</div>
        }
        <div gz-record-row label="County" [missing]="!place(j)" reason="Not named by the job">{{ place(j) }}</div>
        <div gz-record-row label="Job ID">{{ j.jobId !== null ? '#' + j.jobId : j.id }}</div>
        @if ((j.attempt ?? 1) > 1) {
          <div gz-record-row label="Attempt" [numeric]="true">{{ j.attempt }}</div>
        }
        @if (j.retryOfJobId; as earlier) {
          <div gz-record-row label="Resumes">
            <button type="button" class="linkbtn" (click)="openJob.emit(earlier)">Job ID {{ ref(earlier) }}</button>
          </div>
        }
      </gz-record-group>
    </gz-record-section>
    <gz-record-section [heading]="j.jobType === backfill ? 'Each property' : 'Failed and skipped records'">
      <gz-request-status [loading]="loading()" loadingText="Loading the job’s records…" [error]="error()" (retry)="reload.emit()" />
      @if (detail()) {
        @if (j.jobType === backfill) {
          <table gz-table sticky="none" class="jr-table">
            <caption class="sr-only">Each property the backfill looked at</caption>
            <thead>
              <tr><th scope="col">Property</th><th scope="col">Result</th><th scope="col">Reason</th></tr>
            </thead>
            <tbody>
              @for (r of results() | slice: 0 : shown(); track r.propertyId) {
                <tr>
                  <!-- An ID link, not the address: a backfill lists up to 1,000 properties, one lookup each. -->
                  <td><a [routerLink]="['/property', r.propertyId]">Property ID {{ r.propertyId }}</a></td>
                  <td>{{ label(r.status) }}</td>
                  <td>{{ r.reason }}</td>
                </tr>
              } @empty {
                <tr gz-empty-row [colspan]="3" message="No per-property results are recorded yet."></tr>
              }
            </tbody>
          </table>
          @if (results().length > shown()) {
            <button type="button" class="linkbtn jr-more" (click)="showAll()">Show all {{ results().length | number }}</button>
          }
        } @else {
          <table gz-table sticky="none" class="jr-table">
            <caption class="sr-only">Records that failed or were skipped</caption>
            <thead>
              <tr><th scope="col">Record</th><th scope="col">Result</th><th scope="col">Reason</th></tr>
            </thead>
            <tbody>
              @for (r of items() | slice: 0 : shown(); track $index) {
                <tr>
                  <td class="jr-where">{{ where(r.itemKey) }}</td>
                  <td [class.attention]="r.status === 'FAILED'">{{ r.status === 'FAILED' ? 'Failed' : 'Skipped' }}</td>
                  <td>
                    {{ label(r.reason) }}
                    @if (r.message) {
                      <span class="cell-sub">{{ r.message }}</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr gz-empty-row [colspan]="3" message="No record failed or was skipped."></tr>
              }
            </tbody>
          </table>
          @if (items().length > shown()) {
            <button type="button" class="linkbtn jr-more" (click)="showAll()">Show all {{ items().length | number }}</button>
          }
          @if (items().length >= 1000) {
            <p class="table-note">The server lists the first 1,000 records that failed or were skipped.</p>
          }
        }
      }
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
    }
    gz-record-section + gz-record-section {
      margin-top: var(--sp-16);
    }
    .jr-text {
      margin: var(--sp-8) 0 0;
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      overflow-wrap: anywhere;
    }
    .jr-details {
      margin-top: var(--sp-8);
      font-size: var(--fs-cell);
    }
    .jr-details summary {
      cursor: pointer;
      color: var(--copper);
      font-weight: 500;
    }
    .jr-sub {
      display: block;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
      color: var(--ink-2);
    }
    .jr-table {
      margin-top: var(--sp-8);
    }
    .jr-where {
      overflow-wrap: anywhere;
    }
    .jr-more {
      margin-top: var(--sp-8);
    }
  `,
})
export class ImportJobRecord {
  /** The job: the detail answer, or the list row while the detail loads. */
  readonly job = input.required<ImportJobDTO>();
  /** Whether `job` is the detail answer (it alone carries the records). */
  readonly detail = input(false);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly openJob = output<string>();
  readonly reload = output<void>();
  readonly backfill = BACKFILL;
  readonly items = computed(() => this.job().items ?? []);
  readonly results = computed(() => this.job().results ?? []);
  /** The first 50 records; all of them on request (up to the server's 1,000). */
  readonly shown = signal(FIRST);

  private readonly jobId = computed(() => this.job().id);

  constructor() {
    // Another job (not the same job polled again): back to its first 50 records.
    effect(() => {
      this.jobId();
      untracked(() => this.shown.set(FIRST));
    });
  }

  showAll() {
    this.shown.set(Number.MAX_SAFE_INTEGER);
  }
  status = jobStatus;
  active = jobActive;
  kind = jobKind;
  place = jobPlace;
  written = writtenWord;
  ref = jobRef;
  where = itemWhere;
  label(code: string | null) {
    return labelFor(code);
  }
  when(v: string) {
    return formatLocalDateTime(v);
  }
}
