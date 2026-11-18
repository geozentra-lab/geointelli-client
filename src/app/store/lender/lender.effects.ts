import { SessionScopedEffects } from '../session-scoped-effects';
import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  EMPTY,
  catchError,
  concatMap,
  filter,
  map,
  mergeMap,
  of,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import { LenderService } from '../../data-access/lender.service';
import { apiError } from '../../core/models/api-error';
import { UiActions } from '../ui/ui.actions';
import { LenderActions as A } from './lender.actions';
import { selectLender } from './lender.selectors';
@Injectable()
export class LenderEffects extends SessionScopedEffects {
  private actions = inject(Actions);
  private service = inject(LenderService);
  private store = inject(Store);
  private lender = this.store.select(selectLender);

  organizations = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadOrganizations),
      switchMap(() =>
        this.service.organizations().pipe(
          map((organizations) => A.organizationsLoaded({ organizations })),
          catchError((e) => of(A.organizationsFailed({ error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** Whenever the active organization is (re)established, load everything scoped to it. */
  organizationData = createEffect(() =>
    this.actions.pipe(
      ofType(A.organizationsLoaded, A.selectOrganization, A.organizationCreated),
      withLatestFrom(this.lender),
      filter(([, s]) => s.selectedId !== null),
      mergeMap(([, s]) => [
        A.loadPipeline(),
        A.loadApplications({ page: 0, stage: s.stage }),
        A.loadMembers(),
      ]),
    ),
  );
  collateral = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadCollateral),
      withLatestFrom(this.lender),
      mergeMap(([{ applicationId }, s]) =>
        s.selectedId === null
          ? EMPTY
          : this.service.collateralAnalysis(s.selectedId, applicationId).pipe(
              map((analysis) => A.collateralLoaded({ applicationId, analysis })),
              catchError((e) => of(A.collateralFailed({ applicationId, error: apiError(e) }))),
            ),
      ),
    ),
  );
  pipeline = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadPipeline),
      withLatestFrom(this.lender),
      switchMap(([, s]) =>
        s.selectedId === null
          ? EMPTY
          : this.service.pipeline(s.selectedId).pipe(
              map((pipeline) => A.pipelineLoaded({ pipeline })),
              catchError((e) => of(A.pipelineFailed({ error: apiError(e) }))),
            ),
      ),
    ),
  );
  applications = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadApplications),
      withLatestFrom(this.lender),
      switchMap(([{ page, stage }, s]) =>
        s.selectedId === null
          ? EMPTY
          : this.service.applications(s.selectedId, page, stage).pipe(
              map((result) => A.applicationsLoaded({ page: result })),
              catchError((e) => of(A.applicationsFailed({ error: apiError(e) }))),
            ),
      ),
    ),
  );
  members = createEffect(() =>
    this.actions.pipe(
      ofType(A.loadMembers),
      withLatestFrom(this.lender),
      switchMap(([, s]) =>
        s.selectedId === null
          ? EMPTY
          : this.service.members(s.selectedId).pipe(
              map((members) => A.membersLoaded({ members })),
              catchError((e) => of(A.membersFailed({ error: apiError(e) }))),
            ),
      ),
    ),
  );

  createOrganization = createEffect(() =>
    this.actions.pipe(
      ofType(A.createOrganization),
      concatMap(({ name }) =>
        this.service.createOrganization(name).pipe(
          map((organization) => A.organizationCreated({ organization })),
          catchError((e) => of(A.writeFailed({ write: 'organization', error: apiError(e) }))),
        ),
      ),
    ),
  );
  /** Writes capture the organization at dispatch time so a later switch cannot redirect them. */
  createApplication = createEffect(() =>
    this.actions.pipe(
      ofType(A.createApplication),
      withLatestFrom(this.lender),
      concatMap(([{ request }, s]) =>
        s.selectedId === null
          ? of(A.writeFailed({ write: 'application', error: 'Choose an organization first.' }))
          : this.service.createApplication(s.selectedId, request).pipe(
              map((application) => A.applicationSaved({ application, created: true })),
              catchError((e) => of(A.writeFailed({ write: 'application', error: apiError(e) }))),
            ),
      ),
    ),
  );
  updateApplication = createEffect(() =>
    this.actions.pipe(
      ofType(A.updateApplication),
      withLatestFrom(this.lender),
      concatMap(([{ id, request }, s]) =>
        s.selectedId === null
          ? EMPTY
          : this.service.updateApplication(s.selectedId, id, request).pipe(
              map((application) => A.applicationSaved({ application, created: false })),
              catchError((e) => of(A.writeFailed({ write: 'update', error: apiError(e) }))),
            ),
      ),
    ),
  );
  addMember = createEffect(() =>
    this.actions.pipe(
      ofType(A.addMember),
      withLatestFrom(this.lender),
      concatMap(([{ userId }, s]) =>
        s.selectedId === null
          ? EMPTY
          : this.service.addMember(s.selectedId, userId).pipe(
              map(() =>
                A.membersChanged({ message: 'User ' + userId + ' can now track applications.' }),
              ),
              catchError((e) => of(A.writeFailed({ write: 'member', error: apiError(e) }))),
            ),
      ),
    ),
  );
  removeMember = createEffect(() =>
    this.actions.pipe(
      ofType(A.removeMember),
      withLatestFrom(this.lender),
      concatMap(([{ userId }, s]) =>
        s.selectedId === null
          ? EMPTY
          : this.service.removeMember(s.selectedId, userId).pipe(
              map(() => A.membersChanged({ message: 'Access removed for user ' + userId + '.' })),
              catchError((e) => of(A.writeFailed({ write: 'member', error: apiError(e) }))),
            ),
      ),
    ),
  );
  importApplications = createEffect(() =>
    this.actions.pipe(
      ofType(A.importApplications),
      withLatestFrom(this.lender),
      concatMap(([{ request }, s]) =>
        s.selectedId === null
          ? EMPTY
          : this.service.importApplications(s.selectedId, request).pipe(
              map((result) => A.importFinished({ result })),
              catchError((e) => of(A.writeFailed({ write: 'import', error: apiError(e) }))),
            ),
      ),
    ),
  );

  /** Saved applications and imports change the pipeline totals and possibly the visible page. */
  refreshAfterWrite = createEffect(() =>
    this.actions.pipe(
      ofType(A.applicationSaved, A.importFinished),
      withLatestFrom(this.lender),
      mergeMap(([a, s]) => [
        A.loadPipeline(),
        A.loadApplications({
          page: a.type === A.applicationSaved.type && !a.created ? s.page : 0,
          stage: s.stage,
        }),
      ]),
    ),
  );
  refreshMembers = createEffect(() =>
    this.actions.pipe(
      ofType(A.membersChanged),
      map(() => A.loadMembers()),
    ),
  );
  feedback = createEffect(() =>
    this.actions.pipe(
      ofType(
        A.organizationCreated,
        A.applicationSaved,
        A.membersChanged,
        A.importFinished,
        A.writeFailed,
      ),
      map((a) => {
        switch (a.type) {
          case A.organizationCreated.type:
            return UiActions.toast({
              message: 'Organization "' + a.organization.name + '" created.',
            });
          case A.applicationSaved.type:
            return UiActions.toast({
              message: a.created ? 'Application recorded as a draft.' : 'Application updated.',
            });
          case A.membersChanged.type:
            return UiActions.toast({ message: a.message });
          case A.importFinished.type:
            return UiActions.toast({
              message: `Import finished: ${a.result.created} created, ${a.result.updated} updated, ${a.result.unchanged} unchanged, ${a.result.rejected} rejected.`,
            });
          default:
            return UiActions.toast({ message: 'Not saved. ' + a.error, kind: 'error' });
        }
      }),
    ),
  );
}
