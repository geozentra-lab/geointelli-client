// Realtor CRM and realtor dashboard fixtures.
//
//   /api/clients, /api/leads, /api/tasks (+ /summary), /api/transactions (+ /pipeline),
//   /api/crm/activities, /api/{clients,leads,tasks,transactions}/:id/activities,
//   /api/dashboards/realtor/clients-leads, /api/dashboards/realtor/tasks-pipeline
//
// Shapes follow src/app/core/models/crm.ts and dashboard.ts. All data is synthetic: client names
// are invented, emails use example.test, phones use the fictional 555-01xx block. Deals and leads
// point at the shared PROPERTIES (42-49).
//
// "full" is an active realtor (25 clients, 18 leads, 22 tasks, 10 deals, a consistent activity
// log). "empty" is a new realtor with no records. Each scenario keeps its own mutable copy, so
// creating, moving and deleting works in both; reset() restores the seeds.

const { page, PROPERTIES, TODAY } = require('./_shared.cjs');

const LEAD_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const DEAL_STAGES = ['PROSPECT', 'VIEWING', 'OFFER', 'UNDER_CONTRACT', 'CLOSED', 'CANCELLED'];
// Mirrors nextLeadStages / nextTaskStatuses / nextDealStages in core/models/crm.ts.
const NEXT_LEAD = { NEW: ['CONTACTED', 'LOST'], CONTACTED: ['QUALIFIED', 'LOST'], QUALIFIED: ['CONVERTED', 'LOST'], CONVERTED: [], LOST: [] };
const NEXT_TASK = { OPEN: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'], IN_PROGRESS: ['OPEN', 'COMPLETED', 'CANCELLED'], COMPLETED: ['OPEN'], CANCELLED: ['OPEN'] };
const NEXT_DEAL = { PROSPECT: ['VIEWING', 'CANCELLED'], VIEWING: ['OFFER', 'CANCELLED'], OFFER: ['UNDER_CONTRACT', 'CANCELLED'], UNDER_CONTRACT: ['CLOSED', 'CANCELLED'], CLOSED: [], CANCELLED: [] };
const WORDS = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', CONVERTED: 'Converted', LOST: 'Lost',
  OPEN: 'Open', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  PROSPECT: 'Prospect', VIEWING: 'Viewing', OFFER: 'Offer', UNDER_CONTRACT: 'Under contract', CLOSED: 'Closed',
};
const change = (from, to) => `${WORDS[from]} → ${WORDS[to]}`;

// ---- time -----------------------------------------------------------------------------------
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
/** `days` before TODAY (negative = after), at an optional UTC clock time. */
function at(days, hh, mm = 0) {
  const d = new Date(TODAY.getTime() - days * DAY);
  if (hh !== undefined) d.setUTCHours(hh, mm, 0, 0);
  return iso(d.getTime());
}
// Mutations advance a fake clock one minute per write so screenshots stay stable across runs.
let tick = 0;
const clock = () => iso(TODAY.getTime() + tick * 60000);
const stamp = () => {
  tick += 1;
  return clock();
};
const ms = (s) => Date.parse(s);

// ---- seeds ----------------------------------------------------------------------------------
// [id, name, email, phone, notes, createdDaysAgo, updatedDaysAgo|null]
const CLIENT_SEED = [
  [1, 'Maria Delgado', 'maria.delgado@example.test', '305-555-0101', 'Bought Unit 208 for her mother in November. Prefers a text after 6 pm.', 236, 12],
  [2, 'Jean-Baptiste Pierre', 'jb.pierre@example.test', null, null, 221, null],
  [3, 'Carolina Méndez', null, '+1 786 555 0103', 'Phone only. Spanish preferred.', 205, null],
  [4, 'Derek Thompson', 'derek.thompson@example.test', '305-555-0104', 'Owns 2861 SW 27th Ter. Thinking about listing in the spring.', 190, 3],
  [5, 'Yusimy Herrera', 'yherrera@example.test', '786-555-0105', null, 174, null],
  [6, 'Alejandro and Sofía Castillo', 'castillo.family@example.test', '305-555-0106', 'Two kids, one in middle school. Need a yard and a short drive to Coral Way. They will sell their Westchester townhouse first, so any offer will be contingent on that sale.', 160, null],
  [7, 'Natalie Kowalski', 'natalie.k@example.test', null, 'First buyer on 11960 SW 186th St; financing fell through in October.', 149, 22],
  [8, 'Rodrigo Santana', null, '305-555-0108', null, 133, null],
  [10, 'Fabiola Joseph', 'fabiola.joseph@example.test', '786-555-0110', null, 112, null],
  [11, 'Ethan Goldberg', 'ethan.goldberg@example.test', null, 'Went with another agent for a Brickell condo.', 98, 40],
  [12, 'Lucía Ferreira', 'lucia.ferreira@example.test', '305-555-0112', null, 84, null],
  [13, 'Marcus Bell', 'marcus.bell@example.test', '305-555-0113', 'VA loan. Wants to close before the end of November.', 71, null],
  [14, 'Daniela Ospina', 'daniela.ospina@example.test', '786-555-0114', 'Prefers email; works nights.', 63, 15],
  [15, "Patrick O'Neill", 'patrick.oneill@example.test', null, 'In Miami from December to April.', 52, null],
  [16, 'Ingrid Solberg', null, '305-555-0116', null, 44, null],
  [17, 'Kevin Tran', 'kevin.tran@example.test', '305-555-0117', null, 37, null],
  [18, 'Rosa Elena Valdés', 'rosaelena.valdes@example.test', '786-555-0118', null, 29, null],
  [19, 'Samuel Adeyemi', 's.adeyemi@example.test', '305-555-0119', 'Buys rentals through an LLC. Send numbers, not photos.', 23, null],
  [20, 'Gabriela Pineda-Morales', 'gabriela.pineda.morales.household@example.test', '786-555-0120', null, 18, null],
  [21, 'Tomás Rivera', 'tomas.rivera@example.test', '305-555-0121', null, 13, null],
  [22, 'Haley Brooks', 'haley.brooks@example.test', null, null, 9, null],
  [23, 'Wilner Charles', null, '305-555-0123', null, 6, null],
  [24, 'Priya Raman', 'priya.raman@example.test', null, null, 3, null],
  [25, 'Oscar Benítez', 'oscar.benitez@example.test', '786-555-0125', null, 2, null],
  [26, 'Chantal Moreau-Dubois', 'chantal.moreau@example.test', '+1 305 555 0126', null, 0.25, null],
];
// Client 9 was deleted; only its history remains.
const DELETED_CLIENT = { id: 9, name: 'Brian Walsh', createdDays: 120, deletedDays: 16 };

// [id, clientId, propertyId, title, source, notes, createdDaysAgo, [[stage, daysAgo], ...]]
// Leads that arrived through a buyer contact request carry the WEBSITE code (as in the dashboard
// spec); leads typed into the CRM form carry its free-text sources.
const LEAD_SEED = [
  [1, 8, 49, 'Miami Beach pied-à-terre', 'Email', 'Paused the search until 2027.', 130, [['CONTACTED', 126], ['LOST', 95]]],
  [2, 10, null, 'Townhouse in Hialeah with a garage', 'Phone call', null, 110, [['CONTACTED', 107], ['LOST', 88]]],
  [3, 11, null, 'Brickell high-rise, 2 bed', 'Website', 'Chose another agent.', 97, [['CONTACTED', 95], ['QUALIFIED', 80], ['LOST', 40]]],
  [4, 12, 42, 'Grove bungalow at 2847 SW 27th Ter', 'WEBSITE', null, 83, [['CONTACTED', 82], ['QUALIFIED', 60], ['CONVERTED', 20]]],
  [5, 13, 48, 'Family home off SW 186th St', 'Phone call', null, 70, [['CONTACTED', 69], ['QUALIFIED', 50], ['CONVERTED', 35]]],
  [6, 14, 47, 'Little River duplex to house-hack', 'Referral', 'Will live in the front unit and rent the back.', 62, [['CONTACTED', 61], ['QUALIFIED', 45], ['CONVERTED', 30]]],
  [7, 15, 49, 'Seasonal condo on Collins Ave', 'WEBSITE', null, 51, [['CONTACTED', 50], ['QUALIFIED', 14]]],
  [8, 16, 46, 'Starter home in Miami Gardens', 'Open house', null, 43, [['CONTACTED', 41], ['QUALIFIED', 10]]],
  [9, 17, 44, 'Pre-approved, touring Coconut Grove', 'Referral', null, 36, [['CONTACTED', 35], ['QUALIFIED', 8]]],
  [10, 18, null, 'Downsizing from Kendall to a 2-bed', 'Social media', null, 28, [['CONTACTED', 25]]],
  [11, 19, 48, 'South Dade single-family rentals', 'Website', 'Wants rent comps before touring.', 22, [['CONTACTED', 15]]],
  [12, 20, null, 'Duplex, live in one side', 'Referral', null, 17, [['CONTACTED', 12]]],
  [13, 21, 45, 'Condo near Hialeah Park for his parents', 'Phone call', null, 12, [['CONTACTED', 6]]],
  [14, 22, null, 'Relocating from Atlanta in March', 'Email', null, 8.8, []],
  [15, 23, 46, 'First-time buyer, Miami Gardens or Opa-locka', 'Open house', 'Met at the NW 7th Ave open house.', 5.9, []],
  [16, 24, 42, 'Question about 2847 SW 27th Ter', 'WEBSITE', 'Contact request: "Is the seller open to a rent-back?"', 2.9, []],
  [17, 25, null, 'Wants a 3-bed in the Grove by spring', 'Referral', null, 1.9, []],
  [18, 26, 49, 'Question about 1700 Collins Ave, Unit 1504', 'WEBSITE', 'Contact request: "Is a January closing possible?"', 0.24, []],
];

// [id, clientId, leadId, propertyId, title, description, expectedCloseDate, createdDaysAgo, [[stage, daysAgo], ...]]
const DEAL_SEED = [
  [1, 4, null, 43, 'Listing consult, 2861 SW 27th Ter', 'Owner wants a pricing opinion before deciding to list.', null, 3.1, []],
  [2, 16, 8, 46, 'Miami Gardens starter home', null, '2027-02-26', 9.5, []],
  [3, 17, 9, 44, '3120 Day Ave', 'Second showing requested for the weekend.', '2027-01-29', 7.5, [['VIEWING', 5]]],
  [4, 5, null, 46, '18402 NW 7th Ave, second visit', null, null, 20, [['VIEWING', 11]]],
  [5, 12, 4, 42, 'Offer on 2847 SW 27th Ter', 'Offer submitted; seller asked for a 21-day close.', '2026-12-19', 19.9, [['VIEWING', 12], ['OFFER', 3]]],
  [6, 15, 7, 49, '1700 Collins Ave, Unit 1504', null, '2027-01-08', 13.5, [['VIEWING', 9], ['OFFER', 4]]],
  // Expected close already passed: the closing moved but the date was not updated.
  [7, 14, 6, 47, '640 NE 74th St duplex', 'Inspection done. Appraisal came in late, closing moved.', '2026-11-14', 29.9, [['VIEWING', 26], ['OFFER', 21], ['UNDER_CONTRACT', 14]]],
  [8, 13, 5, 48, '11960 SW 186th St purchase', null, '2026-11-30', 34.9, [['VIEWING', 31], ['OFFER', 20], ['UNDER_CONTRACT', 16]]],
  [9, 1, null, 45, '1475 W 44th Pl, Unit 208 purchase', null, '2026-11-07', 75, [['VIEWING', 60], ['OFFER', 47], ['UNDER_CONTRACT', 40], ['CLOSED', 12]]],
  [10, 7, null, 48, '11960 SW 186th St, first buyer', 'Financing fell through.', '2026-10-30', 60, [['VIEWING', 50], ['OFFER', 41], ['UNDER_CONTRACT', 33], ['CANCELLED', 22]]],
];

// [id, title, description, status, dueAt, completedAt, clientId, leadId, propertyId, transactionId, createdDaysAgo, updatedDaysAgo|null]
// A linked lead or deal fills in its client and property, as the backend does.
const TASK_SEED = [
  // overdue
  [1, 'Call Yusimy back about the roof age', null, 'OPEN', at(9, 14), null, 5, null, 46, 4, 11, null],
  [2, 'Collect proof of funds for the Collins Ave offer', 'Lender letter received; still need a bank statement.', 'IN_PROGRESS', at(4, 21), null, 15, null, 49, 6, 9, 5],
  [3, 'First call with Haley Brooks', null, 'OPEN', at(2, 16), null, 22, 14, null, null, 8.8, null],
  [4, 'Confirm the new closing date for NE 74th St', null, 'OPEN', at(1, 17), null, 14, null, 47, 7, 6, null],
  // due in the next 7 days
  [5, 'Schedule the termite inspection, SW 186th St', null, 'OPEN', at(0, 20), null, 13, null, 48, 8, 3, null],
  [6, 'Prepare a CMA for 2861 SW 27th Ter', 'Pull sales on SW 27th Ter and SW 28th St since January.', 'IN_PROGRESS', at(-1, 17), null, 4, null, 43, 1, 3, 2],
  [7, 'Send Grove listings to Oscar', null, 'OPEN', at(-2, 14), null, 25, 17, null, null, 1.9, null],
  [8, 'Book the second showing at 3120 Day Ave', null, 'OPEN', at(-3, 15, 30), null, 17, null, 44, 3, 5, null],
  [9, 'Answer the contact request about Unit 1504', null, 'OPEN', at(-1, 14), null, 26, 18, 49, null, 0.2, null],
  [10, 'Review the seller counter-offer with Lucía', 'Seller wants a 21-day close and no appraisal contingency.', 'IN_PROGRESS', at(-5, 18), null, 12, null, 42, 5, 3, 2],
  [11, 'Email the NW 7th Ave open-house sign-ins', "Everyone on Sunday's sign-in sheet who did not leave a phone number.", 'OPEN', at(-6, 14), null, null, null, null, null, 4, null],
  // due later
  [12, 'Final walkthrough, 11960 SW 186th St', null, 'OPEN', at(-11, 16), null, 13, null, 48, 8, 16, null],
  [13, "Check in on Wilner's pre-approval", null, 'OPEN', at(-25, 15), null, 23, 15, 46, null, 5, null],
  // no due date
  [14, 'Update the Coconut Grove mailing list', null, 'OPEN', null, null, null, null, null, null, 30, null],
  [15, 'Gather school-zone info for the Grove', null, 'IN_PROGRESS', null, null, 17, 9, 44, null, 8, 7],
  // done
  [16, 'Drop off the closing gift for Maria', null, 'COMPLETED', at(10, 20), at(11, 18), 1, null, 45, 9, 13, null],
  [17, 'Order the appraisal, NE 74th St', null, 'COMPLETED', at(6, 16), at(5, 14), 14, null, 47, 7, 14, null],
  [18, 'Submit the offer on 2847 SW 27th Ter', null, 'COMPLETED', at(3, 22), at(3, 19), 12, null, 42, 5, 5, null],
  [19, 'Intro call with Tomás', null, 'COMPLETED', null, at(6, 15), 21, 13, 45, null, 12, null],
  [20, 'Pull sold comps for Miami Gardens', null, 'COMPLETED', at(2, 22), at(1, 13), 16, 8, 46, null, 9, null],
  [21, 'Schedule inspection for the first SW 186th St buyer', null, 'CANCELLED', at(20, 15), null, 7, null, 48, 10, 30, 22],
  [22, 'Brickell tour with Ethan', null, 'CANCELLED', at(38, 15), null, 11, 3, null, null, 45, 40],
];
const DELETED_TASK = { id: 23, title: 'Call Marcus (duplicate)', clientId: 13, createdDays: 17, deletedDays: 16.9 };

// [subjectType, subjectId, clientId, daysAgo, text]
const NOTE_SEED = [
  ['CLIENT', 1, 1, 11.5, 'Closing went smoothly. Asked to hear from us when they are ready for a larger place.'],
  ['LEAD', 4, 12, 21, 'Loves the original Dade County pine floors. Needs a 30-day close.'],
  ['CLIENT', 14, 14, 15, 'Switch to email only; she works nights and misses calls.'],
  ['LEAD', 9, 17, 8, 'Pre-approval letter received. Wants to walk to the Grove.'],
  ['LEAD', 13, 21, 5.5, 'His parents need an elevator building or a ground-floor unit.'],
  ['LEAD', 15, 23, 5, 'Not pre-approved yet; referred to two lenders.'],
  ['CLIENT', 19, 19, 14, 'Sent rent comps for 33177. Wants cap rate before touring.'],
];

function seedFull() {
  const clients = CLIENT_SEED.map(([id, name, email, phone, notes, created, updated]) => {
    const createdAt = at(created);
    return { id, name, email, phone, notes, createdAt, updatedAt: updated === null ? createdAt : at(updated) };
  });
  const leads = LEAD_SEED.map(([id, clientId, propertyId, title, source, notes, created, path]) => ({
    id, clientId, propertyId, title, source,
    stage: path.length ? path[path.length - 1][0] : 'NEW',
    notes,
    createdAt: at(created),
    updatedAt: at(path.length ? path[path.length - 1][1] : created),
  }));
  const deals = DEAL_SEED.map(([id, clientId, leadId, propertyId, title, description, expected, created, path]) => {
    const last = path[path.length - 1];
    const stage = last ? last[0] : 'PROSPECT';
    return {
      id, title, description, stage, clientId, leadId, propertyId,
      expectedCloseDate: expected,
      closedAt: stage === 'CLOSED' ? at(last[1]) : null,
      createdAt: at(created),
      updatedAt: at(last ? last[1] : created),
    };
  });
  const tasks = TASK_SEED.map(
    ([id, title, description, status, dueAt, completedAt, clientId, leadId, propertyId, transactionId, created, updated]) => ({
      id, title, description, status, dueAt, completedAt, clientId, leadId, propertyId, transactionId,
      createdAt: at(created),
      updatedAt: completedAt ?? (updated === null ? at(created) : at(updated)),
    }),
  );

  // Activity log consistent with the records above.
  const log = [];
  const add = (clientId, subjectType, subjectId, activityType, description, createdAt) =>
    log.push({ clientId, subjectType, subjectId, activityType, description, createdAt });
  for (const c of clients) {
    add(c.id, 'CLIENT', c.id, 'CLIENT_CREATED', c.name, c.createdAt);
    if (c.updatedAt !== c.createdAt) add(c.id, 'CLIENT', c.id, 'CLIENT_UPDATED', 'Notes changed', c.updatedAt);
  }
  add(DELETED_CLIENT.id, 'CLIENT', DELETED_CLIENT.id, 'CLIENT_CREATED', DELETED_CLIENT.name, at(DELETED_CLIENT.createdDays));
  add(DELETED_CLIENT.id, 'CLIENT', DELETED_CLIENT.id, 'CLIENT_DELETED', DELETED_CLIENT.name, at(DELETED_CLIENT.deletedDays));
  for (const [id, clientId, , title, , , created, path] of LEAD_SEED) {
    add(clientId, 'LEAD', id, 'LEAD_CREATED', title, at(created));
    let from = 'NEW';
    for (const [stage, days] of path) {
      add(clientId, 'LEAD', id, 'LEAD_STAGE_CHANGED', change(from, stage), at(days));
      from = stage;
    }
  }
  for (const [id, clientId, , , title, , , created, path] of DEAL_SEED) {
    add(clientId, 'TRANSACTION', id, 'TRANSACTION_CREATED', title, at(created));
    let from = 'PROSPECT';
    for (const [stage, days] of path) {
      add(clientId, 'TRANSACTION', id, 'TRANSACTION_STAGE_CHANGED', change(from, stage), at(days));
      from = stage;
    }
  }
  for (const t of tasks) {
    add(t.clientId, 'TASK', t.id, 'TASK_CREATED', t.title, t.createdAt);
    if (t.status !== 'OPEN') add(t.clientId, 'TASK', t.id, 'TASK_STATUS_CHANGED', change('OPEN', t.status), t.updatedAt);
  }
  add(DELETED_TASK.clientId, 'TASK', DELETED_TASK.id, 'TASK_CREATED', DELETED_TASK.title, at(DELETED_TASK.createdDays));
  add(DELETED_TASK.clientId, 'TASK', DELETED_TASK.id, 'TASK_DELETED', DELETED_TASK.title, at(DELETED_TASK.deletedDays));
  for (const [subjectType, subjectId, clientId, days, text] of NOTE_SEED)
    add(clientId, subjectType, subjectId, 'NOTE_ADDED', text, at(days));

  log.sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  const activities = log.map((a, i) => ({
    id: i + 1,
    clientId: a.clientId,
    subjectType: a.subjectType,
    subjectId: a.subjectId,
    activityType: a.activityType,
    description: a.description,
    createdAt: a.createdAt,
  }));

  return {
    clients, leads, tasks, deals, activities,
    nextId: { client: 27, lead: 19, task: 24, deal: 11, activity: activities.length + 1 },
    idempotency: {},
  };
}

function seedEmpty() {
  return {
    clients: [], leads: [], tasks: [], deals: [], activities: [],
    nextId: { client: 1, lead: 1, task: 1, deal: 1, activity: 1 },
    idempotency: {},
  };
}

let db;
function reset() {
  tick = 0;
  db = { full: seedFull(), empty: seedEmpty() };
}
reset();

// ---- helpers --------------------------------------------------------------------------------
const store = (ctx) => (ctx.flags.empty ? db.empty : db.full);
const newestFirst = (list) =>
  [...list].sort((a, b) => ms(b.createdAt) - ms(a.createdAt) || b.id - a.id);
const err = (status, error, message) => ({ status, body: { status, error, message, timestamp: clock() } });
const notFound = (what) => err(404, 'Not Found', `${what} not found`);
const conflict = (message) => err(409, 'Conflict', message);
const badRequest = (message) => err(400, 'Bad Request', message);
const has = (body, key) => body && Object.prototype.hasOwnProperty.call(body, key);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const knownProperty = (id) => PROPERTIES.some((p) => p.id === id);
function normInstant(v) {
  if (v === null || v === undefined || v === '') return { value: null };
  const t = Date.parse(v);
  if (typeof v !== 'string' || Number.isNaN(t)) return { error: 'dueAt must be an ISO-8601 instant' };
  return { value: iso(t) };
}
function normDate(v) {
  if (v === null || v === undefined || v === '') return { value: null };
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))
    return { error: 'expectedCloseDate must be YYYY-MM-DD' };
  return { value: v };
}
function intParam(query, name, fallback, min, max) {
  const raw = query.get(name);
  if (raw === null || raw === '') return { value: fallback };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return { error: `${name} must be between ${min} and ${max}` };
  return { value: n };
}
function logActivity(s, clientId, subjectType, subjectId, activityType, description, createdAt) {
  const a = { id: s.nextId.activity++, clientId, subjectType, subjectId, activityType, description, createdAt };
  s.activities.push(a);
  return a;
}
const isActive = (t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS';
const isOverdue = (t) => isActive(t) && t.dueAt !== null && ms(t.dueAt) < ms(clock());

// DTO builders keep the field order of the TypeScript interfaces.
const clientDto = (c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, notes: c.notes, createdAt: c.createdAt, updatedAt: c.updatedAt });
const leadDto = (l) => ({ id: l.id, clientId: l.clientId, propertyId: l.propertyId, title: l.title, source: l.source, stage: l.stage, notes: l.notes, createdAt: l.createdAt, updatedAt: l.updatedAt });
const taskDto = (t) => ({
  id: t.id, title: t.title, description: t.description, status: t.status, dueAt: t.dueAt, completedAt: t.completedAt,
  overdue: isOverdue(t), clientId: t.clientId, leadId: t.leadId, propertyId: t.propertyId, transactionId: t.transactionId,
  createdAt: t.createdAt, updatedAt: t.updatedAt,
});
const dealDto = (d) => ({
  id: d.id, title: d.title, description: d.description, stage: d.stage, clientId: d.clientId, leadId: d.leadId,
  propertyId: d.propertyId, expectedCloseDate: d.expectedCloseDate, closedAt: d.closedAt, createdAt: d.createdAt, updatedAt: d.updatedAt,
});
const activityDto = (a) => ({ ...a });
const pageOf = (list, map, query) => {
  const p = page(list, query);
  return { ...p, content: p.content.map(map) };
};

function taskCounts(tasks) {
  const count = (st) => tasks.filter((t) => t.status === st).length;
  return {
    total: tasks.length,
    open: count('OPEN'),
    inProgress: count('IN_PROGRESS'),
    completed: count('COMPLETED'),
    cancelled: count('CANCELLED'),
    overdue: tasks.filter(isOverdue).length,
  };
}
const stageCounts = (stages, list, key) => Object.fromEntries(stages.map((st) => [st, list.filter((x) => x[key] === st).length]));

// Signed-out callers get the backend's 401 instead of another user's records.
const authed = (handle) => (req, ctx) =>
  ctx.state.signedIn === false ? err(401, 'Unauthorized', 'Full authentication is required') : handle(req, ctx);

// ---- clients --------------------------------------------------------------------------------
function listClients(req, ctx) {
  return { body: pageOf(newestFirst(store(ctx).clients), clientDto, req.query) };
}
function createClient(req, ctx) {
  const s = store(ctx);
  const b = req.body || {};
  const name = str(b.name);
  const email = str(b.email);
  const phone = str(b.phone);
  if (!name) return badRequest('name is required');
  if (!email && !phone) return badRequest('Add an email address or a phone number for this client.');
  const now = stamp();
  const c = { id: s.nextId.client++, name, email, phone, notes: str(b.notes), createdAt: now, updatedAt: now };
  s.clients.push(c);
  logActivity(s, c.id, 'CLIENT', c.id, 'CLIENT_CREATED', c.name, now);
  return { status: 201, body: clientDto(c) };
}
function updateClient(req, ctx) {
  const s = store(ctx);
  const c = s.clients.find((x) => x.id === Number(req.params[1]));
  if (!c) return notFound('Client');
  const b = req.body || {};
  const next = { ...c };
  if (has(b, 'name')) {
    if (!str(b.name)) return badRequest('name must not be blank');
    next.name = str(b.name);
  }
  for (const key of ['email', 'phone', 'notes']) if (has(b, key)) next[key] = str(b[key]);
  if (!next.email && !next.phone) return badRequest('Add an email address or a phone number for this client.');
  const changed = ['name', 'email', 'phone', 'notes'].filter((k) => next[k] !== c[k]);
  if (changed.length) {
    next.updatedAt = stamp();
    Object.assign(c, next);
    logActivity(s, c.id, 'CLIENT', c.id, 'CLIENT_UPDATED', `${changed.map((k) => k[0].toUpperCase() + k.slice(1)).join(', ')} changed`, c.updatedAt);
  }
  return { body: clientDto(c) };
}
function deleteClient(req, ctx) {
  const s = store(ctx);
  const id = Number(req.params[1]);
  const c = s.clients.find((x) => x.id === id);
  if (!c) return notFound('Client');
  if (s.leads.some((l) => l.clientId === id) || s.tasks.some((t) => t.clientId === id) || s.deals.some((d) => d.clientId === id))
    return conflict(`${c.name} is linked to a lead, task or deal and cannot be deleted.`);
  s.clients = s.clients.filter((x) => x.id !== id);
  logActivity(s, id, 'CLIENT', id, 'CLIENT_DELETED', c.name, stamp());
  return { status: 204 };
}

// ---- leads ----------------------------------------------------------------------------------
function listLeads(req, ctx) {
  const stage = req.query.get('stage');
  if (stage && !LEAD_STAGES.includes(stage)) return badRequest(`Unknown lead stage: ${stage}`);
  const all = store(ctx).leads.filter((l) => !stage || l.stage === stage);
  return { body: pageOf(newestFirst(all), leadDto, req.query) };
}
function createLead(req, ctx) {
  const s = store(ctx);
  const key = req.headers['idempotency-key'];
  if (key && s.idempotency[key]) {
    const prior = s.leads.find((l) => l.id === s.idempotency[key]);
    if (prior) return { status: 200, body: leadDto(prior) };
  }
  const b = req.body || {};
  const client = s.clients.find((c) => c.id === Number(b.clientId));
  if (!client) return notFound('Client');
  const title = str(b.title);
  const source = str(b.source);
  if (!title || !source) return badRequest('title and source are required');
  const propertyId = b.propertyId ?? null;
  if (propertyId !== null && !knownProperty(propertyId)) return notFound('Property');
  const now = stamp();
  const l = { id: s.nextId.lead++, clientId: client.id, propertyId, title, source, stage: 'NEW', notes: str(b.notes), createdAt: now, updatedAt: now };
  s.leads.push(l);
  if (key) s.idempotency[key] = l.id;
  logActivity(s, l.clientId, 'LEAD', l.id, 'LEAD_CREATED', l.title, now);
  return { status: 201, body: leadDto(l) };
}
function updateLead(req, ctx) {
  const s = store(ctx);
  const l = s.leads.find((x) => x.id === Number(req.params[1]));
  if (!l) return notFound('Lead');
  const b = req.body || {};
  if (has(b, 'stage') && b.stage !== l.stage) {
    if (!LEAD_STAGES.includes(b.stage)) return badRequest(`Unknown lead stage: ${b.stage}`);
    if (!NEXT_LEAD[l.stage].includes(b.stage))
      return conflict(`Cannot move a lead from ${WORDS[l.stage]} to ${WORDS[b.stage]}.`);
  }
  if (has(b, 'propertyId') && b.propertyId !== null && !knownProperty(b.propertyId)) return notFound('Property');
  if (has(b, 'title') && !str(b.title)) return badRequest('title must not be blank');
  if (has(b, 'source') && !str(b.source)) return badRequest('source must not be blank');
  const edits = [];
  if (has(b, 'title') && str(b.title) !== l.title) (l.title = str(b.title)), edits.push('Title');
  if (has(b, 'source') && str(b.source) !== l.source) (l.source = str(b.source)), edits.push('Source');
  if (has(b, 'notes') && str(b.notes) !== l.notes) (l.notes = str(b.notes)), edits.push('Notes');
  if (has(b, 'propertyId') && (b.propertyId ?? null) !== l.propertyId) (l.propertyId = b.propertyId ?? null), edits.push('Property');
  if (edits.length) {
    l.updatedAt = stamp();
    logActivity(s, l.clientId, 'LEAD', l.id, 'LEAD_UPDATED', `${edits.join(', ')} changed`, l.updatedAt);
  }
  if (has(b, 'stage') && b.stage !== l.stage) {
    const from = l.stage;
    l.stage = b.stage;
    l.updatedAt = stamp();
    logActivity(s, l.clientId, 'LEAD', l.id, 'LEAD_STAGE_CHANGED', change(from, l.stage), l.updatedAt);
  }
  return { body: leadDto(l) };
}

// ---- tasks ----------------------------------------------------------------------------------
function listTasks(req, ctx) {
  const status = req.query.get('status');
  if (status && !TASK_STATUSES.includes(status)) return badRequest(`Unknown task status: ${status}`);
  const all = store(ctx).tasks.filter((t) => !status || t.status === status);
  return { body: pageOf(newestFirst(all), taskDto, req.query) };
}
function taskSummary(req, ctx) {
  return { body: { ...taskCounts(store(ctx).tasks), asOf: clock() } };
}
function createTask(req, ctx) {
  const s = store(ctx);
  const b = req.body || {};
  const title = str(b.title);
  if (!title) return badRequest('title is required');
  const due = normInstant(b.dueAt);
  if (due.error) return badRequest(due.error);
  let clientId = b.clientId ?? null;
  let propertyId = b.propertyId ?? null;
  const leadId = b.leadId ?? null;
  const transactionId = b.transactionId ?? null;
  if (leadId !== null) {
    const lead = s.leads.find((l) => l.id === leadId);
    if (!lead) return notFound('Lead');
    clientId = clientId ?? lead.clientId;
    propertyId = propertyId ?? lead.propertyId;
  }
  if (transactionId !== null) {
    const deal = s.deals.find((d) => d.id === transactionId);
    if (!deal) return notFound('Transaction');
    clientId = clientId ?? deal.clientId;
    propertyId = propertyId ?? deal.propertyId;
  }
  if (clientId !== null && !s.clients.some((c) => c.id === clientId)) return notFound('Client');
  if (propertyId !== null && !knownProperty(propertyId)) return notFound('Property');
  const now = stamp();
  const t = {
    id: s.nextId.task++, title, description: str(b.description), status: 'OPEN', dueAt: due.value, completedAt: null,
    clientId, leadId, propertyId, transactionId, createdAt: now, updatedAt: now,
  };
  s.tasks.push(t);
  logActivity(s, clientId, 'TASK', t.id, 'TASK_CREATED', t.title, now);
  return { status: 201, body: taskDto(t) };
}
function updateTask(req, ctx) {
  const s = store(ctx);
  const t = s.tasks.find((x) => x.id === Number(req.params[1]));
  if (!t) return notFound('Task');
  const b = req.body || {};
  if (has(b, 'status') && b.status !== t.status) {
    if (!TASK_STATUSES.includes(b.status)) return badRequest(`Unknown task status: ${b.status}`);
    if (!NEXT_TASK[t.status].includes(b.status))
      return conflict(`Cannot move a task from ${WORDS[t.status]} to ${WORDS[b.status]}.`);
  }
  if (has(b, 'title') && !str(b.title)) return badRequest('title must not be blank');
  const due = has(b, 'dueAt') ? normInstant(b.dueAt) : null;
  if (due && due.error) return badRequest(due.error);
  const edits = [];
  if (has(b, 'title') && str(b.title) !== t.title) (t.title = str(b.title)), edits.push('Title');
  if (has(b, 'description') && str(b.description) !== t.description) (t.description = str(b.description)), edits.push('Description');
  if (due && due.value !== t.dueAt) (t.dueAt = due.value), edits.push('Due date');
  if (edits.length) {
    t.updatedAt = stamp();
    logActivity(s, t.clientId, 'TASK', t.id, 'TASK_UPDATED', `${edits.join(', ')} changed`, t.updatedAt);
  }
  if (has(b, 'status') && b.status !== t.status) {
    const from = t.status;
    t.status = b.status;
    t.updatedAt = stamp();
    t.completedAt = t.status === 'COMPLETED' ? t.updatedAt : null;
    logActivity(s, t.clientId, 'TASK', t.id, 'TASK_STATUS_CHANGED', change(from, t.status), t.updatedAt);
  }
  return { body: taskDto(t) };
}
function deleteTask(req, ctx) {
  const s = store(ctx);
  const id = Number(req.params[1]);
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return notFound('Task');
  s.tasks = s.tasks.filter((x) => x.id !== id);
  logActivity(s, t.clientId, 'TASK', id, 'TASK_DELETED', t.title, stamp());
  return { status: 204 };
}

// ---- transactions ---------------------------------------------------------------------------
function listDeals(req, ctx) {
  const stage = req.query.get('stage');
  if (stage && !DEAL_STAGES.includes(stage)) return badRequest(`Unknown transaction stage: ${stage}`);
  const all = store(ctx).deals.filter((d) => !stage || d.stage === stage);
  return { body: pageOf(newestFirst(all), dealDto, req.query) };
}
function pipeline(req, ctx) {
  const deals = store(ctx).deals;
  return { body: { total: deals.length, stages: stageCounts(DEAL_STAGES, deals, 'stage'), asOf: clock() } };
}
function createDeal(req, ctx) {
  const s = store(ctx);
  const b = req.body || {};
  const title = str(b.title);
  if (!title) return badRequest('title is required');
  const client = s.clients.find((c) => c.id === Number(b.clientId));
  if (!client) return notFound('Client');
  if (!knownProperty(b.propertyId)) return notFound('Property');
  const leadId = b.leadId ?? null;
  if (leadId !== null) {
    const lead = s.leads.find((l) => l.id === leadId);
    if (!lead) return notFound('Lead');
    if (lead.clientId !== client.id) return conflict('The lead belongs to a different client.');
  }
  const close = normDate(b.expectedCloseDate);
  if (close.error) return badRequest(close.error);
  const now = stamp();
  const d = {
    id: s.nextId.deal++, title, description: str(b.description), stage: 'PROSPECT', clientId: client.id, leadId,
    propertyId: b.propertyId, expectedCloseDate: close.value, closedAt: null, createdAt: now, updatedAt: now,
  };
  s.deals.push(d);
  logActivity(s, d.clientId, 'TRANSACTION', d.id, 'TRANSACTION_CREATED', d.title, now);
  return { status: 201, body: dealDto(d) };
}
function updateDeal(req, ctx) {
  const s = store(ctx);
  const d = s.deals.find((x) => x.id === Number(req.params[1]));
  if (!d) return notFound('Transaction');
  const b = req.body || {};
  if (has(b, 'stage') && b.stage !== d.stage) {
    if (!DEAL_STAGES.includes(b.stage)) return badRequest(`Unknown transaction stage: ${b.stage}`);
    if (!NEXT_DEAL[d.stage].includes(b.stage))
      return conflict(`Cannot move a deal from ${WORDS[d.stage]} to ${WORDS[b.stage]}.`);
  }
  if (has(b, 'title') && !str(b.title)) return badRequest('title must not be blank');
  const close = has(b, 'expectedCloseDate') ? normDate(b.expectedCloseDate) : null;
  if (close && close.error) return badRequest(close.error);
  const edits = [];
  if (has(b, 'title') && str(b.title) !== d.title) (d.title = str(b.title)), edits.push('Title');
  if (has(b, 'description') && str(b.description) !== d.description) (d.description = str(b.description)), edits.push('Description');
  if (close && close.value !== d.expectedCloseDate) (d.expectedCloseDate = close.value), edits.push('Expected close date');
  if (edits.length) {
    d.updatedAt = stamp();
    logActivity(s, d.clientId, 'TRANSACTION', d.id, 'TRANSACTION_UPDATED', `${edits.join(', ')} changed`, d.updatedAt);
  }
  if (has(b, 'stage') && b.stage !== d.stage) {
    const from = d.stage;
    d.stage = b.stage;
    d.updatedAt = stamp();
    if (d.stage === 'CLOSED') d.closedAt = d.updatedAt;
    logActivity(s, d.clientId, 'TRANSACTION', d.id, 'TRANSACTION_STAGE_CHANGED', change(from, d.stage), d.updatedAt);
  }
  return { body: dealDto(d) };
}

// ---- activity -------------------------------------------------------------------------------
const SUBJECTS = { clients: ['CLIENT', 'clients', 'Client'], leads: ['LEAD', 'leads', 'Lead'], tasks: ['TASK', 'tasks', 'Task'], transactions: ['TRANSACTION', 'deals', 'Transaction'] };
function allActivities(req, ctx) {
  return { body: pageOf(newestFirst(store(ctx).activities), activityDto, req.query) };
}
function history(req, ctx) {
  const s = store(ctx);
  const [subjectType, collection, noun] = SUBJECTS[req.params[1]];
  const id = Number(req.params[2]);
  if (!s[collection].some((x) => x.id === id)) return notFound(noun);
  // A client's history covers everything recorded against that client (its leads, tasks and
  // deals too); the other records show their own entries.
  const entries = s.activities.filter((a) =>
    subjectType === 'CLIENT' ? a.clientId === id : a.subjectType === subjectType && a.subjectId === id,
  );
  return { body: pageOf(newestFirst(entries), activityDto, req.query) };
}
function addNote(req, ctx) {
  const s = store(ctx);
  const [subjectType, collection, noun] = SUBJECTS[req.params[1]];
  const id = Number(req.params[2]);
  const record = s[collection].find((x) => x.id === id);
  if (!record) return notFound(noun);
  const description = str(req.body?.description);
  if (!description) return badRequest('description is required');
  const clientId = subjectType === 'CLIENT' ? record.id : record.clientId;
  return { status: 201, body: activityDto(logActivity(s, clientId, subjectType, id, 'NOTE_ADDED', description, stamp())) };
}

// ---- realtor dashboard cards ----------------------------------------------------------------
function clientsLeadsCard(req, ctx) {
  const limit = intParam(req.query, 'limit', 5, 1, 50);
  if (limit.error) return badRequest(limit.error);
  const s = store(ctx);
  const clients = newestFirst(s.clients);
  const leads = newestFirst(s.leads);
  const byStage = stageCounts(LEAD_STAGES, leads, 'stage');
  const names = Object.fromEntries(s.clients.map((c) => [c.id, c.name]));
  return {
    body: {
      scope: 'CURRENT_USER',
      generatedAt: clock(),
      status: clients.length || leads.length ? 'OK' : 'EMPTY',
      error: null,
      limit: limit.value,
      clients: {
        total: clients.length,
        recent: clients.slice(0, limit.value).map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, createdAt: c.createdAt })),
      },
      leads: {
        total: leads.length,
        open: byStage.NEW + byStage.CONTACTED + byStage.QUALIFIED,
        byStage,
        recent: leads.slice(0, limit.value).map((l) => ({
          id: l.id, clientId: l.clientId, clientName: names[l.clientId] ?? '', propertyId: l.propertyId,
          title: l.title, source: l.source, stage: l.stage, createdAt: l.createdAt,
        })),
      },
    },
  };
}
function tasksPipelineCard(req, ctx) {
  const limit = intParam(req.query, 'limit', 5, 1, 50);
  if (limit.error) return badRequest(limit.error);
  const days = intParam(req.query, 'days', 7, 1, 90);
  if (days.error) return badRequest(days.error);
  const s = store(ctx);
  const from = clock();
  const to = iso(ms(from) + days.value * DAY);
  const byDue = (a, b) => ms(a.dueAt) - ms(b.dueAt) || a.id - b.id;
  const item = (t) => ({
    id: t.id, title: t.title, status: t.status, dueAt: t.dueAt,
    clientId: t.clientId, leadId: t.leadId, propertyId: t.propertyId, transactionId: t.transactionId,
  });
  const dated = s.tasks.filter((t) => isActive(t) && t.dueAt !== null);
  const overdue = dated.filter((t) => ms(t.dueAt) < ms(from)).sort(byDue);
  const dueSoon = dated.filter((t) => ms(t.dueAt) >= ms(from) && ms(t.dueAt) <= ms(to)).sort(byDue);
  const byStage = stageCounts(DEAL_STAGES, s.deals, 'stage');
  return {
    body: {
      scope: 'CURRENT_USER',
      generatedAt: from,
      status: s.tasks.length || s.deals.length ? 'OK' : 'EMPTY',
      error: null,
      limit: limit.value,
      tasks: {
        summary: taskCounts(s.tasks),
        window: { days: days.value, from, to },
        dueSoonCount: dueSoon.length,
        overdue: overdue.slice(0, limit.value).map(item),
        dueSoon: dueSoon.slice(0, limit.value).map(item),
      },
      pipeline: {
        total: s.deals.length,
        open: byStage.PROSPECT + byStage.VIEWING + byStage.OFFER + byStage.UNDER_CONTRACT,
        byStage,
      },
    },
  };
}

// ---- routes ---------------------------------------------------------------------------------
// Exact strings before the digit-only /:id patterns.
const routes = [
  ['GET', '/api/clients', listClients],
  ['POST', '/api/clients', createClient],
  ['PATCH', /^\/api\/clients\/(\d+)$/, updateClient],
  ['DELETE', /^\/api\/clients\/(\d+)$/, deleteClient],

  ['GET', '/api/leads', listLeads],
  ['POST', '/api/leads', createLead],
  ['PATCH', /^\/api\/leads\/(\d+)$/, updateLead],

  ['GET', '/api/tasks/summary', taskSummary],
  ['GET', '/api/tasks', listTasks],
  ['POST', '/api/tasks', createTask],
  ['PATCH', /^\/api\/tasks\/(\d+)$/, updateTask],
  ['DELETE', /^\/api\/tasks\/(\d+)$/, deleteTask],

  ['GET', '/api/transactions/pipeline', pipeline],
  ['GET', '/api/transactions', listDeals],
  ['POST', '/api/transactions', createDeal],
  ['PATCH', /^\/api\/transactions\/(\d+)$/, updateDeal],

  ['GET', '/api/crm/activities', allActivities],
  ['GET', /^\/api\/(clients|leads|tasks|transactions)\/(\d+)\/activities$/, history],
  ['POST', /^\/api\/(clients|leads)\/(\d+)\/activities$/, addNote],

  ['GET', '/api/dashboards/realtor/clients-leads', clientsLeadsCard],
  ['GET', '/api/dashboards/realtor/tasks-pipeline', tasksPipelineCard],
].map(([method, pattern, handle]) => [method, pattern, authed(handle)]);

module.exports = { reset, routes };
