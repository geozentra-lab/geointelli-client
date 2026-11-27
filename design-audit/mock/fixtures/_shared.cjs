// Shared fixture contract. Every domain module imports this so cross-domain references (a favorite,
// a holding, a loan's collateral, a CRM deal) point at the same property records.
//
// All data here is synthetic. Addresses follow the Miami-Dade grid format so string lengths are
// realistic; owners, prices and scores are invented and must never be presented as real records.

/** Spring Page<T> as the app's core/models/api.ts Page<T> expects it. */
function page(all, query, defaultSize = 20) {
  const size = Number(query?.get?.('size') ?? defaultSize) || defaultSize;
  const number = Number(query?.get?.('page') ?? 0) || 0;
  const content = all.slice(number * size, number * size + size);
  const totalPages = Math.ceil(all.length / size);
  return {
    content,
    page: number,
    size,
    totalElements: all.length,
    totalPages,
    first: number === 0,
    last: number + 1 >= totalPages,
  };
}

const COUNTY = { countyId: 17, countyName: 'Miami-Dade', stateCode: 'FL', stateId: 12 };

// Canonical property identities. Domain modules map these into whatever DTO they serve.
// `gaps` lists facts the backend is assumed NOT to have for that record, so every module renders
// the same record as "unavailable" in the same places (never 0).
const PROPERTIES = [
  { id: 42, folio: '0141370120450', address: '2847 SW 27th Ter', city: 'Miami', zip: '33133', lat: 25.7424, lng: -80.2375, beds: 3, baths: 2, sqft: 1840, lotSqft: 6250, yearBuilt: '1952', use: 'Single family', gaps: [] },
  { id: 43, folio: '0141370120460', address: '2861 SW 27th Ter', city: 'Miami', zip: '33133', lat: 25.7425, lng: -80.2381, beds: 3, baths: 2, sqft: 1712, lotSqft: 6100, yearBuilt: '1951', use: 'Single family', gaps: [] },
  { id: 44, folio: '0141160290330', address: '3120 Day Ave', city: 'Miami', zip: '33133', lat: 25.7331, lng: -80.2442, beds: 4, baths: 3, sqft: 2410, lotSqft: 7800, yearBuilt: '1938', use: 'Single family', gaps: [] },
  { id: 45, folio: '3022320060120', address: '1475 W 44th Pl, Unit 208', city: 'Hialeah', zip: '33012', lat: 25.8591, lng: -80.3104, beds: 2, baths: 2, sqft: 1050, lotSqft: null, yearBuilt: '1987', use: 'Condominium', gaps: ['lotSqft', 'saleHistory'] },
  { id: 46, folio: '3059010041870', address: '18402 NW 7th Ave', city: 'Miami Gardens', zip: '33169', lat: 25.9412, lng: -80.2105, beds: 3, baths: 1, sqft: 1225, lotSqft: 7500, yearBuilt: '1961', use: 'Single family', gaps: ['valuation'] },
  { id: 47, folio: '0131180190040', address: '640 NE 74th St', city: 'Miami', zip: '33138', lat: 25.8418, lng: -80.1859, beds: 5, baths: 3, sqft: 2980, lotSqft: 9200, yearBuilt: '1948', use: 'Duplex', gaps: [] },
  { id: 48, folio: '3040190110560', address: '11960 SW 186th St', city: 'Miami', zip: '33177', lat: 25.6014, lng: -80.3901, beds: 4, baths: 2, sqft: 1960, lotSqft: 8100, yearBuilt: '1994', use: 'Single family', gaps: ['beds', 'baths', 'yearBuilt'] },
  { id: 49, folio: '0232060011210', address: '1700 Collins Ave, Unit 1504', city: 'Miami Beach', zip: '33139', lat: 25.7929, lng: -80.1291, beds: 1, baths: 1, sqft: 790, lotSqft: null, yearBuilt: '2008', use: 'Condominium', gaps: ['lotSqft', 'valuation', 'opportunityScore'] },
];

/** Persona and data volume for the current capture. Set by the capture script via /__mock/state. */
function scenarioFlags(state) {
  return {
    empty: state.scenario === 'empty',
    full: state.scenario !== 'empty',
    persona: state.persona, // 'USER' | 'RESIDENTIAL_INVESTOR' | 'REALTOR' | 'BANK_LENDER'
    admin: !!state.admin,
  };
}

/** ISO date helpers relative to a fixed "today" so screenshots are stable across runs. */
const TODAY = new Date('2026-11-18T15:00:00Z');
function daysAgo(n) {
  return new Date(TODAY.getTime() - n * 86400000).toISOString();
}
function dateOnly(iso) {
  return iso.slice(0, 10);
}

module.exports = { page, COUNTY, PROPERTIES, scenarioFlags, TODAY, daysAgo, dateOnly };
