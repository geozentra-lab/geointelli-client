'use strict';
// Account domain: profile, preferences, realtor license, favorites, saved searches, alert rules and
// their monitoring, the notification inbox and delivery settings, the user dashboard cards, the
// lender mortgage-context card, recommendations and opportunity scores.
//
// Shapes follow src/app/core/models. Where the client models leave a value open (status codes,
// generated copy, ordering) the values copy property-service / notification-service master 0f60963,
// so the audit sees the strings the real backend would send. All records are synthetic.
//
// State is kept per scenario ("full" / "empty") so switching scenarios without /__mock/reset never
// leaks one account's writes into the other.

const { page, COUNTY, PROPERTIES, TODAY, daysAgo, dateOnly } = require('./_shared.cjs');

// lender-admin.cjs treats user 7 as the signed-in user (organization owner, Team view).
const USER_ID = 7;
const EMAIL = 'audit.user@example.test';
const STATE_NAME = 'Florida';
const PERSONAS = ['USER', 'RESIDENTIAL_INVESTOR', 'REALTOR', 'BANK_LENDER'];
const PROFESSIONALS = ['REALTOR', 'BANK_LENDER'];
const CARD_MAX_LIMIT = 20;

const byId = new Map(PROPERTIES.map((p) => [p.id, p]));
const lacks = (p, fact) => p.gaps.includes(fact);
const inDays = (n) => daysAgo(-n);
const r2 = (n) => Math.round(n * 100) / 100;

// ---- errors --------------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const REASONS = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict' };
const bad = (message) => new HttpError(400, message);
const missing = (message = 'Not found') => new HttpError(404, message);
/** Wraps a handler so a thrown HttpError becomes a Spring-style error body. */
const h = (fn) => (req, ctx) => {
  try {
    return fn(req, ctx);
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    return {
      status: e.status,
      body: { status: e.status, error: REASONS[e.status] ?? 'Error', message: e.message, path: req.path },
    };
  }
};

function numParam(query, key) {
  const raw = query.get(key);
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw bad(`${key}: must be a number`);
  return n;
}
function limitParam(query, fallback, max = CARD_MAX_LIMIT) {
  const limit = numParam(query, 'limit') ?? fallback;
  if (!Number.isInteger(limit) || limit < 1 || limit > max)
    throw bad(`limit must be between 1 and ${max}, got ${limit}`);
  return limit;
}
function sizeParam(query, fallback = 20, max = 100) {
  const size = numParam(query, 'size') ?? fallback;
  if (!Number.isInteger(size) || size < 1 || size > max) throw bad(`size must be between 1 and ${max}`);
  const p = numParam(query, 'page') ?? 0;
  if (!Number.isInteger(p) || p < 0) throw bad('page must be 0 or greater');
}

// ---- property records ----------------------------------------------------------------------
const NEIGHBORHOOD = {
  42: ['Silver Bluff', null],
  43: ['Silver Bluff', null],
  44: ['Coconut Grove', 'Bayfront village south of Brickell with an older, tree-lined housing stock.'],
  45: ['Hialeah', null],
  46: ['Miami Gardens', null],
  47: ['Upper East Side', 'Historic districts between Biscayne Boulevard and the bay.'],
  48: ['South Miami Heights', null],
  49: ['South Beach', null],
};
const DOR = { 'Single family': '0101', Condominium: '0407', Duplex: '0802' };

/** PropertySearchItem (core/models/api.ts). Facts listed in a property's gaps stay null. */
function searchItem(p) {
  return {
    id: p.id,
    folio: p.folio,
    countyId: COUNTY.countyId,
    countyName: COUNTY.countyName,
    stateCode: COUNTY.stateCode,
    stateName: STATE_NAME,
    address: p.address,
    city: p.city,
    zip: p.zip,
    dorCode: DOR[p.use] ?? null,
    propertyType: p.use,
    bedrooms: lacks(p, 'beds') ? null : p.beds,
    bathrooms: lacks(p, 'baths') ? null : p.baths,
    livingAreaSqft: lacks(p, 'sqft') ? null : p.sqft,
    lotSize: lacks(p, 'lotSqft') ? null : p.lotSqft,
    yearBuilt: lacks(p, 'yearBuilt') ? null : p.yearBuilt,
    neighborhood: NEIGHBORHOOD[p.id]?.[0] ?? null,
    neighborhoodDescription: NEIGHBORHOOD[p.id]?.[1] ?? null,
  };
}

const RANGES = [
  ['minBedrooms', 'bedrooms', 1],
  ['maxBedrooms', 'bedrooms', -1],
  ['minBathrooms', 'bathrooms', 1],
  ['maxBathrooms', 'bathrooms', -1],
  ['minLivingAreaSqft', 'livingAreaSqft', 1],
  ['maxLivingAreaSqft', 'livingAreaSqft', -1],
  ['minYearBuilt', 'yearBuilt', 1],
  ['maxYearBuilt', 'yearBuilt', -1],
  ['minLotSize', 'lotSize', 1],
  ['maxLotSize', 'lotSize', -1],
];
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
/** A saved search replayed on the records. A null fact never satisfies a range (SQL semantics). */
function matchesFilters(p, f) {
  const item = searchItem(p);
  if (f.countyId != null && item.countyId !== Number(f.countyId)) return false;
  if (f.state && !same(item.stateCode, f.state) && !same(item.stateName, f.state)) return false;
  for (const key of ['city', 'zip', 'propertyType', 'dorCode', 'neighborhood'])
    if (f[key] && (item[key] === null || !same(item[key], f[key]))) return false;
  if (f.address && !item.address.toLowerCase().includes(String(f.address).toLowerCase())) return false;
  for (const [key, field, dir] of RANGES) {
    if (f[key] == null) continue;
    const value = item[field] === null ? null : Number(item[field]);
    if (value === null || (dir > 0 ? value < Number(f[key]) : value > Number(f[key]))) return false;
  }
  if (f.minLat != null && p.lat < f.minLat) return false;
  if (f.maxLat != null && p.lat > f.maxLat) return false;
  if (f.minLon != null && p.lng < f.minLon) return false;
  if (f.maxLon != null && p.lng > f.maxLon) return false;
  return true;
}

// ---- opportunity scores (opportunity-v1, mirrors OpportunityScoringServiceImpl) -------------
const OPP_VERSION = 'opportunity-v1';
const OPP_NOTES = [
  `Version ${OPP_VERSION} scores the stored ZentraValue valuation and market forecasts; rent, financing and listing-price evidence is not stored yet, so those factors are unavailable.`,
  'Unavailable factors add no points and are never treated as zero costs: missing data cannot raise a score. coveragePercent is the highest score the available evidence allows.',
  'Forecasts are model trend scenarios, not guarantees, and no listing price is known: the score ranks evidence for research and is not a recommendation to buy.',
];
/**
 * Stored ZentraValue evidence. Values equal investor.cjs ESTIMATES. 46 and 49 have no usable
 * valuation (gaps), so they are never scored.
 */
const VALUATION = {
  42: { value: 985000, g1: 4.2, g3: 11.8, outlook: 3.1, confidence: 78, label: 'medium' },
  43: { value: 942000, g1: 3.9, g3: 10.6, outlook: 3.1, confidence: 74, label: 'medium' },
  44: { value: 1655000, g1: 2.6, g3: 8.9, outlook: 3.1, confidence: 58, label: 'low' },
  45: { value: 268000, g1: -1.4, g3: 2.2, outlook: -0.8, confidence: 66, label: 'medium' },
  47: { value: 1118000, g1: 5.8, g3: 16.4, outlook: 4.4, confidence: null, label: null },
  48: { value: 587000, g1: 3.1, g3: null, outlook: 2.7, confidence: 71, label: 'medium' },
};
const signed = (n) => (n > 0 ? '+' : '') + String(r2(n));
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
const subscore = (signal, low, high) => r2(Math.min(100, Math.max(0, ((signal - low) * 100) / (high - low))));
function available(code, label, category, weight, signal, unit, sub, explanation) {
  return { code, label, category, weight, status: 'AVAILABLE', signal: r2(signal), signalUnit: unit, subscore: sub, points: r2((sub * weight) / 100), explanation };
}
function unavailable(code, label, category, weight, reason) {
  return { code, label, category, weight, status: 'UNAVAILABLE', signal: null, signalUnit: null, subscore: null, points: null, explanation: `Unavailable: ${reason} It adds no points.` };
}
function growth(code, label, weight, horizon, pct, value, low, high) {
  const forecast = value * (1 + pct / 100);
  return available(code, label, 'MARKET', weight, pct, 'PERCENT', subscore(pct, low, high),
    `${horizon} forecast ${signed(pct)}% against the current estimate (${usd(value)} to ${usd(forecast)}). Scale: ${signed(low)}% scores 0, ${signed(high)}% scores 100.`);
}
function factorsFor(v) {
  return [
    growth('FORECAST_GROWTH_1Y', 'One-year forecast growth', 20, 'One-year', v.g1, v.value, -10, 10),
    v.g3 === null
      ? unavailable('FORECAST_GROWTH_3Y', 'Three-year forecast growth', 'MARKET', 15, 'No three-year forecast is stored.')
      : growth('FORECAST_GROWTH_3Y', 'Three-year forecast growth', 15, 'Three-year', v.g3, v.value, -25, 25),
    v.outlook === null
      ? unavailable('MARKET_OUTLOOK', 'Area market outlook', 'MARKET', 5, "No market outlook is stored for the property's area.")
      : available('MARKET_OUTLOOK', 'Area market outlook', 'MARKET', 5, v.outlook, 'PERCENT', subscore(v.outlook, -10, 10),
          `The area's one-year market outlook is ${signed(v.outlook)}%. Scale: -10% scores 0, +10% scores 100.`),
    v.confidence === null
      ? unavailable('VALUATION_CONFIDENCE', 'Valuation confidence', 'VALUATION', 10, 'No valuation confidence score is stored.')
      : available('VALUATION_CONFIDENCE', 'Valuation confidence', 'VALUATION', 10, v.confidence, 'SCORE', subscore(v.confidence, 0, 100),
          `The valuation's confidence score is ${v.confidence} of 100${v.label ? ` (${v.label} confidence)` : ''}; it is used as the subscore.`),
    unavailable('RENTAL_YIELD', 'Rental yield', 'RENT', 20, 'No rent estimate is stored for this property, so rental yield cannot be measured.'),
    unavailable('FINANCED_CASH_FLOW', 'Cash flow after financing', 'FINANCING', 10, 'Needs a rent estimate and financing terms; neither is stored for this property.'),
    unavailable('ASKING_PRICE_DISCOUNT', 'Discount of the asking price to the estimate', 'PRICE', 20, 'No listing price is known, so a discount to the estimated value cannot be measured.'),
  ];
}
const OPPORTUNITIES = Object.entries(VALUATION).map(([id, v]) => {
  const p = byId.get(Number(id));
  const factors = factorsFor(v);
  const used = factors.filter((f) => f.status === 'AVAILABLE');
  return {
    propertyId: p.id,
    folio: p.folio,
    address: p.address,
    city: p.city,
    zip: p.zip,
    countyName: COUNTY.countyName,
    stateCode: COUNTY.stateCode,
    score: r2(used.reduce((s, f) => s + f.points, 0)),
    maxScore: 100,
    coveragePercent: used.reduce((s, f) => s + f.weight, 0),
    estimatedValue: v.value,
    forecastGrowth1yPct: v.g1,
    factors,
    valuationRunId: 'zv-run-2026-11-02',
    valuationDataThrough: '2026-10-31',
    scoredAt: daysAgo(3),
  };
});
const OPP_SORTS = {
  SCORE_DESC: (a, b) => b.score - a.score || a.propertyId - b.propertyId,
  FORECAST_GROWTH_1Y_DESC: (a, b) => b.forecastGrowth1yPct - a.forecastGrowth1yPct || b.score - a.score || a.propertyId - b.propertyId,
  VALUE_ASC: (a, b) => a.estimatedValue - b.estimatedValue || b.score - a.score || a.propertyId - b.propertyId,
  VALUE_DESC: (a, b) => b.estimatedValue - a.estimatedValue || b.score - a.score || a.propertyId - b.propertyId,
};

// ---- seeds ---------------------------------------------------------------------------------
const MIAMI_DADE = { countyId: COUNTY.countyId, countyName: COUNTY.countyName, stateCode: COUNTY.stateCode, stateName: STATE_NAME };
const KNOWN_COUNTIES = new Map([[COUNTY.countyId, MIAMI_DADE]]);

function monitoringState(o) {
  return { status: 'READY', baseline: false, generation: 0, scanned: 0, last: null, next: null, error: null, pending: 0, sent: 0, failed: 0, evaluating: false, ...o };
}

function seedFull() {
  return {
    tick: 0,
    seq: 600,
    profile: { firstName: 'Dana', lastName: 'Okafor' },
    preferencesSaved: true,
    preferences: {
      minBudget: 450000,
      maxBudget: 1100000,
      targetLocations: [MIAMI_DADE],
      investmentGoals: ['Long-term rental income', 'Walkable to Metrorail'],
    },
    favorites: [
      { id: 506, propertyId: 42, createdAt: daysAgo(0.2) },
      { id: 505, propertyId: 47, createdAt: daysAgo(1.5) },
      { id: 504, propertyId: 49, createdAt: daysAgo(4) },
      { id: 503, propertyId: 44, createdAt: daysAgo(9) },
      { id: 502, propertyId: 45, createdAt: daysAgo(15) },
      { id: 501, propertyId: 46, createdAt: daysAgo(23) },
    ],
    savedSearches: [
      { id: 11, name: '33133 houses, 3+ beds', filters: { countyId: 17, zip: '33133', propertyType: 'Single family', minBedrooms: 3 }, filtersVersion: 2, cadence: 'DAILY', paused: false, createdAt: daysAgo(40), updatedAt: daysAgo(0.6) },
      { id: 12, name: 'Miami Beach condos under 1,000 sq ft', filters: { countyId: 17, city: 'Miami Beach', propertyType: 'Condominium', maxLivingAreaSqft: 1000 }, filtersVersion: 1, cadence: 'WEEKLY', paused: false, createdAt: daysAgo(21), updatedAt: daysAgo(21) },
      { id: 13, name: 'Upper East Side duplexes', filters: { countyId: 17, zip: '33138', propertyType: 'Duplex' }, filtersVersion: 1, cadence: 'DAILY', paused: true, createdAt: daysAgo(33), updatedAt: daysAgo(2.2) },
      // 48 is the only 33177 record and its bedrooms and year built are unknown: no match.
      { id: 14, name: 'South Dade 4 beds, built 1990 or later', filters: { countyId: 17, zip: '33177', minBedrooms: 4, minYearBuilt: 1990 }, filtersVersion: 1, cadence: 'WEEKLY', paused: false, createdAt: daysAgo(12), updatedAt: daysAgo(12) },
      { id: 15, name: 'Hialeah 2-bed condos', filters: { countyId: 17, city: 'Hialeah', propertyType: 'Condominium', minBedrooms: 2, maxBedrooms: 2 }, filtersVersion: 1, cadence: 'DAILY', paused: false, createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    ],
    alerts: [
      { id: 21, name: 'New 33133 house matches', eventType: 'NEW_MATCH', propertyId: null, savedSearchId: 11, cadence: 'DAILY', paused: false, createdAt: daysAgo(39), updatedAt: daysAgo(39), minimumChangePercent: null, changeDirection: null },
      { id: 22, name: 'Miami Beach condo matches', eventType: 'NEW_MATCH', propertyId: null, savedSearchId: 12, cadence: 'WEEKLY', paused: false, createdAt: daysAgo(20), updatedAt: daysAgo(20), minimumChangePercent: null, changeDirection: null },
      // Not paused itself; its saved search is, so it is effectively paused.
      { id: 23, name: 'Upper East Side duplex matches', eventType: 'NEW_MATCH', propertyId: null, savedSearchId: 13, cadence: 'DAILY', paused: false, createdAt: daysAgo(32), updatedAt: daysAgo(32), minimumChangePercent: null, changeDirection: null },
      { id: 24, name: '2847 SW 27th Ter: value moves 3% or more', eventType: 'VALUATION_CHANGED', propertyId: 42, savedSearchId: null, cadence: 'WEEKLY', paused: false, createdAt: daysAgo(18), updatedAt: daysAgo(3.1), minimumChangePercent: 3, changeDirection: 'ANY' },
      { id: 25, name: '3120 Day Ave: any value drop', eventType: 'VALUATION_CHANGED', propertyId: 44, savedSearchId: null, cadence: 'DAILY', paused: false, createdAt: daysAgo(0.9), updatedAt: daysAgo(0.9), minimumChangePercent: 0, changeDirection: 'DECREASE' },
      { id: 26, name: '640 NE 74th St listing price', eventType: 'LISTING_PRICE_CHANGED', propertyId: 47, savedSearchId: null, cadence: 'DAILY', paused: false, createdAt: daysAgo(7), updatedAt: daysAgo(7), minimumChangePercent: null, changeDirection: null },
      { id: 27, name: '18402 NW 7th Ave: value up 5%', eventType: 'VALUATION_CHANGED', propertyId: 46, savedSearchId: null, cadence: 'WEEKLY', paused: true, createdAt: daysAgo(26), updatedAt: daysAgo(10), minimumChangePercent: 5, changeDirection: 'INCREASE' },
    ],
    monitoring: {
      21: monitoringState({ status: 'COMPLETED', baseline: true, generation: 38, scanned: 3, last: daysAgo(0.13), next: inDays(0.87), sent: 4 }),
      22: monitoringState({ status: 'COMPLETED', baseline: true, generation: 3, scanned: 1, last: daysAgo(5.1), next: inDays(1.9), sent: 1 }),
      23: monitoringState({ status: 'BASELINED', baseline: true, generation: 1, scanned: 1, last: daysAgo(31.9) }),
      24: monitoringState({ status: 'COMPLETED', baseline: true, generation: 2, scanned: 1, last: daysAgo(0.45), next: inDays(6.55), sent: 2, failed: 1 }),
      25: monitoringState({ next: inDays(0.1) }),
      // Listing-price monitoring stays BLOCKED until listing data exists (AlertMonitoringController).
      26: monitoringState({ status: 'BLOCKED', error: 'UNSUPPORTED_SOURCE', next: inDays(0.01) }),
      // 46 has no stored valuation: the baseline holds nothing to compare yet.
      27: monitoringState({ status: 'BASELINED', baseline: true, generation: 1, scanned: 0, last: daysAgo(25.9) }),
    },
    notifications: [
      note(310, 'NEW_MATCH', 0.13, { alertRuleId: 21, savedSearchId: 11, propertyId: 43, count: 1 }),
      note(309, 'VALUATION_CHANGED', 0.45, { alertRuleId: 24, propertyId: 42, from: 955000, to: 985000, pct: 3.14 }),
      note(308, 'CONTACT_REQUEST', 0.8, { propertyId: 47, audience: PROFESSIONALS }),
      note(307, 'NEW_MATCH', 1.3, { alertRuleId: 21, savedSearchId: 11, propertyId: null, count: 3 }),
      note(306, 'NEW_MATCH', 3.6, { alertRuleId: 21, savedSearchId: 11, propertyId: 44, count: 1, readAfter: 0.4 }),
      note(305, 'NEW_MATCH', 5.1, { alertRuleId: 22, savedSearchId: 12, propertyId: 49, count: 1, readAfter: 1.2 }),
      note(304, 'CONTACT_REQUEST', 6.4, { propertyId: 44, audience: PROFESSIONALS, readAfter: 0.1 }),
      note(303, 'VALUATION_CHANGED', 9.5, { alertRuleId: 24, propertyId: 42, from: 988000, to: 955000, pct: 3.34, limited: true, readAfter: 0.6 }),
      note(302, 'NEW_MATCH', 13, { alertRuleId: 21, savedSearchId: 11, propertyId: null, count: 2, readAfter: 2 }),
      // Its rule and saved search were deleted later; the link falls back to /alerts.
      note(301, 'NEW_MATCH', 27, { alertRuleId: 19, savedSearchId: 9, propertyId: null, count: 4, readAfter: 0.3 }),
    ],
    notificationPrefs: {
      inAppEnabled: true,
      emailEnabled: true,
      enabledEventTypes: ['NEW_MATCH', 'CONTACT_REQUEST', 'VALUATION_CHANGED'],
      emailCadence: 'DAILY',
      emailAddress: EMAIL,
      nextEmailAt: nextDigest('DAILY'),
      updatedAt: daysAgo(20),
      emailDeliveryEnabled: true,
    },
    // Seeded submissions belong to the realtor persona; later POSTs are kept for every persona.
    licenses: [
      { id: 7, licenseHolderName: 'Dana M. Okafor', licensingState: 'FL', licenseNumber: 'SL3487215', licenseExpirationDate: '2027-09-30', brokerageName: 'Bayline Realty Group', workEmail: 'dana.okafor@bayline.example', status: 'VERIFIED', rejectionReason: null, submittedAt: daysAgo(44), decidedAt: daysAgo(42), seed: 'REALTOR' },
      { id: 5, licenseHolderName: 'Dana M. Okafor', licensingState: 'FL', licenseNumber: 'SL348721', licenseExpirationDate: '2027-09-30', brokerageName: 'Bayline Realty Group', workEmail: null, status: 'REJECTED', rejectionReason: 'The license number does not match the DBPR record for this name', submittedAt: daysAgo(47), decidedAt: daysAgo(45), seed: 'REALTOR' },
    ],
    // Investor persona only. Ids, names and timestamps copy investor.cjs seedFull(), which owns
    // the portfolios; writes made there later do not show up here.
    portfolioActivity: portfolioActivity(),
    opportunitiesScored: true,
  };
}

function seedEmpty() {
  return {
    tick: 0,
    seq: 600,
    profile: { firstName: null, lastName: null },
    preferencesSaved: false,
    preferences: { minBudget: null, maxBudget: null, targetLocations: [], investmentGoals: [] },
    favorites: [],
    savedSearches: [],
    alerts: [],
    monitoring: {},
    notifications: [],
    notificationPrefs: {
      inAppEnabled: true,
      emailEnabled: false,
      enabledEventTypes: ['NEW_MATCH', 'CONTACT_REQUEST', 'VALUATION_CHANGED'],
      emailCadence: 'DAILY',
      emailAddress: null,
      nextEmailAt: null,
      updatedAt: null,
      emailDeliveryEnabled: false,
    },
    licenses: [],
    portfolioActivity: [],
    // A fresh environment where no rescoring run has happened yet (status NOT_SCORED).
    opportunitiesScored: false,
  };
}

function portfolioActivity() {
  const portfolios = [
    { id: 1, name: 'Miami-Dade rentals', created: 610, updated: 212 },
    { id: 2, name: 'Family homes', created: 95, updated: 95 },
  ];
  const holdings = [
    [101, 1, 42, 608, 18], [102, 1, 44, 608, 301], [103, 1, 46, 560, 77], [104, 1, 47, 605, 49],
    [105, 1, 49, 12, 12], [201, 2, 43, 95, 40], [202, 2, 45, 95, 95],
  ];
  const items = [];
  for (const p of portfolios) {
    items.push({ type: 'PORTFOLIO_CREATED', occurredAt: daysAgo(p.created), entityId: p.id, label: p.name, propertyId: null, portfolioId: null });
    if (p.updated !== p.created)
      items.push({ type: 'PORTFOLIO_UPDATED', occurredAt: daysAgo(p.updated), entityId: p.id, label: p.name, propertyId: null, portfolioId: null });
  }
  for (const [id, portfolioId, propertyId, created, updated] of holdings) {
    const label = `property ${propertyId} in ${portfolios.find((p) => p.id === portfolioId).name}`;
    items.push({ type: 'HOLDING_ADDED', occurredAt: daysAgo(created), entityId: id, label, propertyId, portfolioId });
    if (updated !== created)
      items.push({ type: 'HOLDING_UPDATED', occurredAt: daysAgo(updated), entityId: id, label, propertyId, portfolioId });
  }
  return items;
}

/** Notification text as AlertEventConsumptionServiceImpl builds it. */
function note(id, eventType, ago, o) {
  const occurredAt = daysAgo(ago);
  const createdAt = new Date(Date.parse(occurredAt) + 40000).toISOString();
  let title, message, payload;
  if (eventType === 'CONTACT_REQUEST') {
    title = 'New property contact request';
    message = `A user requested contact about property ${o.propertyId}. Open GeoZentra to view the request and contact details.`;
    payload = { propertyId: o.propertyId };
  } else if (eventType === 'VALUATION_CHANGED') {
    const up = o.to > o.from;
    title = 'Property valuation changed';
    message = `The estimated value of property ${o.propertyId} ${up ? 'increased' : 'decreased'} from USD ${o.from} to USD ${o.to} (${o.pct}%). This is a model estimate, not a sale price.${o.limited ? ' The new estimate has limited support.' : ''}`;
    payload = {
      direction: up ? 'INCREASE' : 'DECREASE',
      changePercent: up ? o.pct : -o.pct,
      oldValuation: { value: o.from, status: 'supported' },
      newValuation: { value: o.to, status: o.limited ? 'limited' : 'supported' },
    };
  } else {
    title = 'New matching properties';
    message = o.count === 1 ? '1 property now matches your saved search.' : `${o.count} properties now match your saved search.`;
    payload = { newMatchCount: o.count };
  }
  const read = o.readAfter !== undefined;
  return {
    id,
    eventType,
    title,
    message,
    alertRuleId: o.alertRuleId ?? null,
    savedSearchId: o.savedSearchId ?? null,
    propertyId: o.propertyId ?? null,
    payload,
    occurredAt,
    createdAt,
    readAt: read ? daysAgo(ago - o.readAfter) : null,
    read,
    audience: o.audience ?? null,
  };
}

function nextDigest(cadence) {
  if (cadence === 'IMMEDIATE') return null;
  const d = new Date(TODAY);
  d.setUTCHours(13, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  if (cadence === 'WEEKLY') while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

let db;
function reset() {
  db = { full: seedFull(), empty: seedEmpty() };
}
reset();

// ---- accessors -----------------------------------------------------------------------------
const S = (ctx) => (ctx.flags.empty ? db.empty : db.full);
const persona = (ctx) => (PERSONAS.includes(ctx.state.persona) ? ctx.state.persona : 'USER');
/** A write's timestamp: "now", one second further on per write so ordering stays stable. */
const stamp = (s) => new Date(TODAY.getTime() + ++s.tick * 1000).toISOString();
const nextId = (s) => ++s.seq;

function licenses(s, ctx) {
  return s.licenses
    .filter((l) => !l.seed || l.seed === persona(ctx))
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
    .map(({ seed, ...l }) => l);
}
function userDTO(s, ctx) {
  return {
    id: USER_ID,
    keycloakUserId: 'audit-user',
    username: 'audit.user',
    email: EMAIL,
    firstName: s.profile.firstName,
    lastName: s.profile.lastName,
    persona: persona(ctx),
    realtorLicenseStatus: licenses(s, ctx)[0]?.status ?? null,
  };
}

const searchById = (s, id) => s.savedSearches.find((x) => x.id === id);
const byNewestId = (a, b) => b.id - a.id;
function alertDTO(s, a) {
  const search = a.savedSearchId === null ? null : searchById(s, a.savedSearchId);
  return { ...a, effectivePaused: a.paused || !!search?.paused };
}
function monitoringDTO(s, a) {
  const m = s.monitoring[a.id] ?? (s.monitoring[a.id] = monitoringState({ next: inDays(0.01) }));
  const dto = alertDTO(s, a);
  // An evaluation scheduled with POST /evaluate shows as SCANNING once, then as finished.
  if (m.evaluating === 'shown') finishEvaluation(s, a, m);
  else if (m.evaluating) m.evaluating = 'shown';
  return {
    alertRuleId: a.id,
    monitoringEnabled: true,
    publisherEnabled: true,
    effectivePaused: dto.effectivePaused,
    status: m.status,
    baselineEstablished: m.baseline,
    generation: m.generation,
    scannedMatches: m.scanned,
    lastEvaluatedAt: m.last,
    nextEvaluationAt: dto.effectivePaused ? null : m.next,
    lastErrorCode: m.error,
    pendingEvents: m.pending,
    sentEvents: m.sent,
    failedEvents: m.failed,
  };
}
function finishEvaluation(s, a, m) {
  const scanned =
    a.eventType === 'NEW_MATCH'
      ? PROPERTIES.filter((p) => matchesFilters(p, searchById(s, a.savedSearchId)?.filters ?? {})).length
      : a.propertyId !== null && VALUATION[a.propertyId]
        ? 1
        : a.savedSearchId !== null
          ? PROPERTIES.filter((p) => VALUATION[p.id] && matchesFilters(p, searchById(s, a.savedSearchId)?.filters ?? {})).length
          : 0;
  const now = stamp(s);
  Object.assign(m, {
    status: m.baseline ? 'COMPLETED' : 'BASELINED',
    baseline: true,
    generation: m.generation + 1,
    scanned,
    last: now,
    next: new Date(Date.parse(now) + (a.cadence === 'DAILY' ? 1 : 7) * 86400000).toISOString(),
    error: null,
    evaluating: false,
  });
}
function ruleOr404(s, id) {
  const a = s.alerts.find((x) => x.id === id);
  if (!a) throw missing('Alert rule not found: ' + id);
  return a;
}
function searchOr404(s, id) {
  const x = searchById(s, id);
  if (!x) throw missing('Saved search not found: ' + id);
  return x;
}

// ---- validation helpers --------------------------------------------------------------------
const CADENCES = ['DAILY', 'WEEKLY'];
const DIRECTIONS = ['ANY', 'INCREASE', 'DECREASE'];
const EVENTS = ['NEW_MATCH', 'LISTING_PRICE_CHANGED', 'VALUATION_CHANGED'];
function text(value, field, max, required) {
  if (value === undefined || value === null) {
    if (required) throw bad(`${field}: must not be blank`);
    return undefined;
  }
  if (typeof value !== 'string' || (required && !value.trim())) throw bad(`${field}: must not be blank`);
  if (value.trim().length > max) throw bad(`${field}: size must be between 1 and ${max}`);
  return value.trim();
}
function oneOf(value, field, allowed) {
  if (value === undefined || value === null) return undefined;
  if (!allowed.includes(value)) throw bad(`${field} must be one of ${allowed.join(', ')}`);
  return value;
}
function threshold(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000)
    throw bad('minimumChangePercent must be between 0 and 100000');
  return value;
}
function filtersOf(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw bad('filters must be an object');
  const { page: _p, size: _s, sortBy: _b, direction: _d, ...rest } = value;
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

// ---- calculators (dashboard cards) ---------------------------------------------------------
const AFF_REQUIRED = ['annualGrossIncome', 'monthlyDebtPayments', 'downPayment', 'annualInterestRate', 'loanTermYears'];
const AFF_OPTIONAL = ['annualPropertyTax', 'annualHomeInsurance', 'monthlyHoaFees'];
function money(v) {
  return Math.round(v * 100) / 100;
}
function readInputs(query, keys) {
  const v = {};
  for (const k of keys) v[k] = numParam(query, k);
  for (const k of keys) {
    if (v[k] === null) continue;
    if (k === 'loanTermYears' && (!Number.isInteger(v[k]) || v[k] < 1 || v[k] > 50))
      throw bad('loanTermYears: must be between 1 and 50');
    if ((k === 'annualGrossIncome' || k === 'price') && v[k] <= 0) throw bad(`${k}: must be greater than 0`);
    if (k === 'annualInterestRate' && v[k] > 30) throw bad('annualInterestRate: must be less than or equal to 30');
    if (v[k] < 0) throw bad(`${k}: must be greater than or equal to 0`);
  }
  return v;
}
function maxLoan(monthlyPI, ratePct, years) {
  const n = years * 12;
  const r = ratePct / 100 / 12;
  return r === 0 ? monthlyPI * n : (monthlyPI * (1 - Math.pow(1 + r, -n))) / r;
}
function payment(loan, ratePct, years) {
  const n = years * 12;
  const r = ratePct / 100 / 12;
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}
function affordabilityCard(query) {
  const v = readInputs(query, [...AFF_REQUIRED, ...AFF_OPTIONAL]);
  const base = { scope: 'CURRENT_USER', generatedAt: TODAY.toISOString() };
  const missingInputs = AFF_REQUIRED.filter((k) => v[k] === null);
  if (missingInputs.length)
    return { ...base, status: 'INCOMPLETE', error: 'Required financial inputs not supplied', missingInputs, affordability: null };
  const notes = [];
  const monthly = v.annualGrossIncome / 12;
  let housing = Math.min(monthly * 0.28, monthly * 0.36 - v.monthlyDebtPayments);
  if (housing <= 0) {
    notes.push('Existing debts reach or exceed the 36% back-end limit: no additional housing payment is affordable.');
    housing = 0;
  }
  let known = 0;
  const optional = [
    ['annualPropertyTax', 'Property tax', 12],
    ['annualHomeInsurance', 'Home insurance', 12],
    ['monthlyHoaFees', 'HOA fees', 1],
  ];
  for (const [k, label, per] of optional) {
    if (v[k] === null) notes.push(`${label} not provided: not deducted from the budget, the estimate may be too high.`);
    else known += v[k] / per;
  }
  let pi = housing - known;
  if (pi < 0) {
    notes.push('Property tax, insurance and HOA fees exceed the housing budget: no loan is affordable.');
    pi = 0;
  }
  const loan = maxLoan(pi, v.annualInterestRate, v.loanTermYears);
  return {
    ...base,
    status: 'OK',
    error: null,
    missingInputs: [],
    affordability: {
      monthlyGrossIncome: money(monthly),
      maxMonthlyHousingPayment: money(housing),
      maxMonthlyPrincipalAndInterest: money(pi),
      maxLoanAmount: money(loan),
      maxHomePrice: money(loan + v.downPayment),
      assumptions: {
        frontEndRatioPercent: 28,
        backEndRatioPercent: 36,
        annualInterestRate: v.annualInterestRate,
        loanTermYears: v.loanTermYears,
        rateSource: 'Supplied by user, not a market rate',
      },
      notes,
      disclaimer: 'This is an affordability estimate, not a loan approval.',
    },
  };
}
const MORTGAGE_REQUIRED = ['price', 'downPayment', 'annualInterestRate', 'loanTermYears'];
function mortgageContextCard(query) {
  const v = readInputs(query, [...MORTGAGE_REQUIRED, ...AFF_OPTIONAL]);
  const base = { scope: 'SUPPLIED_INPUTS', generatedAt: TODAY.toISOString() };
  if (Object.values(v).every((x) => x === null))
    return { ...base, status: 'UNAVAILABLE', error: 'No mortgage inputs supplied', assumptions: null, mortgage: null };
  const absent = MORTGAGE_REQUIRED.filter((k) => v[k] === null);
  if (absent.length) throw bad(absent.map((k) => `${k}: must not be null`).join(', '));
  if (v.downPayment > v.price) throw bad('downPayment must not exceed price');
  const loanAmount = money(v.price - v.downPayment);
  const pi = money(payment(loanAmount, v.annualInterestRate, v.loanTermYears));
  const tax = v.annualPropertyTax === null ? null : money(v.annualPropertyTax / 12);
  const ins = v.annualHomeInsurance === null ? null : money(v.annualHomeInsurance / 12);
  const hoa = v.monthlyHoaFees === null ? null : money(v.monthlyHoaFees);
  return {
    ...base,
    status: 'OK',
    error: null,
    assumptions: { annualInterestRate: v.annualInterestRate, loanTermYears: v.loanTermYears, rateSource: 'Supplied by the caller, not a live market rate' },
    mortgage: {
      loanAmount,
      monthlyPrincipalAndInterest: pi,
      monthlyPropertyTax: tax,
      monthlyInsurance: ins,
      monthlyHoaFees: hoa,
      totalMonthlyKnownCosts: money(pi + (tax ?? 0) + (ins ?? 0) + (hoa ?? 0)),
    },
  };
}

/** Optional audit switch: POST /__mock/state {"cardErrors":["activity"]} answers that card ERROR. */
function cardError(ctx, name) {
  return Array.isArray(ctx.state.cardErrors) && ctx.state.cardErrors.includes(name);
}
const CARD_ERROR = 'This card could not be built right now.';

// ---- activity (UserDashboardActivityServiceImpl) -------------------------------------------
function activity(s, ctx, limit) {
  const items = [];
  const createdAndUpdated = (record, created, updated, label, propertyId) => {
    items.push({ type: created, occurredAt: record.createdAt, entityId: record.id, label, propertyId, portfolioId: null });
    if (Date.parse(record.updatedAt) - Date.parse(record.createdAt) > 1000)
      items.push({ type: updated, occurredAt: record.updatedAt, entityId: record.id, label, propertyId, portfolioId: null });
  };
  for (const f of s.favorites)
    items.push({ type: 'FAVORITE_ADDED', occurredAt: f.createdAt, entityId: f.id, label: 'property ' + f.propertyId, propertyId: f.propertyId, portfolioId: null });
  for (const x of s.savedSearches) createdAndUpdated(x, 'SAVED_SEARCH_CREATED', 'SAVED_SEARCH_UPDATED', x.name, null);
  for (const a of s.alerts) createdAndUpdated(a, 'ALERT_RULE_CREATED', 'ALERT_RULE_UPDATED', a.name, a.propertyId);
  if (persona(ctx) === 'RESIDENTIAL_INVESTOR') items.push(...s.portfolioActivity);
  return items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, limit);
}

// ---- recommendations (RecommendationServiceImpl) -------------------------------------------
function recommendations(s, limit) {
  const limitations = [
    'Property records are research suggestions, not confirmed active listings. Listing availability and prices are unavailable.',
    "Source freshness is unavailable; generatedAt is the response time, not the property data's observation time.",
  ];
  const prefs = s.preferencesSaved ? s.preferences : null;
  const respond = (status, counties, content) => ({
    status,
    generatedAt: TODAY.toISOString(),
    source: 'PROPERTY_RECORDS',
    sourceAsOf: null,
    rankingMethod: 'COUNTY_MATCH_THEN_PROPERTY_ID_ASC',
    limit,
    appliedCountyIds: counties,
    minBudget: prefs ? prefs.minBudget : null,
    maxBudget: prefs ? prefs.maxBudget : null,
    investmentGoals: prefs ? [...prefs.investmentGoals] : [],
    limitations,
    content,
  });
  if (!prefs) {
    limitations.push('Save target locations in your user preferences to receive recommendations.');
    return respond('NO_PREFERENCES', [], []);
  }
  const counties = [...new Set(prefs.targetLocations.map((c) => c.countyId))];
  const hasBudget = prefs.minBudget !== null || prefs.maxBudget !== null;
  const hasGoals = prefs.investmentGoals.length > 0;
  if (hasBudget)
    limitations.push('Budget was not applied: current listing prices are unavailable. Returned properties are not verified to fit your budget; amounts are not inferred from assessments or past sales.');
  if (hasGoals)
    limitations.push('Investment goals were not scored: structured goal criteria and opportunity scores are unavailable.');
  if (!counties.length) {
    limitations.push('Choose at least one target county; no nationwide fallback is used.');
    return respond('LOCATION_REQUIRED', counties, []);
  }
  const content = PROPERTIES.filter((p) => counties.includes(COUNTY.countyId))
    .sort((a, b) => a.id - b.id)
    .slice(0, limit)
    .map((p, i) => ({
      rank: i + 1,
      property: searchItem(p),
      reasons: [`Matches your saved target county: ${COUNTY.countyName}, ${COUNTY.stateCode}`],
      budgetMatch: hasBudget ? 'UNKNOWN' : 'NOT_REQUESTED',
      goalMatch: hasGoals ? 'UNKNOWN' : 'NOT_REQUESTED',
      listingStatus: 'UNKNOWN',
    }));
  const status = !content.length ? 'NO_MATCHES' : hasBudget || hasGoals ? 'PARTIAL' : 'READY';
  return respond(status, counties, content);
}

// ---- routes --------------------------------------------------------------------------------
const routes = [
  // Profile and persona. The top-bar persona switcher PATCHes persona; it lives in server state.
  ['GET', '/api/users/me', h((req, ctx) => ({ body: userDTO(S(ctx), ctx) }))],
  ['PATCH', '/api/users/me', h((req, ctx) => {
    const s = S(ctx);
    const b = req.body ?? {};
    const firstName = text(b.firstName, 'firstName', 100, false);
    const lastName = text(b.lastName, 'lastName', 100, false);
    const next = oneOf(b.persona, 'persona', PERSONAS);
    if (firstName !== undefined) s.profile.firstName = firstName;
    if (lastName !== undefined) s.profile.lastName = lastName;
    if (next) ctx.state.persona = next;
    return { body: userDTO(s, ctx) };
  })],
  ['GET', '/api/users/me/preferences', h((req, ctx) => ({ body: structuredClone(S(ctx).preferences) }))],
  ['PUT', '/api/users/me/preferences', h((req, ctx) => {
    const s = S(ctx);
    const b = req.body ?? {};
    const budget = (v, field) => {
      if (v === null || v === undefined) return null;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw bad(`${field}: must be greater than or equal to 0`);
      return v;
    };
    const minBudget = budget(b.minBudget, 'minBudget');
    const maxBudget = budget(b.maxBudget, 'maxBudget');
    if (minBudget !== null && maxBudget !== null && minBudget > maxBudget) throw bad('minBudget must not exceed maxBudget');
    const locations = Array.isArray(b.targetLocations) ? b.targetLocations : [];
    if (locations.length > 20) throw bad('targetLocations: size must be between 0 and 20');
    const goals = (Array.isArray(b.investmentGoals) ? b.investmentGoals : []).map((g) => String(g).trim()).filter(Boolean);
    if (goals.length > 20 || goals.some((g) => g.length > 200)) throw bad('investmentGoals: up to 20 goals of at most 200 characters');
    const seen = new Set();
    const targetLocations = [];
    for (const l of locations) {
      const id = Number(l?.countyId);
      if (!Number.isInteger(id) || id < 1) throw bad('Unknown countyId: ' + l?.countyId);
      if (seen.has(id)) continue;
      seen.add(id);
      // Only Miami-Dade is known to this fixture; another county keeps its ID without names.
      targetLocations.push(KNOWN_COUNTIES.get(id) ?? { countyId: id, countyName: null, stateCode: null, stateName: null });
    }
    s.preferences = { minBudget, maxBudget, targetLocations, investmentGoals: [...new Set(goals)] };
    s.preferencesSaved = true;
    return { body: structuredClone(s.preferences) };
  })],

  // Realtor license (applicant side).
  ['GET', '/api/users/me/realtor-license/history', h((req, ctx) => ({ body: licenses(S(ctx), ctx) }))],
  ['POST', '/api/users/me/realtor-license', h((req, ctx) => {
    const s = S(ctx);
    const b = req.body;
    if (!b) throw bad('Request body is required');
    const latest = licenses(s, ctx)[0];
    const licenseHolderName = text(b.licenseHolderName, 'licenseHolderName', 160, true);
    const licenseNumber = text(b.licenseNumber, 'licenseNumber', 40, true);
    const state = String(b.licensingState ?? '').trim().toUpperCase();
    if (state !== 'FL') throw bad(`licensingState ${state || '(blank)'} is not supported; supported: [FL]`);
    if (b.licenseExpirationDate !== undefined && b.licenseExpirationDate !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.licenseExpirationDate)) throw bad('licenseExpirationDate: must be yyyy-MM-dd');
      if (b.licenseExpirationDate < dateOnly(TODAY.toISOString())) throw bad('licenseExpirationDate must not be in the past');
    }
    if (latest && latest.status !== 'REJECTED')
      throw new HttpError(409, 'A license submission is already pending or verified; a new one is allowed only after a rejection');
    const row = {
      id: nextId(s),
      licenseHolderName,
      licensingState: 'FL',
      licenseNumber,
      licenseExpirationDate: b.licenseExpirationDate ?? null,
      brokerageName: text(b.brokerageName, 'brokerageName', 160, false) ?? null,
      workEmail: text(b.workEmail, 'workEmail', 254, false) ?? null,
      status: 'PENDING_REVIEW',
      rejectionReason: null,
      submittedAt: stamp(s),
      decidedAt: null,
    };
    s.licenses.push(row);
    return { status: 201, body: { ...row } };
  })],

  // Favorites.
  ['GET', '/api/properties/favorites', h((req, ctx) => ({
    body: [...S(ctx).favorites]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((f) => ({ propertyId: f.propertyId, favorite: true, createdAt: f.createdAt })),
  }))],
  ['POST', /^\/api\/properties\/(\d+)\/favorite$/, h((req, ctx) => {
    const s = S(ctx);
    const propertyId = Number(req.params[1]);
    if (!byId.has(propertyId)) throw missing('Property not found: ' + propertyId);
    let f = s.favorites.find((x) => x.propertyId === propertyId);
    if (!f) s.favorites.push((f = { id: nextId(s), propertyId, createdAt: stamp(s) }));
    return { body: { propertyId, favorite: true, createdAt: f.createdAt } };
  })],
  ['DELETE', /^\/api\/properties\/(\d+)\/favorite$/, h((req, ctx) => {
    const s = S(ctx);
    const propertyId = Number(req.params[1]);
    s.favorites = s.favorites.filter((x) => x.propertyId !== propertyId);
    return { status: 204 };
  })],

  // Saved searches.
  ['GET', '/api/saved-searches', h((req, ctx) => {
    sizeParam(req.query);
    return { body: page([...S(ctx).savedSearches].sort(byNewestId).map((x) => structuredClone(x)), req.query) };
  })],
  ['POST', '/api/saved-searches', h((req, ctx) => {
    const s = S(ctx);
    const b = req.body ?? {};
    const now = stamp(s);
    const row = {
      id: nextId(s),
      name: text(b.name, 'name', 120, true),
      filters: filtersOf(b.filters) ?? {},
      filtersVersion: 1,
      cadence: oneOf(b.cadence, 'cadence', CADENCES) ?? 'DAILY',
      paused: b.paused === true,
      createdAt: now,
      updatedAt: now,
    };
    s.savedSearches.push(row);
    return { status: 201, body: structuredClone(row) };
  })],
  ['PATCH', /^\/api\/saved-searches\/(\d+)$/, h((req, ctx) => {
    const s = S(ctx);
    const row = searchOr404(s, Number(req.params[1]));
    const b = req.body ?? {};
    const name = text(b.name, 'name', 120, false);
    const filters = filtersOf(b.filters);
    const cadence = oneOf(b.cadence, 'cadence', CADENCES);
    if (b.paused !== undefined && typeof b.paused !== 'boolean') throw bad('paused must be true or false');
    if (name !== undefined) {
      if (!name) throw bad('name: must not be blank');
      row.name = name;
    }
    if (filters !== undefined && JSON.stringify(filters) !== JSON.stringify(row.filters)) {
      row.filters = filters;
      row.filtersVersion += 1;
    }
    if (cadence) row.cadence = cadence;
    if (b.paused !== undefined) row.paused = b.paused;
    row.updatedAt = stamp(s);
    return { body: structuredClone(row) };
  })],
  ['DELETE', /^\/api\/saved-searches\/(\d+)$/, h((req, ctx) => {
    const s = S(ctx);
    const id = Number(req.params[1]);
    searchOr404(s, id);
    // Linked alert rules go with the search (the Saved page's delete dialog says so).
    for (const a of s.alerts.filter((x) => x.savedSearchId === id)) delete s.monitoring[a.id];
    s.alerts = s.alerts.filter((x) => x.savedSearchId !== id);
    s.savedSearches = s.savedSearches.filter((x) => x.id !== id);
    return { status: 204 };
  })],
  ['GET', /^\/api\/saved-searches\/(\d+)\/results$/, h((req, ctx) => {
    const row = searchOr404(S(ctx), Number(req.params[1]));
    sizeParam(req.query);
    const items = PROPERTIES.filter((p) => matchesFilters(p, row.filters)).sort((a, b) => a.id - b.id).map(searchItem);
    return { body: page(items, req.query) };
  })],

  // Alert rules and monitoring.
  ['GET', '/api/alerts', h((req, ctx) => {
    const s = S(ctx);
    sizeParam(req.query);
    return { body: page([...s.alerts].sort(byNewestId).map((a) => alertDTO(s, a)), req.query) };
  })],
  ['POST', '/api/alerts', h((req, ctx) => {
    const s = S(ctx);
    const b = req.body ?? {};
    const name = text(b.name, 'name', 120, true);
    const eventType = oneOf(b.eventType, 'eventType', EVENTS);
    if (!eventType) throw bad('eventType: must not be null');
    const propertyId = b.propertyId ?? null;
    const savedSearchId = b.savedSearchId ?? null;
    if ((propertyId === null) === (savedSearchId === null)) throw bad('Exactly one of propertyId or savedSearchId is required');
    if (eventType === 'NEW_MATCH' && savedSearchId === null) throw bad('NEW_MATCH rules must follow a saved search');
    if (savedSearchId !== null) searchOr404(s, Number(savedSearchId));
    if (propertyId !== null && !byId.has(Number(propertyId))) throw missing('Property not found: ' + propertyId);
    const valuation = eventType === 'VALUATION_CHANGED';
    if (!valuation && (b.minimumChangePercent != null || b.changeDirection != null))
      throw bad('minimumChangePercent and changeDirection apply to VALUATION_CHANGED rules only');
    const now = stamp(s);
    const row = {
      id: nextId(s),
      name,
      eventType,
      propertyId: propertyId === null ? null : Number(propertyId),
      savedSearchId: savedSearchId === null ? null : Number(savedSearchId),
      cadence: oneOf(b.cadence, 'cadence', CADENCES) ?? 'DAILY',
      paused: b.paused === true,
      createdAt: now,
      updatedAt: now,
      minimumChangePercent: valuation ? (threshold(b.minimumChangePercent) ?? 0) : null,
      changeDirection: valuation ? (oneOf(b.changeDirection, 'changeDirection', DIRECTIONS) ?? 'ANY') : null,
    };
    s.alerts.push(row);
    s.monitoring[row.id] = monitoringState({ next: new Date(Date.parse(now) + 15 * 60000).toISOString() });
    return { status: 201, body: alertDTO(s, row) };
  })],
  ['PATCH', /^\/api\/alerts\/(\d+)$/, h((req, ctx) => {
    const s = S(ctx);
    const row = ruleOr404(s, Number(req.params[1]));
    const b = req.body ?? {};
    if (b.eventType !== undefined || b.propertyId !== undefined || b.savedSearchId !== undefined)
      throw bad('The target and event type of an alert rule cannot be changed');
    const name = text(b.name, 'name', 120, false);
    const cadence = oneOf(b.cadence, 'cadence', CADENCES);
    const min = threshold(b.minimumChangePercent);
    const direction = oneOf(b.changeDirection, 'changeDirection', DIRECTIONS);
    if ((min !== undefined || direction !== undefined) && row.eventType !== 'VALUATION_CHANGED')
      throw bad('minimumChangePercent and changeDirection apply to VALUATION_CHANGED rules only');
    if (b.paused !== undefined && typeof b.paused !== 'boolean') throw bad('paused must be true or false');
    if (name !== undefined) {
      if (!name) throw bad('name: must not be blank');
      row.name = name;
    }
    if (cadence) row.cadence = cadence;
    if (b.paused !== undefined) row.paused = b.paused;
    const criteriaChanged =
      (min !== undefined && min !== row.minimumChangePercent) || (direction !== undefined && direction !== row.changeDirection);
    if (min !== undefined) row.minimumChangePercent = min;
    if (direction !== undefined) row.changeDirection = direction;
    row.updatedAt = stamp(s);
    // New valuation criteria start a new silent baseline.
    if (criteriaChanged) {
      const m = s.monitoring[row.id];
      if (m) Object.assign(m, { status: 'READY', baseline: false, scanned: 0, evaluating: false, next: inDays(0.01) });
    }
    return { body: alertDTO(s, row) };
  })],
  ['DELETE', /^\/api\/alerts\/(\d+)$/, h((req, ctx) => {
    const s = S(ctx);
    const id = Number(req.params[1]);
    ruleOr404(s, id);
    s.alerts = s.alerts.filter((x) => x.id !== id);
    delete s.monitoring[id];
    return { status: 204 };
  })],
  ['GET', /^\/api\/alerts\/(\d+)\/monitoring$/, h((req, ctx) => {
    const s = S(ctx);
    return { body: monitoringDTO(s, ruleOr404(s, Number(req.params[1]))) };
  })],
  ['POST', /^\/api\/alerts\/(\d+)\/evaluate$/, h((req, ctx) => {
    const s = S(ctx);
    const row = ruleOr404(s, Number(req.params[1]));
    if (alertDTO(s, row).effectivePaused || row.eventType === 'LISTING_PRICE_CHANGED')
      throw new HttpError(409, 'Monitoring must be enabled, unpaused and use a supported source');
    const m = s.monitoring[row.id] ?? (s.monitoring[row.id] = monitoringState({}));
    Object.assign(m, { status: 'SCANNING', error: null, evaluating: true, next: stamp(s) });
    return { status: 202 };
  })],

  // Notification inbox and delivery settings (notification-service).
  ['GET', '/notification-api/notifications', h((req, ctx) => {
    sizeParam(req.query);
    const who = persona(ctx);
    const items = S(ctx)
      .notifications.filter((n) => !n.audience || n.audience.includes(who))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(({ audience, ...n }) => ({ ...n }));
    return { body: page(items, req.query, 20) };
  })],
  ['PATCH', /^\/notification-api\/notifications\/(\d+)$/, h((req, ctx) => {
    const s = S(ctx);
    const item = s.notifications.find((n) => n.id === Number(req.params[1]));
    if (!item || (item.audience && !item.audience.includes(persona(ctx)))) throw missing('Notification not found');
    if (req.body?.read !== true) throw bad('read must be true');
    if (!item.read) Object.assign(item, { read: true, readAt: stamp(s) });
    const { audience, ...dto } = item;
    return { body: { ...dto } };
  })],
  ['GET', '/notification-api/notifications/preferences', h((req, ctx) => ({ body: structuredClone(S(ctx).notificationPrefs) }))],
  ['PUT', '/notification-api/notifications/preferences', h((req, ctx) => {
    const s = S(ctx);
    const b = req.body;
    const known = ['NEW_MATCH', 'CONTACT_REQUEST', 'VALUATION_CHANGED'];
    if (!b || typeof b.inAppEnabled !== 'boolean' || typeof b.emailEnabled !== 'boolean' || !Array.isArray(b.enabledEventTypes) || !b.emailCadence)
      throw bad('inAppEnabled, emailEnabled, enabledEventTypes and emailCadence are required');
    if (b.enabledEventTypes.some((t) => !known.includes(t))) throw bad('enabledEventTypes must contain only ' + known.join(', '));
    oneOf(b.emailCadence, 'emailCadence', ['IMMEDIATE', 'DAILY', 'WEEKLY']);
    const p = s.notificationPrefs;
    Object.assign(p, {
      inAppEnabled: b.inAppEnabled,
      emailEnabled: b.emailEnabled,
      enabledEventTypes: known.filter((t) => b.enabledEventTypes.includes(t)),
      emailCadence: b.emailCadence,
      // The recipient comes from the verified token once email is switched on.
      emailAddress: b.emailEnabled ? EMAIL : p.emailAddress,
      nextEmailAt: b.emailEnabled && p.emailDeliveryEnabled ? nextDigest(b.emailCadence) : null,
      updatedAt: stamp(s),
    });
    return { body: structuredClone(p) };
  })],

  // User dashboard cards.
  ['GET', '/api/dashboards/user/favorites', h((req, ctx) => {
    const s = S(ctx);
    const limit = limitParam(req.query, 5);
    const base = { scope: 'CURRENT_USER', generatedAt: TODAY.toISOString(), limit };
    if (cardError(ctx, 'favorites')) return { body: { ...base, status: 'ERROR', error: CARD_ERROR, count: 0, recent: [] } };
    const recent = [...s.favorites]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit)
      .map((f) => {
        const p = byId.get(f.propertyId);
        return {
          propertyId: f.propertyId,
          folio: p?.folio ?? null,
          address: p?.address ?? null,
          countyName: p ? COUNTY.countyName : null,
          stateCode: p ? COUNTY.stateCode : null,
          favoritedAt: f.createdAt,
        };
      });
    return { body: { ...base, status: 'OK', error: null, count: s.favorites.length, recent } };
  })],
  ['GET', '/api/dashboards/user/saved-searches', h((req, ctx) => {
    const s = S(ctx);
    const limit = limitParam(req.query, 5);
    const base = { scope: 'CURRENT_USER', generatedAt: TODAY.toISOString(), limit };
    if (cardError(ctx, 'saved-searches')) return { body: { ...base, status: 'ERROR', error: CARD_ERROR, count: 0, recent: [] } };
    const recent = [...s.savedSearches]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, limit)
      .map(({ id, name, cadence, paused, createdAt, updatedAt }) => ({ id, name, cadence, paused, createdAt, updatedAt }));
    return { body: { ...base, status: 'OK', error: null, count: s.savedSearches.length, recent } };
  })],
  ['GET', '/api/dashboards/user/alerts', h((req, ctx) => {
    const s = S(ctx);
    const limit = limitParam(req.query, 5);
    const base = { scope: 'CURRENT_USER', generatedAt: TODAY.toISOString(), limit };
    if (cardError(ctx, 'alerts'))
      return { body: { ...base, status: 'ERROR', error: CARD_ERROR, count: 0, activeCount: 0, pausedCount: 0, recent: [] } };
    const all = s.alerts.map((a) => alertDTO(s, a));
    const pausedCount = all.filter((a) => a.effectivePaused).length;
    const recent = all.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, limit);
    return { body: { ...base, status: 'OK', error: null, count: all.length, activeCount: all.length - pausedCount, pausedCount, recent } };
  })],
  ['GET', '/api/dashboards/user/activity', h((req, ctx) => {
    const limit = limitParam(req.query, 6);
    const base = { scope: 'CURRENT_USER', generatedAt: TODAY.toISOString(), limit };
    if (cardError(ctx, 'activity')) return { body: { ...base, status: 'ERROR', error: CARD_ERROR, recent: [] } };
    return { body: { ...base, status: 'OK', error: null, recent: activity(S(ctx), ctx, limit) } };
  })],
  ['GET', '/api/dashboards/user/affordability', h((req, ctx) => {
    if (cardError(ctx, 'affordability'))
      return { body: { scope: 'CURRENT_USER', generatedAt: TODAY.toISOString(), status: 'ERROR', error: CARD_ERROR, missingInputs: [], affordability: null } };
    return { body: affordabilityCard(req.query) };
  })],
  ['GET', '/api/dashboards/lender/mortgage-context', h((req, ctx) => {
    if (cardError(ctx, 'mortgage-context'))
      return { body: { scope: 'SUPPLIED_INPUTS', generatedAt: TODAY.toISOString(), status: 'ERROR', error: CARD_ERROR, assumptions: null, mortgage: null } };
    return { body: mortgageContextCard(req.query) };
  })],

  // Suggestions from saved preferences.
  ['GET', '/api/recommendations', h((req, ctx) => ({ body: recommendations(S(ctx), limitParam(req.query, 20, 50)) }))],

  // Opportunity scores.
  ['GET', '/api/opportunities', h((req, ctx) => {
    const s = S(ctx);
    const q = req.query;
    sizeParam(q);
    const countyId = numParam(q, 'countyId');
    const stateId = numParam(q, 'stateId');
    const minScore = numParam(q, 'minScore');
    const minValue = numParam(q, 'minValue');
    const maxValue = numParam(q, 'maxValue');
    const sort = q.get('sort') || 'SCORE_DESC';
    for (const [k, v] of [['countyId', countyId], ['stateId', stateId]])
      if (v !== null && (!Number.isInteger(v) || v < 1)) throw bad(`${k} must be a positive number`);
    if (minScore !== null && (minScore < 0 || minScore > 100)) throw bad('minScore must be between 0 and 100');
    for (const [k, v] of [['minValue', minValue], ['maxValue', maxValue]])
      if (v !== null && v < 0) throw bad(`${k} must be 0 or greater`);
    if (minValue !== null && maxValue !== null && minValue > maxValue) throw bad('minValue must not exceed maxValue');
    if (!OPP_SORTS[sort]) throw bad('sort must be one of SCORE_DESC, FORECAST_GROWTH_1Y_DESC, VALUE_ASC, VALUE_DESC');
    const matching = !s.opportunitiesScored
      ? []
      : OPPORTUNITIES.filter(
          (o) =>
            (countyId === null || countyId === COUNTY.countyId) &&
            (stateId === null || stateId === COUNTY.stateId) &&
            (minScore === null || o.score >= minScore) &&
            (minValue === null || o.estimatedValue >= minValue) &&
            (maxValue === null || o.estimatedValue <= maxValue),
        ).sort(OPP_SORTS[sort]);
    return {
      body: {
        scoreVersion: OPP_VERSION,
        status: matching.length ? 'OK' : s.opportunitiesScored ? 'NO_MATCHES' : 'NOT_SCORED',
        filters: { countyId, stateId, minScore, minValue, maxValue },
        sort,
        results: page(structuredClone(matching), q),
        notes: OPP_NOTES,
      },
    };
  })],
  ['POST', '/api/admin/opportunity-scores/refresh', h((req, ctx) => {
    if (!ctx.flags.admin) throw new HttpError(403, 'Access denied');
    const mode = req.query.get('mode');
    if (!mode) throw bad('mode is required');
    if (mode !== 'INCREMENTAL' && mode !== 'FULL') throw bad('mode must be INCREMENTAL or FULL');
    const s = S(ctx);
    // Properties with a stored valuation row: the six scored ones plus 49, whose valuation is
    // unsupported (UNAVAILABLE). 46 has no valuation row at all.
    const stale = mode === 'FULL' || !s.opportunitiesScored;
    const processed = stale ? OPPORTUNITIES.length + 1 : 0;
    const durationMillis = stale ? 1840 : 14;
    s.opportunitiesScored = true;
    const startedAt = stamp(s);
    return {
      delay: stale ? 1200 : 150,
      body: {
        mode,
        scoreVersion: OPP_VERSION,
        processed,
        scored: stale ? OPPORTUNITIES.length : 0,
        unavailable: stale ? 1 : 0,
        removed: 0,
        startedAt,
        finishedAt: new Date(Date.parse(startedAt) + durationMillis).toISOString(),
        durationMillis,
      },
    };
  })],
];

module.exports = { reset, routes };
