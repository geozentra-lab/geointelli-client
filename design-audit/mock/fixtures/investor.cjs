// Investor domain: portfolios, holdings, financial records, the two investor dashboard cards, the
// three calculators and saved investment scenarios.
//
// Shapes follow src/app/core/models/{api,dashboard,investment}.ts. All data is synthetic.
//
// Main portfolio (id 1) has 5 holdings: 3 valued (46 and 49 have no valuation per _shared gaps),
// debt known for 3 (one financed holding without a balance, one with financing never entered),
// occupancy RENTED 2 / VACANT 1 / OWNER_OCCUPIED 1 / UNKNOWN 1, and 2026 financial records for two of
// them. Portfolio 2 has 2 holdings, fully valued and with known debt, and no financial records, so
// the switcher shows a complete-but-unrecorded portfolio next to a partial one.
//
// The empty scenario has its own store, so creating a portfolio there works and stays separate.

const { page, COUNTY, PROPERTIES, TODAY, daysAgo, dateOnly } = require('./_shared.cjs');

const STATE = { stateId: COUNTY.stateId, stateCode: COUNTY.stateCode, stateName: 'Florida' };
const TODAY_DATE = dateOnly(TODAY.toISOString());
const PROPERTY = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));

/**
 * Latest published ZentraValue estimate per property, as this module assumes the valuation service
 * has it. Properties whose `gaps` include 'valuation' (46, 49) have none, so they never count as valued.
 */
const ESTIMATES = {
  42: { value: 985000, date: '2026-11-01' },
  43: { value: 942000, date: '2026-11-01' },
  44: { value: 1655000, date: '2026-10-01' },
  45: { value: 268000, date: '2026-11-01' },
  47: { value: 1118000, date: '2026-11-01' },
  48: { value: 587000, date: '2026-11-01' },
};
function estimateFor(propertyId) {
  const p = PROPERTY[propertyId];
  if (p && p.gaps.includes('valuation')) return null;
  return ESTIMATES[propertyId] ?? null;
}

const CATEGORIES = [
  'RENT', 'OTHER_INCOME', 'REPAIRS', 'MAINTENANCE', 'INSURANCE', 'PROPERTY_TAX', 'HOA',
  'UTILITIES', 'MANAGEMENT_FEE', 'MORTGAGE_PAYMENT', 'OTHER_EXPENSE',
];
const INCOME = new Set(['RENT', 'OTHER_INCOME']);
const OCCUPANCIES = ['UNKNOWN', 'OWNER_OCCUPIED', 'RENTED', 'VACANT'];
const FINANCING_TYPES = ['UNKNOWN', 'CASH', 'FINANCED'];

// ---- helpers --------------------------------------------------------------------------------
const r2 = (x) => (x === null || x === undefined ? null : Math.round(x * 100) / 100);
const has = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const num = (v) => (has(v) ? Number(v) : null);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const at = (date, hour = 14) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`).toISOString();
const clone = (o) => JSON.parse(JSON.stringify(o));
/** Write time: the fixed TODAY, so screenshots of edited records are stable across runs. */
const stamp = () => TODAY.toISOString();
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (part, whole) => (whole ? r2((part / whole) * 100) : null);

const bad = (message) => ({ status: 400, body: { status: 400, error: 'Bad Request', message } });
const notFound = (what) => ({ status: 404, body: { status: 404, error: 'Not Found', message: `${what} not found` } });
const conflict = (message) => ({ status: 409, body: { status: 409, error: 'Conflict', message } });

function payment(loan, ratePct, years) {
  if (loan <= 0) return 0;
  const n = years * 12;
  const r = ratePct / 100 / 12;
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}
function balanceAfter(loan, ratePct, years, months) {
  const n = years * 12;
  if (loan <= 0 || months >= n) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return loan * (1 - months / n);
  const pmt = payment(loan, ratePct, years);
  return loan * Math.pow(1 + r, months) - (pmt * (Math.pow(1 + r, months) - 1)) / r;
}
function presentValue(pmt, ratePct, years) {
  if (pmt <= 0) return 0;
  const n = years * 12;
  const r = ratePct / 100 / 12;
  return r === 0 ? pmt * n : (pmt * (1 - Math.pow(1 + r, -n))) / r;
}

// ---- seed -----------------------------------------------------------------------------------
function financing(type, f = {}) {
  const fin = type === 'FINANCED';
  const v = (k) => (fin && f[k] !== undefined && f[k] !== '' ? f[k] : null);
  return {
    type,
    loanAmount: v('loanAmount'),
    outstandingBalance: v('outstandingBalance'),
    balanceAsOfDate: v('balanceAsOfDate'),
    interestRatePercent: v('interestRatePercent'),
    loanTermMonths: v('loanTermMonths'),
    monthlyPayment: v('monthlyPayment'),
  };
}
function occupancy(status, o = {}) {
  const rented = status === 'RENTED';
  const v = (k) => (rented && o[k] !== undefined && o[k] !== '' ? o[k] : null);
  return { status, monthlyRent: v('monthlyRent'), leaseStartDate: v('leaseStartDate'), leaseEndDate: v('leaseEndDate') };
}
function holding(id, portfolioId, propertyId, h, created, updated) {
  const p = PROPERTY[propertyId];
  return {
    id,
    portfolioId,
    propertyId,
    folio: p ? p.folio : String(propertyId).padStart(13, '0'),
    countyId: COUNTY.countyId,
    currency: 'USD',
    acquisitionDate: h.acquisitionDate ?? null,
    purchasePrice: h.purchasePrice ?? null,
    acquisitionCosts: h.acquisitionCosts ?? null,
    ownershipSharePercent: h.ownershipSharePercent ?? 100,
    financing: h.financing,
    occupancy: h.occupancy,
    createdAt: created,
    updatedAt: updated,
  };
}

function seedFull() {
  const portfolios = [
    {
      id: 1,
      name: 'Miami-Dade rentals',
      description: 'Long-term rentals and the Day Ave home held with my brother.',
      currency: 'USD',
      createdAt: daysAgo(610),
      updatedAt: daysAgo(212),
    },
    {
      id: 2,
      name: 'Family homes',
      description: null,
      currency: 'USD',
      createdAt: daysAgo(95),
      updatedAt: daysAgo(95),
    },
  ];
  const holdings = [
    holding(101, 1, 42, {
      acquisitionDate: '2019-06-14', purchasePrice: 612000, acquisitionCosts: 14800,
      financing: financing('FINANCED', {
        loanAmount: 489600, outstandingBalance: 431250, balanceAsOfDate: '2026-10-31',
        interestRatePercent: 3.875, loanTermMonths: 360, monthlyPayment: 2302.19,
      }),
      occupancy: occupancy('RENTED', { monthlyRent: 4350, leaseStartDate: '2026-03-01', leaseEndDate: '2027-02-28' }),
    }, daysAgo(608), daysAgo(18)),
    // Co-owned, financed, but the balance was never entered: valued, debt unknown.
    holding(102, 1, 44, {
      acquisitionDate: '2021-09-02', purchasePrice: 1180000, acquisitionCosts: 31250, ownershipSharePercent: 50,
      financing: financing('FINANCED', { loanAmount: 944000, interestRatePercent: 2.99, loanTermMonths: 360 }),
      occupancy: occupancy('OWNER_OCCUPIED'),
    }, daysAgo(608), daysAgo(301)),
    // Paid cash (debt known: none), but no published valuation: value unknown.
    holding(103, 1, 46, {
      acquisitionDate: '2023-04-20', purchasePrice: 389000, acquisitionCosts: 9400,
      financing: financing('CASH'),
      occupancy: occupancy('VACANT'),
    }, daysAgo(560), daysAgo(77)),
    holding(104, 1, 47, {
      acquisitionDate: '2018-02-12', purchasePrice: 735000, acquisitionCosts: 18900,
      financing: financing('FINANCED', {
        loanAmount: 588000, outstandingBalance: 498900, balanceAsOfDate: '2026-09-30',
        interestRatePercent: 4.25, loanTermMonths: 360, monthlyPayment: 2892.62,
      }),
      occupancy: occupancy('RENTED', { monthlyRent: 5900, leaseStartDate: '2026-01-01', leaseEndDate: '2026-12-31' }),
    }, daysAgo(605), daysAgo(49)),
    // Added recently with almost nothing filled in: no valuation, financing and occupancy unknown.
    holding(105, 1, 49, {
      acquisitionDate: '2024-11-05', purchasePrice: 545000,
      financing: financing('UNKNOWN'),
      occupancy: occupancy('UNKNOWN'),
    }, daysAgo(12), daysAgo(12)),
    holding(201, 2, 43, {
      acquisitionDate: '2015-08-21', purchasePrice: 455000, acquisitionCosts: 11200,
      financing: financing('FINANCED', {
        loanAmount: 364000, outstandingBalance: 251800, balanceAsOfDate: '2026-10-01',
        interestRatePercent: 3.5, loanTermMonths: 360, monthlyPayment: 1634.54,
      }),
      occupancy: occupancy('OWNER_OCCUPIED'),
    }, daysAgo(95), daysAgo(40)),
    holding(202, 2, 45, {
      acquisitionDate: '2020-03-10', purchasePrice: 178000, acquisitionCosts: 4100,
      financing: financing('CASH'),
      occupancy: occupancy('RENTED', { monthlyRent: 2150, leaseStartDate: '2026-06-01', leaseEndDate: '2027-05-31' }),
    }, daysAgo(95), daysAgo(95)),
  ];

  let rid = 5001;
  const records = [];
  const rec = (holdingId, category, amount, date, description = null, periodStart = null, periodEnd = null) => {
    const h = holdings.find((x) => x.id === holdingId);
    const created = at(date, 23);
    records.push({
      id: rid++,
      portfolioId: h.portfolioId,
      holdingId,
      category,
      type: INCOME.has(category) ? 'INCOME' : 'EXPENSE',
      amount,
      currency: 'USD',
      transactionDate: date,
      periodStart,
      periodEnd,
      description,
      source: 'USER_ENTERED',
      createdAt: created,
      updatedAt: created,
    });
  };
  const monthEnd = (y, m) => dateOnly(new Date(Date.UTC(y, m, 0)).toISOString());
  const mm = (m) => String(m).padStart(2, '0');

  // 2847 SW 27th Ter (holding 101): one 2025 record outside the default year-to-date period.
  rec(101, 'RENT', 4350, '2025-12-01', null, '2025-12-01', '2025-12-31');
  for (let m = 1; m <= 11; m++) {
    const day = m === 3 ? '06' : '01';
    rec(101, 'RENT', 4350, `2026-${mm(m)}-${day}`, m === 3 ? 'Paid late, on the 6th' : null, `2026-${mm(m)}-01`, monthEnd(2026, m));
  }
  rec(101, 'PROPERTY_TAX', 11482.36, '2026-03-27', '2025 real estate tax bill', '2025-01-01', '2025-12-31');
  rec(101, 'MAINTENANCE', 360, '2026-04-02', 'Lawn and hedge service, Q2', '2026-04-01', '2026-06-30');
  rec(101, 'INSURANCE', 6918, '2026-05-14', 'Homeowners policy renewal, wind included', '2026-05-15', '2027-05-14');
  rec(101, 'REPAIRS', 1875, '2026-08-09', 'AC compressor replaced');
  rec(101, 'MAINTENANCE', 360, '2026-10-03', 'Lawn and hedge service, Q4', '2026-10-01', '2026-12-31');

  // 640 NE 74th St duplex (holding 104).
  for (let m = 1; m <= 10; m++) {
    rec(104, 'RENT', 5900, `2026-${mm(m)}-${m === 7 ? '03' : '02'}`, 'Units A and B', `2026-${mm(m)}-01`, monthEnd(2026, m));
  }
  rec(104, 'UTILITIES', 412.6, '2026-02-18', 'Water and sewer, owner-paid', '2025-11-15', '2026-02-14');
  rec(104, 'MANAGEMENT_FEE', 1416, '2026-04-05', '8% of collected rent, Q1', '2026-01-01', '2026-03-31');
  rec(104, 'UTILITIES', 438.15, '2026-05-19', 'Water and sewer, owner-paid', '2026-02-15', '2026-05-14');
  rec(104, 'REPAIRS', 2340, '2026-06-19', 'Roof patch over unit B after the June storm');
  rec(104, 'MANAGEMENT_FEE', 1416, '2026-07-06', '8% of collected rent, Q2', '2026-04-01', '2026-06-30');
  rec(104, 'OTHER_INCOME', 150, '2026-07-08', 'Late fee, unit B');
  rec(104, 'UTILITIES', 465.9, '2026-08-18', 'Water and sewer, owner-paid', '2026-05-15', '2026-08-14');
  rec(104, 'MANAGEMENT_FEE', 1416, '2026-10-05', '8% of collected rent, Q3', '2026-07-01', '2026-09-30');
  rec(104, 'PROPERTY_TAX', 14186.4, '2026-11-12', '2026 tax bill, paid in November for the 4% discount', '2026-01-01', '2026-12-31');

  const scenarios = [
    {
      id: 11,
      name: 'SW 186th St, 20% down',
      scenarioType: 'INVESTMENT',
      inputVersion: 1,
      propertyId: 48,
      assumptions: {
        operating: {
          monthlyRent: 3250, vacancyRatePercent: 5, maintenanceRatePercent: 6, managementRatePercent: 8,
          annualPropertyTax: 8900, annualHomeInsurance: 5400,
        },
        financing: { purchasePrice: 585000, downPayment: 117000, annualInterestRate: 6.75, loanTermYears: 30, closingCosts: 14600 },
        projection: { horizonYears: 7, annualAppreciationRatePercent: 3 },
      },
      createdAt: daysAgo(41),
      updatedAt: daysAgo(6),
    },
    {
      id: 12,
      name: 'Collins Ave condo, all cash',
      scenarioType: 'INVESTMENT',
      inputVersion: 1,
      propertyId: 49,
      assumptions: {
        operating: { monthlyRent: 3400, vacancyRatePercent: 8, annualPropertyTax: 9600, annualHomeInsurance: 2100, monthlyHoaFees: 1180 },
        financing: { purchasePrice: 545000, downPayment: 545000, closingCosts: 6500 },
        projection: { horizonYears: 5 },
      },
      createdAt: daysAgo(64),
      updatedAt: daysAgo(30),
    },
    {
      id: 13,
      name: 'Duplex at current rents, no loan',
      scenarioType: 'INVESTMENT',
      inputVersion: 1,
      propertyId: 47,
      assumptions: {
        operating: { monthlyRent: 5900, vacancyRatePercent: 4, maintenanceRatePercent: 8, annualPropertyTax: 14200, annualHomeInsurance: 7800, monthlyOtherExpenses: 150 },
      },
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120),
    },
    {
      id: 14,
      name: 'Quick rent check',
      scenarioType: 'INVESTMENT',
      inputVersion: 1,
      propertyId: null,
      assumptions: { operating: { monthlyRent: 2800 } },
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
  ];
  return { portfolios, holdings, records, scenarios };
}

let db;
function reset() {
  db = {
    full: seedFull(),
    empty: { portfolios: [], holdings: [], records: [], scenarios: [] },
    seq: { portfolio: 3, holding: 301, record: 6001, scenario: 21 },
  };
}
reset();

const store = (ctx) => (ctx?.flags?.empty ? db.empty : db.full);

// ---- portfolio DTOs -------------------------------------------------------------------------
function portfolioDto(s, p) {
  return { ...clone(p), holdingCount: s.holdings.filter((h) => h.portfolioId === p.id).length };
}
function findPortfolio(s, id) {
  return s.portfolios.find((p) => p.id === Number(id)) ?? null;
}

/** Per-holding amounts by ownership share; null where the backend would not know them. */
function holdingFacts(h) {
  const share = (h.ownershipSharePercent ?? 100) / 100;
  const est = estimateFor(h.propertyId);
  const value = est ? est.value * share : null;
  const f = h.financing ?? { type: 'UNKNOWN' };
  let debt = null;
  let balanceDate = null;
  if (f.type === 'CASH') debt = 0;
  else if (f.type === 'FINANCED' && has(f.outstandingBalance)) {
    debt = Number(f.outstandingBalance) * share;
    balanceDate = f.balanceAsOfDate ?? null;
  }
  const equity = value !== null && debt !== null ? value - debt : null;
  return { share, value, debt, equity, valuationDate: est?.date ?? null, balanceDate };
}

function metric(values, totalHoldings) {
  const known = values.filter((v) => v !== null);
  const covered = known.length;
  const knownTotal = r2(sum(known));
  let status;
  if (!totalHoldings) status = 'NO_HOLDINGS';
  else if (covered === totalHoldings) status = 'COMPLETE';
  else if (covered === 0) status = 'UNAVAILABLE';
  else status = 'PARTIAL';
  return {
    status,
    total: totalHoldings && covered === totalHoldings ? knownTotal : null,
    knownTotal,
    coveredHoldings: covered,
    totalHoldings,
  };
}

function valuation(holdings) {
  const facts = holdings.map(holdingFacts);
  const n = holdings.length;
  const value = metric(facts.map((f) => f.value), n);
  const debt = metric(facts.map((f) => f.debt), n);
  const equity = metric(facts.map((f) => f.equity), n);
  const vDates = facts.map((f) => f.valuationDate).filter(Boolean).sort();
  const bDates = facts.map((f) => f.balanceDate).filter(Boolean).sort();
  return {
    value, debt, equity,
    valueCoveragePercent: pct(value.coveredHoldings, n),
    debtCoveragePercent: pct(debt.coveredHoldings, n),
    equityCoveragePercent: pct(equity.coveredHoldings, n),
    oldestValuationDate: vDates[0] ?? null,
    newestValuationDate: vDates[vDates.length - 1] ?? null,
    oldestBalanceDate: bDates[0] ?? null,
    newestBalanceDate: bDates[bDates.length - 1] ?? null,
    valuationSources: vDates.length ? ['ZENTRAVALUE_ESTIMATE'] : [],
    valuationSource: 'ZENTRAVALUE_ESTIMATE',
    debtSource: 'OWNER_REPORTED_FINANCING',
  };
}
const VALUE_NOTE =
  'Amounts by ownership share. Value is the latest published ZentraValue estimate; purchase price and assessments are never used. Holdings without an estimate or a reported loan balance are left out of the totals.';

function geography(holdings) {
  const n = holdings.length;
  if (!n) return { states: [], counties: [] };
  const share = sum(holdings.map((h) => (h.ownershipSharePercent ?? 100) / 100));
  const base = { holdingCount: n, holdingPercent: 100, ownershipEquivalentHoldings: r2(share), unknown: false };
  return {
    states: [{ ...STATE, countyId: null, countyName: null, ...base }],
    counties: [{ ...STATE, countyId: COUNTY.countyId, countyName: COUNTY.countyName, ...base }],
  };
}

function occupancyFacts(holdings) {
  const counts = { RENTED: 0, VACANT: 0, OWNER_OCCUPIED: 0, UNKNOWN: 0 };
  for (const h of holdings) counts[h.occupancy?.status ?? 'UNKNOWN'] += 1;
  const n = holdings.length;
  const known = n - counts.UNKNOWN;
  const rental = counts.RENTED + counts.VACANT;
  return {
    occupancyCounts: counts,
    knownOccupancyHoldings: known,
    occupancyCoveragePercent: pct(known, n),
    rentalHoldings: rental,
    rentalOccupancyPercent: rental ? r2((counts.RENTED / rental) * 100) : null,
  };
}

// ---- summary --------------------------------------------------------------------------------
function summary(s, p, query) {
  const toQ = query.get('toDate');
  const fromQ = query.get('fromDate');
  if ((fromQ && !isDate(fromQ)) || (toQ && !isDate(toQ))) return bad('Dates must be in YYYY-MM-DD format.');
  const toDate = toQ || TODAY_DATE;
  const fromDate = fromQ || `${toDate.slice(0, 4)}-01-01`;
  if (fromDate > toDate) return bad('fromDate must be on or before toDate.');

  const holdings = s.holdings.filter((h) => h.portfolioId === p.id);
  const n = holdings.length;
  const v = valuation(holdings);

  const shareOf = Object.fromEntries(holdings.map((h) => [h.id, (h.ownershipSharePercent ?? 100) / 100]));
  const inPeriod = s.records.filter(
    (r) => shareOf[r.holdingId] !== undefined && r.transactionDate >= fromDate && r.transactionDate <= toDate,
  );
  const categories = CATEGORIES.map((category) => {
    const rs = inPeriod.filter((r) => r.category === category);
    return {
      category,
      type: INCOME.has(category) ? 'INCOME' : 'EXPENSE',
      amount: r2(sum(rs.map((r) => r.amount * shareOf[r.holdingId]))),
      recordCount: rs.length,
    };
  }).filter((c) => c.recordCount > 0);
  const income = r2(sum(categories.filter((c) => c.type === 'INCOME').map((c) => c.amount)));
  const expenses = r2(sum(categories.filter((c) => c.type === 'EXPENSE').map((c) => c.amount)));
  const withRecords = new Set(inPeriod.map((r) => r.holdingId)).size;

  const occ = occupancyFacts(holdings);
  const geo = geography(holdings);
  const occStatus = !n ? 'NO_HOLDINGS' : occ.knownOccupancyHoldings === n ? 'COMPLETE' : 'PARTIAL';
  const partial = [v.value, v.debt, v.equity].some((m) => m.status !== 'COMPLETE') || occStatus !== 'COMPLETE';

  return {
    body: {
      portfolioId: p.id,
      portfolioName: p.name,
      status: !n ? 'NO_HOLDINGS' : partial ? 'PARTIAL' : 'COMPLETE',
      generatedAt: TODAY.toISOString(),
      asOfDate: TODAY_DATE,
      fromDate,
      toDate,
      valuationAndDebt: {
        currency: 'USD',
        asOfDate: TODAY_DATE,
        value: v.value,
        debt: v.debt,
        equity: v.equity,
        note: VALUE_NOTE,
        valuationSources: v.valuationSources,
        valuationSource: v.valuationSource,
        debtSource: v.debtSource,
      },
      financials: {
        status: inPeriod.length ? 'OK' : 'NO_RECORDS',
        basis: 'CASH_BASIS',
        currency: 'USD',
        fromDate,
        toDate,
        income,
        expenses,
        cashFlow: r2(income - expenses),
        recordCount: inPeriod.length,
        holdingsWithRecords: withRecords,
        totalHoldings: n,
        note: 'Recorded income minus recorded expenses by transaction date, by ownership share. Not a forecast or a return.',
        categories,
      },
      occupancyAndExposure: {
        status: occStatus,
        asOfDate: TODAY_DATE,
        totalHoldings: n,
        knownOccupancyHoldings: occ.knownOccupancyHoldings,
        rentalHoldings: occ.rentalHoldings,
        rentalOccupancyPercent: occ.rentalOccupancyPercent,
        occupancyCounts: occ.occupancyCounts,
        states: geo.states,
        counties: geo.counties,
        note: 'Occupancy and leases as you reported them; exposure counts holdings and is not value-weighted. Describes current holdings, whatever period is selected.',
      },
      errors: [],
    },
  };
}

// ---- investor dashboard cards -----------------------------------------------------------------
function cardScope(req, ctx) {
  const s = store(ctx);
  const raw = req.query.get('portfolioId');
  if (raw === null || raw === '') {
    return { s, portfolioId: null, holdings: s.holdings };
  }
  if (!/^\d+$/.test(raw)) return { error: bad('portfolioId must be a number.') };
  const p = findPortfolio(s, raw);
  if (!p) return { error: notFound('Portfolio') };
  return { s, portfolioId: p.id, holdings: s.holdings.filter((h) => h.portfolioId === p.id) };
}
function cardBase(s, portfolioId, holdings, note) {
  const updated = holdings.map((h) => h.updatedAt).sort();
  const none = s.portfolios.length === 0;
  return {
    scope: portfolioId === null ? 'ALL_PORTFOLIOS' : 'PORTFOLIO',
    generatedAt: TODAY.toISOString(),
    status: none ? 'EMPTY' : 'OK',
    error: null,
    portfolioId,
    portfolioCount: portfolioId === null ? s.portfolios.length : 1,
    asOfDate: TODAY_DATE,
    totalHoldings: holdings.length,
    holdingsUpdatedAt: updated[updated.length - 1] ?? null,
    note: none ? 'No portfolios yet.' : note,
  };
}
function valueEquityDebtCard(req, ctx) {
  const scope = cardScope(req, ctx);
  if (scope.error) return scope.error;
  const { s, portfolioId, holdings } = scope;
  const v = valuation(holdings);
  return {
    body: {
      ...cardBase(s, portfolioId, holdings, VALUE_NOTE),
      currency: 'USD',
      ...v,
    },
  };
}
function occupancyExposureCard(req, ctx) {
  const scope = cardScope(req, ctx);
  if (scope.error) return scope.error;
  const { s, portfolioId, holdings } = scope;
  const n = holdings.length;
  const geo = geography(holdings);
  return {
    body: {
      ...cardBase(s, portfolioId, holdings, 'Occupancy and leases as you reported them.'),
      ...occupancyFacts(holdings),
      knownGeographyHoldings: n,
      geographyCoveragePercent: pct(n, n),
      exposureBasis: 'HOLDING_COUNT',
      states: geo.states,
      counties: geo.counties,
    },
  };
}

// ---- holdings -------------------------------------------------------------------------------
function readFinancing(input) {
  if (input === undefined || input === null) return { value: financing('UNKNOWN') };
  if (!FINANCING_TYPES.includes(input.type)) return { error: 'financing.type must be UNKNOWN, CASH or FINANCED.' };
  for (const k of ['loanAmount', 'outstandingBalance', 'interestRatePercent', 'loanTermMonths', 'monthlyPayment']) {
    if (input[k] !== undefined && input[k] !== null && !(has(input[k]) && Number(input[k]) >= 0))
      return { error: `financing.${k} must be zero or more.` };
  }
  if (input.interestRatePercent > 100) return { error: 'financing.interestRatePercent must be 100 or less.' };
  if (input.balanceAsOfDate && !isDate(input.balanceAsOfDate)) return { error: 'financing.balanceAsOfDate must be a date.' };
  return { value: financing(input.type, input) };
}
function readOccupancy(input) {
  if (input === undefined || input === null) return { value: occupancy('UNKNOWN') };
  if (!OCCUPANCIES.includes(input.status)) return { error: 'occupancy.status must be UNKNOWN, OWNER_OCCUPIED, RENTED or VACANT.' };
  if (input.monthlyRent !== undefined && input.monthlyRent !== null && !(has(input.monthlyRent) && input.monthlyRent >= 0))
    return { error: 'occupancy.monthlyRent must be zero or more.' };
  const { leaseStartDate: a, leaseEndDate: b } = input;
  if ((a && !isDate(a)) || (b && !isDate(b))) return { error: 'Lease dates must be dates.' };
  if (a && b && a > b) return { error: 'The lease must start on or before it ends.' };
  return { value: occupancy(input.status, input) };
}
/** Applies the fields a HoldingRequest carries; returns an error message or null. */
function applyHolding(target, body) {
  if (body.ownershipSharePercent !== undefined) {
    const share = Number(body.ownershipSharePercent);
    if (!has(body.ownershipSharePercent) || share <= 0 || share > 100)
      return 'ownershipSharePercent must be more than 0 and at most 100.';
    target.ownershipSharePercent = share;
  }
  if (body.acquisitionDate !== undefined) {
    if (body.acquisitionDate !== null && !isDate(body.acquisitionDate)) return 'acquisitionDate must be a date.';
    if (body.acquisitionDate && body.acquisitionDate > TODAY_DATE) return 'acquisitionDate cannot be in the future.';
    target.acquisitionDate = body.acquisitionDate || null;
  }
  for (const k of ['purchasePrice', 'acquisitionCosts']) {
    if (body[k] === undefined) continue;
    if (body[k] !== null && !(has(body[k]) && Number(body[k]) >= 0)) return `${k} must be zero or more.`;
    target[k] = num(body[k]);
  }
  if (body.financing !== undefined) {
    const f = readFinancing(body.financing);
    if (f.error) return f.error;
    target.financing = f.value;
  }
  if (body.occupancy !== undefined) {
    const o = readOccupancy(body.occupancy);
    if (o.error) return o.error;
    target.occupancy = o.value;
  }
  return null;
}

// ---- financial records ----------------------------------------------------------------------
function applyRecord(target, body, creating) {
  if (creating || body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return 'category is required and must be a known category.';
    target.category = body.category;
    target.type = INCOME.has(body.category) ? 'INCOME' : 'EXPENSE';
  }
  if (creating || body.amount !== undefined) {
    if (!has(body.amount) || Number(body.amount) <= 0) return 'amount must be more than 0.';
    target.amount = r2(Number(body.amount));
  }
  if (body.currency !== undefined && body.currency !== 'USD') return 'Only USD is supported.';
  if (creating || body.transactionDate !== undefined) {
    if (!isDate(body.transactionDate)) return 'transactionDate is required.';
    target.transactionDate = body.transactionDate;
  }
  if (body.periodStart !== undefined) target.periodStart = body.periodStart || null;
  if (body.periodEnd !== undefined) target.periodEnd = body.periodEnd || null;
  const { periodStart: a, periodEnd: b } = target;
  if (!!a !== !!b) return 'Provide both periodStart and periodEnd, or neither.';
  if ((a && !isDate(a)) || (b && !isDate(b))) return 'Period dates must be dates.';
  if (a && b && a > b) return 'periodStart must be on or before periodEnd.';
  if (body.description !== undefined) {
    const d = body.description === null ? null : String(body.description).trim();
    if (d && d.length > 2000) return 'description must be at most 2000 characters.';
    target.description = d || null;
  }
  return null;
}
function findHolding(s, portfolioId, holdingId) {
  return s.holdings.find((h) => h.portfolioId === Number(portfolioId) && h.id === Number(holdingId)) ?? null;
}

// ---- calculators ----------------------------------------------------------------------------
function mortgage(body) {
  const b = body ?? {};
  const price = num(b.price), down = num(b.downPayment), rate = num(b.annualInterestRate), years = num(b.loanTermYears);
  if (price === null || price <= 0) return bad('price must be more than 0.');
  if (down === null || down < 0 || down > price) return bad('downPayment must be between 0 and the price.');
  if (rate === null || rate < 0 || rate > 100) return bad('annualInterestRate must be between 0 and 100.');
  if (years === null || !Number.isInteger(years) || years < 1 || years > 50) return bad('loanTermYears must be a whole number from 1 to 50.');
  for (const k of ['annualPropertyTax', 'annualHomeInsurance', 'monthlyHoaFees'])
    if (b[k] !== undefined && b[k] !== null && !(has(b[k]) && b[k] >= 0)) return bad(`${k} must be zero or more.`);
  const loan = price - down;
  const pi = r2(payment(loan, rate, years));
  const tax = has(b.annualPropertyTax) ? r2(b.annualPropertyTax / 12) : null;
  const ins = has(b.annualHomeInsurance) ? r2(b.annualHomeInsurance / 12) : null;
  const hoa = has(b.monthlyHoaFees) ? r2(Number(b.monthlyHoaFees)) : null;
  return {
    body: {
      loanAmount: r2(loan),
      monthlyPrincipalAndInterest: pi,
      monthlyPropertyTax: tax,
      monthlyInsurance: ins,
      monthlyHoaFees: hoa,
      totalMonthlyKnownCosts: r2(sum([pi, tax ?? 0, ins ?? 0, hoa ?? 0])),
    },
  };
}

const FRONT_END = 28;
const BACK_END = 36;
function affordability(body) {
  const b = body ?? {};
  const income = num(b.annualGrossIncome), debts = num(b.monthlyDebtPayments), down = num(b.downPayment);
  const rate = num(b.annualInterestRate), years = num(b.loanTermYears);
  if (income === null || income <= 0) return bad('annualGrossIncome must be more than 0.');
  if (debts === null || debts < 0) return bad('monthlyDebtPayments must be zero or more.');
  if (down === null || down < 0) return bad('downPayment must be zero or more.');
  if (rate === null || rate < 0 || rate > 100) return bad('annualInterestRate must be between 0 and 100.');
  if (years === null || !Number.isInteger(years) || years < 1 || years > 50) return bad('loanTermYears must be a whole number from 1 to 50.');
  const monthly = income / 12;
  const front = (monthly * FRONT_END) / 100;
  const back = (monthly * BACK_END) / 100 - debts;
  const housing = Math.max(0, Math.min(front, back));
  const optional = [
    ['property tax', has(b.annualPropertyTax) ? b.annualPropertyTax / 12 : null],
    ['home insurance', has(b.annualHomeInsurance) ? b.annualHomeInsurance / 12 : null],
    ['HOA', has(b.monthlyHoaFees) ? Number(b.monthlyHoaFees) : null],
  ];
  const known = sum(optional.map(([, v]) => v ?? 0));
  const pi = Math.max(0, housing - known);
  const loan = presentValue(pi, rate, years);
  const notes = [];
  if (housing === 0) {
    notes.push(`Monthly debt payments of $${Math.round(debts).toLocaleString('en-US')} already use more than ${BACK_END}% of income, so no housing payment fits these limits.`);
  } else if (back < front) {
    notes.push(`Your monthly debts set the limit: at ${BACK_END}% of income they leave $${Math.round(back).toLocaleString('en-US')} a month for housing, less than the ${FRONT_END}% housing limit.`);
  }
  const missing = optional.filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length)
    notes.push(`Not supplied, so not deducted from the budget: ${missing.join(', ')}. A real payment would include them.`);
  if (housing > 0 && pi === 0) notes.push('The costs you entered use the whole housing budget, leaving nothing for a loan payment.');
  return {
    body: {
      monthlyGrossIncome: r2(monthly),
      maxMonthlyHousingPayment: r2(housing),
      maxMonthlyPrincipalAndInterest: r2(pi),
      maxLoanAmount: r2(loan),
      maxHomePrice: r2(loan + down),
      assumptions: {
        frontEndRatioPercent: FRONT_END,
        backEndRatioPercent: BACK_END,
        annualInterestRate: rate,
        loanTermYears: years,
        rateSource: 'USER_SUPPLIED',
      },
      notes,
      disclaimer: 'An estimate from the figures you entered, not a loan offer or pre-approval.',
    },
  };
}

function investment(body) {
  const o = body?.operating;
  if (!o || !has(o.monthlyRent) || Number(o.monthlyRent) < 0) return bad('operating.monthlyRent is required and must be zero or more.');
  for (const k of ['vacancyRatePercent', 'maintenanceRatePercent', 'managementRatePercent'])
    if (o[k] !== undefined && o[k] !== null && !(has(o[k]) && o[k] >= 0 && o[k] <= 100)) return bad(`operating.${k} must be between 0 and 100.`);
  for (const k of ['annualPropertyTax', 'annualHomeInsurance', 'monthlyHoaFees', 'monthlyOtherExpenses'])
    if (o[k] !== undefined && o[k] !== null && !(has(o[k]) && o[k] >= 0)) return bad(`operating.${k} must be zero or more.`);
  const f = body.financing ?? null;
  const p = body.projection ?? null;
  if (f) {
    for (const k of ['purchasePrice', 'downPayment', 'annualInterestRate', 'loanTermYears', 'closingCosts'])
      if (f[k] !== undefined && f[k] !== null && !(has(f[k]) && f[k] >= 0)) return bad(`financing.${k} must be zero or more.`);
    if (has(f.purchasePrice) && has(f.downPayment) && Number(f.downPayment) > Number(f.purchasePrice))
      return bad('financing.downPayment cannot be more than the purchase price.');
  }
  if (p) {
    if (!Number.isInteger(p.horizonYears) || p.horizonYears < 1 || p.horizonYears > 30) return bad('projection.horizonYears must be a whole number from 1 to 30.');
    if (p.annualAppreciationRatePercent !== undefined && p.annualAppreciationRatePercent !== null &&
      !(has(p.annualAppreciationRatePercent) && p.annualAppreciationRatePercent >= -50 && p.annualAppreciationRatePercent <= 50))
      return bad('projection.annualAppreciationRatePercent must be between -50 and 50.');
  }

  // Operating
  const rent = Number(o.monthlyRent);
  const opNotes = [];
  const vacancy = has(o.vacancyRatePercent) ? (rent * o.vacancyRatePercent) / 100 : null;
  if (vacancy === null) opNotes.push('Vacancy was not supplied: effective income is the full rent, with no allowance for empty months.');
  const effM = rent - (vacancy ?? 0);
  const lines = [
    ['maintenance', has(o.maintenanceRatePercent) ? (rent * 12 * o.maintenanceRatePercent) / 100 : null],
    ['management', has(o.managementRatePercent) ? (effM * 12 * o.managementRatePercent) / 100 : null],
    ['property tax', has(o.annualPropertyTax) ? Number(o.annualPropertyTax) : null],
    ['insurance', has(o.annualHomeInsurance) ? Number(o.annualHomeInsurance) : null],
    ['HOA', has(o.monthlyHoaFees) ? o.monthlyHoaFees * 12 : null],
    ['other costs', has(o.monthlyOtherExpenses) ? o.monthlyOtherExpenses * 12 : null],
  ];
  const supplied = lines.filter(([, v]) => v !== null);
  const missing = lines.filter(([, v]) => v === null).map(([k]) => k);
  const opexA = supplied.length ? sum(supplied.map(([, v]) => v)) : null;
  if (!supplied.length) opNotes.push('No operating costs were supplied, so operating costs and net operating income are not calculated.');
  else if (missing.length) opNotes.push(`Not supplied, so not included in operating costs: ${missing.join(', ')}.`);
  const noiA = opexA === null ? null : effM * 12 - opexA;
  const operating = {
    monthlyGrossRent: r2(rent),
    annualGrossRent: r2(rent * 12),
    monthlyVacancyLoss: r2(vacancy),
    annualVacancyLoss: vacancy === null ? null : r2(vacancy * 12),
    monthlyEffectiveIncome: r2(effM),
    annualEffectiveIncome: r2(effM * 12),
    annualMaintenance: r2(lines[0][1]),
    annualManagement: r2(lines[1][1]),
    annualPropertyTax: r2(lines[2][1]),
    annualInsurance: r2(lines[3][1]),
    annualHoaFees: r2(lines[4][1]),
    annualOtherExpenses: r2(lines[5][1]),
    monthlyOperatingExpenses: opexA === null ? null : r2(opexA / 12),
    annualOperatingExpenses: r2(opexA),
    monthlyNetOperatingIncome: noiA === null ? null : r2(noiA / 12),
    annualNetOperatingIncome: r2(noiA),
    notes: opNotes,
  };

  // Financing
  let financingResult = null;
  let price = null, down = null, loan = null, rate = null, term = null, annualCashFlow = null;
  if (f) {
    const fNotes = [];
    price = num(f.purchasePrice);
    down = num(f.downPayment);
    rate = num(f.annualInterestRate);
    term = num(f.loanTermYears);
    const closing = num(f.closingCosts);
    loan = price !== null && down !== null ? price - down : null;
    if (loan === null) fNotes.push('Purchase price and down payment are both needed for the loan amount.');
    let mds = null;
    if (loan === 0) {
      mds = 0;
      fNotes.push('Bought for cash: there is no debt service.');
    } else if (loan !== null) {
      if (rate !== null && term !== null) mds = payment(loan, rate, term);
      else fNotes.push('Interest rate and loan term are needed for debt service and cash flow.');
    }
    const mcf = noiA !== null && mds !== null ? noiA / 12 - mds : null;
    annualCashFlow = mcf === null ? null : mcf * 12;
    const cashInvested = down !== null ? down + (closing ?? 0) : null;
    if (cashInvested !== null && closing === null) fNotes.push('Closing costs were not supplied and are not part of cash invested.');
    financingResult = {
      loanAmount: r2(loan),
      monthlyDebtService: r2(mds),
      annualDebtService: mds === null ? null : r2(mds * 12),
      monthlyCashFlow: r2(mcf),
      annualCashFlow: r2(annualCashFlow),
      capRatePercent: noiA !== null && price ? r2((noiA / price) * 100) : null,
      cashInvested: r2(cashInvested),
      cashOnCashPercent: annualCashFlow !== null && cashInvested ? r2((annualCashFlow / cashInvested) * 100) : null,
      notes: fNotes,
    };
  }

  // Projection
  let projection = null;
  if (p) {
    const h = p.horizonYears;
    const g = has(p.annualAppreciationRatePercent) ? Number(p.annualAppreciationRatePercent) : null;
    const pNotes = [];
    const projected = price !== null ? price * Math.pow(1 + (g ?? 0) / 100, h) : null;
    if (price === null) pNotes.push('A purchase price is needed to project value and equity.');
    let remaining = null;
    if (loan === 0) remaining = 0;
    else if (loan !== null && rate !== null && term !== null) remaining = balanceAfter(loan, rate, term, h * 12);
    if (annualCashFlow === null) pNotes.push('Cash flow over the period needs net operating income and debt service.');
    projection = {
      horizonYears: h,
      annualAppreciationRatePercent: g,
      projectedPropertyValue: r2(projected),
      remainingLoanBalance: r2(remaining),
      equityFromDownPayment: r2(down),
      equityFromLoanPaydown: loan !== null && remaining !== null ? r2(loan - remaining) : null,
      equityFromAppreciation: projected !== null ? r2(projected - price) : null,
      totalEquity: projected !== null && remaining !== null ? r2(projected - remaining) : null,
      cumulativeCashFlow: annualCashFlow === null ? null : r2(annualCashFlow * h),
      assumptions: [
        g === null
          ? 'No yearly value change was supplied, so the value is held at the purchase price.'
          : `Value changes ${g}% a year, compounded from the purchase price.`,
        "Rent and costs stay at today's figures for the whole period.",
      ],
      notes: pNotes,
    };
  }

  return {
    body: {
      operating,
      financing: financingResult,
      grossYieldPercent: price ? r2(((rent * 12) / price) * 100) : null,
      projection,
      notes: ['Calculated only from the figures you entered. Not a market estimate, an appraisal or advice.'],
    },
  };
}

// ---- scenarios ------------------------------------------------------------------------------
function readAssumptions(a) {
  if (!a || typeof a !== 'object' || !a.operating || !has(a.operating.monthlyRent))
    return 'assumptions.operating.monthlyRent is required.';
  const check = investment(a);
  return check.status === 400 ? check.body.message : null;
}

// ---- routes ---------------------------------------------------------------------------------
const P = '^\\/api\\/portfolios\\/(\\d+)';
const rx = (s) => new RegExp(s + '$');

module.exports = {
  reset,
  routes: [
    // Portfolios
    ['GET', '/api/portfolios', (req, ctx) => {
      const s = store(ctx);
      return { body: page(s.portfolios.map((p) => portfolioDto(s, p)), req.query) };
    }],
    ['POST', '/api/portfolios', (req, ctx) => {
      const s = store(ctx);
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 120) return bad('name is required and must be at most 120 characters.');
      const now = stamp();
      const p = {
        id: db.seq.portfolio++,
        name,
        description: req.body.description ? String(req.body.description).trim().slice(0, 2000) || null : null,
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      };
      s.portfolios.push(p);
      return { status: 201, body: portfolioDto(s, p) };
    }],
    ['PATCH', rx(P), (req, ctx) => {
      const s = store(ctx);
      const p = findPortfolio(s, req.params[1]);
      if (!p) return notFound('Portfolio');
      const b = req.body ?? {};
      if (b.name !== undefined) {
        const name = typeof b.name === 'string' ? b.name.trim() : '';
        if (!name || name.length > 120) return bad('name must be 1 to 120 characters.');
        p.name = name;
      }
      if (b.description !== undefined) p.description = b.description ? String(b.description).trim() || null : null;
      p.updatedAt = stamp();
      return { body: portfolioDto(s, p) };
    }],
    ['DELETE', rx(P), (req, ctx) => {
      const s = store(ctx);
      const p = findPortfolio(s, req.params[1]);
      if (!p) return notFound('Portfolio');
      s.portfolios = s.portfolios.filter((x) => x !== p);
      s.holdings = s.holdings.filter((h) => h.portfolioId !== p.id);
      s.records = s.records.filter((r) => r.portfolioId !== p.id);
      return { status: 204 };
    }],
    ['GET', rx(P + '\\/summary'), (req, ctx) => {
      const s = store(ctx);
      const p = findPortfolio(s, req.params[1]);
      if (!p) return notFound('Portfolio');
      return summary(s, p, req.query);
    }],

    // Holdings
    ['GET', rx(P + '\\/holdings'), (req, ctx) => {
      const s = store(ctx);
      const p = findPortfolio(s, req.params[1]);
      if (!p) return notFound('Portfolio');
      return { body: page(clone(s.holdings.filter((h) => h.portfolioId === p.id)), req.query) };
    }],
    ['POST', rx(P + '\\/holdings'), (req, ctx) => {
      const s = store(ctx);
      const p = findPortfolio(s, req.params[1]);
      if (!p) return notFound('Portfolio');
      const b = req.body ?? {};
      const propertyId = Number(b.propertyId);
      if (!Number.isSafeInteger(propertyId) || propertyId <= 0) return bad('propertyId is required.');
      if (s.holdings.some((h) => h.portfolioId === p.id && h.propertyId === propertyId))
        return conflict('This property is already a holding in this portfolio.');
      const now = stamp();
      const h = holding(db.seq.holding++, p.id, propertyId, { financing: financing('UNKNOWN'), occupancy: occupancy('UNKNOWN') }, now, now);
      const error = applyHolding(h, b);
      if (error) {
        db.seq.holding--;
        return bad(error);
      }
      s.holdings.push(h);
      return { status: 201, body: clone(h) };
    }],
    ['PATCH', rx(P + '\\/holdings\\/(\\d+)'), (req, ctx) => {
      const s = store(ctx);
      const h = findHolding(s, req.params[1], req.params[2]);
      if (!h) return notFound('Holding');
      const b = req.body ?? {};
      if (b.propertyId !== undefined && Number(b.propertyId) !== h.propertyId)
        return bad('The property of a holding cannot be changed.');
      const next = clone(h);
      const error = applyHolding(next, b);
      if (error) return bad(error);
      next.updatedAt = stamp();
      Object.assign(h, next);
      return { body: clone(h) };
    }],
    ['DELETE', rx(P + '\\/holdings\\/(\\d+)'), (req, ctx) => {
      const s = store(ctx);
      const h = findHolding(s, req.params[1], req.params[2]);
      if (!h) return notFound('Holding');
      s.holdings = s.holdings.filter((x) => x !== h);
      s.records = s.records.filter((r) => r.holdingId !== h.id);
      return { status: 204 };
    }],

    // Financial records
    ['GET', rx(P + '\\/holdings\\/(\\d+)\\/financial-records'), (req, ctx) => {
      const s = store(ctx);
      const h = findHolding(s, req.params[1], req.params[2]);
      if (!h) return notFound('Holding');
      const from = req.query.get('fromDate');
      const to = req.query.get('toDate');
      const category = req.query.get('category');
      if ((from && !isDate(from)) || (to && !isDate(to))) return bad('Dates must be in YYYY-MM-DD format.');
      if (from && to && from > to) return bad('fromDate must be on or before toDate.');
      if (category && !CATEGORIES.includes(category)) return bad('Unknown category.');
      const list = s.records
        .filter((r) => r.holdingId === h.id)
        .filter((r) => (!from || r.transactionDate >= from) && (!to || r.transactionDate <= to))
        .filter((r) => !category || r.category === category)
        .sort((a, b) => (a.transactionDate === b.transactionDate ? b.id - a.id : a.transactionDate < b.transactionDate ? 1 : -1));
      return { body: page(clone(list), req.query) };
    }],
    ['POST', rx(P + '\\/holdings\\/(\\d+)\\/financial-records'), (req, ctx) => {
      const s = store(ctx);
      const h = findHolding(s, req.params[1], req.params[2]);
      if (!h) return notFound('Holding');
      const now = stamp();
      const r = {
        id: 0, portfolioId: h.portfolioId, holdingId: h.id, category: 'RENT', type: 'INCOME', amount: 0,
        currency: 'USD', transactionDate: TODAY_DATE, periodStart: null, periodEnd: null, description: null,
        source: 'USER_ENTERED', createdAt: now, updatedAt: now,
      };
      const error = applyRecord(r, req.body ?? {}, true);
      if (error) return bad(error);
      r.id = db.seq.record++;
      s.records.push(r);
      return { status: 201, body: clone(r) };
    }],
    ['PATCH', rx(P + '\\/holdings\\/(\\d+)\\/financial-records\\/(\\d+)'), (req, ctx) => {
      const s = store(ctx);
      const h = findHolding(s, req.params[1], req.params[2]);
      if (!h) return notFound('Holding');
      const r = s.records.find((x) => x.holdingId === h.id && x.id === Number(req.params[3]));
      if (!r) return notFound('Financial record');
      const next = clone(r);
      const error = applyRecord(next, req.body ?? {}, false);
      if (error) return bad(error);
      next.updatedAt = stamp();
      Object.assign(r, next);
      return { body: clone(r) };
    }],
    ['DELETE', rx(P + '\\/holdings\\/(\\d+)\\/financial-records\\/(\\d+)'), (req, ctx) => {
      const s = store(ctx);
      const h = findHolding(s, req.params[1], req.params[2]);
      if (!h) return notFound('Holding');
      const r = s.records.find((x) => x.holdingId === h.id && x.id === Number(req.params[3]));
      if (!r) return notFound('Financial record');
      s.records = s.records.filter((x) => x !== r);
      return { status: 204 };
    }],

    // Investor dashboard cards
    ['GET', '/api/dashboards/investor/value-equity-debt', valueEquityDebtCard],
    ['GET', '/api/dashboards/investor/occupancy-exposure', occupancyExposureCard],

    // Calculators
    ['POST', '/api/calculations/mortgage', (req) => mortgage(req.body)],
    ['POST', '/api/calculations/affordability', (req) => affordability(req.body)],
    ['POST', '/api/calculations/investment', (req) => investment(req.body)],

    // Saved scenarios
    ['GET', '/api/scenarios', (req, ctx) => {
      const s = store(ctx);
      const list = [...s.scenarios].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : b.id - a.id));
      return { body: page(clone(list), req.query, 50) };
    }],
    ['POST', '/api/scenarios', (req, ctx) => {
      const s = store(ctx);
      const b = req.body ?? {};
      const name = typeof b.name === 'string' ? b.name.trim() : '';
      if (!name || name.length > 120) return bad('name is required and must be at most 120 characters.');
      if (b.scenarioType !== 'INVESTMENT') return bad('scenarioType must be INVESTMENT.');
      const error = readAssumptions(b.assumptions);
      if (error) return bad(error);
      if (b.propertyId !== undefined && b.propertyId !== null && !(Number.isSafeInteger(b.propertyId) && b.propertyId > 0))
        return bad('propertyId must be a property ID.');
      const now = stamp();
      const sc = {
        id: db.seq.scenario++,
        name,
        scenarioType: 'INVESTMENT',
        inputVersion: 1,
        propertyId: b.propertyId ?? null,
        assumptions: clone(b.assumptions),
        createdAt: now,
        updatedAt: now,
      };
      s.scenarios.push(sc);
      return { status: 201, body: clone(sc) };
    }],
    ['PATCH', /^\/api\/scenarios\/(\d+)$/, (req, ctx) => {
      const s = store(ctx);
      const sc = s.scenarios.find((x) => x.id === Number(req.params[1]));
      if (!sc) return notFound('Scenario');
      const b = req.body ?? {};
      if (b.name !== undefined) {
        const name = typeof b.name === 'string' ? b.name.trim() : '';
        if (!name || name.length > 120) return bad('name must be 1 to 120 characters.');
        sc.name = name;
      }
      if (b.assumptions !== undefined) {
        const error = readAssumptions(b.assumptions);
        if (error) return bad(error);
        sc.assumptions = clone(b.assumptions);
      }
      if (b.propertyId !== undefined) sc.propertyId = b.propertyId ?? null;
      sc.updatedAt = stamp();
      return { body: clone(sc) };
    }],
    ['DELETE', /^\/api\/scenarios\/(\d+)$/, (req, ctx) => {
      const s = store(ctx);
      const sc = s.scenarios.find((x) => x.id === Number(req.params[1]));
      if (!sc) return notFound('Scenario');
      s.scenarios = s.scenarios.filter((x) => x !== sc);
      return { status: 204 };
    }],
  ],
};
