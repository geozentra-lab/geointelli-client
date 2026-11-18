import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Action, Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  Observable,
  catchError,
  concatMap,
  forkJoin,
  map,
  mergeMap,
  of,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import { CrmService } from '../../data-access/crm.service';
import { apiError } from '../../core/models/api-error';
import { CrmSubjectType } from '../../core/models/crm';
import { UiActions } from '../ui/ui.actions';
import { CrmActions as A } from './crm.actions';
import { CrmCollection } from './crm.model';
import { CrmState } from './crm.reducer';
import { selectCrm } from './crm.selectors';
/** CRM conflicts carry an actionable reason, e.g. an unsupported stage change or a referenced client. */
export function crmError(error: unknown): string {
  if (
    error instanceof HttpErrorResponse &&
    error.status === 409 &&
    typeof error.error?.message === 'string'
  )
    return error.error.message;
  return apiError(error);
}
const reloadAction = (s: CrmState, collection: CrmCollection): Action => {
  const list = s[collection];
  const page = Math.min(list.page, Math.max(0, list.totalPages - 1));
  switch (collection) {
    case 'clients':
      return A.loadClients({ page });
    case 'leads':
      return A.loadLeads({ page, stage: list.filter as never });
    case 'tasks':
      return A.loadTasks({ page, status: list.filter as never });
    case 'deals':
      return A.loadDeals({ page, stage: list.filter as never });
  }
};
@Injectable()
export class CrmEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(CrmService);
  private store = inject(Store);
  overview = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadOverview),
      switchMap(() =>
        forkJoin({
          summary: this.service.taskSummary(),
          pipeline: this.service.pipeline(),
          activities: this.service.activities(0, 10),
        }).pipe(
          map((result) => A.overviewLoaded(result)),
          catchError((e) => of(A.overviewFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  options = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadOptions),
      switchMap(() =>
        forkJoin({
          clients: this.service.clients(0, 100).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
          leads: this.service.leads(0, null, 100).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
          deals: this.service.deals(0, null, 100).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
        }).pipe(map((options) => A.optionsLoaded(options))),
      ),
    ),
  );
  clients = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadClients),
      switchMap(({ page }) =>
        this.service.clients(page).pipe(
          map((page) => A.clientsLoaded({ page })),
          catchError((e) => of(A.collectionFailed({ collection: 'clients', error: apiError(e) }))),
        ),
      ),
    ),
  );
  leads = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadLeads),
      switchMap(({ page, stage }) =>
        this.service.leads(page, stage).pipe(
          map((page) => A.leadsLoaded({ page })),
          catchError((e) => of(A.collectionFailed({ collection: 'leads', error: apiError(e) }))),
        ),
      ),
    ),
  );
  tasks = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadTasks),
      switchMap(({ page, status }) =>
        this.service.tasks(page, status).pipe(
          map((page) => A.tasksLoaded({ page })),
          catchError((e) => of(A.collectionFailed({ collection: 'tasks', error: apiError(e) }))),
        ),
      ),
    ),
  );
  deals = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadDeals),
      switchMap(({ page, stage }) =>
        this.service.deals(page, stage).pipe(
          map((page) => A.dealsLoaded({ page })),
          catchError((e) => of(A.collectionFailed({ collection: 'deals', error: apiError(e) }))),
        ),
      ),
    ),
  );
  history = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadHistory),
      switchMap(({ subject, id, page }) => {
        const key = subject + ':' + id;
        return this.service.history(subject, id, page).pipe(
          map((page) => A.historyLoaded({ key, page })),
          catchError((e) => of(A.historyFailed({ key, error: apiError(e) }))),
        );
      }),
    ),
  );
  save = createEffect(() =>
    this.actions.pipe(
      ofType(
        A.createClient,
        A.updateClient,
        A.deleteClient,
        A.createLead,
        A.updateLead,
        A.createTask,
        A.updateTask,
        A.deleteTask,
        A.createDeal,
        A.updateDeal,
        A.addNote,
      ),
      concatMap((a) => {
        let request: Observable<unknown>;
        let collection: CrmCollection | 'note';
        let message: string;
        switch (a.type) {
          case A.createClient.type:
            [request, collection, message] = [
              this.service.createClient(a.request),
              'clients',
              'Client added.',
            ];
            break;
          case A.updateClient.type:
            [request, collection, message] = [
              this.service.updateClient(a.id, a.request),
              'clients',
              'Client updated.',
            ];
            break;
          case A.deleteClient.type:
            [request, collection, message] = [
              this.service.deleteClient(a.id),
              'clients',
              'Client deleted.',
            ];
            break;
          case A.createLead.type:
            [request, collection, message] = [
              this.service.createLead(a.request, a.idempotencyKey),
              'leads',
              'Lead captured.',
            ];
            break;
          case A.updateLead.type:
            [request, collection, message] = [
              this.service.updateLead(a.id, a.request),
              'leads',
              'Lead updated.',
            ];
            break;
          case A.createTask.type:
            [request, collection, message] = [
              this.service.createTask(a.request),
              'tasks',
              'Task created.',
            ];
            break;
          case A.updateTask.type:
            [request, collection, message] = [
              this.service.updateTask(a.id, a.request),
              'tasks',
              'Task updated.',
            ];
            break;
          case A.deleteTask.type:
            [request, collection, message] = [
              this.service.deleteTask(a.id),
              'tasks',
              'Task deleted.',
            ];
            break;
          case A.createDeal.type:
            [request, collection, message] = [
              this.service.createDeal(a.request),
              'deals',
              'Deal created.',
            ];
            break;
          case A.updateDeal.type:
            [request, collection, message] = [
              this.service.updateDeal(a.id, a.request),
              'deals',
              'Deal updated.',
            ];
            break;
          default:
            [request, collection, message] = [
              this.service.addNote(a.subject, a.id, a.description),
              'note',
              'Note added.',
            ];
        }
        return request.pipe(
          map(() => A.saved({ collection, message })),
          catchError((e) => of(A.saveFailed({ error: crmError(e) }))),
        );
      }),
    ),
  );
  /** Acknowledged writes refresh the canonical lists, counts and the open history. */
  refresh = createEffect(() =>
    this.actions.pipe(
      ofType(A.saved),
      withLatestFrom(this.store.select(selectCrm)),
      mergeMap(([{ collection, message }, s]) => {
        const actions: Action[] = [UiActions.toast({ message }), A.loadOverview()];
        if (collection !== 'note') actions.push(reloadAction(s, collection), A.loadOptions());
        if (s.history.key) {
          const [subject, id] = s.history.key.split(':');
          actions.push(A.loadHistory({ subject: subject as CrmSubjectType, id: +id, page: 0 }));
        }
        return of(...actions);
      }),
    ),
  );
}
