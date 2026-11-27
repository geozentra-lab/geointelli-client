import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { ConfirmationService } from '../../shared/components/confirm-dialog';
import { CrmActions as A } from '../../store/crm/crm.actions';
import { CrmClientDTO, CrmLeadDTO, CrmTaskDTO } from '../../core/models/crm';
import { Crm } from './crm';

const client = (id: number, over: Partial<CrmClientDTO> = {}): CrmClientDTO => ({
  id,
  name: 'Client ' + id,
  email: `c${id}@example.com`,
  phone: null,
  notes: null,
  createdAt: '2026-11-01T12:00:00Z',
  updatedAt: '2026-11-01T12:00:00Z',
  ...over,
});
const lead = (id: number, over: Partial<CrmLeadDTO> = {}): CrmLeadDTO => ({
  id,
  clientId: 1,
  propertyId: null,
  title: 'Lead ' + id,
  source: 'Referral',
  stage: 'NEW',
  notes: null,
  createdAt: '2026-11-01T12:00:00Z',
  updatedAt: '2026-11-10T12:00:00Z',
  ...over,
});
const task = (id: number, over: Partial<CrmTaskDTO> = {}): CrmTaskDTO => ({
  id,
  title: 'Task ' + id,
  description: null,
  status: 'OPEN',
  dueAt: '2026-11-09T15:00:00Z',
  completedAt: null,
  overdue: true,
  clientId: 1,
  leadId: null,
  propertyId: null,
  transactionId: null,
  createdAt: '2026-11-01T12:00:00Z',
  updatedAt: '2026-11-01T12:00:00Z',
  ...over,
});
const page = <T>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

describe('CRM', () => {
  let store: Store;
  let dispatched: Action[];
  const auth = { loggedIn: true };
  const confirm = vi.fn(async () => true);
  beforeEach(() => {
    auth.loggedIn = true;
    confirm.mockClear();
  });

  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'crm', component: Crm },
          { path: 'crm/:tab', component: Crm },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => auth.loggedIn, hasRealmRole: () => false } },
        { provide: ConfirmationService, useValue: { confirm } },
      ],
    });
    store = TestBed.inject(Store);
    dispatched = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action) => {
      dispatched.push(a);
      return dispatch(a);
    }) as Store['dispatch']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, Crm);
    const el = harness.routeNativeElement as HTMLElement;
    document.body.appendChild(harness.fixture.nativeElement);
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    return { harness, el, settle };
  }
  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  const spaced = (el: Element | null) => {
    const walk = document.createTreeWalker(el!, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    while (walk.nextNode()) out.push(walk.currentNode.textContent!);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  const of = <T extends Action>(type: string) => dispatched.filter((a) => a.type === type) as T[];
  const button = (root: Element, words: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === words)!;

  it('asks a guest to sign in and loads nothing', async () => {
    auth.loggedIn = false;
    const { el } = await setup('/crm');
    expect(el.textContent).toContain('Sign in to keep your client work');
    expect(of(A.loadOverview.type)).toHaveLength(0);
  });

  it('lists leads as a table at /crm/leads, filtered by ?stage=, the h1 being the list’s name', async () => {
    const { el, harness, settle } = await setup('/crm/leads?stage=CONTACTED');
    expect(text(el.querySelector('h1'))).toBe('Leads');
    expect(of(A.loadOptions.type)).toHaveLength(1);
    expect(of<ReturnType<typeof A.loadLeads>>(A.loadLeads.type)[0]).toMatchObject({ page: 0, stage: 'CONTACTED' });
    store.dispatch(A.optionsLoaded({ clients: [client(1, { name: 'Haley Brooks' })], leads: [], deals: [] }));
    store.dispatch(A.leadsLoaded({ page: page([lead(5, { stage: 'CONTACTED' })]) }));
    await settle();
    const row = el.querySelector('.cm-table tbody tr')!;
    expect(spaced(row)).toContain('Lead 5 Haley Brooks Contacted Referral');
    expect(text(el.querySelector('.cm-count'))).toBe('1 lead · Contacted');
    // The tab follows the address: the rail's Tasks link.
    await harness.navigateByUrl('/crm/tasks');
    await settle();
    expect(text(el.querySelector('h1'))).toBe('Tasks');
    expect(of(A.loadTasks.type)).toHaveLength(1);
  });

  it('opens a lead in the pane; the way forward is primary and a final stage asks first', async () => {
    const { el, settle } = await setup('/crm/leads');
    store.dispatch(A.leadsLoaded({ page: page([lead(5, { stage: 'QUALIFIED' })]) }));
    await settle();
    (el.querySelector('.cm-table tbody tr td') as HTMLElement).click();
    await settle();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane.querySelector('.pane-title'))).toBe('Lead 5');
    const forward = button(pane, 'Move to Converted');
    expect(forward.classList).toContain('primary');
    expect(button(pane, 'Mark lost').classList).not.toContain('primary');
    forward.click();
    await settle();
    expect(confirm).toHaveBeenCalled();
    expect(of<ReturnType<typeof A.updateLead>>(A.updateLead.type)[0]).toEqual(A.updateLead({ id: 5, request: { stage: 'CONVERTED' } }));
    // Its history is asked for, as notes live there.
    expect(of<ReturnType<typeof A.loadHistory>>(A.loadHistory.type)[0]).toMatchObject({ subject: 'LEAD', id: 5 });
  });

  it('marks a task done from its pane, with overdue said in words', async () => {
    const { el, settle } = await setup('/crm/tasks');
    store.dispatch(A.tasksLoaded({ page: page([task(9)]) }));
    await settle();
    expect(spaced(el.querySelector('.cm-table tbody tr'))).toContain('Overdue');
    (el.querySelector('.cm-table tbody tr td') as HTMLElement).click();
    await settle();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    button(pane, 'Mark done').click();
    await settle();
    expect(of<ReturnType<typeof A.updateTask>>(A.updateTask.type)[0]).toEqual(A.updateTask({ id: 9, request: { status: 'COMPLETED' } }));
  });

  it('opens New lead in the pane and says what is missing before Create', async () => {
    const { el, settle } = await setup('/crm/leads');
    store.dispatch(A.optionsLoaded({ clients: [client(1)], leads: [], deals: [] }));
    store.dispatch(A.leadsLoaded({ page: page([]) }));
    await settle();
    button(el, 'New lead').click();
    await settle();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane.querySelector('.pane-title'))).toBe('New lead');
    const create = button(pane, 'Create lead');
    expect(create.getAttribute('aria-disabled')).toBe('true');
    expect(text(pane.querySelector('#cf-why'))).toBe('Enter a title.');
    const title = pane.querySelector<HTMLInputElement>('#cf-title')!;
    title.value = 'Wants a 3-bed';
    title.dispatchEvent(new Event('input'));
    const who = pane.querySelector<HTMLSelectElement>('#cf-client')!;
    await settle();
    who.selectedIndex = 1;
    who.dispatchEvent(new Event('change'));
    const source = pane.querySelector<HTMLInputElement>('#cf-source')!;
    source.value = 'Referral';
    source.dispatchEvent(new Event('input'));
    await settle();
    expect(pane.querySelector('#cf-why')).toBeNull();
    create.click();
    const sent = of<ReturnType<typeof A.createLead>>(A.createLead.type)[0];
    expect(sent.request).toEqual({ clientId: 1, propertyId: undefined, title: 'Wants a 3-bed', source: 'Referral', notes: undefined });
    // Saved: the pane closes.
    store.dispatch(A.saved({ collection: 'leads', message: 'Lead captured.' }));
    await settle();
    expect(el.querySelector('.desk-slot')).toBeNull();
  });

  it('says a client list that could not be read, with Retry, never "add a client first"', async () => {
    const { el, settle } = await setup('/crm/leads');
    store.dispatch(A.optionsLoaded({ clients: [], leads: [], deals: [], failed: ['clients'] }));
    store.dispatch(A.leadsLoaded({ page: page([]) }));
    await settle();
    button(el, 'New lead').click();
    await settle();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(pane.textContent).not.toContain('add a client first');
    expect(text(pane.querySelector('.cf-hint[role=alert]'))).toBe(
      'Your clients, leads and deals could not all be loaded, so the lists below may be missing some. Retry',
    );
    const asked = of(A.loadOptions.type).length;
    button(pane, 'Retry').click();
    expect(of(A.loadOptions.type)).toHaveLength(asked + 1);
    // Read again: a list that fails keeps the one already held.
    store.dispatch(A.optionsLoaded({ clients: [client(1)], leads: [], deals: [] }));
    store.dispatch(A.optionsLoaded({ clients: [], leads: [], deals: [], failed: ['clients'] }));
    await settle();
    expect(pane.querySelector('.cf-hint[role=alert]')).not.toBeNull();
    expect(pane.querySelector<HTMLSelectElement>('#cf-client')!.options.length).toBe(2);
  });

  it('changes a client from one form, sending only what changed', async () => {
    const { el, settle } = await setup('/crm/clients');
    store.dispatch(A.clientsLoaded({ page: page([client(1, { phone: '+1 305 555 0101' })]) }));
    await settle();
    (el.querySelector('.cm-table tbody tr td') as HTMLElement).click();
    await settle();
    const pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane)).toContain('Nothing has changed.');
    const email = pane.querySelector<HTMLInputElement>('#cc-email')!;
    email.value = '';
    email.dispatchEvent(new Event('input'));
    await settle();
    pane.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    expect(of<ReturnType<typeof A.updateClient>>(A.updateClient.type)[0]).toEqual(A.updateClient({ id: 1, request: { email: null } }));
    // Neither email nor phone: the reason, and nothing sent.
    const phone = pane.querySelector<HTMLInputElement>('#cc-phone')!;
    phone.value = '';
    phone.dispatchEvent(new Event('input'));
    await settle();
    expect(text(pane.querySelector('#cc-why'))).toBe('Add an email address or a phone number.');
  });

  it('shows the overview: tasks, deals by stage and activity that opens its record', async () => {
    const { el, harness, settle } = await setup('/crm');
    store.dispatch(
      A.overviewLoaded({
        summary: { total: 9, open: 4, inProgress: 2, completed: 2, cancelled: 1, overdue: 3, asOf: '2026-11-18T12:00:00Z' },
        pipeline: { total: 3, stages: { PROSPECT: 1, VIEWING: 1, OFFER: 1, UNDER_CONTRACT: 0, CLOSED: 0, CANCELLED: 0 }, asOf: '2026-11-18T12:00:00Z' } as never,
        activities: page([{ id: 1, clientId: 1, subjectType: 'LEAD' as const, subjectId: 5, activityType: 'LEAD_CREATED' as never, description: 'From the website', createdAt: '2026-11-18T12:00:00Z' }]),
      }),
    );
    await settle();
    expect([...el.querySelectorAll('.kpi-value')].map((x) => text(x))).toEqual(['4', '2', '3', '2']);
    expect(el.querySelector('.stages a')).not.toBeNull();
    (el.querySelector('table tbody tr td') as HTMLElement).click();
    await settle();
    await harness.fixture.whenStable();
    // /crm to /crm/leads is another route: the page is a new instance.
    const leadsPage = harness.routeNativeElement as HTMLElement;
    expect(text(leadsPage.querySelector('h1'))).toBe('Leads');
    store.dispatch(A.leadsLoaded({ page: page([lead(5)]) }));
    await settle();
    expect(text(leadsPage.querySelector('.desk-slot .pane-title'))).toBe('Lead 5');
  });

  it('opens the New form when the address asks for it (?new=1, from the realtor overview)', async () => {
    const { el, settle } = await setup('/crm/tasks?new=1');
    await settle();
    expect(text(el.querySelector('.desk-slot .pane-title'))).toBe('New task');
  });

  it('says a failed move in that record’s pane only, and why Add note can’t run', async () => {
    const { el, settle } = await setup('/crm/leads');
    store.dispatch(A.leadsLoaded({ page: page([lead(5), lead(6)]) }));
    await settle();
    const rows = () => [...el.querySelectorAll<HTMLElement>('.cm-table tbody tr')];
    rows()[0].querySelector('td')!.click();
    await settle();
    let pane = el.querySelector('.desk-slot gz-record-pane')!;
    button(pane, 'Move to Contacted').click();
    await settle();
    // Focus waits on the pane's title while the buttons change.
    expect(document.activeElement).toBe(pane.querySelector('.pane-title'));
    store.dispatch(A.saveFailed({ error: 'The lead could not be updated.' }));
    await settle();
    expect(text(el.querySelector('.cm-pane-error'))).toBe('The lead could not be updated.');
    rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    pane = el.querySelector('.desk-slot gz-record-pane')!;
    expect(text(pane.querySelector('.pane-title'))).toBe('Lead 6');
    expect(el.querySelector('.cm-pane-error')).toBeNull();
    expect(spaced(pane)).toContain('Write the note first.');
  });
});
