'use strict';
// Catalog fixtures: the public property record and everything read from it. Search, full records,
// parcels, addresses, locations, photos, ZentraValue valuation and predictions, comparables,
// location intelligence, opportunity scores and contact requests.
//
// All data is synthetic (Miami-Dade grid addresses, invented owners and prices). The canonical
// records are _shared.cjs PROPERTIES (ids 42-49); ids 50-66 are extra rows so Explore has a second
// page and the comparables have neighbours. A fact listed in a row's `gaps` is null everywhere this
// module serves it, never 0.

const crypto = require('node:crypto');
const { page, COUNTY, PROPERTIES, TODAY, daysAgo, dateOnly } = require('./_shared.cjs');

const STATE = { id: COUNTY.stateId, code: COUNTY.stateCode, name: 'Florida' };
const COUNTIES = [
  { countyId: 16, countyName: 'Broward', stateCode: 'FL', stateName: 'Florida' },
  { countyId: COUNTY.countyId, countyName: COUNTY.countyName, stateCode: 'FL', stateName: 'Florida' },
  { countyId: 18, countyName: 'Palm Beach', stateCode: 'FL', stateName: 'Florida' },
];
const day = (n) => dateOnly(daysAgo(n));
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const r1000 = (n) => Math.round(n / 1000) * 1000;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const notFound = (what) => ({ status: 404, body: { status: 404, error: 'Not Found', message: what } });
const badRequest = (message) => ({ status: 400, body: { status: 400, error: 'Bad Request', message } });

// ---- model run constants ---------------------------------------------------------------------
const MODEL = 'zv-17.3';
const PREDICTION_DATE = '2026-11-01';
const DATA_THROUGH = '2026-10-31';
const RUN_ID = 'zv-run-2026-11-02';
const RUN_CREATED = '2026-11-03T06:12:41Z';
const AS_OF = day(4); // latest county sale record loaded
const MARKET_OUTLOOK_1Y = 2.4; // county-wide, same for every property in a run
const SCORE_VERSION = 'opportunity-v1'; // same version and factors as account.cjs /opportunities
const SCORED_IN_EMPTY = new Set([42, 43, 45]); // a new workspace: only these are scored yet
const COMPS_IN_EMPTY = new Set([42, 43]);

// ---- areas -------------------------------------------------------------------------------------
const AREAS = {
  grove: { neighborhood: 6230, name: 'Silver Bluff', municipality: 'Miami', muniZone: 'T3-R', muniZoneDesc: 'Sub-Urban Transect Zone - Restricted', ppsf: 540, typSqft: 1650, typLot: 6100, typYear: 1952, g1: 3.3 },
  day: { neighborhood: 6240, name: 'Coconut Grove North', municipality: 'Miami', muniZone: 'T3-R', muniZoneDesc: 'Sub-Urban Transect Zone - Restricted', ppsf: 660, typSqft: 2000, typLot: 7200, typYear: 1945, g1: 3.0 },
  hialeah: { neighborhood: 2830, name: 'Hialeah West', municipality: 'Hialeah', muniZone: 'R-3', muniZoneDesc: 'Multiple-Family District', ppsf: 258, typSqft: 950, typLot: 7500, typYear: 1975, g1: 2.0 },
  mg: { neighborhood: 3610, name: 'Norwood', municipality: 'Miami Gardens', muniZone: 'R-15', muniZoneDesc: 'Single-Family Residential', ppsf: 335, typSqft: 1350, typLot: 7500, typYear: 1962, g1: 2.8 },
  lr: { neighborhood: 1240, name: 'Little River', municipality: 'Miami', muniZone: 'T3-O', muniZoneDesc: 'Sub-Urban Transect Zone - Open', ppsf: 390, typSqft: 1900, typLot: 7000, typYear: 1952, g1: 3.6 },
  sd: { neighborhood: 8820, name: 'South Miami Heights', municipality: 'Unincorporated County', muniZone: 'RU-1', muniZoneDesc: 'Single-Family Residential', ppsf: 308, typSqft: 1850, typLot: 7900, typYear: 1990, g1: 2.4 },
  mb: { neighborhood: 5110, name: 'South Beach - Collins', municipality: 'Miami Beach', muniZone: 'RM-3', muniZoneDesc: 'Residential Multifamily, High Intensity', ppsf: 715, typSqft: 950, typLot: null, typYear: 2000, g1: 1.5 },
};
const DOR = {
  house: { code: '0101', desc: 'Single family', zone: '0100', zoneDesc: 'SINGLE FAMILY - GENERAL', cls: 'house' },
  duplex: { code: '0802', desc: 'Duplex', zone: '0200', zoneDesc: 'DUPLEX - GENERAL', cls: 'multi' },
  condo: { code: '0407', desc: 'Condominium', zone: '3900', zoneDesc: 'MULTI-FAMILY - HIGH DENSITY', cls: 'condo' },
  vacant: { code: '0081', desc: 'Vacant residential land', zone: '0100', zoneDesc: 'SINGLE FAMILY - GENERAL', cls: null },
  reference: { code: '0000', desc: 'Condominium reference folio', zone: '3900', zoneDesc: 'MULTI-FAMILY - HIGH DENSITY', cls: null },
};

// Sale qualification wording follows the county's codes; only the first two count as market sales.
const Q = 'Qual by exam of deed';
const Q2 = 'Sales which are qualified';
const NQ = 'Corrective, tax or QCD; min consideration';
const NQ2 = 'Not exposed to open-market; atypical motivation';
const QUALIFIED = new Set([Q, Q2]);
const sale = (saleDate, salePrice, saleType, instrumentNumber) => ({ saleDate, salePrice, saleType, instrumentNumber });
const owner = (name, percentageOwn, o = {}) => ({
  name,
  description: o.description ?? (percentageOwn === 100 ? 'Sole owner' : 'Joint owner'),
  role: o.role ?? 'Owner',
  percentageOwn,
  shortDescription: o.short ?? (percentageOwn === 100 ? 'SOLE' : 'JT'),
  tenancyCd: o.tenancy ?? null,
  marriedFlag: o.married ?? false,
  message: null,
});
const xf = (description, useCode, units, actualYearBuilt, percentCondition, depreciatedValue) => ({ description, useCode, units, actualYearBuilt, percentCondition, depreciatedValue });

// Per-record detail the shared identities do not carry.
const DETAIL = {
  42: { area: 'grove', dor: 'house', sub: 'BLUFF PARK SUB', halfBaths: 0, floors: 1,
    owners: [owner('MARISOL A HERRERA', 50, { tenancy: 'TE', description: 'Tenancy by the entirety', short: 'TBE', married: true }), owner('DANIEL J HERRERA', 50, { tenancy: 'TE', description: 'Tenancy by the entirety', short: 'TBE', married: true })],
    sales: [sale('2008-06-20', 410000, Q, '26451-3302'), sale('2019-06-14', 612000, Q, '31480-2219')],
    features: [xf("Pool 8' res AVG 3-8' dpth, tile 250-649 sf", '0080', 1, 1978, 64, 18400), xf('Patio - Concrete slab', '0034', 240, 1978, 55, 1310), xf('Chain-link fence 4-5 ft high', '0100', 180, null, null, 920), xf('Wood deck', '0280', 120, 2015, 82, null)],
    images: 3, homestead: false },
  43: { area: 'grove', dor: 'house', sub: 'BLUFF PARK SUB', halfBaths: 0, floors: 1,
    owners: [owner('RIVERA FAMILY REVOCABLE TRUST', 100, { role: 'Trustee', description: 'Trust', short: 'TR' })],
    sales: [sale('2001-04-02', 189000, Q, '19603-2210'), sale('2015-08-21', 455000, Q2, '29745-0388'), sale(day(2101), 0, NQ, '32388-0915')],
    features: [xf('Patio - Concrete slab', '0034', 180, 1962, 50, 940), xf('Chain-link fence 4-5 ft high', '0100', 150, null, 45, 610)],
    images: 1, homestead: true },
  44: { area: 'day', dor: 'house', sub: 'DAY AVENUE ESTATES', halfBaths: 1, floors: 2,
    owners: [owner('DAY AVENUE 3120 LLC', 50, { description: 'Corporation', short: 'CORP' }), owner('PRIYA S NAIR', 50)],
    sales: [sale('1997-08-29', 265000, Q, '17781-0446'), sale('2014-05-09', 720000, Q2, '29140-3319'), sale('2021-09-02', 1180000, Q, '32740-1166')],
    features: [xf("Pool 8' res BETTER 3-8' dpth, tile 650-1000 sf", '0081', 1, 1996, 71, 31200), xf('Screen enclosure - aluminum', '0140', 1100, 1996, 60, 4820), xf('Wall - CBS unreinforced', '0210', 210, 1938, 35, 2150), xf('Patio - Brick, tile, flagstone', '0036', 420, 1996, 66, 3980)],
    images: 2, homestead: true },
  45: { area: 'hialeah', dor: 'condo', sub: 'PALM WEST CONDO', halfBaths: 0, floors: 1, parentFolio: '3022320060001',
    owners: [owner('YAMILET CASTRO', 100)],
    sales: [], features: [], images: 1, homestead: true, footprint: [42, 28] },
  46: { area: 'mg', dor: 'house', sub: 'NORWOOD HEIGHTS 2ND ADDN', halfBaths: 0, floors: 1,
    owners: [owner('NORWOOD 18402 LLC', null, { description: 'Corporation', short: 'CORP' })],
    sales: [sale('1999-02-12', 78000, Q, '18490-1173'), sale('2012-09-28', 96500, NQ2, '28297-0552'), sale(day(2008), 255000, Q, '32514-3390'), sale('2023-04-20', 389000, Q, '33671-0904')],
    features: [xf('Chain-link fence 4-5 ft high', '0100', 300, 1975, 40, 1080), xf('Carport - aluminum', '0150', 200, 1988, 30, 960)],
    images: 0, homestead: false },
  47: { area: 'lr', dor: 'duplex', sub: 'LITTLE RIVER GARDENS', halfBaths: 0, floors: 1, units: 2,
    owners: [owner('NORTHEAST 74 HOLDINGS LLC', 100, { description: 'Corporation', short: 'CORP' })],
    sales: [sale('2005-01-07', 520000, Q, '23011-4480'), sale('2009-11-16', 100, NQ, '27101-0217'), sale('2018-02-12', 735000, Q2, '30865-1736')],
    features: [xf('Patio - Concrete slab', '0034', 360, 1948, 40, 1480), xf('Wall - CBS unreinforced', '0210', 140, 1960, 45, 1210)],
    images: 2, homestead: false },
  48: { area: 'sd', dor: 'house', sub: 'SOUTH RIDGE ESTATES', halfBaths: null, floors: 1,
    owners: [owner('KEVIN R MOODIE', 100)],
    sales: [sale('2002-07-19', 168000, Q, '20511-2391'), sale('2017-02-03', 335000, Q2, '30410-0033'), sale(day(340), 566000, Q, '34877-1904')],
    features: [xf("Pool 6' res BETTER 3-6' dpth, tile 250-649 sf", '0079', 1, 2003, 74, 14900), xf('Screen enclosure - aluminum', '0140', 780, 2003, 62, 3010), xf('Patio - Concrete slab', '0034', 300, null, null, null)],
    images: 0, homestead: true },
  49: { area: 'mb', dor: 'condo', sub: 'COLLINS TOWER CONDO', halfBaths: 0, floors: 1, parentFolio: '0232060010001',
    owners: [owner('COLLINS 1504 LLC', 100, { description: 'Corporation', short: 'CORP' })],
    sales: [sale('2009-03-13', 410000, Q, '26790-2245'), sale('2020-06-26', 445000, Q2, '31977-3010'), sale('2024-11-05', 545000, Q, '34470-0881')],
    features: [], images: 1, homestead: false, parcel: false },
};

// Extra catalog rows (search, comparables and the parcel map). Same shape as PROPERTIES.
const EXTRA = [
  { id: 50, folio: '0141370120440', address: '2833 SW 27th Ter', city: 'Miami', zip: '33133', lat: 25.7424, lng: -80.2369, beds: 3, baths: 1, sqft: 1390, lotSqft: 6000, yearBuilt: '1949', use: 'Single family', gaps: [],
    d: { area: 'grove', dor: 'house', sub: 'BLUFF PARK SUB', owners: [owner('GLORIA M PEÑA', 100)], sales: [sale('1994-10-21', 98000, Q, '16541-0912'), sale(day(365), 748000, Q, '34720-3318')], features: [xf('Patio - Concrete slab', '0034', 160, 1971, 48, 790)], images: 1 } },
  { id: 51, folio: '0141370120470', address: '2875 SW 27th Ter', city: 'Miami', zip: '33133', lat: 25.7425, lng: -80.2387, beds: 3, baths: 2, sqft: 1655, lotSqft: 6150, yearBuilt: '1953', use: 'Single family', gaps: [],
    d: { area: 'grove', dor: 'house', sub: 'BLUFF PARK SUB', owners: [owner('THOMAS K WREN', 50), owner('ALICIA WREN', 50)], sales: [sale('2011-12-02', 312000, Q, '27920-1180'), sale(day(150), 905000, Q, '35140-2201')], features: [xf("Pool 8' res AVG 3-8' dpth, tile 250-649 sf", '0080', 1, 2012, 80, 21600)], images: 2 } },
  { id: 52, folio: '0141370130120', address: '2836 SW 28th St', city: 'Miami', zip: '33133', lat: 25.7409, lng: -80.2371, beds: 2, baths: 1, sqft: 1120, lotSqft: 5600, yearBuilt: '1947', use: 'Single family', gaps: [],
    d: { area: 'grove', dor: 'house', sub: 'BLUFF PARK SUB', owners: [owner('BLUFF 2836 LLC', 100, { description: 'Corporation', short: 'CORP' })], sales: [sale(day(640), 615000, Q, '34401-0566')], features: [], images: 1 } },
  { id: 53, folio: '0141160290290', address: '3045 Day Ave', city: 'Miami', zip: '33133', lat: 25.7336, lng: -80.2428, beds: 3, baths: 2, sqft: 1980, lotSqft: 7200, yearBuilt: null, use: 'Single family', gaps: ['yearBuilt'],
    d: { area: 'day', dor: 'house', sub: 'DAY AVENUE ESTATES', owners: [owner('PRISCILLA O DUNN', 100)], sales: [sale('2006-08-04', 640000, Q, '24822-3007'), sale(day(300), 1340000, Q, '34951-1740')], features: [xf('Wall - CBS unreinforced', '0210', 180, null, null, 1720)], images: 1 } },
  { id: 54, folio: '0141370150270', address: '2900 SW 28th Ter', city: 'Miami', zip: '33133', lat: 25.7395, lng: -80.2392, beds: 4, baths: 3, sqft: 2650, lotSqft: 8800, yearBuilt: '2016', use: 'Single family', gaps: [],
    d: { area: 'grove', dor: 'house', sub: 'BLUFF PARK SUB 2ND ADDN', halfBaths: 1, floors: 2, owners: [owner('JONAH S ALTMAN', 100)], sales: [sale('2016-09-30', 1250000, Q, '30245-2714'), sale(day(520), 1520000, Q, '34560-0298')], features: [xf("Pool 8' res BETTER 3-8' dpth, tile 650-1000 sf", '0081', 1, 2016, 88, 38800), xf('Patio - Brick, tile, flagstone', '0036', 640, 2016, 86, 8120)], images: 3 } },
  { id: 55, folio: '0141370120380', address: null, city: 'Miami', zip: '33133', lat: 25.7419, lng: -80.2398, beds: null, baths: null, sqft: null, lotSqft: 5800, yearBuilt: null, use: 'Vacant residential land', gaps: ['address', 'beds', 'baths', 'sqft', 'yearBuilt', 'valuation', 'opportunityScore', 'location'],
    d: { area: 'grove', dor: 'vacant', sub: 'BLUFF PARK SUB', floors: null, owners: [owner('BLUFF LOT PARTNERS LLC', 100, { description: 'Corporation', short: 'CORP' })], sales: [sale(day(950), 640000, Q2, '33980-2675')], features: [], images: 0, homestead: false } },
  { id: 56, folio: '3022320070050', address: '1480 W 44th Pl, Unit 105', city: 'Hialeah', zip: '33012', lat: 25.8594, lng: -80.311, beds: 2, baths: 1, sqft: 890, lotSqft: null, yearBuilt: '1986', use: 'Condominium', gaps: ['lotSqft'],
    d: { area: 'hialeah', dor: 'condo', sub: 'PALM WEST II CONDO', parentFolio: '3022320070001', owners: [owner('ROBERTO L SOSA', 100)], sales: [sale('2013-07-12', 88000, Q, '28710-0420'), sale(day(215), 236000, Q, '35071-1913')], features: [], images: 1, footprint: [40, 26] } },
  { id: 57, folio: '3022310150210', address: '760 W 42nd St', city: 'Hialeah', zip: '33012', lat: 25.8552, lng: -80.301, beds: 3, baths: 2, sqft: 1450, lotSqft: 7500, yearBuilt: '1958', use: 'Single family', gaps: [],
    d: { area: 'hialeah', dor: 'house', sub: 'WEST HIALEAH HEIGHTS', ppsf: 350, owners: [owner('MIRTA E VALDES', 100)], sales: [sale('2004-03-26', 219000, Q, '22170-3381'), sale(day(400), 512000, Q, '34681-0145')], features: [xf('Chain-link fence 4-5 ft high', '0100', 260, 1980, 35, 760)], images: 1 } },
  { id: 58, folio: '3059010042100', address: '640 NW 184th St', city: 'Miami Gardens', zip: '33169', lat: 25.9425, lng: -80.2095, beds: 3, baths: 2, sqft: 1340, lotSqft: 7600, yearBuilt: '1962', use: 'Single family', gaps: [],
    d: { area: 'mg', dor: 'house', sub: 'NORWOOD HEIGHTS 2ND ADDN', owners: [owner('LATOYA M GREENE', null), owner('JAMAL R GREENE', null)], sales: [sale('2008-01-25', 190000, NQ2, '26180-4012'), sale(day(280), 428000, Q, '34990-2516')], features: [], images: 1 } },
  { id: 59, folio: '3059010040580', address: '18330 NW 8th Ave', city: 'Miami Gardens', zip: '33169', lat: 25.9398, lng: -80.2121, beds: 4, baths: 2, sqft: 1490, lotSqft: 7500, yearBuilt: '1964', use: 'Single family', gaps: [],
    d: { area: 'mg', dor: 'house', sub: 'NORWOOD HEIGHTS', owners: [owner('EMMANUEL JOSEPH', 100)], sales: [sale(day(480), 465000, Q, '34530-0917')], features: [xf('Carport - aluminum', '0150', 220, 1990, 28, 880)], images: 0 } },
  { id: 60, folio: '0131180190030', address: '620 NE 74th St', city: 'Miami', zip: '33138', lat: 25.8418, lng: -80.1866, beds: 3, baths: 2, sqft: 1720, lotSqft: 6800, yearBuilt: '1951', use: 'Single family', gaps: [],
    d: { area: 'lr', dor: 'house', sub: 'LITTLE RIVER GARDENS', ppsf: 500, owners: [owner('SOFIA BERNAL', 50), owner('IAN BERNAL', 50)], sales: [sale('2015-06-19', 410000, Q, '29680-1144'), sale(day(190), 865000, Q, '35110-0730')], features: [xf('Patio - Concrete slab', '0034', 220, 1951, 42, 880)], images: 1 } },
  { id: 61, folio: '0131180200110', address: '7301 NE 6th Ct', city: 'Miami', zip: '33138', lat: 25.841, lng: -80.1878, beds: 4, baths: 2, sqft: 2040, lotSqft: 7000, yearBuilt: '1956', use: 'Duplex', gaps: [],
    d: { area: 'lr', dor: 'duplex', sub: 'LITTLE RIVER GARDENS', units: 2, owners: [owner('SIXTH COURT RENTALS LLC', 100, { description: 'Corporation', short: 'CORP' })], sales: [sale(day(610), 890000, Q, '34440-2287')], features: [], images: 1, homestead: false } },
  { id: 62, folio: '0232060010870', address: '1700 Collins Ave, Unit 1101', city: 'Miami Beach', zip: '33139', lat: 25.7929, lng: -80.1291, beds: 2, baths: 2, sqft: 1180, lotSqft: null, yearBuilt: '2008', use: 'Condominium', gaps: ['lotSqft'],
    d: { area: 'mb', dor: 'condo', sub: 'COLLINS TOWER CONDO', parentFolio: '0232060010001', owners: [owner('VALENTINA ROSSI', 100)], sales: [sale('2010-02-19', 590000, Q, '27190-0611'), sale(day(120), 795000, Q, '35190-1458')], features: [], images: 1, parcel: false, homestead: false } },
  { id: 63, folio: '0232060010420', address: '1700 Collins Ave, Unit 702', city: 'Miami Beach', zip: '33139', lat: 25.7929, lng: -80.1291, beds: 1, baths: 1, sqft: 760, lotSqft: null, yearBuilt: '2008', use: 'Condominium', gaps: ['lotSqft'],
    d: { area: 'mb', dor: 'condo', sub: 'COLLINS TOWER CONDO', parentFolio: '0232060010001', owners: [owner('702 COLLINS HOLDINGS LLC', 100, { description: 'Corporation', short: 'CORP' })], sales: [sale(day(330), 512000, Q, '34890-0377')], features: [], images: 1, parcel: false, homestead: false } },
  { id: 64, folio: '0232060011650', address: '1700 Collins Ave, Unit 2203', city: 'Miami Beach', zip: '33139', lat: 25.7929, lng: -80.1291, beds: 2, baths: 2, sqft: 1240, lotSqft: null, yearBuilt: '2008', use: 'Condominium', gaps: ['lotSqft'],
    d: { area: 'mb', dor: 'condo', sub: 'COLLINS TOWER CONDO', parentFolio: '0232060010001', owners: [owner('HEINRICH BAUER', 100)], sales: [sale(day(560), 905000, Q, '34510-2093')], features: [], images: 0, parcel: false, homestead: false } },
  { id: 65, folio: '3040190110550', address: '11940 SW 186th St', city: 'Miami', zip: '33177', lat: 25.6014, lng: -80.3895, beds: 3, baths: 2, sqft: 1890, lotSqft: 7900, yearBuilt: '1987', use: 'Single family', gaps: [],
    d: { area: 'sd', dor: 'house', sub: 'SOUTH RIDGE ESTATES', owners: [owner('MARCUS T ELLISON', 100)], sales: [sale('2009-05-29', 205000, Q, '26890-1302'), sale(day(95), 585000, Q, '35215-0446')], features: [xf('Patio - Concrete slab', '0034', 280, 1987, 58, 1290)], images: 1 } },
  { id: 66, folio: '0232060010001', address: '1700 Collins Ave', city: 'Miami Beach', zip: '33139', lat: 25.7929, lng: -80.1291, beds: null, baths: null, sqft: null, lotSqft: 41200, yearBuilt: '2008', use: 'Condominium reference folio', gaps: ['beds', 'baths', 'sqft', 'valuation', 'opportunityScore', 'location', 'saleHistory'],
    d: { area: 'mb', dor: 'reference', sub: 'COLLINS TOWER CONDO', floors: 32, units: 4, owners: [], sales: [], features: [], images: 0, homestead: false, footprint: [64, 46] } },
];

// ---- record set ------------------------------------------------------------------------------
const ROWS = [...PROPERTIES.map((p) => ({ ...p, d: DETAIL[p.id] })), ...EXTRA].map((r) => {
  const d = r.d;
  const area = AREAS[d.area];
  const dor = DOR[d.dor];
  const sales = d.sales.map((s, i) => ({ id: r.id * 100 + i + 1, ...s }));
  const qualified = sales.filter((s) => QUALIFIED.has(s.saleType) && s.salePrice > 0);
  return { ...r, d, area, dor, sales, lastQualified: qualified.at(-1) ?? null };
});
const BY_ID = new Map(ROWS.map((r) => [r.id, r]));
const BY_FOLIO = new Map(ROWS.map((r) => [r.folio, r]));
const gap = (r, key) => r.gaps.includes(key);
/** The row's value for a fact, or null when the backend does not have it. */
const fact = (r, key) => (gap(r, key) ? null : r[key] ?? null);
const yearOf = (r) => (fact(r, 'yearBuilt') ? Number(r.yearBuilt) : null);
const rowFor = (id) => BY_ID.get(Number(id)) ?? null;
const homestead = (r) => r.d.homestead ?? true;

function searchItem(r) {
  return {
    id: r.id,
    folio: r.folio,
    countyId: COUNTY.countyId,
    countyName: COUNTY.countyName,
    stateCode: STATE.code,
    stateName: STATE.name,
    address: fact(r, 'address'),
    city: r.city,
    zip: r.zip,
    dorCode: r.dor.code,
    propertyType: r.dor.desc,
    bedrooms: fact(r, 'beds'),
    bathrooms: fact(r, 'baths'),
    livingAreaSqft: fact(r, 'sqft'),
    lotSize: fact(r, 'lotSqft'),
    yearBuilt: fact(r, 'yearBuilt'),
    neighborhood: String(r.area.neighborhood),
    neighborhoodDescription: r.area.name,
  };
}

// ---- full record -------------------------------------------------------------------------------
const DIRS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
const SUFFIXES = new Set(['St', 'Ter', 'Pl', 'Ave', 'Ct', 'Dr', 'Rd', 'Blvd', 'Way']);
function address(r) {
  const full = fact(r, 'address');
  const base = { id: r.id * 10 + 1, buildingNumber: 1, city: r.city, houseNumberSuffix: '', message: null, streetSuffixDirection: '', zip: r.zip };
  if (!full) return { ...base, address: null, streetName: null, streetNumber: null, streetPrefix: null, streetSuffix: null, unit: null };
  const [street, unitPart] = full.split(', Unit ');
  const t = street.split(' ');
  const number = Number(t.shift());
  const prefix = DIRS.has(t[0]) ? t.shift() : '';
  const suffix = SUFFIXES.has(t.at(-1)) ? t.pop() : '';
  return { ...base, address: full, streetName: t.join(' '), streetNumber: number, streetPrefix: prefix, streetSuffix: suffix, unit: unitPart ?? '' };
}

/** Assessed market value for a roll year; roughly 85% of the model's value, stepped back per year. */
function assessmentsOf(r) {
  if (r.d.dor === 'reference') return [];
  const lot = fact(r, 'lotSqft');
  const base = valueBasis(r) * 0.85;
  const xfValue = r.d.features.reduce((s, f) => s + (f.depreciatedValue ?? 0), 0);
  return [2026, 2025, 2024].map((year, i) => {
    const total = r1000(base / Math.pow(1.065, i));
    const land = r.d.dor === 'condo' ? 0 : r1000(Math.min(total * (r.d.dor === 'vacant' ? 1 : 0.68), (lot ?? 0) * r.area.ppsf * 0.75));
    const xfv = r.d.dor === 'vacant' ? 0 : Math.round(xfValue / Math.pow(1.02, i));
    const building = r.d.dor === 'vacant' ? 0 : Math.max(0, total - land - xfv);
    const assessed = r1000(homestead(r) ? total * 0.61 / Math.pow(1.03, i) : total * 0.9 / Math.pow(1.1, i));
    return { id: r.id * 10 + i, assessedValue: Math.min(assessed, total), buildingOnlyValue: building, extraFeatureValue: xfv, landValue: land, totalValue: total, year, message: null };
  });
}
function taxesOf(r, assessments) {
  return assessments.slice(0, 2).map((a, i) => {
    const hx = homestead(r) ? 50000 : 0;
    const sx = homestead(r) ? 25000 : 0;
    const city = r.area.municipality === 'Unincorporated County';
    return {
      id: r.id * 10 + i,
      year: a.year,
      message: null,
      cityExemptionValue: city ? null : hx,
      cityTaxableValue: city ? null : Math.max(0, a.assessedValue - hx),
      countyExemptionValue: hx,
      countyTaxableValue: Math.max(0, a.assessedValue - hx),
      regionalExemptionValue: hx,
      regionalTaxableValue: Math.max(0, a.assessedValue - hx),
      schoolExemptionValue: sx,
      schoolTaxableValue: Math.max(0, a.assessedValue - sx),
    };
  });
}
function buildingsOf(r) {
  const sqft = fact(r, 'sqft');
  if (!sqft) return [];
  const year = yearOf(r);
  const a = assessmentsOf(r)[0];
  return [{
    id: r.id * 10 + 1, actual: year, actualArea: Math.round(sqft * 1.12), adjustedBasePrice: Math.round(r.area.ppsf * 0.42),
    buildingNo: 1, depreciatedValue: a ? a.buildingOnlyValue : null, effective: year ? Math.min(2026, year + 22) : null,
    effectiveArea: Math.round(sqft * 1.04), grossArea: Math.round(sqft * 1.2), heatedArea: sqft, message: null, percentComp: 100,
    percentageGood: year ? clamp(100 - (2026 - year) * 0.55, 40, 100) : null, replacementCostNew: Math.round(sqft * r.area.ppsf * 0.45),
    rollYear: 2026, segNo: 1, totalAdjustedPoints: 112, traversePoints: 'U38R42D38L42', improvementModelDesc: r.d.dor === 'condo' ? 'Condominium unit' : 'Residential',
  }];
}
function landsOf(r) {
  const lot = fact(r, 'lotSqft');
  if (!lot || r.d.dor === 'condo') return [];
  const depth = lot > 9000 ? 130 : 125;
  const a = assessmentsOf(r)[0];
  return [{
    id: r.id * 10 + 1, adjustedUnitPrice: a ? r2(a.landValue / lot) : null, calculatedValue: a ? a.landValue : null, depth,
    frontFeet: Math.round(lot / depth), landUse: 'GENERAL', landlineType: 'C', message: null, muniZone: r.area.muniZone,
    muniZoneDescription: r.area.muniZoneDesc, paZoneDescription: r.dor.zoneDesc, percentCondition: 1, rollYear: 2026,
    totalAdjustments: 1, unitType: 'Square Ft.', units: lot, useCode: '00', zone: r.dor.zone,
  }];
}

// ---- parcels -----------------------------------------------------------------------------------
const M_PER_DEG_LAT = 111320;
function parcelOf(r) {
  if (r.d.parcel === false) return null; // condo units: the tower's outline belongs to the reference folio
  const lot = fact(r, 'lotSqft');
  let [front, depth] = r.d.footprint ?? [lot / 125 * 0.3048, 125 * 0.3048];
  const street = (fact(r, 'address') ?? '').split(',')[0];
  const northSouthStreet = /\b(Ave|Ct)\b/.test(street);
  if (northSouthStreet) [front, depth] = [depth, front];
  const dx = front / 2 / (M_PER_DEG_LAT * Math.cos((r.lat * Math.PI) / 180));
  const dy = depth / 2 / M_PER_DEG_LAT;
  const f = (n) => Math.round(n * 1e7) / 1e7;
  const ring = [[r.lng - dx, r.lat - dy], [r.lng + dx, r.lat - dy], [r.lng + dx, r.lat + dy], [r.lng - dx, r.lat + dy], [r.lng - dx, r.lat - dy]].map(([x, y]) => [f(x), f(y)]);
  return {
    id: 90000 + r.id,
    folio: r.folio,
    propertyId: r.id,
    countyId: COUNTY.countyId,
    stateCode: STATE.code,
    lotSize: lot,
    geom: { type: 'MultiPolygon', coordinates: [[ring]], crs: { type: 'name', properties: { name: 'EPSG:4326' } } },
  };
}
const PARCELS = ROWS.map(parcelOf).filter(Boolean);

function property(r) {
  const assessments = assessmentsOf(r);
  const parcel = parcelOf(r);
  const sqft = fact(r, 'sqft');
  return {
    countyId: COUNTY.countyId,
    countyName: COUNTY.countyName,
    stateId: STATE.id,
    stateCode: STATE.code,
    stateName: STATE.name,
    id: r.id,
    folio: r.folio,
    parentFolio: r.d.parentFolio ?? null,
    bathroomCount: fact(r, 'baths'),
    bedroomCount: fact(r, 'beds'),
    halfBathroomCount: gap(r, 'baths') ? null : sqft ? r.d.halfBaths ?? 0 : null,
    buildingActualArea: sqft,
    buildingBaseArea: sqft ? Math.round(sqft * 0.98) : null,
    buildingEffectiveArea: sqft ? Math.round(sqft * 1.04) : null,
    buildingGrossArea: sqft ? Math.round(sqft * 1.2) : null,
    buildingHeatedArea: sqft,
    dorCode: r.dor.code,
    dorDescription: r.dor.desc,
    neighborhood: r.area.neighborhood,
    neighborhoodDescription: r.area.name,
    lotSize: fact(r, 'lotSqft'),
    floorCount: r.d.floors === undefined ? 1 : r.d.floors,
    unitCount: r.d.units ?? (sqft ? 1 : null),
    yearBuilt: fact(r, 'yearBuilt'),
    municipality: r.area.municipality,
    subdivision: r.d.sub,
    primaryZone: r.dor.zone,
    primaryZoneDescription: r.dor.zoneDesc,
    status: 'Active',
    showCurrentValuesFlag: 'Y',
    message: null,
    address: address(r),
    owners: r.d.owners.map((o, i) => ({ id: r.id * 10 + i, ...o })),
    assessments,
    buildings: buildingsOf(r),
    lands: landsOf(r),
    sales: gap(r, 'saleHistory') ? [] : r.sales.map((s) => ({ ...s })),
    taxes: taxesOf(r, assessments),
    parcels: parcel ? [parcel] : [],
  };
}

// ---- search ------------------------------------------------------------------------------------
const ABBR = { street: 'st', avenue: 'ave', av: 'ave', terrace: 'ter', place: 'pl', court: 'ct', drive: 'dr', road: 'rd', boulevard: 'blvd', northwest: 'nw', southwest: 'sw', northeast: 'ne', southeast: 'se', north: 'n', south: 's', east: 'e', west: 'w', unit: '', apt: '', apartment: '', ste: '', fl: '', florida: '' };
function tokens(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[#,.]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^(\d+)(st|nd|rd|th)$/, '$1'))
    .map((t) => (t in ABBR ? ABBR[t] : t))
    .filter(Boolean);
}
/** Every typed token is the start of some token of the address line (so partial typing matches). */
function matchesAddress(r, raw) {
  const want = tokens(raw);
  if (!want.length) return false;
  const have = tokens([fact(r, 'address'), r.city, r.zip].filter(Boolean).join(' '));
  return want.every((w) => have.some((h) => h.startsWith(w)));
}
const num = (q, k) => {
  const v = q.get(k);
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const SORT_KEYS = { id: 'id', bedrooms: 'bedrooms', bathrooms: 'bathrooms', livingAreaSqft: 'livingAreaSqft', lotSize: 'lotSize', yearBuilt: 'yearBuilt' };
function search(req) {
  const q = req.query;
  const s = (k) => (q.get(k) ?? '').trim();
  let items = ROWS.map((r) => ({ r, item: searchItem(r) }));
  const county = num(q, 'countyId');
  if (county !== null) items = items.filter(({ item }) => item.countyId === county);
  if (s('state')) items = items.filter(({ item }) => item.stateCode.toLowerCase() === s('state').toLowerCase());
  if (s('city')) items = items.filter(({ item }) => (item.city ?? '').toLowerCase().includes(s('city').toLowerCase()));
  if (s('zip')) items = items.filter(({ item }) => item.zip === s('zip'));
  if (s('address')) items = items.filter(({ r }) => matchesAddress(r, s('address')));
  if (s('neighborhood')) {
    const n = s('neighborhood').toLowerCase();
    items = items.filter(({ item }) => item.neighborhood === n || (item.neighborhoodDescription ?? '').toLowerCase().includes(n));
  }
  if (s('propertyType')) items = items.filter(({ item }) => (item.propertyType ?? '').toLowerCase() === s('propertyType').toLowerCase());
  if (s('dorCode')) items = items.filter(({ item }) => item.dorCode === s('dorCode'));
  const ranges = [['Bedrooms', 'bedrooms'], ['Bathrooms', 'bathrooms'], ['LivingAreaSqft', 'livingAreaSqft'], ['YearBuilt', 'yearBuilt'], ['LotSize', 'lotSize']];
  for (const [suffix, key] of ranges) {
    const lo = num(q, 'min' + suffix), hi = num(q, 'max' + suffix);
    // SQL semantics: a range filter never matches an unknown value.
    if (lo !== null) items = items.filter(({ item }) => item[key] !== null && Number(item[key]) >= lo);
    if (hi !== null) items = items.filter(({ item }) => item[key] !== null && Number(item[key]) <= hi);
  }
  const [minLon, minLat, maxLon, maxLat] = ['minLon', 'minLat', 'maxLon', 'maxLat'].map((k) => num(q, k));
  if ([minLon, minLat, maxLon, maxLat].every((v) => v !== null))
    items = items.filter(({ r }) => r.lng >= minLon && r.lng <= maxLon && r.lat >= minLat && r.lat <= maxLat);
  const sortBy = SORT_KEYS[s('sortBy')] ?? 'id';
  const desc = s('direction').toLowerCase() === 'desc';
  // As PropertySearchServiceImpl on backend master: unknown values last in either direction.
  items.sort((a, b) => {
    const x = a.item[sortBy], y = b.item[sortBy];
    if (x === null || y === null) return x === y ? a.item.id - b.item.id : x === null ? 1 : -1;
    const c = Number(x) - Number(y);
    return (desc ? -c : c) || a.item.id - b.item.id;
  });
  const size = Math.min(100, Math.max(1, num(q, 'size') ?? 20));
  const params = new URLSearchParams({ page: String(Math.max(0, num(q, 'page') ?? 0)), size: String(size) });
  return { body: page(items.map((x) => x.item), params, 20) };
}

// ---- valuation model ---------------------------------------------------------------------------
function supportFor(r, ctx) {
  if (gap(r, 'valuation')) {
    const reasons = {
      46: [{ code: 'RECORD_CONFLICT', message: 'The recorded living area conflicts with the building sketch. The record is held back until the county corrects it.' }],
      49: [{ code: 'CONDO_HOTEL', message: 'Units in condo-hotel buildings are not modelled: their prices depend on rental-program terms the model cannot see.' }],
      55: [{ code: 'UNSUPPORTED_PROPERTY_TYPE', message: 'Vacant land is not modelled.' }],
      66: [{ code: 'REFERENCE_FOLIO', message: 'A reference folio has no market value of its own. Each unit is valued separately.' }],
    };
    return { status: 'unsupported', reasons: reasons[r.id] ?? [{ code: 'NOT_MODELLED', message: 'This property is not covered by the current model.' }] };
  }
  if (ctx.flags.empty && !SCORED_IN_EMPTY.has(r.id))
    return { status: 'unsupported', reasons: [{ code: 'NOT_SCORED_YET', message: 'This property has not been scored by the current model run yet.' }] };
  const reasons = [];
  if (!r.lastQualified) reasons.push({ code: 'NO_SALE_HISTORY', message: 'No qualified sale is on record, so the estimate relies on the home\'s attributes and nearby sales.' });
  if (gap(r, 'beds') || gap(r, 'baths') || gap(r, 'yearBuilt'))
    reasons.push({ code: 'MISSING_ATTRIBUTES', message: `The county record is missing ${[gap(r, 'beds') && 'bedrooms', gap(r, 'baths') && 'bathrooms', gap(r, 'yearBuilt') && 'year built'].filter(Boolean).join(', ')}.` });
  if (r.id === 44) {
    reasons.push({ code: 'FEW_COMPARABLE_SALES', message: 'Only 2 qualified sales of similar homes were recorded within 2 km in the last 24 months.' });
    reasons.push({ code: 'OLDER_HOME', message: 'Homes built before 1940 are under-represented in the training data.' });
  }
  return { status: reasons.length ? 'limited' : 'supported', reasons };
}
/**
 * Stored valuation evidence for the canonical records, identical to account.cjs VALUATION (whose
 * values equal investor.cjs ESTIMATES), so the property page, the opportunity list and portfolio
 * totals agree. confidence is the 0-100 score, label the band; 47 has neither stored.
 */
const CANON = {
  42: { value: 985000, g1: 4.2, g3: 11.8, outlook: 3.1, confidence: 78, label: 'medium' },
  43: { value: 942000, g1: 3.9, g3: 10.6, outlook: 3.1, confidence: 74, label: 'medium' },
  44: { value: 1655000, g1: 2.6, g3: 8.9, outlook: 3.1, confidence: 58, label: 'low', predictionDate: '2026-10-01' },
  45: { value: 268000, g1: -1.4, g3: 2.2, outlook: -0.8, confidence: 66, label: 'medium' },
  47: { value: 1118000, g1: 5.8, g3: 16.4, outlook: 4.4, confidence: null, label: null },
  48: { value: 587000, g1: 3.1, g3: null, outlook: 2.7, confidence: 71, label: 'medium' },
};
const AREA_OUTLOOK = { grove: 3.1, day: 3.1, hialeah: -0.8, mg: 2.9, lr: 4.4, sd: 2.7, mb: 1.2 };
/** Model value before rounding; used for assessments too (assessments exist even when the model has no estimate). */
function valueBasis(r) {
  if (CANON[r.id]) return CANON[r.id].value;
  const sqft = fact(r, 'sqft');
  if (!sqft) return (fact(r, 'lotSqft') ?? 6000) * r.area.ppsf * (r.d.dor === 'reference' ? 0.1 : 0.2);
  return sqft * (r.d.ppsf ?? r.area.ppsf);
}
const predictionDateOf = (r) => CANON[r.id]?.predictionDate ?? PREDICTION_DATE;
const runIdFor = (date) => `zv-run-${date.slice(0, 7)}-02`;
function model(r, ctx) {
  const support = supportFor(r, ctx);
  if (support.status === 'unsupported') return { ...support, row: r };
  const c = CANON[r.id];
  const value = r1000(valueBasis(r));
  const conf = c ? c.label : support.status === 'limited' ? 'low' : 'medium';
  const confScore = c ? c.confidence : { medium: 70, low: 40 }[conf];
  const spread80 = { high: 0.08, medium: 0.11, low: 0.16 }[conf ?? 'medium'];
  const spread90 = { high: 0.11, medium: 0.15, low: 0.22 }[conf ?? 'medium'];
  const g1 = c ? c.g1 : r1(r.area.g1 + ((r.id % 7) - 3) * 0.15);
  const noLongForecast = gap(r, 'yearBuilt') && r.d.dor !== 'vacant';
  const g3 = c ? c.g3 : noLongForecast ? null : r1((Math.pow(1 + g1 / 100, 3) - 1) * 100 * 0.97);
  const g7 = g3 === null ? null : r1((Math.pow(1 + g3 / 100, 7 / 3) - 1) * 100 * 0.95);
  const outlook = c ? c.outlook : AREA_OUTLOOK[r.d.area];
  const last = gap(r, 'saleHistory') ? null : r.lastQualified;
  const predictionDate = predictionDateOf(r);
  return {
    ...support, row: r, value, conf, confScore, g1, g3, g7, outlook, last, predictionDate,
    runId: runIdFor(predictionDate), dataThrough: predictionDate === PREDICTION_DATE ? DATA_THROUGH : monthsBefore(DATA_THROUGH, 1),
    range80: { low: r1000(value * (1 - spread80)), high: r1000(value * (1 + spread80)) },
    range90: r.id === 48 ? null : { low: r1000(value * (1 - spread90)), high: r1000(value * (1 + spread90)) },
    f1: r1000(value * (1 + g1 / 100)),
    f3: g3 === null ? null : r1000(value * (1 + g3 / 100)),
    f7: g7 === null ? null : r1000(value * (1 + g7 / 100)),
  };
}
const projection = (v, spread) => (v === null ? null : { value: v, low: r1000(v * (1 - spread)), high: r1000(v * (1 + spread)) });

function factors(m) {
  const r = m.row, a = r.area;
  const baseline = r1000(a.typSqft * a.ppsf);
  const out = [];
  const add = (code, label, pct, text) => out.push({ code, label, pct: r1(pct), usd: r1000((baseline * pct) / 100), text });
  const sqft = fact(r, 'sqft');
  if (sqft) add('LIVING_AREA', 'Living area', (sqft / a.typSqft - 1) * 45, `${sqft.toLocaleString('en-US')} sqft, against a typical ${a.typSqft.toLocaleString('en-US')} sqft for homes sold nearby.`);
  const lot = fact(r, 'lotSqft');
  if (lot && a.typLot) add('LOT_SIZE', 'Lot size', (lot / a.typLot - 1) * 20, `${lot.toLocaleString('en-US')} sqft lot, against a typical ${a.typLot.toLocaleString('en-US')} sqft.`);
  const yb = yearOf(r);
  if (yb) add('BUILDING_AGE', 'Year built', (yb - a.typYear) * 0.09 - Math.max(0, 2026 - yb - 60) * 0.05, `Built in ${yb}; typical nearby homes were built around ${a.typYear}.`);
  const beds = fact(r, 'beds');
  if (beds !== null && r.d.dor !== 'condo') add('BEDROOMS', 'Bedrooms', (beds - 3) * 1.8, `${beds} bedrooms, against 3 for a typical nearby home.`);
  add('MARKET_TREND', 'Nearby sales trend', a.g1 * 0.8, `Prices of qualified sales in ${a.name} rose over the last 12 months.`);
  return { baseline, factors: out };
}

function valuation(r, ctx) {
  const m = model(r, ctx);
  if (m.status === 'unsupported') {
    return {
      status: 'unsupported',
      reasons: m.reasons,
      method: { valuationMethod: null, modelVersion: MODEL, predictionDate: null, dataThrough: DATA_THROUGH, createdAt: RUN_CREATED },
      notes: [],
    };
  }
  const f = factors(m);
  const comps = r.id === 45 ? null : comparableSet(r, new URLSearchParams({ limit: '5' }), ctx);
  return {
    status: m.status,
    reasons: m.reasons,
    estimate: { value: m.value, range80: m.range80, range90: m.range90, confidence: m.conf },
    forecasts: { oneYear: projection(m.f1, 0.07), threeYears: projection(m.f3, 0.15), sevenYears: projection(m.f7, 0.26) },
    explanation: {
      baseline: f.baseline,
      summary: `The estimate starts from the median of recent qualified sales in ${r.area.name} and adjusts for this home's size${fact(r, 'lotSqft') ? ', lot' : ''}${yearOf(r) ? ' and age' : ''}.`,
      factors: f.factors,
      note: gap(r, 'beds') || gap(r, 'yearBuilt') ? 'Bedroom and year-built factors are missing because the county record does not have them.' : null,
    },
    evidence: {
      lastSale: m.last ? { hasSaleHistory: true, price: m.last.salePrice, date: m.last.saleDate } : { hasSaleHistory: false, price: null, date: null },
      comparables: comps
        ? { label: "Selected separately as supporting evidence, not the model's calculation.", status: comps.status, data: comps }
        : { label: null, status: 'UNAVAILABLE', data: null },
    },
    method: { valuationMethod: 'Gradient-boosted hedonic model with nearby-sale features', modelVersion: MODEL, predictionDate: m.predictionDate, dataThrough: m.dataThrough, createdAt: m.predictionDate.slice(0, 8) + RUN_CREATED.slice(8) },
    reproducibility: { runId: m.runId, inputHash: sha(`${m.runId}|${r.id}|in`).slice(0, 16) },
    notes: m.f3 === null ? ['Three- and seven-year scenarios need the year built, which the county record does not have.'] : [],
  };
}

function prediction(r, ctx) {
  const m = model(r, ctx);
  if (m.status === 'unsupported') return null;
  const notes = [];
  if (!m.last) notes.push('No qualified sale history: the estimate relies on attributes and nearby sales.');
  if (gap(r, 'beds') || gap(r, 'yearBuilt')) notes.push('Bedrooms, bathrooms or year built are missing from the county record.');
  return {
    propertyId: r.id,
    predictedPrice: m.value,
    predictedPriceLow: m.range80.low,
    predictedPriceHigh: m.range80.high,
    predictedPriceLow90: m.range90?.low ?? null,
    predictedPriceHigh90: m.range90?.high ?? null,
    // The service sends 0 when there is no prior sale (see hasGrowth()).
    growthPercentage: m.last ? r2((m.value / m.last.salePrice - 1) * 100) : 0,
    confidence: m.conf,
    // 47 has no stored confidence; the service then sends null even though the client types it as number.
    confidenceScore: m.confScore,
    hasSaleHistory: !!m.last,
    lastSalePrice: m.last?.salePrice ?? null,
    lastSaleDate: m.last?.saleDate ?? null,
    forecast1y: m.f1,
    forecast1yLow: r1000(m.f1 * 0.93),
    forecast1yHigh: r1000(m.f1 * 1.07),
    unchangedHomeValue1y: r1000(m.value * (1 + MARKET_OUTLOOK_1Y / 100)),
    forecast3y: m.f3,
    forecast3yLow: m.f3 === null ? null : r1000(m.f3 * 0.85),
    forecast3yHigh: m.f3 === null ? null : r1000(m.f3 * 1.15),
    forecast7y: m.f7,
    forecast7yLow: m.f7 === null ? null : r1000(m.f7 * 0.74),
    forecast7yHigh: m.f7 === null ? null : r1000(m.f7 * 1.26),
    marketOutlook1yPct: MARKET_OUTLOOK_1Y,
    predictionDate: m.predictionDate,
    dataThrough: m.dataThrough,
    modelVersion: MODEL,
    notes: notes.length ? JSON.stringify(notes) : null,
  };
}

// ---- valuation history -------------------------------------------------------------------------
/** The same day `months` earlier, clamped to the month's last day (Oct 31 - 1 month = Sep 30). */
function monthsBefore(iso, months) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}
const HISTORY_LENGTH = { 42: 12, 43: 4, 44: 3, 45: 2, 47: 5, 48: 1 };
function history(r, ctx) {
  const m = model(r, ctx);
  if (m.status === 'unsupported') return [];
  const n = ctx.flags.empty ? 1 : HISTORY_LENGTH[r.id] ?? 3;
  const entries = [];
  for (let k = 0; k < n; k++) {
    // The newest entry is the current published valuation (same value, date and run as /valuation).
    const predictionDate = monthsBefore(m.predictionDate, k);
    const dataThrough = monthsBefore(m.dataThrough, k);
    const seeded = !ctx.flags.empty && n > 1 && k === n - 1;
    const modelVersion = k >= 9 ? 'zv-16.4' : k >= 4 ? 'zv-17.1' : MODEL;
    const runId = seeded ? null : runIdFor(predictionDate);
    const value = r1000(m.value * (1 - 0.0035 * k));
    const status = r.id === 44 && k === 2 ? 'unsupported' : m.status;
    const scoredAt = predictionDate.slice(0, 8) + '03T06:12:41Z';
    const published = predictionDate.slice(0, 8) + '04T09:00:00Z';
    const v = status === 'unsupported'
      ? { status, reasons: [{ code: 'OLDER_HOME', message: 'Model zv-16.4 did not value homes built before 1940.' }], method: { modelVersion, predictionDate, dataThrough, createdAt: scoredAt } }
      : {
          status,
          reasons: m.reasons,
          estimate: { value, range80: { low: r1000(value * (m.range80.low / m.value)), high: r1000(value * (m.range80.high / m.value)) }, range90: m.range90 ? { low: r1000(value * (m.range90.low / m.value)), high: r1000(value * (m.range90.high / m.value)) } : null, confidence: k >= 9 ? null : m.conf },
          forecasts: { oneYear: projection(r1000(value * (1 + m.g1 / 100)), 0.07), threeYears: null, sevenYears: null },
          method: { valuationMethod: 'Gradient-boosted hedonic model with nearby-sale features', modelVersion, predictionDate, dataThrough, createdAt: scoredAt },
          reproducibility: { runId, inputHash: seeded ? null : sha(`${runId}|${r.id}|in`).slice(0, 16) },
        };
    entries.push({
      id: r.id * 100 + k + 1,
      runId,
      inputHash: v.reproducibility?.inputHash ?? null,
      archivedAt: k === 0 ? null : monthsBefore(m.predictionDate, k - 1).slice(0, 8) + '04T09:00:00Z',
      scoredAt: seeded ? null : scoredAt,
      loadedAt: published,
      provenance: seeded ? 'SEEDED_CURRENT' : 'PUBLISHED',
      provenanceLabel: seeded ? 'Recorded before history' : 'Published',
      rowSha256: sha(`${r.id}|${k}|row`),
      valuation: v,
      modelEvidence: seeded
        ? { status: 'NOT_RECORDED', label: 'Inputs were not recorded for this version.', lastSale: null, nearbySales: null }
        : {
            status: 'RECORDED',
            label: 'Frozen inputs of this model run',
            lastSale: m.last && m.last.saleDate <= dataThrough ? { price: m.last.salePrice, date: m.last.saleDate } : { price: null, date: null },
            nearbySales: { medianPrice: r1000(r.area.typSqft * r.area.ppsf * (1 - 0.004 * k)), count: 14 - (k % 4) - (r.d.dor === 'condo' ? 6 : 0), pricePerSqft: Math.round(r.area.ppsf * (1 - 0.004 * k)), radiusDegrees: 0.01, lookbackDays: 365, windowEnd: dataThrough },
          },
      run: seeded ? null : { runId, runKind: 'MONTHLY', asOf: predictionDate, sourceSnapshotAt: dataThrough + 'T04:00:00Z', referenceRunId: null, scoredAt, publishedAt: published, contentSha256: sha(runId + 'content'), manifestSha256: sha(runId + 'manifest'), inputsSha256: sha(runId + 'inputs') },
    });
  }
  return entries;
}

// ---- opportunity score ---------------------------------------------------------------------------
// opportunity-v1, the same factors, weights and scales as account.cjs /opportunities (which mirrors
// OpportunityScoringServiceImpl), so a property scores the same on its page and in the list.
const OPP_NOTES = [
  `Version ${SCORE_VERSION} scores the stored ZentraValue valuation and market forecasts; rent, financing and listing-price evidence is not stored yet, so those factors are unavailable.`,
  'Unavailable factors add no points and are never treated as zero costs: missing data cannot raise a score. coveragePercent is the highest score the available evidence allows.',
  'Forecasts are model trend scenarios, not guarantees, and no listing price is known: the score ranks evidence for research and is not a recommendation to buy.',
];
const signed = (n) => (n > 0 ? '+' : '') + String(r2(n));
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
const subscoreOf = (signal, low, high) => r2(Math.min(100, Math.max(0, ((signal - low) * 100) / (high - low))));
const availableFactor = (code, label, category, weight, signal, unit, sub, explanation) => ({ code, label, category, weight, status: 'AVAILABLE', signal: r2(signal), signalUnit: unit, subscore: sub, points: r2((sub * weight) / 100), explanation });
const unavailableFactor = (code, label, category, weight, reason) => ({ code, label, category, weight, status: 'UNAVAILABLE', signal: null, signalUnit: null, subscore: null, points: null, explanation: `Unavailable: ${reason} It adds no points.` });
function growthFactor(code, label, weight, horizon, pct, value, low, high) {
  return availableFactor(code, label, 'MARKET', weight, pct, 'PERCENT', subscoreOf(pct, low, high),
    `${horizon} forecast ${signed(pct)}% against the current estimate (${usd(value)} to ${usd(value * (1 + pct / 100))}). Scale: ${signed(low)}% scores 0, ${signed(high)}% scores 100.`);
}
const NO_VALUATION = 'No supported valuation is stored for this property.';
function opportunityFactors(m) {
  const scored = m && m.status !== 'unsupported';
  return [
    scored ? growthFactor('FORECAST_GROWTH_1Y', 'One-year forecast growth', 20, 'One-year', m.g1, m.value, -10, 10) : unavailableFactor('FORECAST_GROWTH_1Y', 'One-year forecast growth', 'MARKET', 20, NO_VALUATION),
    scored && m.g3 !== null ? growthFactor('FORECAST_GROWTH_3Y', 'Three-year forecast growth', 15, 'Three-year', m.g3, m.value, -25, 25) : unavailableFactor('FORECAST_GROWTH_3Y', 'Three-year forecast growth', 'MARKET', 15, scored ? 'No three-year forecast is stored.' : NO_VALUATION),
    scored && m.outlook !== null
      ? availableFactor('MARKET_OUTLOOK', 'Area market outlook', 'MARKET', 5, m.outlook, 'PERCENT', subscoreOf(m.outlook, -10, 10), `The area's one-year market outlook is ${signed(m.outlook)}%. Scale: -10% scores 0, +10% scores 100.`)
      : unavailableFactor('MARKET_OUTLOOK', 'Area market outlook', 'MARKET', 5, scored ? "No market outlook is stored for the property's area." : NO_VALUATION),
    scored && m.confScore !== null
      ? availableFactor('VALUATION_CONFIDENCE', 'Valuation confidence', 'VALUATION', 10, m.confScore, 'SCORE', subscoreOf(m.confScore, 0, 100), `The valuation's confidence score is ${m.confScore} of 100${m.conf ? ` (${m.conf} confidence)` : ''}; it is used as the subscore.`)
      : unavailableFactor('VALUATION_CONFIDENCE', 'Valuation confidence', 'VALUATION', 10, scored ? 'No valuation confidence score is stored.' : NO_VALUATION),
    unavailableFactor('RENTAL_YIELD', 'Rental yield', 'RENT', 20, 'No rent estimate is stored for this property, so rental yield cannot be measured.'),
    unavailableFactor('FINANCED_CASH_FLOW', 'Cash flow after financing', 'FINANCING', 10, 'Needs a rent estimate and financing terms; neither is stored for this property.'),
    unavailableFactor('ASKING_PRICE_DISCOUNT', 'Discount of the asking price to the estimate', 'PRICE', 20, 'No listing price is known, so a discount to the estimated value cannot be measured.'),
  ];
}
function opportunity(r, ctx) {
  const m = model(r, ctx);
  const scoredAt = daysAgo(3);
  if (m.status === 'unsupported' || gap(r, 'opportunityScore')) {
    return {
      propertyId: r.id, scoreVersion: SCORE_VERSION, status: 'UNAVAILABLE', score: null, maxScore: 100, coveragePercent: 0,
      factors: opportunityFactors(null),
      reasons: [{ code: 'NO_SUPPORTED_VALUATION', message: 'This property has no supported valuation with a one-year forecast, so it cannot be scored.' }],
      // 46 keeps a reference to its stored (unsupported) valuation; 49 and the reference folio have none.
      valuation: r.id === 49 || r.d.dor === 'reference' || r.d.dor === 'vacant' ? null : { estimatedValue: null, valuationStatus: 'unsupported', confidence: null, modelVersion: MODEL, dataThrough: null, runId: RUN_ID },
      scoredAt,
      notes: OPP_NOTES,
    };
  }
  const factorList = opportunityFactors(m);
  const used = factorList.filter((f) => f.status === 'AVAILABLE');
  return {
    propertyId: r.id, scoreVersion: SCORE_VERSION, status: 'SCORED',
    score: r2(used.reduce((s, f) => s + f.points, 0)), maxScore: 100,
    coveragePercent: used.reduce((s, f) => s + f.weight, 0),
    factors: factorList, reasons: [],
    valuation: { estimatedValue: m.value, valuationStatus: m.status, confidence: m.conf, modelVersion: MODEL, dataThrough: m.dataThrough, runId: m.runId },
    scoredAt,
    notes: OPP_NOTES,
  };
}

// ---- comparables -------------------------------------------------------------------------------
function distanceMeters(a, b) {
  const rad = Math.PI / 180, R = 6371000;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function matchLevel(s, c) {
  if (s.d.parentFolio && s.d.parentFolio === c.d.parentFolio) return 'SAME_PARENT_GROUP';
  if (s.d.sub === c.d.sub) return 'SAME_SUBDIVISION';
  if (s.area === c.area) return 'SAME_NEIGHBORHOOD';
  return 'NEARBY';
}
const MATCH_TEXT = { SAME_PARENT_GROUP: 'Same building', SAME_SUBDIVISION: 'Same subdivision', SAME_NEIGHBORHOOD: 'Same neighborhood', NEARBY: 'Nearby' };
const LEVEL_SCORE = { SAME_PARENT_GROUP: 1, SAME_SUBDIVISION: 0.85, SAME_NEIGHBORHOOD: 0.7, NEARBY: 0.5 };
const WEIGHTS = { distance: 0.2, livingArea: 0.25, bedrooms: 0.15, age: 0.1, recency: 0.15, location: 0.15 };
function candidateOf(c, s) {
  return {
    propertyId: c.row.id, folio: c.row.folio, countyId: COUNTY.countyId, address: fact(c.row, 'address'), city: c.row.city, zip: c.row.zip,
    dorCode: c.row.dor.code, bedrooms: fact(c.row, 'beds'), bathrooms: fact(c.row, 'baths'), livingAreaSqft: fact(c.row, 'sqft'), yearBuilt: fact(c.row, 'yearBuilt'),
    saleId: c.sale.id, saleDate: c.sale.saleDate, salePrice: c.sale.salePrice, qualifiedFlag: 'Q', qualificationDescription: c.sale.saleType,
    instrumentNumber: c.sale.instrumentNumber, matchLevel: matchLevel(s, c.row), distanceMeters: Math.round(c.distance),
  };
}
function criteria(q) {
  const get = (k, dflt) => (q.get(k) === null || q.get(k) === '' ? dflt : Number(q.get(k)));
  return { months: get('months', 24), radiusMeters: get('radiusMeters', 2000), areaTolerancePercent: get('areaTolerancePercent', 25), bedroomTolerance: get('bedroomTolerance', 1), limit: get('limit', 10) };
}
function invalid(c) {
  if (![c.months, c.radiusMeters, c.areaTolerancePercent, c.bedroomTolerance, c.limit].every(Number.isFinite)) return 'Search parameters must be numbers.';
  if (c.months < 1 || c.months > 120) return 'months must be between 1 and 120.';
  if (c.radiusMeters < 100 || c.radiusMeters > 10000) return 'radiusMeters must be between 100 and 10000.';
  if (c.areaTolerancePercent < 0 || c.areaTolerancePercent > 100) return 'areaTolerancePercent must be between 0 and 100.';
  if (c.bedroomTolerance < 0 || c.bedroomTolerance > 5) return 'bedroomTolerance must be between 0 and 5.';
  if (c.limit < 1 || c.limit > 100) return 'limit must be between 1 and 100.';
  return null;
}
/** Qualified sales around the subject that pass the filters, nearest first, with the reasons kept. */
function pool(s, c, ctx) {
  const saleDateFrom = monthsBefore(AS_OF, c.months);
  const warnings = [];
  if (!s.dor.cls) return { saleDateFrom, considered: 0, passed: [], warnings: ['Comparable sales are selected for residential properties only.'] };
  if (ctx.flags.empty && !COMPS_IN_EMPTY.has(s.id))
    return { saleDateFrom, considered: 0, passed: [], warnings: ['Recorded sales for this area are still being loaded. Comparable sales appear after the next county import.'] };
  const sArea = fact(s, 'sqft'), sBeds = fact(s, 'beds');
  if (sArea === null) warnings.push('Living area is unknown for this property, so the size filter was not applied.');
  if (sBeds === null) warnings.push('The bedroom count is unknown for this property, so the bedroom filter was not applied.');
  const near = [];
  for (const row of ROWS) {
    if (row.id === s.id || row.dor.cls !== s.dor.cls || gap(row, 'saleHistory')) continue;
    const distance = distanceMeters(s, row);
    if (distance > c.radiusMeters) continue;
    for (const sale of row.sales) if (QUALIFIED.has(sale.saleType) && sale.salePrice > 0 && sale.saleDate >= saleDateFrom && sale.saleDate <= AS_OF) near.push({ row, sale, distance });
  }
  const passed = near.filter(({ row }) => {
    const a = fact(row, 'sqft'), b = fact(row, 'beds');
    if (sArea !== null && a !== null && Math.abs(a - sArea) / sArea > c.areaTolerancePercent / 100) return false;
    if (sBeds !== null && b !== null && Math.abs(b - sBeds) > c.bedroomTolerance) return false;
    return true;
  });
  passed.sort((x, y) => x.distance - y.distance || x.sale.id - y.sale.id);
  return { saleDateFrom, considered: near.length, passed, warnings };
}
const MINIMUM = 3;
function comparableSet(s, q, ctx) {
  const c = criteria(q);
  const p = pool(s, c, ctx);
  const sArea = fact(s, 'sqft'), sBeds = fact(s, 'beds'), sYear = yearOf(s);
  const ranked = p.passed.map((x) => {
    const cand = candidateOf(x, s);
    const monthsAgo = (Date.parse(AS_OF) - Date.parse(x.sale.saleDate)) / (86400000 * 30.44);
    const parts = {
      distance: 1 - x.distance / c.radiusMeters,
      livingArea: sArea && cand.livingAreaSqft ? clamp(1 - Math.abs(cand.livingAreaSqft - sArea) / sArea / Math.max(c.areaTolerancePercent / 100, 0.05), 0, 1) : null,
      bedrooms: sBeds !== null && cand.bedrooms !== null ? clamp(1 - Math.abs(cand.bedrooms - sBeds) / (c.bedroomTolerance + 1), 0, 1) : null,
      age: sYear && cand.yearBuilt ? 1 - Math.min(1, Math.abs(Number(cand.yearBuilt) - sYear) / 40) : null,
      recency: clamp(1 - monthsAgo / c.months, 0, 1),
      location: LEVEL_SCORE[cand.matchLevel],
    };
    let wsum = 0, score = 0;
    for (const [k, w] of Object.entries(WEIGHTS)) if (parts[k] !== null) { wsum += w; score += w * parts[k]; }
    const reasons = [MATCH_TEXT[cand.matchLevel], `${(x.distance / 1609.344).toFixed(1)} mi away`, `Sold ${Math.max(1, Math.round(monthsAgo))} months ago`];
    if (parts.livingArea !== null) reasons.push(`Living area within ${Math.round((Math.abs(cand.livingAreaSqft - sArea) / sArea) * 100)}%`);
    if (parts.bedrooms !== null) reasons.push(cand.bedrooms === sBeds ? 'Same bedroom count' : `${Math.abs(cand.bedrooms - sBeds)} bedroom difference`);
    return {
      candidate: cand,
      similarityScore: r3(score / wsum),
      evidenceCoveragePercent: Math.round(wsum * 100),
      selectionReasons: reasons,
      missingData: [['bedrooms', cand.bedrooms], ['bathrooms', cand.bathrooms], ['livingAreaSqft', cand.livingAreaSqft], ['yearBuilt', cand.yearBuilt]].filter(([, v]) => v === null).map(([k]) => k),
      scoreBreakdown: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v === null ? null : r3(v)])),
    };
  });
  ranked.sort((a, b) => b.similarityScore - a.similarityScore || a.candidate.distanceMeters - b.candidate.distanceMeters);
  const comparables = ranked.slice(0, c.limit).map((x, i) => ({ rank: i + 1, ...x }));
  const status = comparables.length >= MINIMUM ? 'COMPARABLES_FOUND' : 'INSUFFICIENT_DATA';
  const warnings = [...p.warnings];
  if (status === 'INSUFFICIENT_DATA' && s.dor.cls && !(ctx.flags.empty && !COMPS_IN_EMPTY.has(s.id)))
    warnings.push(`Only ${comparables.length} qualified ${comparables.length === 1 ? 'sale' : 'sales'} passed the filters; at least ${MINIMUM} are needed for a reliable comparison.`);
  return {
    propertyId: s.id,
    subject: { propertyId: s.id, countyId: COUNTY.countyId, dorCode: s.dor.code, bedrooms: sBeds, bathrooms: fact(s, 'baths'), livingAreaSqft: sArea, yearBuilt: fact(s, 'yearBuilt') },
    asOfDate: AS_OF,
    saleDateFrom: p.saleDateFrom,
    search: c,
    selectionVersion: 'comparable-selection-v3',
    rankingVersion: 'comparable-ranking-v2',
    candidatePoolLimit: 200,
    consideredCandidates: p.considered,
    candidatePoolLimitReached: false,
    minimumCandidates: MINIMUM,
    returnedCount: comparables.length,
    status,
    warnings,
    comparables,
    scoringWeights: { ...WEIGHTS },
  };
}
function candidateSet(s, q, ctx) {
  const c = { ...criteria(q), limit: criteria(q).limit === 10 && q.get('limit') === null ? 50 : criteria(q).limit };
  const p = pool(s, c, ctx);
  const candidates = p.passed.slice(0, c.limit).map((x) => candidateOf(x, s));
  const status = candidates.length >= MINIMUM ? 'CANDIDATES_FOUND' : 'INSUFFICIENT_DATA';
  return {
    propertyId: s.id, asOfDate: AS_OF, saleDateFrom: p.saleDateFrom, radiusMeters: c.radiusMeters, areaTolerancePercent: c.areaTolerancePercent,
    bedroomTolerance: c.bedroomTolerance, limit: c.limit, minimumCandidates: MINIMUM, returnedCount: candidates.length, status,
    selectionVersion: 'comparable-selection-v3', warnings: p.warnings, candidates,
  };
}

// ---- location intelligence -----------------------------------------------------------------------
// Distances in meters. rail/mover/hwy null = none within the 5 km search.
const LOC = {
  42: { pub: 640, charter: 1350, n1k: 2, sScore: 74, bus: 160, rail: 2350, mover: null, hwy: 1900, stops: 6, tScore: 68 },
  43: { pub: 690, charter: 1300, n1k: 2, sScore: 72, bus: 210, rail: 2400, mover: null, hwy: 1850, stops: 5, tScore: 66 },
  44: { pub: 420, charter: 900, n1k: 3, sScore: 81, bus: 120, rail: 1500, mover: null, hwy: 2600, stops: 8, tScore: 73 },
  45: { pub: 520, charter: 760, n1k: 4, sScore: 78, bus: 90, rail: 2900, mover: null, hwy: 1200, stops: 9, tScore: 64 },
  46: { pub: 830, charter: 2100, n1k: 1, sScore: 58, bus: 240, rail: null, mover: null, hwy: 700, stops: 4, tScore: 49, transportUnavailable: true },
  47: { pub: 380, charter: 1200, n1k: 3, sScore: 76, bus: 70, rail: 3100, mover: null, hwy: 900, stops: 11, tScore: 71 },
  48: { pub: 1650, charter: 2300, n1k: 0, sScore: 39, bus: 380, rail: null, mover: null, hwy: 2100, stops: 2, tScore: 34 },
  49: { pub: 900, charter: 1700, n1k: 1, sScore: 61, bus: 50, rail: null, mover: null, hwy: 3800, stops: 14, tScore: 70 },
};
const ANCHOR = { grove: 42, day: 44, hialeah: 45, mg: 46, lr: 47, sd: 48, mb: 49 };
function locOf(r) {
  if (gap(r, 'location')) return null;
  if (LOC[r.id]) return LOC[r.id];
  const a = LOC[ANCHOR[r.d.area]];
  const j = 1 + ((r.id % 5) - 2) * 0.06;
  const d = (v) => (v === null ? null : Math.round(v * j));
  return { pub: d(a.pub), charter: d(a.charter), n1k: a.n1k, sScore: clamp(a.sScore + (r.id % 3) - 1), bus: d(a.bus), rail: d(a.rail), mover: null, hwy: d(a.hwy), stops: a.stops, tScore: clamp(a.tScore + (r.id % 3) - 1) };
}
const scoreLabel = (s) => (s === null ? null : s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Fair' : 'Limited');
const sub = { pub: (m) => Math.round(clamp(100 - m / 25)), charter: (m) => Math.round(clamp(100 - m / 30)), density: (n) => Math.min(100, n * 25) };
const SCHOOL_SOURCE = 'Miami-Dade County Public Schools facility locations, 2025-26 school year';
const TRANSIT_SOURCE = 'Miami-Dade Transit GTFS feed (October 2026) and FDOT highway interchanges';
function schoolContext(r) {
  const l = locOf(r);
  if (!l) return { propertyId: r.id, status: 'NO_COVERAGE', distanceUnit: 'meters', nearestPublicSchoolDistance: null, nearestCharterSchoolDistance: null, schoolsWithin1km: null, schoolScore: null, schoolScoreLabel: null, publicSchoolDistanceScore: null, charterSchoolDistanceScore: null, schoolDensityScore: null, source: SCHOOL_SOURCE, note: 'Location analysis runs for residential parcels only.' };
  return {
    propertyId: r.id, status: l.n1k === 0 ? 'NO_NEARBY_RESULTS' : 'AVAILABLE', distanceUnit: 'meters',
    nearestPublicSchoolDistance: l.pub, nearestCharterSchoolDistance: l.charter, schoolsWithin1km: l.n1k,
    schoolScore: l.sScore, schoolScoreLabel: scoreLabel(l.sScore),
    publicSchoolDistanceScore: sub.pub(l.pub), charterSchoolDistanceScore: sub.charter(l.charter), schoolDensityScore: sub.density(l.n1k),
    source: SCHOOL_SOURCE, note: 'Distances are straight-line, not walking routes. School quality ratings are not included.',
  };
}
function transportContext(r, ctx) {
  const l = locOf(r);
  const base = { propertyId: r.id, distanceUnit: 'meters', source: TRANSIT_SOURCE };
  if (!l) return { ...base, status: 'NO_COVERAGE', transport: [], busStopsWithin500m: null, transportationScore: null, transportationScoreLabel: null, error: null, note: 'Location analysis runs for residential parcels only.' };
  if (l.transportUnavailable && ctx.flags.full)
    return { ...base, status: 'UNAVAILABLE', transport: [], busStopsWithin500m: null, transportationScore: null, transportationScoreLabel: null, error: 'The transit stop index is being rebuilt. Try again in a few minutes.', note: null };
  const transport = [['RAIL', l.rail], ['PEOPLE_MOVER', l.mover], ['BUS', l.bus], ['HIGHWAY', l.hwy]].filter(([, v]) => v !== null).map(([category, nearestDistance]) => ({ category, nearestDistance }));
  return { ...base, status: 'AVAILABLE', transport, busStopsWithin500m: l.stops, transportationScore: l.tScore, transportationScoreLabel: scoreLabel(l.tScore), error: null, note: l.rail === null ? 'No Metrorail station is within 5 km.' : null };
}
function schoolAnalysis(r) {
  const l = locOf(r);
  if (!l) return null;
  return { id: 7000 + r.id, propertyId: r.id, distPublicSchool: l.pub, distCharterSchool: l.charter, schoolsWithin1km: l.n1k, publicSchoolDistanceScore: sub.pub(l.pub), charterSchoolDistanceScore: sub.charter(l.charter), schoolDensityScore: sub.density(l.n1k), schoolScore: l.sScore };
}
function transportAnalysis(r, ctx) {
  const l = locOf(r);
  if (!l || (l.transportUnavailable && ctx.flags.full)) return null;
  const ds = (m, k) => (m === null ? null : Math.round(clamp(100 - m / k)));
  return { id: 8000 + r.id, propertyId: r.id, distMetroRail: l.rail, distMetroMover: l.mover, distBusStop: l.bus, distHighway: l.hwy, busStopsWithin500m: l.stops, metroRailScore: ds(l.rail, 50), metroMoverScore: ds(l.mover, 50), busStopDistanceScore: ds(l.bus, 8), busStopDensityScore: Math.min(100, l.stops * 8), highwayScore: ds(l.hwy, 40), transportationScore: l.tScore };
}

// ---- extra features ----------------------------------------------------------------------------
function extraFeatures(r, q) {
  const historyMode = q.get('history') === 'true';
  const year = q.get('year') ? Number(q.get('year')) : null;
  const years = historyMode ? [2026, 2025, 2024] : [year ?? 2026];
  const all = [];
  for (const y of years) {
    const back = 2026 - y;
    for (const f of r.d.features) {
      if (f.actualYearBuilt !== null && f.actualYearBuilt > y) continue;
      all.push({
        actualYearBuilt: f.actualYearBuilt,
        adjustedUnitPrice: f.depreciatedValue === null || !f.units ? null : r2(f.depreciatedValue / f.units / ((f.percentCondition ?? 100) / 100)),
        depreciatedValue: f.depreciatedValue === null ? null : Math.round(f.depreciatedValue * Math.pow(1.02, back)),
        description: f.description,
        message: null,
        percentCondition: f.percentCondition === null ? null : Math.min(100, f.percentCondition + back),
        rollYear: y,
        units: f.units,
        useCode: f.useCode,
      });
    }
  }
  const size = Math.min(100, Math.max(1, Number(q.get('size')) || 25));
  const p = page(all, new URLSearchParams({ page: q.get('page') ?? '0', size: String(size) }), 25);
  return { propertyId: r.id, rollYear: historyMode ? null : all.length ? years[0] : null, history: historyMode, features: p.content, page: p.page, size: p.size, totalElements: p.totalElements, totalPages: p.totalPages };
}

// ---- images --------------------------------------------------------------------------------------
function images(r) {
  const n = r.d.images ?? 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const street = i < 2 && r.id !== 43;
    out.push({
      id: r.id * 10 + i + 1,
      storagePath: '/assets/images/property.webp' + (i ? `?v=${i + 1}` : ''),
      // 43's only photo carries no ordering or primary flag, as older imports do.
      displayOrder: r.id === 43 ? null : i + 1,
      primaryImage: r.id === 43 ? null : i === 0,
      source: street ? 'Mapillary' : 'County records',
      sourceImageId: street ? String(4100000000000 + r.id * 97 + i) : null,
      sourceUrl: null,
      contributor: street ? 'street-level contributor' : null,
      license: street ? 'CC BY-SA 4.0' : null,
      capturedAt: street ? daysAgo(220 + r.id * 11 + i * 30) : null,
      matchStatus: street ? 'MATCHED' : null,
    });
  }
  return out;
}

// ---- compare ---------------------------------------------------------------------------------
function comparison(r, ctx) {
  const a = assessmentsOf(r)[0] ?? null;
  const p = prediction(r, ctx);
  const l = locOf(r);
  const t = transportContext(r, ctx);
  const last = gap(r, 'saleHistory') ? null : r.lastQualified;
  const out = {
    propertyId: r.id, folio: r.folio, address: fact(r, 'address'), countyName: COUNTY.countyName, stateCode: STATE.code,
    facts: { bedrooms: fact(r, 'beds'), bathrooms: fact(r, 'baths'), livingAreaSqft: fact(r, 'sqft'), lotSizeSqft: fact(r, 'lotSqft'), yearBuilt: fact(r, 'yearBuilt'), propertyType: r.dor.desc, floors: r.d.floors === undefined ? 1 : r.d.floors, units: r.d.units ?? (fact(r, 'sqft') ? 1 : null) },
    assessment: a ? { year: a.year, totalValue: a.totalValue, landValue: a.landValue, buildingValue: a.buildingOnlyValue, assessedValue: a.assessedValue } : null,
    lastSale: last ? { date: last.saleDate, price: last.salePrice } : null,
    valuation: p ? { predictedPrice: p.predictedPrice, low: p.predictedPriceLow, high: p.predictedPriceHigh, growthPercentage: p.hasSaleHistory ? p.growthPercentage : null, confidenceScore: p.confidenceScore, predictionDate: p.predictionDate } : null,
    scores: l ? { schoolScore: l.sScore, transportationScore: t.status === 'AVAILABLE' ? t.transportationScore : null } : null,
  };
  const missing = [];
  for (const [k, v] of Object.entries(out.facts)) if (v === null) missing.push('facts.' + k);
  for (const k of ['assessment', 'lastSale', 'valuation', 'scores']) if (out[k] === null) missing.push(k);
  if (out.valuation && out.valuation.growthPercentage === null) missing.push('valuation.growthPercentage');
  if (out.scores && out.scores.transportationScore === null) missing.push('scores.transportationScore');
  return { ...out, missingFields: missing };
}
function compare(req, ctx) {
  const ids = Array.isArray(req.body?.propertyIds) ? [...new Set(req.body.propertyIds.map(Number))] : null;
  if (!ids || ids.length < 2 || ids.length > 5 || !ids.every((n) => Number.isSafeInteger(n) && n > 0))
    return badRequest('Choose between 2 and 5 properties to compare.');
  const rows = ids.map(rowFor);
  const warnings = ids.filter((id, i) => !rows[i]).map((id) => `Property ${id} was not found and is left out.`);
  const properties = rows.filter(Boolean).map((r) => comparison(r, ctx));
  if (!properties.length) return notFound('None of the requested properties exist.');
  const years = new Set(properties.map((p) => p.assessment?.year ?? null));
  const assessmentYear = years.size === 1 ? [...years][0] : null;
  if (years.size > 1) warnings.push('Assessment years differ, so each column shows its own latest year.');
  const noValuation = properties.filter((p) => !p.valuation).length;
  if (noValuation) warnings.push(`${noValuation} of ${properties.length} properties ${noValuation === 1 ? 'has' : 'have'} no published valuation.`);
  return { body: { requestedIds: ids, comparedCount: properties.length, units: { currency: 'USD', area: 'sqft', distance: 'meters' }, assessmentYear, warnings, properties } };
}

// ---- contact requests --------------------------------------------------------------------------
const PROFESSIONALS = [
  { id: 201, name: 'Carla Mendoza' },
  { id: 202, name: 'Derrick Owens' },
  { id: 203, name: 'Lucía Ferreira' },
  { id: 204, name: 'Samuel Okafor' },
];
const PHONE = /^\+?[0-9][0-9 ().-]{5,38}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function submitContact(req, ctx) {
  const b = req.body ?? {};
  const key = req.headers['idempotency-key'];
  if (!key) return badRequest('An Idempotency-Key header is required.');
  const fingerprint = JSON.stringify([b.propertyId, b.professionalUserId, b.contactName, b.contactEmail ?? null, b.contactPhone ?? null, b.message ?? null, b.consent, b.consentVersion]);
  const prior = db.idempotency.get(key);
  if (prior) {
    if (prior.fingerprint !== fingerprint) return { status: 409, body: { status: 409, error: 'Conflict', message: 'This request was already sent with different details. Start a new request to change them.' } };
    return { status: 200, body: db.contacts.find((c) => c.id === prior.id) };
  }
  if (b.consent !== true || b.consentVersion !== 'property-contact-v1') return badRequest('Consent to share your details is required.');
  if (!String(b.contactName ?? '').trim()) return badRequest('contactName is required.');
  if (!b.contactEmail && !b.contactPhone) return badRequest('Give an email address or a phone number.');
  if (b.contactEmail && !EMAIL.test(b.contactEmail)) return badRequest('contactEmail is not a valid email address.');
  if (b.contactPhone && !PHONE.test(b.contactPhone)) return badRequest('contactPhone is not a valid phone number.');
  if (!rowFor(b.propertyId)) return notFound('This property was not found.');
  const professionals = ctx.flags.empty ? [] : PROFESSIONALS;
  if (!professionals.some((p) => p.id === Number(b.professionalUserId))) return badRequest('Choose a registered professional.');
  const saved = {
    id: db.nextContactId++,
    propertyId: Number(b.propertyId),
    professionalUserId: Number(b.professionalUserId),
    leadId: db.nextLeadId++,
    status: 'SUBMITTED',
    deliveryStatus: 'PENDING',
    submittedAt: TODAY.toISOString(),
    contactName: String(b.contactName).trim(),
    contactEmail: b.contactEmail || null,
    contactPhone: b.contactPhone || null,
    message: b.message || null,
    consentVersion: b.consentVersion,
  };
  db.contacts.push(saved);
  db.idempotency.set(key, { fingerprint, id: saved.id });
  return { status: 201, body: saved };
}

// ---- state -------------------------------------------------------------------------------------
let db;
function reset() {
  db = { contacts: [], idempotency: new Map(), nextContactId: 3101, nextLeadId: 8401 };
}
reset();

const withRow = (fn) => (req, ctx) => {
  const r = rowFor(req.params[1]);
  return r ? fn(r, req, ctx) : notFound(`Property ${req.params[1]} was not found.`);
};
const idsOf = (body) => (Array.isArray(body?.propertyIds) ? [...new Set(body.propertyIds.map(Number))].filter(Number.isSafeInteger) : null);

module.exports = {
  reset,
  routes: [
    ['GET', '/api/properties/search', (req) => search(req)],
    ['POST', '/api/properties/compare', (req, ctx) => compare(req, ctx)],
    ['GET', /^\/api\/properties\/id\/(\d+)$/, withRow((r) => ({ body: property(r) }))],
    ['GET', /^\/api\/properties\/id\/(\d+)\/children$/, withRow((r, req) => {
      const units = ROWS.filter((u) => u.d.parentFolio && u.d.parentFolio === r.folio).map((u) => {
        const p = property(u);
        return { id: p.id, folio: p.folio, countyId: p.countyId, parentFolio: p.parentFolio, address: p.address, bedroomCount: p.bedroomCount, bathroomCount: p.bathroomCount, buildingActualArea: p.buildingActualArea, dorCode: p.dorCode, dorDescription: p.dorDescription, yearBuilt: p.yearBuilt };
      });
      return { body: page(units, req.query, 20) };
    })],
    ['GET', /^\/api\/properties\/id\/(\d+)\/extra-features$/, withRow((r, req) => ({ body: extraFeatures(r, req.query) }))],
    ['GET', /^\/api\/properties\/id\/(\d+)\/location-intelligence\/schools$/, withRow((r) => ({ body: schoolContext(r) }))],
    ['GET', /^\/api\/properties\/id\/(\d+)\/location-intelligence\/transport$/, withRow((r, req, ctx) => ({ body: transportContext(r, ctx) }))],
    ['GET', /^\/api\/properties\/id\/(\d+)\/valuation$/, withRow((r, req, ctx) => ({ body: valuation(r, ctx) }))],
    ['GET', /^\/api\/properties\/id\/(\d+)\/valuations$/, withRow((r, req, ctx) => ({ body: page(history(r, ctx), req.query, 10) }))],
    ['GET', /^\/api\/properties\/id\/(\d+)\/opportunity-score$/, withRow((r, req, ctx) => ({ body: opportunity(r, ctx) }))],
    ['GET', /^\/api\/properties\/id\/(\d+)\/comparables\/candidates$/, withRow((r, req, ctx) => {
      const problem = invalid(criteria(req.query));
      return problem ? badRequest(problem) : { body: candidateSet(r, req.query, ctx) };
    })],
    ['GET', /^\/api\/properties\/id\/(\d+)\/comparables$/, withRow((r, req, ctx) => {
      const problem = invalid(criteria(req.query));
      return problem ? badRequest(problem) : { body: comparableSet(r, req.query, ctx) };
    })],
    // Folio lookups only: 13 digits, with or without the county's dashes (01-4137-012-0450).
    ['GET', /^\/api\/properties\/(\d{2}-?\d{4}-?\d{3}-?\d{4})$/, (req) => {
      const county = req.query.get('countyId');
      const r = BY_FOLIO.get(req.params[1].replace(/-/g, ''));
      if (!r || (county && Number(county) !== COUNTY.countyId)) return notFound(`No property with folio ${req.params[1]} in this county.`);
      return { body: property(r) };
    }],
    ['GET', /^\/api\/images\/property\/(\d+)$/, withRow((r) => ({ body: images(r) }))],
    ['GET', '/api/parcels', (req) => {
      const box = (req.query.get('bbox') ?? '').split(',').map(Number);
      if (box.length !== 4 || !box.every(Number.isFinite)) return badRequest('bbox must be minLon,minLat,maxLon,maxLat.');
      const [minLon, minLat, maxLon, maxLat] = box;
      return {
        body: PARCELS.filter((p) => {
          const ring = p.geom.coordinates[0][0];
          const xs = ring.map((c) => c[0]), ys = ring.map((c) => c[1]);
          return Math.max(...xs) >= minLon && Math.min(...xs) <= maxLon && Math.max(...ys) >= minLat && Math.min(...ys) <= maxLat;
        }),
      };
    }],
    ['GET', '/api/parcels/byfolio', (req) => {
      const folio = (req.query.get('folio') ?? '').replace(/\D/g, '');
      const county = Number(req.query.get('countyId'));
      const found = county === COUNTY.countyId ? PARCELS.filter((p) => p.folio === folio) : [];
      return found.length ? { body: found } : notFound(`No parcel boundary is on record for folio ${folio || '(none)'}.`);
    }],
    ['GET', '/api/addresses/search', (req) => {
      const raw = (req.query.get('rawAddress') ?? '').trim();
      const matches = raw.length >= 3 ? ROWS.filter((r) => matchesAddress(r, raw)).slice(0, 20).map(searchItem) : [];
      return matches.length ? { body: matches } : notFound(`No property matches "${raw}".`);
    }],
    ['GET', '/api/addresses/suggest', (req) => {
      const raw = (req.query.get('raw') ?? '').trim();
      if (raw.length < 3) return { body: [] };
      return { body: ROWS.filter((r) => fact(r, 'address') && matchesAddress(r, raw)).slice(0, 8).map((r) => `${r.address}, ${r.city}, FL ${r.zip}`) };
    }],
    ['GET', '/api/locations/states', () => ({ body: [{ ...STATE }] })],
    ['GET', '/api/locations/counties', (req) => {
      const stateId = Number(req.query.get('stateId'));
      if (!Number.isSafeInteger(stateId)) return badRequest('stateId is required.');
      return { body: stateId === STATE.id ? COUNTIES.map((c) => ({ ...c })) : [] };
    }],
    ['GET', '/api/predictions/bypropertyid', (req, ctx) => {
      const r = rowFor(req.query.get('propertyId'));
      const p = r && prediction(r, ctx);
      return p ? { body: p } : notFound('No prediction has been scored for this property.');
    }],
    ['POST', '/api/predictions/bulk', (req, ctx) => {
      const ids = idsOf(req.body);
      if (!ids) return badRequest('propertyIds is required.');
      const map = {};
      for (const id of ids) {
        const r = rowFor(id);
        const p = r && prediction(r, ctx);
        if (p) map[String(id)] = p;
      }
      // The service answers 404 when none of the requested properties has a prediction.
      return Object.keys(map).length ? { body: map } : notFound('None of these properties has a prediction.');
    }],
    ['POST', '/api/property-school-analysis/bulk', (req) => {
      const ids = idsOf(req.body);
      if (!ids) return badRequest('propertyIds is required.');
      const map = {};
      for (const id of ids) {
        const a = rowFor(id) && schoolAnalysis(rowFor(id));
        if (a) map[String(id)] = a;
      }
      return { body: map };
    }],
    ['POST', '/api/property-transportation-analysis/bulk', (req, ctx) => {
      const ids = idsOf(req.body);
      if (!ids) return badRequest('propertyIds is required.');
      const map = {};
      for (const id of ids) {
        const a = rowFor(id) && transportAnalysis(rowFor(id), ctx);
        if (a) map[String(id)] = a;
      }
      return { body: map };
    }],
    ['GET', '/api/map/layers', () => ({
      body: [{ id: 'parcels', name: 'Parcel boundaries', type: 'polygon', source: 'Miami-Dade County Property Appraiser parcel layer', coverage: ['Miami-Dade, FL'], featureCount: PARCELS.length, lastUpdated: '2026-10-28T04:00:00Z' }],
    })],
    ['GET', '/api/contact-requests/professionals', (req, ctx) => {
      const size = Number(req.query.get('size') ?? 100);
      if (!Number.isSafeInteger(size) || size < 1 || size > 100) return badRequest('size must be between 1 and 100.');
      return { body: page(ctx.flags.empty ? [] : PROFESSIONALS.map((p) => ({ ...p })), req.query, 100) };
    }],
    ['POST', '/api/contact-requests', (req, ctx) => submitContact(req, ctx)],
    ['GET', /^\/api\/contact-requests\/(\d+)$/, (req) => {
      const c = db.contacts.find((x) => x.id === Number(req.params[1]));
      if (!c) return notFound('This contact request was not found.');
      c.deliveryStatus = 'SENT'; // the broker picked it up after the first read
      return { body: c };
    }],
  ],
};
