// Lender workspace (organizations, applications, pipeline, collateral LTV, approved-funded card) and
// admin tools (import jobs + CSV ingestion, data-quality report, valuation refresh queue).
//
// Synthetic data only: borrower names, amounts, valuations, job ids and error rows are invented.
// Collateral points at _shared PROPERTIES 42-49. 46 and 49 have no valuation, so their collateral
// value and LTV stay null / UNAVAILABLE (never 0). 45 and 48 have limited valuations.
//
// Two worlds: `full` (ctx.flags.full) and `empty` (ctx.flags.empty). Writes land in the world of the
// current scenario, so creating an organization in the empty scenario shows a real zero-application org.

const crypto = require('node:crypto');
const { page, COUNTY, PROPERTIES, TODAY, daysAgo, dateOnly } = require('./_shared.cjs');

/** Profile id the account fixture is expected to serve for the signed-in user. */
const ME = 7;

// ---- helpers ------------------------------------------------------------------------------
const STAGES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'FUNDED', 'REJECTED', 'WITHDRAWN'];
const STAGE_LABEL = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', APPROVED: 'Approved',
  FUNDED: 'Funded', REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn',
};
const TERMINAL = ['FUNDED', 'REJECTED', 'WITHDRAWN'];
const LOAN_TYPES = ['CONVENTIONAL', 'FHA', 'VA', 'USDA', 'UNKNOWN'];
function nextStages(stage) {
  if (TERMINAL.includes(stage)) return [];
  const forward = { DRAFT: ['SUBMITTED'], SUBMITTED: ['UNDER_REVIEW'], UNDER_REVIEW: ['APPROVED', 'REJECTED'], APPROVED: ['FUNDED'] };
  return [...(forward[stage] || []), 'WITHDRAWN'];
}
const canMove = (from, to) => from === to || nextStages(from).includes(to);

/** Deterministic UUID-looking id, so screenshots and links stay stable across resets. */
function uuid(seed) {
  const h = crypto.createHash('md5').update(String(seed)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const minutesAgo = (m) => daysAgo(m / 1440);
const minutesAhead = (m) => daysAgo(-m / 1440);
let tick = 0;
/** Clock for writes: just after TODAY, strictly increasing so the newest write sorts first. */
const now = () => new Date(TODAY.getTime() + ++tick * 1000).toISOString();
const clone = (o) => JSON.parse(JSON.stringify(o));
const isAmount = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0 && Math.round(v * 100) === v * 100;
const REASONS = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict' };
/** Spring Boot error body; the app reads `message` (core/models/api-error.ts). */
function fail(req, status, message) {
  return { status, body: { timestamp: now(), status, error: REASONS[status] || 'Error', message, path: req.path } };
}
const forbiddenAdmin = (req) => fail(req, 403, 'Access Denied');

// ---- collateral valuations (by property id) -----------------------------------------------
const MODEL = 'zentravalue-2026.10.2';
const VALUATIONS = {
  42: { valuationStatus: 'supported', value: 1085000, range80: { low: 1010000, high: 1160000 }, range90: { low: 968000, high: 1205000 }, confidence: 'HIGH', valuationDate: '2026-10-31', modelVersion: MODEL, reasons: [] },
  43: { valuationStatus: 'supported', value: 1012000, range80: { low: 944000, high: 1081000 }, range90: { low: 905000, high: 1126000 }, confidence: 'HIGH', valuationDate: '2026-10-31', modelVersion: MODEL, reasons: [] },
  44: { valuationStatus: 'supported', value: 1640000, range80: { low: 1498000, high: 1782000 }, range90: { low: 1421000, high: 1866000 }, confidence: 'MEDIUM', valuationDate: '2026-10-31', modelVersion: MODEL, reasons: [] },
  45: {
    valuationStatus: 'limited', value: 298000, range80: { low: 262000, high: 334000 }, range90: null, confidence: 'LOW', valuationDate: '2026-10-31', modelVersion: MODEL,
    reasons: [
      { code: 'NO_SALE_HISTORY', message: 'No recorded sale of this unit; the estimate relies on sales elsewhere in the building.' },
      { code: 'FEW_COMPARABLES', message: '4 comparable sales in the last 12 months, 8 expected.' },
    ],
  },
  46: {
    valuationStatus: 'unsupported', value: null, range80: null, range90: null, confidence: null, valuationDate: null, modelVersion: MODEL,
    reasons: [{ code: 'INSUFFICIENT_COMPARABLES', message: 'Fewer than 3 qualified sales within 1 km in the last 24 months.' }],
  },
  47: { valuationStatus: 'supported', value: 1150000, range80: { low: 1062000, high: 1238000 }, range90: { low: 1015000, high: 1291000 }, confidence: 'MEDIUM', valuationDate: '2026-10-31', modelVersion: MODEL, reasons: [] },
  48: {
    valuationStatus: 'limited', value: 565000, range80: { low: 498000, high: 632000 }, range90: { low: 461000, high: 676000 }, confidence: 'LOW', valuationDate: '2026-10-31', modelVersion: MODEL,
    reasons: [{ code: 'MISSING_BUILDING_FACTS', message: 'Bedrooms, bathrooms and year built are not recorded for this property.' }],
  },
  49: {
    valuationStatus: 'unsupported', value: null, range80: null, range90: null, confidence: null, valuationDate: null, modelVersion: null,
    reasons: [{ code: 'NO_VALUATION', message: 'No valuation has been published for this unit.' }],
  },
};
// The shared gaps decide which properties have no valuation; keep the table honest if they change.
for (const p of PROPERTIES) {
  if (p.gaps.includes('valuation') && VALUATIONS[p.id]) {
    Object.assign(VALUATIONS[p.id], { valuationStatus: 'unsupported', value: null, range80: null, range90: null, confidence: null, valuationDate: null });
  }
}
const DISCLAIMER = 'Informational only; not a credit decision or approval.';

// ---- lender seed --------------------------------------------------------------------------
/** [id, name, email, propertyId, requested, stage, loanType, approved, funded, approvedAt d, fundedAt d, created d, updated d, createdBy, source, externalId, notes] */
const ORG3_APPS = [
  [1024, 'Lucía Bermúdez', 'lucia.bermudez@example.test', 42, 760000, 'FUNDED', 'CONVENTIONAL', 760000, 752500, 41, 33, 70, 33, ME, null, null, null],
  [1025, 'Terrence Whitlock', null, 43, 690000, 'FUNDED', 'VA', 690000, 690000, 30, 22, 58, 22, 112, 'BROKER_SOUTHDADE', 'SD-2214', null],
  [1026, 'Nadia Haddad', 'nadia.haddad@example.test', null, 350000, 'REJECTED', 'FHA', null, null, null, null, 55, 40, ME, null, null, 'Debt-to-income above the program limit.'],
  [1027, 'Gustavo Ferreira', 'g.ferreira@example.test', 48, 590000, 'UNDER_REVIEW', 'CONVENTIONAL', null, null, null, null, 49, 6, 131, null, null, 'Borrower asked about 5% down; appraisal ordered.'],
  [1028, 'Patrice Jean-Louis', null, 45, 255000, 'WITHDRAWN', 'FHA', null, null, null, null, 47, 35, 112, null, null, 'Applicant bought with cash elsewhere.'],
  [1029, 'Hannah Goldberg', 'hannah.goldberg@example.test', 44, 1250000, 'APPROVED', 'CONVENTIONAL', 1200000, null, 25, null, 44, 25, ME, null, null, null],
  [1030, 'Carlos Mendoza Ruiz', null, 42, 805000, 'FUNDED', 'UNKNOWN', 800000, 800000, 15, 5, 40, 5, 112, 'BROKER_SOUTHDADE', 'SD-2238', null],
  [1031, 'Imani Brooks', 'imani.brooks@example.test', null, 275000, 'SUBMITTED', 'USDA', null, null, null, null, 38, 12, 131, null, null, 'Property not chosen yet; pre-approval only.'],
  [1032, 'Viktor Sokolov', 'v.sokolov@example.test', 47, 920000, 'REJECTED', 'CONVENTIONAL', null, null, null, null, 36, 20, ME, null, null, 'Rental income from the second unit could not be verified.'],
  [1033, 'Elena Castellanos', null, 43, 640000, 'APPROVED', 'FHA', 625000, null, 8, null, 33, 8, 112, null, null, null],
  [1034, 'Samuel Oyelaran', 'samuel.oyelaran@example.test', 42, 815000, 'UNDER_REVIEW', 'VA', null, null, null, null, 30, 4, ME, null, null, null],
  [1035, 'Beatriz Andrade', null, null, 199500, 'DRAFT', 'UNKNOWN', null, null, null, null, 27, 27, 131, null, null, 'Waiting on the signed credit authorization.'],
  [1036, 'Rosa Villanueva', 'rosa.villanueva@example.test', 45, 240000, 'APPROVED', 'FHA', 236000, null, 2, null, 26, 2, ME, null, null, null],
  [1037, 'Michael Thibodeaux', 'm.thibodeaux@example.test', 44, 1320000, 'SUBMITTED', 'CONVENTIONAL', null, null, null, null, 21, 10, 112, 'PARTNER_A', 'APP-0977', null],
  [1038, 'Graciela Montes', null, 48, 450000, 'FUNDED', 'FHA', 450000, 448000, 16, 7, 24, 7, 131, null, null, null],
  [1039, 'Desmond Okafor', 'desmond.okafor@example.test', 47, 880000, 'FUNDED', 'CONVENTIONAL', 860000, 860000, 9, 1, 23, 1, ME, null, null, 'Two-unit property; owner occupies one unit.'],
  [1040, 'Aaron Feldstein', 'aaron.feldstein@example.test', 49, 520000, 'UNDER_REVIEW', 'CONVENTIONAL', null, null, null, null, 19, 0.5, 112, null, null, null],
  [1041, 'Marisol Etienne', 'marisol.etienne@example.test', 44, 1180000, 'UNDER_REVIEW', 'CONVENTIONAL', null, null, null, null, 14, 0.1, ME, null, null, null],
  [1042, 'Tomás Iglesias', 't.iglesias@example.test', null, 298000, 'SUBMITTED', 'VA', null, null, null, null, 12, 9, 131, 'PARTNER_A', 'APP-0991', null],
  [1043, 'Yolanda Prieto', null, 46, 312000, 'SUBMITTED', 'FHA', null, null, null, null, 6, 0.3, 112, null, null, null],
  [1044, 'Kenneth Baptiste', null, null, 425000, 'DRAFT', 'UNKNOWN', null, null, null, null, 3, 0.8, ME, null, null, null],
  [1045, 'Ana Lucía Restrepo', 'ana.restrepo@example.test', 42, 690000, 'DRAFT', 'CONVENTIONAL', null, null, null, null, 2.6, 2.5, ME, null, null, 'Refinance of an existing first mortgage.'],
];
const ORG5_APPS = [
  [2001, 'Jorge Albán', 'jorge.alban@example.test', 43, 720000, 'UNDER_REVIEW', 'CONVENTIONAL', null, null, null, null, 9, 3, 118, null, null, null],
  [2002, 'Priya Natarajan', 'priya.natarajan@example.test', 47, 900000, 'FUNDED', 'CONVENTIONAL', 880000, 875000, 20, 13, 31, 13, 118, null, null, null],
  [2003, 'Lamar Pierre-Louis', null, null, 289000, 'SUBMITTED', 'FHA', null, null, null, null, 7, 7, ME, null, null, null],
  [2004, 'Odalys Cabrera', null, 45, 245000, 'APPROVED', 'FHA', 240000, null, 4, null, 15, 4, 140, null, null, null],
  [2005, 'Ethan Kowalczyk', 'ethan.k@example.test', 49, 610000, 'REJECTED', 'CONVENTIONAL', null, null, null, null, 28, 18, 118, null, null, 'Condo association is in litigation.'],
];
function app(orgId, row) {
  const [id, applicantName, applicantEmail, propertyId, requestedAmount, stage, loanType, approvedAmount, fundedAmount, apprD, fundD, createdD, updatedD, createdByUserId, source, externalId, notes] = row;
  return {
    id, organizationId: orgId, createdByUserId, applicantName, applicantEmail, propertyId, requestedAmount,
    currency: 'USD', stage, loanType, approvedAmount, fundedAmount,
    approvedAt: apprD === null ? null : daysAgo(apprD),
    fundedAt: fundD === null ? null : daysAgo(fundD),
    notes, source, externalId, createdAt: daysAgo(createdD), updatedAt: daysAgo(updatedD),
  };
}
function lenderFull() {
  return {
    orgs: [
      { id: 3, name: 'Biscayne Community Lending', ownerUserId: ME },
      { id: 5, name: 'Coral Way Mortgage Partners', ownerUserId: 118 },
      { id: 6, name: 'Little River Credit Union (pilot)', ownerUserId: ME },
    ],
    members: { 3: [ME, 112, 131, 145], 5: [118, ME, 140], 6: [ME] },
    apps: [...ORG3_APPS.map((r) => app(3, r)), ...ORG5_APPS.map((r) => app(5, r))],
  };
}
const lenderEmpty = () => ({ orgs: [], members: {}, apps: [] });

// ---- admin seed: import jobs --------------------------------------------------------------
/** Ingestion job (CSV_IMPORT / PROPERTY_INGESTION); backfill jobs are built by backfill(). */
function ingestion(seed, o) {
  return {
    id: uuid('job-' + seed), jobType: 'CSV_IMPORT', dataset: null, jobId: null, countyId: COUNTY.countyId,
    sourceCounty: COUNTY.countyName, sourceState: COUNTY.stateCode, status: 'COMPLETED',
    total: 0, processed: 0, completed: 0, skipped: 0, failed: 0, currentStep: null,
    errorCode: null, errorMessage: null, inputStorage: 'LOCAL', attempt: 1, retryOfJobId: null,
    retryable: false, retryBlockedReason: 'JOB_COMPLETED', createdAt: null, startedAt: null, finishedAt: null,
    ...o,
  };
}
function backfill(jobId, o) {
  return {
    id: String(jobId), jobType: 'MAPILLARY_IMAGE_BACKFILL', dataset: null, jobId, countyId: COUNTY.countyId,
    sourceCounty: null, sourceState: null, status: 'COMPLETED', total: 0, processed: 0, completed: 0,
    skipped: 0, failed: 0, currentStep: null, errorCode: null, errorMessage: null, inputStorage: null,
    attempt: null, retryOfJobId: null, retryable: false, retryBlockedReason: 'RETRY_NOT_SUPPORTED',
    createdAt: null, startedAt: null, finishedAt: null,
    ...o,
  };
}
function importJobsFull() {
  const salesFailed = ingestion('sales-1', {
    dataset: 'SALES', status: 'FAILED', total: 48210, processed: 17940, completed: 17702, skipped: 205, failed: 33,
    errorCode: 'DATABASE_UNAVAILABLE', errorMessage: 'The database connection was lost at row 17,941 of sales.csv. Rows up to the last checkpoint (17,500) are saved.',
    retryable: false, retryBlockedReason: 'RETRY_ALREADY_ACTIVE',
    createdAt: minutesAgo(95), startedAt: minutesAgo(94), finishedAt: minutesAgo(61),
  });
  return [
    ingestion('sales-2', {
      dataset: 'SALES', status: 'RUNNING', total: 48210, processed: 31877, completed: 31640, skipped: 212, failed: 25,
      currentStep: 'Writing rows', attempt: 2, retryOfJobId: salesFailed.id, retryable: false, retryBlockedReason: 'JOB_NOT_FINISHED',
      createdAt: minutesAgo(14), startedAt: minutesAgo(13), finishedAt: null,
    }),
    ingestion('assessments-q', {
      dataset: 'ASSESSMENTS', status: 'QUEUED', retryable: false, retryBlockedReason: 'JOB_NOT_FINISHED',
      createdAt: minutesAgo(6), startedAt: null, finishedAt: null,
    }),
    backfill(214, {
      status: 'RUNNING', total: 1200, processed: 455, completed: 301, skipped: 154, failed: 0,
      currentStep: 'Querying Mapillary', createdAt: minutesAgo(48), startedAt: minutesAgo(47),
    }),
    salesFailed,
    ingestion('properties-dup', {
      dataset: 'PROPERTIES', status: 'FAILED', total: 914230, processed: 18233, completed: 18232, skipped: 0, failed: 1,
      errorCode: 'DUPLICATE_FOLIO', errorMessage: 'Row 18,233: folio 3059010041870 already exists. Existing properties are never overwritten, so the job stopped.',
      retryable: true, retryBlockedReason: null,
      createdAt: daysAgo(1.1), startedAt: daysAgo(1.1), finishedAt: daysAgo(1.08),
    }),
    ingestion('addresses-1', {
      dataset: 'ADDRESSES', total: 1048210, processed: 1048210, completed: 1047980, skipped: 230, failed: 0,
      createdAt: daysAgo(2.2), startedAt: daysAgo(2.2), finishedAt: daysAgo(2.05),
    }),
    ingestion('lands-1', {
      dataset: 'LANDS', status: 'PARTIAL', total: 913381, processed: 913381, completed: 912004, skipped: 0, failed: 1377,
      errorCode: 'ROWS_FAILED', errorMessage: '1,377 rows could not be read; the other rows were saved.',
      retryable: true, retryBlockedReason: null,
      createdAt: daysAgo(2.9), startedAt: daysAgo(2.9), finishedAt: daysAgo(2.75),
    }),
    ingestion('api-ingest', {
      jobType: 'PROPERTY_INGESTION', dataset: 'PROPERTIES', sourceCounty: null, sourceState: null, inputStorage: null,
      status: 'INTERRUPTED', total: 640, processed: 212, completed: 198, skipped: 9, failed: 5,
      errorCode: 'INSTANCE_RESTARTED', errorMessage: 'The server restarted while this job was running.',
      retryable: false, retryBlockedReason: 'INPUT_ON_OTHER_INSTANCE',
      createdAt: daysAgo(3.4), startedAt: daysAgo(3.4), finishedAt: daysAgo(3.38),
    }),
    backfill(209, {
      status: 'COMPLETED', total: 8, processed: 8, completed: 5, skipped: 2, failed: 1,
      createdAt: daysAgo(4.1), startedAt: daysAgo(4.1), finishedAt: daysAgo(4.09),
    }),
    ingestion('buildings-1', {
      dataset: 'BUILDINGS', total: 905114, processed: 905114, completed: 905114, skipped: 0, failed: 0,
      createdAt: daysAgo(5.3), startedAt: daysAgo(5.3), finishedAt: daysAgo(5.18),
    }),
    backfill(201, {
      status: 'FAILED', total: 1500, processed: 610, completed: 402, skipped: 208, failed: 0,
      errorCode: 'MAPILLARY_RATE_LIMITED', errorMessage: 'Mapillary answered 429 Too Many Requests for 30 minutes, so the job stopped.',
      createdAt: daysAgo(6.2), startedAt: daysAgo(6.2), finishedAt: daysAgo(6.1),
    }),
    ingestion('extra-1', {
      dataset: 'EXTRA_FEATURES', total: 402877, processed: 402877, completed: 402650, skipped: 227, failed: 0,
      createdAt: daysAgo(8.4), startedAt: daysAgo(8.4), finishedAt: daysAgo(8.36),
    }),
  ];
}
/** Detail-only rows: Mapillary outcomes per property, or the first 1000 failed/skipped CSV rows. */
const BACKFILL_RESULTS = {
  209: [
    { propertyId: 42, status: 'IMAGE_SAVED', reason: null, imageId: 5101 },
    { propertyId: 43, status: 'IMAGE_SAVED', reason: null, imageId: 5102 },
    { propertyId: 44, status: 'IMAGE_SAVED', reason: null, imageId: 5103 },
    { propertyId: 45, status: 'SKIPPED', reason: 'No street-level image within 30 m.', imageId: null },
    { propertyId: 46, status: 'IMAGE_SAVED', reason: null, imageId: 5104 },
    { propertyId: 47, status: 'IMAGE_SAVED', reason: null, imageId: 5105 },
    { propertyId: 48, status: 'FAILED', reason: 'Mapillary timed out after 3 attempts.', imageId: null },
    { propertyId: 49, status: 'SKIPPED', reason: 'Newest image is older than 5 years.', imageId: null },
  ],
  214: [
    { propertyId: 42, status: 'IMAGE_SAVED', reason: null, imageId: 5201 },
    { propertyId: 45, status: 'SKIPPED', reason: 'No street-level image within 30 m.', imageId: null },
  ],
  201: [],
};
const ITEM_REASONS = {
  SALES: [['INVALID_NUMBER', (r) => `sale_price "${['N/A', '1,2OO,000', ''][r % 3]}" is not a number`], ['UNKNOWN_FOLIO', (r) => `folio 30${String(50000000000 + r * 7919)} is not in properties`], ['DUPLICATE_ROW', () => 'Same folio, date and price as an earlier row']],
  LANDS: [['INVALID_NUMBER', (r) => `lot_size "${['7,5OO', '-1', 'NULL'][r % 3]}" is not a number`], ['UNKNOWN_FOLIO', (r) => `folio 01${String(31000000000 + r * 6151)} is not in properties`]],
  PROPERTIES: [['INVALID_FOLIO', () => 'folio must have 13 digits'], ['MISSING_FIELD', () => 'dor_code is empty']],
  API: [['UPSTREAM_TIMEOUT', () => 'The county property service did not answer within 30 s.'], ['INVALID_RESPONSE', () => 'The county property service answered without a land use code.']],
  ADDRESSES: [['MISSING_FIELD', () => 'street name is empty'], ['DUPLICATE_ROW', () => 'Same folio and address as an earlier row']],
  EXTRA_FEATURES: [['UNKNOWN_CODE', (r) => `feature code "X${r % 90}" is not recognized`]],
  ASSESSMENTS: [['INVALID_NUMBER', () => 'total_value is not a number']],
  BUILDINGS: [['INVALID_NUMBER', () => 'living_area is not a number']],
};
/** Jobs whose rows must match their errorMessage exactly. */
const ITEM_OVERRIDES = {
  [uuid('job-properties-dup')]: [{ itemKey: 'properties.csv:18233', status: 'FAILED', reason: 'DUPLICATE_FOLIO', message: 'folio 3059010041870 already exists' }],
};
function itemsFor(job) {
  if (ITEM_OVERRIDES[job.id]) return clone(ITEM_OVERRIDES[job.id]);
  const n = Math.min(1000, job.failed + job.skipped);
  const reasons = (job.jobType === 'PROPERTY_INGESTION' ? ITEM_REASONS.API : ITEM_REASONS[job.dataset]) || [['INVALID_ROW', () => 'The row could not be read']];
  const file = (job.dataset || 'data').toLowerCase() + '.csv';
  const out = [];
  for (let i = 0; i < n; i++) {
    const failed = i < job.failed;
    const row = 1200 + i * 37 + (i % 5) * 3;
    const [reason, msg] = reasons[i % reasons.length];
    out.push(
      job.jobType === 'PROPERTY_INGESTION'
        ? { itemKey: '30' + String(59010040000 + i * 113), status: failed ? 'FAILED' : 'SKIPPED', reason: failed ? reason : 'ALREADY_PRESENT', message: failed ? msg(i) : null }
        : { itemKey: `${file}:${row}`, status: failed ? 'FAILED' : 'SKIPPED', reason: failed ? reason : 'DUPLICATE_ROW', message: failed ? msg(i) : (i % 4 === 0 ? null : 'Same folio as an earlier row') },
    );
  }
  return out;
}

// ---- admin seed: data quality ------------------------------------------------------------
const RULES = [
  { rule: 'PROPERTY_MISSING_ADDRESS', category: 'MISSING', entityType: 'PROPERTY', source: 'property, address', description: 'Property without an address', count: 14 },
  { rule: 'PROPERTY_MISSING_PARCEL', category: 'MISSING', entityType: 'PROPERTY', source: 'property, parcel', description: 'Property without parcel geometry', count: 37 },
  { rule: 'ASSESSMENT_STALE', category: 'STALE', entityType: 'ASSESSMENT', source: 'assessment', description: 'Latest assessment older than two tax years', count: 212 },
  { rule: 'LOT_SIZE_CONFLICT', category: 'CONFLICTING', entityType: 'PROPERTY', source: 'land, parcel', description: 'Recorded lot size differs from the parcel area by more than 10%', count: 9 },
  { rule: 'SALE_PRICE_OUTLIER', category: 'OUTLIER', entityType: 'SALE', source: 'sale', description: 'Sale price far outside the area median', count: 23 },
  { rule: 'SALE_DUPLICATE', category: 'DUPLICATE', entityType: 'SALE', source: 'sale', description: 'Sale recorded twice', count: 6 },
  { rule: 'ASSESSMENT_DUPLICATE', category: 'DUPLICATE', entityType: 'ASSESSMENT', source: 'assessment', description: 'Assessment recorded twice for the same tax year', count: 0 },
];
const fmt = (n) => n.toLocaleString('en-US');
const synthFolio = (i, prefix) => prefix + String(1000000000 + ((i * 2654435761) % 9000000000)).padStart(11, '0').slice(0, 11);
function issuesFor(def) {
  const P = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));
  // Real catalog properties first (only where their gaps allow the issue), then synthetic records.
  const real = {
    PROPERTY_MISSING_ADDRESS: [],
    PROPERTY_MISSING_PARCEL: [],
    ASSESSMENT_STALE: [46, 48],
    LOT_SIZE_CONFLICT: [47, 44],
    SALE_PRICE_OUTLIER: [44, 46],
    SALE_DUPLICATE: [42],
    ASSESSMENT_DUPLICATE: [],
  }[def.rule].filter((id) => !(def.rule === 'LOT_SIZE_CONFLICT' && P[id].lotSqft === null) && !(def.entityType === 'SALE' && P[id].gaps.includes('saleHistory')));
  const out = [];
  for (let i = 0; i < def.count; i++) {
    const r = real[i] ? P[real[i]] : null;
    const propertyId = r ? r.id : 18000 + (((i + def.rule.length * 31) * 7907) % 61000);
    const folio = r ? r.folio : synthFolio(i + def.rule.length, ['30', '01', '04', '35'][i % 4]);
    let entityId = propertyId;
    let detail;
    let sold = null;
    switch (def.rule) {
      case 'PROPERTY_MISSING_ADDRESS':
        detail = i % 3 === 0 ? 'No address record for this folio.' : 'Address record has no street name.';
        break;
      case 'PROPERTY_MISSING_PARCEL':
        detail = 'No parcel geometry; the property cannot be placed on the map.';
        break;
      case 'ASSESSMENT_STALE': {
        entityId = 7700000 + i * 13;
        const year = [2022, 2021, 2023][i % 3];
        detail = `Latest assessment is for tax year ${year}; the 2025 roll has not been loaded.`;
        break;
      }
      case 'LOT_SIZE_CONFLICT': {
        const recorded = r ? r.lotSqft : 6000 + (i * 811) % 9000;
        const measured = Math.round(recorded * (i % 2 ? 1.17 : 0.88) / 10) * 10;
        const pct = Math.round(Math.abs(measured - recorded) / recorded * 100);
        detail = `Land record: ${fmt(recorded)} sq ft; parcel geometry: ${fmt(measured)} sq ft (${pct}% ${measured > recorded ? 'larger' : 'smaller'}).`;
        break;
      }
      case 'SALE_PRICE_OUTLIER':
        entityId = 880000 + i * 29;
        sold = i % 3 === 1;
        detail = sold
          ? `Sale of $${fmt(100 + (i % 4) * 50)} on ${dateOnly(daysAgo(200 + i * 11))} is under 1% of the area median; likely not an arm's-length sale.`
          : `Sale of $${fmt(9800000 + i * 412000)} on ${dateOnly(daysAgo(150 + i * 9))} is ${(8 + (i % 7) * 0.9).toFixed(1)} times the area median for this property type.`;
        break;
      case 'SALE_DUPLICATE':
        entityId = 771000 + i * 41;
        detail = `Same date, price and deed book/page as sale #${entityId - 17}.`;
        break;
      default:
        detail = 'Recorded twice.';
    }
    const fromFile = i % 5 !== 3;
    const orphan = def.rule === 'SALE_DUPLICATE' && i >= 4; // sale rows whose folio matches no property
    out.push({
      reference: `${def.rule}:${def.entityType}:${entityId}`,
      rule: def.rule,
      category: def.category,
      entityType: def.entityType,
      entityId,
      propertyId: orphan ? null : propertyId,
      folio: orphan ? synthFolio(i + 99, '30') : folio,
      detail,
      sourceCounty: fromFile ? COUNTY.countyName : null,
      sourceState: fromFile ? COUNTY.stateCode : null,
      sourcePropertyId: fromFile && i % 7 !== 2 ? 100000 + i * 53 : null,
    });
  }
  return out;
}

// ---- admin seed: valuation refresh queue --------------------------------------------------
function refresh(n, o) {
  return {
    requestId: uuid('vr-' + n), eventKey: null, triggerType: 'SALE_CHANGE', scopeType: 'PROPERTY',
    propertyId: null, saleId: null, sourceVersion: null, sourceChangedAt: null, status: 'COMPLETED',
    outcome: null, attempts: 1, maxAttempts: 5, nextAttemptAt: null, runId: null, lastErrorCode: null,
    leaseExpiresAt: null, createdAt: null, updatedAt: null, startedAt: null, completedAt: null,
    ...o,
  };
}
function refreshFull() {
  const rows = [
    refresh(1, { triggerType: 'SALE_CHANGE', propertyId: 44, saleId: 88412, sourceVersion: '1', sourceChangedAt: minutesAgo(9), status: 'PENDING', attempts: 0, nextAttemptAt: minutesAhead(2), createdAt: minutesAgo(8), updatedAt: minutesAgo(8) }),
    refresh(2, { triggerType: 'PROPERTY_CHANGE', propertyId: 47, sourceVersion: '7', sourceChangedAt: minutesAgo(20), status: 'LEASED', attempts: 1, runId: 'run-20261118-1452', leaseExpiresAt: minutesAhead(4), createdAt: minutesAgo(19), updatedAt: minutesAgo(1), startedAt: minutesAgo(1) }),
    refresh(3, { triggerType: 'PROPERTY_CHANGE', propertyId: 48, sourceVersion: '4', sourceChangedAt: minutesAgo(70), status: 'PENDING', attempts: 2, lastErrorCode: 'WORKER_UNAVAILABLE', nextAttemptAt: minutesAhead(12), createdAt: minutesAgo(68), updatedAt: minutesAgo(18), startedAt: minutesAgo(19) }),
    refresh(4, { triggerType: 'SALE_CHANGE', propertyId: 43, saleId: 88377, sourceVersion: '2', sourceChangedAt: daysAgo(0.3), status: 'FAILED', attempts: 5, lastErrorCode: 'COMPARABLES_QUERY_TIMEOUT', createdAt: daysAgo(0.3), updatedAt: daysAgo(0.12), startedAt: daysAgo(0.13), completedAt: daysAgo(0.12) }),
    refresh(5, { triggerType: 'SALE_CHANGE', propertyId: 42, saleId: 88390, sourceVersion: '1', sourceChangedAt: daysAgo(0.4), status: 'COMPLETED', outcome: 'VALUATION_PUBLISHED', runId: 'run-20261118-0611', createdAt: daysAgo(0.4), updatedAt: daysAgo(0.37), startedAt: daysAgo(0.38), completedAt: daysAgo(0.37) }),
    refresh(6, { triggerType: 'PROPERTY_CHANGE', propertyId: 46, sourceVersion: '3', sourceChangedAt: daysAgo(0.6), status: 'COMPLETED', outcome: 'NO_SUPPORTED_VALUATION', runId: 'run-20261118-0144', createdAt: daysAgo(0.6), updatedAt: daysAgo(0.58), startedAt: daysAgo(0.59), completedAt: daysAgo(0.58) }),
    refresh(7, { triggerType: 'MODEL_PUBLICATION', scopeType: 'FULL_MARKET', sourceVersion: 'zentravalue-2026.11.0', sourceChangedAt: daysAgo(0.9), status: 'FAILED', attempts: 3, maxAttempts: 3, lastErrorCode: 'PUBLICATION_CHECKSUM_MISMATCH', createdAt: daysAgo(0.9), updatedAt: daysAgo(0.7), startedAt: daysAgo(0.72), completedAt: daysAgo(0.7) }),
    refresh(8, { triggerType: 'PROPERTY_CHANGE', propertyId: 45, sourceVersion: '2', sourceChangedAt: daysAgo(1.2), status: 'CANCELLED', attempts: 0, outcome: 'CANCELLED', createdAt: daysAgo(1.2), updatedAt: daysAgo(1.1) }),
    refresh(9, { triggerType: 'SALE_CHANGE', propertyId: 47, saleId: 88211, sourceVersion: '1', sourceChangedAt: daysAgo(1.5), status: 'COMPLETED', outcome: 'UNCHANGED', runId: 'run-20261117-0302', createdAt: daysAgo(1.5), updatedAt: daysAgo(1.48), startedAt: daysAgo(1.49), completedAt: daysAgo(1.48) }),
    refresh(10, { triggerType: 'PROPERTY_CHANGE', propertyId: 49, sourceVersion: '5', sourceChangedAt: daysAgo(1.9), status: 'FAILED', attempts: 5, lastErrorCode: 'PROPERTY_FACTS_INCOMPLETE', createdAt: daysAgo(1.9), updatedAt: daysAgo(1.6), startedAt: daysAgo(1.61), completedAt: daysAgo(1.6) }),
    refresh(11, { triggerType: 'MODEL_PUBLICATION', scopeType: 'FULL_MARKET', sourceVersion: 'zentravalue-2026.11.0', sourceChangedAt: daysAgo(0.9), status: 'PENDING', attempts: 0, maxAttempts: 3, nextAttemptAt: minutesAhead(11 * 60), createdAt: daysAgo(0.69), updatedAt: daysAgo(0.69) }),
    refresh(12, { triggerType: 'SALE_CHANGE', propertyId: 44, saleId: 87954, sourceVersion: '1', sourceChangedAt: daysAgo(3.2), status: 'COMPLETED', outcome: 'VALUATION_PUBLISHED', runId: 'run-20261115-1120', createdAt: daysAgo(3.2), updatedAt: daysAgo(3.18), startedAt: daysAgo(3.19), completedAt: daysAgo(3.18) }),
    refresh(13, { triggerType: 'SALE_CHANGE', propertyId: 42, saleId: 87731, sourceVersion: '1', sourceChangedAt: daysAgo(4.1), status: 'CANCELLED', attempts: 0, outcome: 'SUPERSEDED', createdAt: daysAgo(4.1), updatedAt: daysAgo(4.0) }),
    refresh(14, { triggerType: 'SALE_CHANGE', propertyId: 48, saleId: 87610, sourceVersion: '2', sourceChangedAt: daysAgo(5.0), status: 'FAILED', attempts: 5, lastErrorCode: 'MODEL_TIMEOUT', createdAt: daysAgo(5.0), updatedAt: daysAgo(4.7), startedAt: daysAgo(4.71), completedAt: daysAgo(4.7) }),
    refresh(15, { triggerType: 'PROPERTY_CHANGE', propertyId: 43, sourceVersion: '6', sourceChangedAt: daysAgo(6.3), status: 'COMPLETED', outcome: 'VALUATION_PUBLISHED', runId: 'run-20261112-0405', createdAt: daysAgo(6.3), updatedAt: daysAgo(6.28), startedAt: daysAgo(6.29), completedAt: daysAgo(6.28) }),
    refresh(16, { triggerType: 'MODEL_PUBLICATION', scopeType: 'FULL_MARKET', sourceVersion: 'zentravalue-2026.10.2', sourceChangedAt: daysAgo(18.5), status: 'COMPLETED', outcome: 'VALUATION_PUBLISHED', maxAttempts: 3, runId: 'run-20261031-0200', createdAt: daysAgo(18.5), updatedAt: daysAgo(18.3), startedAt: daysAgo(18.45), completedAt: daysAgo(18.3) }),
  ];
  for (const r of rows) {
    r.eventKey = r.triggerType === 'SALE_CHANGE' ? `sale:${r.saleId}:v${r.sourceVersion}`
      : r.triggerType === 'PROPERTY_CHANGE' ? `property:${r.propertyId}:v${r.sourceVersion}`
      : `model:${r.sourceVersion}`;
  }
  return rows;
}

// ---- state -------------------------------------------------------------------------------
let db;
function reset() {
  tick = 0;
  db = {
    nextOrgId: 20,
    nextAppId: 3000,
    full: {
      ...lenderFull(),
      jobs: importJobsFull(),
      quality: RULES.map((r) => ({ ...r, issues: issuesFor(r) })),
      refreshes: refreshFull(),
    },
    empty: {
      ...lenderEmpty(),
      jobs: [],
      quality: RULES.map((r) => ({ ...r, count: 0, issues: [] })),
      refreshes: [],
    },
    /** Idempotency-Key -> requestId of the retry it created. */
    retryKeys: {},
  };
}
reset();
const world = (ctx) => (ctx.flags.empty ? db.empty : db.full);

// ---- lender logic ------------------------------------------------------------------------
/** Resolves ?organizationId to an organization the caller belongs to, or an error response. */
function orgFor(req, ctx, raw = req.query.get('organizationId')) {
  const w = world(ctx);
  if (raw === null || raw === '' || !/^\d+$/.test(String(raw))) return { error: fail(req, 400, 'organizationId is required.') };
  const org = w.orgs.find((o) => o.id === Number(raw));
  if (!org) return { error: fail(req, 404, 'Organization not found.') };
  if (!(w.members[org.id] || []).includes(ME)) return { error: fail(req, 403, 'You are not a member of this organization.') };
  return { org, w };
}
const byNewest = (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : b.id - a.id);

function pipeline(org, w) {
  const apps = w.apps.filter((a) => a.organizationId === org.id);
  const stages = {};
  for (const s of STAGES) {
    const inStage = apps.filter((a) => a.stage === s);
    if (inStage.length) stages[s] = { count: inStage.length, requestedAmount: inStage.reduce((n, a) => n + a.requestedAmount, 0) };
  }
  const approved = apps.filter((a) => a.stage === 'APPROVED' || a.stage === 'FUNDED');
  const funded = apps.filter((a) => a.stage === 'FUNDED');
  return {
    organizationId: org.id,
    currency: 'USD',
    total: apps.length,
    stages,
    approvedCount: approved.length,
    approvedAmount: approved.reduce((n, a) => n + (a.approvedAmount ?? 0), 0),
    fundedCount: funded.length,
    fundedAmount: funded.reduce((n, a) => n + (a.fundedAmount ?? 0), 0),
    asOf: TODAY.toISOString(),
    scope: 'ORGANIZATION',
  };
}

function collateral(a) {
  const base = { applicationId: a.id, organizationId: a.organizationId, propertyId: a.propertyId, currency: 'USD', disclaimer: DISCLAIMER };
  const [loanAmount, loanAmountBasis] =
    a.fundedAmount !== null ? [a.fundedAmount, 'FUNDED'] : a.approvedAmount !== null ? [a.approvedAmount, 'APPROVED'] : [a.requestedAmount, 'REQUESTED'];
  if (a.propertyId === null) {
    return { ...base, loanAmount, loanAmountBasis, collateral: null, ltv: { status: 'UNAVAILABLE', percent: null, reasons: ['NO_COLLATERAL_PROPERTY'] } };
  }
  // A property this fixture holds no valuation for (e.g. picked from search) has none, not zero.
  const v = clone(VALUATIONS[a.propertyId] || {
    valuationStatus: 'unsupported', value: null, range80: null, range90: null, confidence: null, valuationDate: null, modelVersion: null,
    reasons: [{ code: 'NO_VALUATION', message: 'No valuation has been published for this property.' }],
  });
  if (v.value === null || v.valuationStatus === 'unsupported') {
    return { ...base, loanAmount, loanAmountBasis, collateral: v, ltv: { status: 'UNAVAILABLE', percent: null, reasons: ['VALUATION_UNAVAILABLE'] } };
  }
  const percent = Math.round((loanAmount / v.value) * 10000) / 100;
  const limited = v.valuationStatus === 'limited';
  return {
    ...base, loanAmount, loanAmountBasis, collateral: v,
    ltv: { status: limited ? 'LIMITED' : 'AVAILABLE', percent, reasons: limited ? ['VALUATION_LIMITED'] : [] },
  };
}

function approvedFunded(req, org, w) {
  const from = req.query.get('fromDate');
  const to = req.query.get('toDate');
  if (!!from !== !!to) return fail(req, 400, 'Give both fromDate and toDate, or neither.');
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (from && (!re.test(from) || !re.test(to))) return fail(req, 400, 'Dates must be ISO days (yyyy-MM-dd).');
  if (from && from > to) return fail(req, 400, 'fromDate must not be after toDate.');
  const y = TODAY.getUTCFullYear();
  const m = TODAY.getUTCMonth();
  const fromDate = from || dateOnly(new Date(Date.UTC(y, m, 1)).toISOString());
  const toDate = to || dateOnly(new Date(Date.UTC(y, m + 1, 0)).toISOString());
  const inPeriod = (iso) => iso !== null && dateOnly(iso) >= fromDate && dateOnly(iso) <= toDate;
  const apps = w.apps.filter((a) => a.organizationId === org.id);
  const approved = apps.filter((a) => a.approvedAmount !== null && inPeriod(a.approvedAt));
  const funded = apps.filter((a) => a.fundedAmount !== null && inPeriod(a.fundedAt));
  const sum = (list, k) => list.reduce((n, a) => n + a[k], 0);
  const empty = !approved.length && !funded.length;
  return {
    body: {
      organizationId: org.id,
      currency: 'USD',
      status: empty ? 'EMPTY' : 'OK',
      error: null,
      generatedAt: TODAY.toISOString(),
      period: { fromDate, toDate, timeZone: 'UTC' },
      approved: { count: approved.length, totalAmount: sum(approved, 'approvedAmount') },
      funded: { count: funded.length, totalAmount: sum(funded, 'fundedAmount') },
      fundedLoanMix: LOAN_TYPES.map((loanType) => {
        const of = funded.filter((a) => a.loanType === loanType);
        return { loanType, count: of.length, totalAmount: sum(of, 'fundedAmount') };
      }),
      note: empty ? null : 'Approved counts every application whose approval date falls in the period, funded ones included.',
    },
  };
}

function validEmail(v) {
  return typeof v === 'string' && v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}

/** Applies a PATCH body to a copy of the application; returns { app } or { error }. */
function patchApplication(req, a, b) {
  const next = { ...a };
  if ('applicantName' in b) {
    if (typeof b.applicantName !== 'string' || !b.applicantName.trim() || b.applicantName.trim().length > 160)
      return { error: fail(req, 400, 'applicantName must be 1 to 160 characters.') };
    next.applicantName = b.applicantName.trim();
  }
  if ('applicantEmail' in b) {
    if (b.applicantEmail !== null && !validEmail(b.applicantEmail)) return { error: fail(req, 400, 'applicantEmail is not a valid email address.') };
    next.applicantEmail = b.applicantEmail;
  }
  if ('propertyId' in b) {
    if (b.propertyId !== null && !(Number.isSafeInteger(b.propertyId) && b.propertyId > 0)) return { error: fail(req, 400, 'propertyId must be a positive number.') };
    next.propertyId = b.propertyId;
  }
  if ('requestedAmount' in b) {
    if (!isAmount(b.requestedAmount)) return { error: fail(req, 400, 'requestedAmount must be a positive amount with at most two decimals.') };
    next.requestedAmount = b.requestedAmount;
  }
  if ('notes' in b) {
    if (b.notes !== null && (typeof b.notes !== 'string' || b.notes.length > 2000)) return { error: fail(req, 400, 'notes must be at most 2000 characters.') };
    next.notes = b.notes === null ? null : b.notes.trim() || null;
  }
  if ('loanType' in b) {
    if (b.loanType !== null && !LOAN_TYPES.includes(b.loanType)) return { error: fail(req, 400, 'loanType must be one of ' + LOAN_TYPES.join(', ') + '.') };
    next.loanType = b.loanType ?? 'UNKNOWN';
  }
  if ('approvedAmount' in b && b.approvedAmount !== undefined) {
    if (!isAmount(b.approvedAmount)) return { error: fail(req, 400, 'approvedAmount must be a positive amount with at most two decimals.') };
    next.approvedAmount = b.approvedAmount;
  }
  if ('fundedAmount' in b && b.fundedAmount !== undefined) {
    if (!isAmount(b.fundedAmount)) return { error: fail(req, 400, 'fundedAmount must be a positive amount with at most two decimals.') };
    next.fundedAmount = b.fundedAmount;
  }
  if ('stage' in b && b.stage !== undefined) {
    if (!STAGES.includes(b.stage)) return { error: fail(req, 400, 'stage must be one of ' + STAGES.join(', ') + '.') };
    if (!canMove(a.stage, b.stage))
      return { error: fail(req, 409, `An application in ${STAGE_LABEL[a.stage]} cannot move to ${STAGE_LABEL[b.stage]}.`) };
    next.stage = b.stage;
  }
  if (next.stage === 'APPROVED' || next.stage === 'FUNDED') {
    if (next.approvedAmount === null) return { error: fail(req, 400, 'An approved application needs approvedAmount.') };
    if (next.approvedAmount > next.requestedAmount) return { error: fail(req, 400, 'approvedAmount cannot exceed requestedAmount.') };
    if (next.approvedAt === null) next.approvedAt = now();
  }
  if (next.stage === 'FUNDED') {
    if (next.fundedAmount === null) return { error: fail(req, 400, 'A funded application needs fundedAmount.') };
    if (next.fundedAmount > next.approvedAmount) return { error: fail(req, 400, 'fundedAmount cannot exceed approvedAmount.') };
    if (next.fundedAt === null) next.fundedAt = now();
  }
  next.updatedAt = now();
  return { app: next };
}

const IMPORT_FIELDS = ['applicantName', 'applicantEmail', 'propertyId', 'requestedAmount', 'stage', 'approvedAmount', 'fundedAmount', 'approvedAt', 'fundedAt', 'notes', 'loanType'];
function importRow(row, source, org, w) {
  const bad = { status: 'REJECTED', applicationId: null, errorCode: 'INVALID_ROW' };
  if (!row || typeof row !== 'object') return bad;
  const ok =
    typeof row.externalId === 'string' && row.externalId.trim() && row.externalId.length <= 80 &&
    typeof row.applicantName === 'string' && row.applicantName.trim() && row.applicantName.length <= 160 &&
    isAmount(row.requestedAmount) && row.currency === 'USD' && STAGES.includes(row.stage) &&
    (row.loanType === undefined || row.loanType === null || LOAN_TYPES.includes(row.loanType)) &&
    (row.applicantEmail === undefined || row.applicantEmail === null || validEmail(row.applicantEmail)) &&
    (row.propertyId === undefined || row.propertyId === null || (Number.isSafeInteger(row.propertyId) && row.propertyId > 0));
  if (!ok) return bad;
  const needsApproval = row.stage === 'APPROVED' || row.stage === 'FUNDED';
  if (needsApproval && (!isAmount(row.approvedAmount) || !row.approvedAt || row.approvedAmount > row.requestedAmount)) return bad;
  if (row.stage === 'FUNDED' && (!isAmount(row.fundedAmount) || !row.fundedAt || row.fundedAmount > row.approvedAmount)) return bad;
  const badDate = (v) => typeof v !== 'string' || Number.isNaN(Date.parse(v));
  if (needsApproval && badDate(row.approvedAt)) return bad;
  if (row.stage === 'FUNDED' && badDate(row.fundedAt)) return bad;
  const values = {
    applicantName: row.applicantName.trim(),
    applicantEmail: row.applicantEmail ?? null,
    propertyId: row.propertyId ?? null,
    requestedAmount: row.requestedAmount,
    stage: row.stage,
    approvedAmount: needsApproval ? row.approvedAmount : null,
    fundedAmount: row.stage === 'FUNDED' ? row.fundedAmount : null,
    approvedAt: needsApproval ? new Date(row.approvedAt).toISOString() : null,
    fundedAt: row.stage === 'FUNDED' ? new Date(row.fundedAt).toISOString() : null,
    notes: row.notes ?? null,
    loanType: row.loanType ?? 'UNKNOWN',
  };
  const existing = w.apps.find((a) => a.organizationId === org.id && a.source === source && a.externalId === row.externalId.trim());
  if (existing) {
    if (!canMove(existing.stage, values.stage)) return { status: 'REJECTED', applicationId: existing.id, errorCode: 'INVALID_TRANSITION' };
    const changed = IMPORT_FIELDS.some((k) => existing[k] !== values[k]);
    if (!changed) return { status: 'UNCHANGED', applicationId: existing.id, errorCode: null };
    Object.assign(existing, values, { updatedAt: now() });
    return { status: 'UPDATED', applicationId: existing.id, errorCode: null };
  }
  const t = now();
  const created = { id: db.nextAppId++, organizationId: org.id, createdByUserId: ME, ...values, currency: 'USD', source, externalId: row.externalId.trim(), createdAt: t, updatedAt: t };
  w.apps.push(created);
  return { status: 'CREATED', applicationId: created.id, errorCode: null };
}

// ---- admin logic -------------------------------------------------------------------------
const listJob = ({ results, items, ...rest }) => rest;
function jobDetail(job) {
  if (job.jobType === 'MAPILLARY_IMAGE_BACKFILL') return { ...job, results: clone(BACKFILL_RESULTS[job.jobId] || []) };
  return { ...job, items: itemsFor(job) };
}
const DATASET_CODE = (d) => d.toUpperCase().replace(/-/g, '_');
const CSV_DATASETS = ['properties', 'addresses', 'assessments', 'buildings', 'lands', 'sales', 'taxes', 'extra-features', 'parcels', 'property-value-predictions', 'property-images'];
function queueJob(ctx, dataset) {
  const w = world(ctx);
  const job = ingestion('upload-' + ++tick, {
    dataset, status: 'QUEUED', retryable: false, retryBlockedReason: 'JOB_NOT_FINISHED', createdAt: now(),
  });
  w.jobs.unshift(job);
  return { status: 202, body: job };
}

// ---- routes ------------------------------------------------------------------------------
module.exports = {
  reset,
  routes: [
    // Organizations and team access
    ['GET', '/api/lender/organizations', (req, ctx) => {
      const w = world(ctx);
      return { body: w.orgs.filter((o) => (w.members[o.id] || []).includes(ME)) };
    }],
    ['POST', '/api/lender/organizations', (req, ctx) => {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 160) return fail(req, 400, 'name must be 1 to 160 characters.');
      const w = world(ctx);
      const org = { id: db.nextOrgId++, name, ownerUserId: ME };
      w.orgs.push(org);
      w.members[org.id] = [ME];
      return { status: 201, body: org };
    }],
    ['GET', /^\/api\/lender\/organizations\/(\d+)\/members$/, (req, ctx) => {
      const r = orgFor(req, ctx, req.params[1]);
      if (r.error) return r.error;
      return { body: [...r.w.members[r.org.id]] };
    }],
    ['POST', /^\/api\/lender\/organizations\/(\d+)\/members$/, (req, ctx) => {
      const r = orgFor(req, ctx, req.params[1]);
      if (r.error) return r.error;
      if (r.org.ownerUserId !== ME) return fail(req, 403, 'Only the organization owner can change who has access.');
      const userId = req.body?.userId;
      if (!Number.isSafeInteger(userId) || userId <= 0) return fail(req, 400, 'userId must be a positive number.');
      if (userId > 100000) return fail(req, 404, `User ${userId} was not found.`);
      const list = r.w.members[r.org.id];
      if (list.includes(userId)) return fail(req, 409, `User ${userId} is already a member.`);
      list.push(userId);
      return { status: 204 };
    }],
    ['DELETE', /^\/api\/lender\/organizations\/(\d+)\/members\/(\d+)$/, (req, ctx) => {
      const r = orgFor(req, ctx, req.params[1]);
      if (r.error) return r.error;
      if (r.org.ownerUserId !== ME) return fail(req, 403, 'Only the organization owner can change who has access.');
      const userId = Number(req.params[2]);
      if (userId === r.org.ownerUserId) return fail(req, 409, 'The owner cannot be removed.');
      const list = r.w.members[r.org.id];
      if (!list.includes(userId)) return fail(req, 404, `User ${userId} is not a member.`);
      r.w.members[r.org.id] = list.filter((id) => id !== userId);
      return { status: 204 };
    }],

    // Applications
    ['GET', '/api/lender/applications', (req, ctx) => {
      const r = orgFor(req, ctx);
      if (r.error) return r.error;
      const stage = req.query.get('stage');
      if (stage && !STAGES.includes(stage)) return fail(req, 400, 'stage must be one of ' + STAGES.join(', ') + '.');
      const list = r.w.apps.filter((a) => a.organizationId === r.org.id && (!stage || a.stage === stage)).sort(byNewest);
      return { body: page(list.map(clone), req.query) };
    }],
    ['POST', '/api/lender/applications', (req, ctx) => {
      const r = orgFor(req, ctx);
      if (r.error) return r.error;
      const b = req.body;
      if (!b || typeof b !== 'object') return fail(req, 400, 'A JSON body is required.');
      const name = typeof b.applicantName === 'string' ? b.applicantName.trim() : '';
      if (!name || name.length > 160) return fail(req, 400, 'applicantName must be 1 to 160 characters.');
      if (!isAmount(b.requestedAmount)) return fail(req, 400, 'requestedAmount must be a positive amount with at most two decimals.');
      if (b.currency !== undefined && b.currency !== 'USD') return fail(req, 400, 'Only USD is supported.');
      if (b.applicantEmail !== undefined && !validEmail(b.applicantEmail)) return fail(req, 400, 'applicantEmail is not a valid email address.');
      if (b.loanType !== undefined && b.loanType !== null && !LOAN_TYPES.includes(b.loanType)) return fail(req, 400, 'loanType must be one of ' + LOAN_TYPES.join(', ') + '.');
      if (b.propertyId !== undefined && b.propertyId !== null && !(Number.isSafeInteger(b.propertyId) && b.propertyId > 0)) return fail(req, 400, 'propertyId must be a positive number.');
      if (b.notes !== undefined && b.notes !== null && (typeof b.notes !== 'string' || b.notes.length > 2000)) return fail(req, 400, 'notes must be at most 2000 characters.');
      const t = now();
      const created = {
        id: db.nextAppId++, organizationId: r.org.id, createdByUserId: ME, applicantName: name,
        applicantEmail: b.applicantEmail ?? null, propertyId: b.propertyId ?? null, requestedAmount: b.requestedAmount,
        currency: 'USD', stage: 'DRAFT', loanType: b.loanType ?? 'UNKNOWN', approvedAmount: null, fundedAmount: null,
        approvedAt: null, fundedAt: null, notes: typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null,
        source: null, externalId: null, createdAt: t, updatedAt: t,
      };
      r.w.apps.push(created);
      return { status: 201, body: clone(created) };
    }],
    // Exact path before the /applications/{id} patterns (those are digits-only anyway).
    ['POST', '/api/lender/applications/import', (req, ctx) => {
      const r = orgFor(req, ctx);
      if (r.error) return r.error;
      const b = req.body;
      const source = typeof b?.source === 'string' ? b.source.trim() : '';
      if (!source || source.length > 80) return fail(req, 400, 'source must be 1 to 80 characters.');
      if (!Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > 100) return fail(req, 400, 'rows must hold 1 to 100 applications.');
      const rows = b.rows.map((row, i) => ({ row: i + 1, ...importRow(row, source, r.org, r.w) }));
      const count = (s) => rows.filter((x) => x.status === s).length;
      return { body: { created: count('CREATED'), updated: count('UPDATED'), unchanged: count('UNCHANGED'), rejected: count('REJECTED'), rows } };
    }],
    ['PATCH', /^\/api\/lender\/applications\/(\d+)$/, (req, ctx) => {
      const r = orgFor(req, ctx);
      if (r.error) return r.error;
      const a = r.w.apps.find((x) => x.id === Number(req.params[1]) && x.organizationId === r.org.id);
      if (!a) return fail(req, 404, 'Application not found.');
      if (!req.body || typeof req.body !== 'object') return fail(req, 400, 'A JSON body is required.');
      const out = patchApplication(req, a, req.body);
      if (out.error) return out.error;
      Object.assign(a, out.app);
      return { body: clone(a) };
    }],
    ['GET', /^\/api\/lender\/applications\/(\d+)\/collateral-analysis$/, (req, ctx) => {
      const r = orgFor(req, ctx);
      if (r.error) return r.error;
      const a = r.w.apps.find((x) => x.id === Number(req.params[1]) && x.organizationId === r.org.id);
      if (!a) return fail(req, 404, 'Application not found.');
      return { body: collateral(a) };
    }],
    ['GET', '/api/lender/pipeline', (req, ctx) => {
      const r = orgFor(req, ctx);
      if (r.error) return r.error;
      return { body: pipeline(r.org, r.w) };
    }],
    ['GET', '/api/dashboards/lender/approved-funded', (req, ctx) => {
      const r = orgFor(req, ctx);
      if (r.error) return r.error;
      return approvedFunded(req, r.org, r.w);
    }],

    // Admin: data quality
    ['GET', '/api/admin/data-quality/issues', (req, ctx) => {
      if (!ctx.flags.admin) return forbiddenAdmin(req);
      const w = world(ctx);
      const rule = req.query.get('rule');
      if (rule && !RULES.some((r) => r.rule === rule)) return fail(req, 400, 'Unknown rule ' + rule + '.');
      const body = {
        generatedAt: minutesAgo(3),
        summary: w.quality.map(({ rule, category, entityType, source, description, count }) => ({ rule, category, entityType, source, description, issueCount: count })),
        note: ctx.flags.empty ? null : 'Counts are reused for up to 5 minutes. Rules read the latest import of each county.',
      };
      if (rule) {
        body.rule = rule;
        body.issues = page(w.quality.find((r) => r.rule === rule).issues, req.query);
      }
      return { body };
    }],

    // Admin: valuation refresh queue
    ['GET', '/api/admin/valuation-refresh-requests', (req, ctx) => {
      if (!ctx.flags.admin) return forbiddenAdmin(req);
      const status = req.query.get('status');
      if (status && !['PENDING', 'LEASED', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) return fail(req, 400, 'Unknown status ' + status + '.');
      const list = world(ctx).refreshes.filter((r) => !status || r.status === status).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { body: page(list.map(clone), req.query) };
    }],
    ['POST', /^\/api\/admin\/valuation-refresh-requests\/([^/]+)\/cancel$/, (req, ctx) => {
      if (!ctx.flags.admin) return forbiddenAdmin(req);
      const r = world(ctx).refreshes.find((x) => x.requestId === decodeURIComponent(req.params[1]));
      if (!r) return fail(req, 404, 'Refresh request not found.');
      if (r.status !== 'PENDING' && r.status !== 'FAILED') return fail(req, 409, 'Only pending or failed requests can be cancelled.');
      const t = now();
      Object.assign(r, { status: 'CANCELLED', outcome: 'CANCELLED', nextAttemptAt: null, updatedAt: t, completedAt: t });
      return { body: clone(r) };
    }],
    ['POST', /^\/api\/admin\/valuation-refresh-requests\/([^/]+)\/retry$/, (req, ctx) => {
      if (!ctx.flags.admin) return forbiddenAdmin(req);
      const w = world(ctx);
      const r = w.refreshes.find((x) => x.requestId === decodeURIComponent(req.params[1]));
      if (!r) return fail(req, 404, 'Refresh request not found.');
      const key = req.headers['idempotency-key'];
      if (key && db.retryKeys[key]) return { status: 201, body: clone(w.refreshes.find((x) => x.requestId === db.retryKeys[key])) };
      if (r.status !== 'FAILED') return fail(req, 409, 'Only failed requests can be retried.');
      if (r.triggerType === 'MODEL_PUBLICATION') return fail(req, 409, 'Model publications are retried by the valuation worker.');
      const t = now();
      const retry = refresh('retry-' + r.requestId + '-' + tick, {
        eventKey: r.eventKey + ':retry', triggerType: r.triggerType, scopeType: r.scopeType, propertyId: r.propertyId,
        saleId: r.saleId, sourceVersion: r.sourceVersion, sourceChangedAt: r.sourceChangedAt, status: 'PENDING',
        attempts: 0, maxAttempts: r.maxAttempts, nextAttemptAt: t, createdAt: t, updatedAt: t,
      });
      w.refreshes.unshift(retry);
      if (key) db.retryKeys[key] = retry.requestId;
      return { status: 201, body: clone(retry) };
    }],

    // Admin: import jobs
    ['GET', '/api/admin/import-jobs', (req, ctx) => {
      if (!ctx.flags.admin) return forbiddenAdmin(req);
      const { content, page: number, size, totalElements, totalPages } = page(world(ctx).jobs.map(listJob), req.query);
      return {
        body: {
          jobs: { content, page: number, size, totalElements, totalPages },
          untrackedJobTypes: ['SCHOOL_ANALYSIS', 'TRANSPORTATION_ANALYSIS'],
          note: 'These run on the analysis worker and report to its own log.',
        },
      };
    }],
    ['GET', /^\/api\/admin\/import-jobs\/([^/]+)$/, (req, ctx) => {
      if (!ctx.flags.admin) return forbiddenAdmin(req);
      const job = world(ctx).jobs.find((j) => j.id === decodeURIComponent(req.params[1]));
      if (!job) return fail(req, 404, 'Import job not found.');
      return { body: jobDetail(job) };
    }],
    ['POST', /^\/api\/admin\/import-jobs\/([^/]+)\/retry$/, (req, ctx) => {
      if (!ctx.flags.admin) return forbiddenAdmin(req);
      const w = world(ctx);
      const job = w.jobs.find((j) => j.id === decodeURIComponent(req.params[1]));
      if (!job) return fail(req, 404, 'Import job not found.');
      if (job.jobType === 'MAPILLARY_IMAGE_BACKFILL') return fail(req, 409, 'RETRY_NOT_SUPPORTED: image backfill jobs cannot be retried.');
      if (job.status === 'QUEUED' || job.status === 'RUNNING') return fail(req, 409, 'JOB_NOT_FINISHED: the job is still running.');
      if (job.status === 'COMPLETED') return fail(req, 409, 'JOB_COMPLETED: the job already completed.');
      if (!job.retryable) return fail(req, 409, `${job.retryBlockedReason || 'RETRY_NOT_SUPPORTED'}: retry is not available for this job.`);
      const next = ingestion('retry-' + job.id + '-' + ++tick, {
        jobType: job.jobType, dataset: job.dataset, sourceCounty: job.sourceCounty, sourceState: job.sourceState,
        inputStorage: job.inputStorage, status: 'QUEUED', total: job.total, processed: 0, attempt: (job.attempt ?? 1) + 1,
        retryOfJobId: job.id, retryable: false, retryBlockedReason: 'JOB_NOT_FINISHED', createdAt: now(),
      });
      Object.assign(job, { retryable: false, retryBlockedReason: 'RETRY_ALREADY_ACTIVE' });
      w.jobs.unshift(next);
      return { status: 202, body: next };
    }],

    // CSV ingestion (multipart: req.body is null, so county/state default to the shared county)
    ['POST', '/api/ingestion/import/owners', (req, ctx) => (ctx.flags.admin ? queueJob(ctx, 'OWNERS') : forbiddenAdmin(req))],
    ['POST', '/api/ingestion/import/folder', (req, ctx) => (ctx.flags.admin ? queueJob(ctx, 'COUNTY_FOLDER') : forbiddenAdmin(req))],
    ['POST', /^\/api\/ingestion\/import\/([^/]+)$/, (req, ctx) => {
      if (!ctx.flags.admin) return forbiddenAdmin(req);
      const dataset = decodeURIComponent(req.params[1]);
      if (!CSV_DATASETS.includes(dataset)) return fail(req, 400, `Unknown dataset ${dataset}.`);
      return queueJob(ctx, DATASET_CODE(dataset));
    }],
  ],
};
