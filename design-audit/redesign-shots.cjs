#!/usr/bin/env node
// Before/after screenshots for each redesign item (see PROGRESS.md), against the audit's mock server.
//
//   node --experimental-websocket design-audit/redesign-shots.cjs --item 0-shell --side before --app design-audit/.build-start/browser
//   node --experimental-websocket design-audit/redesign-shots.cjs --item 0-shell --side after  --app design-audit/.build/browser
//
// Writes design-audit/screenshots/<item>/<side>/<shot>.png and design-audit/screenshots/<item>/index.html
// (before and after side by side). A shot with `holdApp` keeps the app's main script from loading, so
// the start-up state (index.html, before Angular and the sign-in check) stays on screen.
// As in foundation-shots.cjs, the served copy of the build points its API base at the mock, so a real
// backend on port 8081 is never contacted.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const ITEM = arg('--item', null);
const SIDE = arg('--side', 'after');
const only = arg('--only', null);
const APP = path.resolve(arg('--app', path.join(__dirname, '.build', 'browser')));
const ROOT = path.join(__dirname, 'screenshots', ITEM || 'x');
const out = path.join(ROOT, SIDE);
const PORT = 4310;
const MOCK = `http://127.0.0.1:${PORT}`;
const KEYCLOAK_HOST = 'http://3.229.63.159:8090';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = 9338;

const desktop = { width: 1440, height: 900, mobile: false };
const laptop = { width: 1280, height: 800, mobile: false };
const tablet = { width: 768, height: 1024, mobile: false };
const phone = { width: 390, height: 844, mobile: true };
const buyer = { persona: 'USER' };
const investor = { persona: 'RESIDENTIAL_INVESTOR' };
const realtor = { persona: 'REALTOR' };
const lender = { persona: 'BANK_LENDER' };
const guest = { signedIn: false };
const s = (name, route, opts = {}) => ({ name, route, viewport: desktop, ...opts });
const typeSearch = (q) => [{ wait: '!!document.querySelector("#shell-search-input")' }, {
  eval: `(()=>{const i=document.querySelector('#shell-search-input');i.focus();i.value=${JSON.stringify(q)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`,
  wait: '!!document.querySelector(".search-option")',
  pause: 600,
}];

// The live map opens the property dialog after a folio search finds a parcel (as in shots.cjs).
const liveDialog = (folio) => [
  { eval: `(()=>{const s=document.querySelector('select[aria-label="Property state"]');s.selectedIndex=1;s.dispatchEvent(new Event('change',{bubbles:true}))})()`, wait: `document.querySelector('select[aria-label="Property county"]')?.options.length>1` },
  { eval: `(()=>{const s=document.querySelector('select[aria-label="Property county"]');s.selectedIndex=[...s.options].findIndex(o=>o.textContent.includes('Miami-Dade'));s.dispatchEvent(new Event('change',{bubbles:true}))})()` },
  { eval: `(()=>{const i=document.querySelector('.parcel-search input');i.value=${JSON.stringify(folio)};i.dispatchEvent(new Event('input',{bubbles:true}))})()` },
  { eval: `[...document.querySelectorAll('.parcel-search button')].find(b=>b.textContent.trim()==='Search')?.click()`, wait: 'document.querySelectorAll("path.leaflet-interactive").length>0', pause: 1500 },
  // Click the highlighted parcel (the one drawn with a different fill), as a user would.
  { eval: `(()=>{const ps=[...document.querySelectorAll('path.leaflet-interactive')];const fills=ps.map(p=>p.getAttribute('fill'));const odd=ps.find((p,i)=>fills.filter(f=>f===fills[i]).length===1)||ps[0];const r=odd.getBoundingClientRect();odd.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))})()`, wait: '!!document.querySelector("mat-dialog-container")', pause: 1500 },
];
// Opens the contact sheet on the property page (item 1 onwards; the before build has no such button).
const askSheet = [{ click: '.ask-button', wait: '!!document.querySelector(".ask-sheet")', pause: 400 }];

// Item 2 helpers. They work on both builds where both have the control (the before build's Explore is
// a card grid with sort selects; the after build sorts by column header).
const clickText = (selector, re) =>
  `(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>${re}.test(x.textContent.trim()));b?.click();return !!b})()`;
const typeInto = (label, value) =>
  `(()=>{const i=document.querySelector('input[aria-label="${label}"]');i.focus();i.value=${JSON.stringify(value)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`;
const sortLivingDesc = `(()=>{const s=document.querySelector('select[aria-label="Sort properties"]');
  const one=[...s.options].find(o=>o.value==='livingAreaSqft|desc');
  if(one){s.value=one.value;s.dispatchEvent(new Event('change',{bubbles:true}));return}
  s.value='livingAreaSqft';s.dispatchEvent(new Event('change',{bubbles:true}));
  const d=document.querySelector('select[aria-label="Sort direction"]');d.value='desc';d.dispatchEvent(new Event('change',{bubbles:true}))})()`;
// Explore after the Zillow-like rebuild opens on the country with a state to choose: pick Florida
// (the mock's only state) and wait for the results, their values and their parcels. A no-op on the
// before build, which lists every property straight away.
const florida = { eval: clickText('.ex-states button', /^Florida$/), wait: '!document.querySelector(".ex-states")', pause: 4500 };
// The live map's folio search: Florida, Miami-Dade, then the folio (as in liveDialog, without the click).
const liveFolio = (folio) => liveDialog(folio).slice(0, 4);
const liveAddress = (text) => [
  { eval: clickText('.parcel-search .toggle button, .live-search .toggle button', /^Address$/) },
  { eval: `(()=>{const i=document.querySelector('.parcel-search input');i.focus();i.value=${JSON.stringify(text)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`, pause: 900 },
  { eval: clickText('.parcel-search button', /^Search$/), wait: '!!document.querySelector(".match-list, .matches")', pause: 1500 },
];

// Item 3 helpers. `prefs` saves the buyer's preferences in the mock before the page opens (the
// recommendations status follows from them); `fail` answers an API path with a 500 and `hold` never
// answers it (a loading state). Both builds keep #opp-min-score and the Apply button.
const prefs = (p) => ({ prep: [{ method: 'PUT', path: '/api/users/me/preferences', body: { minBudget: null, maxBudget: null, targetLocations: [], investmentGoals: [], ...p } }] });
const minScore = (n) => ({ eval: `(()=>{const i=document.querySelector('#opp-min-score');i.value='${n}';i.dispatchEvent(new Event('input',{bubbles:true}));${clickText('form button', /^Apply$/)}})()`, pause: 1500 });
const openRow = (i) => ({ eval: `document.querySelectorAll('.opp-table tbody tr.gz-row')[${i}]?.querySelector('td')?.click()`, wait: '!!document.querySelector(".desk-slot gz-record-pane")', pause: 800 });
const MATCHES = 'opportunities?view=matches';
// Fills the inline "Set your area and budget" form (Florida, Miami-Dade, a budget) and saves it.
const setArea = [
  { eval: `(()=>{const s=document.querySelector('gz-area-budget-form select[aria-label="State"]');s.selectedIndex=1;s.dispatchEvent(new Event('change',{bubbles:true}))})()`, wait: `document.querySelector('gz-area-budget-form select[aria-label="County"]')?.options.length>1` },
  { eval: `(()=>{const s=document.querySelector('gz-area-budget-form select[aria-label="County"]');s.selectedIndex=[...s.options].findIndex(o=>o.textContent.includes('Miami-Dade'));s.dispatchEvent(new Event('change',{bubbles:true}))})()` },
  { eval: `(()=>{const i=document.querySelector('gz-area-budget-form input[name=maxBudget]');i.value='900000';i.dispatchEvent(new Event('input',{bubbles:true}))})()`, pause: 300 },
];

// Item 4 helpers: pick a value in a select by id (the investor portfolio and lender organization
// switchers keep their ids in both builds).
const pick = (id, value) => ({ eval: `(()=>{const s=document.querySelector('#${id}');if(!s)return false;s.value='${value}';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`, pause: 1800 });

// Item 5 helpers: type into fields by id (both builds keep the ids) and submit the field's form.
const fill = (values) => ({
  eval: `(()=>{for(const [id,v] of Object.entries(${JSON.stringify(values)})){const i=document.getElementById(id);if(!i)continue;i.value=String(v);i.dispatchEvent(new Event('input',{bubbles:true}))}})()`,
  pause: 400,
});
const submit = (id) => ({ eval: `document.getElementById('${id}')?.form?.requestSubmit()`, pause: 1800 });
const MORTGAGE = { price: 650000, downPayment: 130000, rate: 6.5, term: 30, tax: 9100, insurance: 4200 };
const AFFORD = { income: 145000, debts: 650, affDown: 90000, affRate: 6.5, affTerm: 30, affTax: 7800, affInsurance: 3600 };
const RENTAL = { 'ra-rent': 3250, 'ra-vacancy': 5, 'ra-maintenance': 8, 'ra-management': 10, 'ra-tax': 6200, 'ra-insurance': 2900, 'ra-price': 465000, 'ra-down': 93000, 'ra-rate': 6.75, 'ra-term': 30, 'ra-closing': 9000, 'ra-horizon': 10 };
const RENTAL_RUN = [fill(RENTAL), fill({ 'ra-growth': 3 }), submit('ra-rent')];
const openScenario = { eval: clickText('button', /^Open$/), pause: 2200 };

// Item 6 helpers: open a register row (the after build's record pane) and the New alert form.
const openTableRow = (i) => ({ eval: `document.querySelectorAll('table tbody tr.gz-row')[${i}]?.querySelector('td')?.click()`, wait: '!!document.querySelector(".desk-slot gz-record-pane")', pause: 1500 });
const newAlert = { eval: clickText('button, a', /^New alert$/), wait: '!!document.querySelector(".desk-slot gz-record-pane")', pause: 800 };

// Item 7 helper: a "New …" button by its words (after build: it opens the form in the pane).
const clickNew = (re) => ({ eval: clickText('button', re), wait: '!!document.querySelector(".desk-slot gz-record-pane")', pause: 900 });

// Item 8 helper: open a rule's issues on Data quality (before: its "Show issues" button; after: its row).
const firstRule = {
  eval: `(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Show issues$/.test(x.textContent.trim()));if(b){b.click();return}document.querySelectorAll('.dq-rules tbody tr.gz-row')[0]?.querySelector('td')?.click()})()`,
  pause: 1800,
};
const admin = { admin: true };

// Item 9 helpers: tick two Compare boxes on Explore and open Compare from the tray; move the first
// application one stage on (a non-final stage, so no confirmation), then wait out the 5 s toast clear.
const compareTwo = [
  florida,
  { eval: `(()=>{const b=[...document.querySelectorAll('gz-compare-toggle input[type=checkbox]')].slice(0,2);b.forEach(x=>x.click());return b.length})()`, pause: 800 },
  { eval: `(()=>{const a=[...document.querySelectorAll('gz-compare-tray a, gz-compare-tray button')].find(x=>/compare/i.test(x.textContent));a?.click();return !!a})()`, wait: 'location.pathname.startsWith("/compare")', pause: 3000 },
];
const moveStage = [
  openTableRow(1),
  { eval: clickText('.desk-slot gz-record-pane button', /^(Submit|Start review)$/), pause: 6500 },
];

const SETS = {
  '10-compare': [
    // Side by side: a full set, a set with gaps (45 has no lot or sale, 46 no ZentraValue, 55 is vacant
    // land with almost nothing on record), nothing chosen, one chosen, a failed comparison, a guest.
    s('side-1440', 'compare?ids=42,43,44,47', { ...buyer, fullPage: true }),
    s('side-gaps-1440', 'compare?ids=42,45,46,55', { ...buyer, fullPage: true }),
    s('side-empty-1440', 'compare', { ...buyer }),
    s('side-error-1440', 'compare?ids=42,43', { ...buyer, fail: ['/api/properties/compare'] }),
    s('side-guest-1440', 'compare?ids=42,43', { ...guest, fullPage: true }),
    s('side-390', 'compare?ids=42,46', { ...buyer, viewport: phone, fullPage: true }),
    s('side-four-390', 'compare?ids=42,43,44,47', { ...buyer, viewport: phone, fullPage: true }),
    s('side-one-390', 'compare?ids=42', { ...buyer, viewport: phone }),
    // Comparable sales for one property: a full set, vacant land (none: residential only), a thin area.
    s('sales-1440', 'compare/42', { ...buyer, fullPage: true }),
    s('sales-none-1440', 'compare/55', { ...buyer }),
    s('sales-few-1440', 'compare/65', { ...buyer, fullPage: true }),
    s('sales-390', 'compare/42', { ...buyer, viewport: phone, fullPage: true }),
  ],
  '9-final': [
    // Carried fixes.
    s('alerts-pane-1440', 'alerts', { ...buyer, sides: ['after'], actions: [openTableRow(3)] }),
    s('opp-pane-1440', 'opportunities', { ...buyer, sides: ['after'], actions: [openRow(0)] }),
    s('alerts-pane-2560', 'alerts', { ...buyer, viewport: { width: 2560, height: 1000, mobile: false }, sides: ['after'], actions: [openTableRow(3)] }),
    s('explore-1440', 'explore', { ...buyer, actions: [florida] }),
    s('compare-1440', 'explore', { ...buyer, sides: ['after'], fullPage: true, actions: compareTwo }),
    s('property-1440', 'property/42', { ...buyer }),
    s('alerts-refs-loading-1440', 'alerts', { ...buyer, hold: ['/api/properties/id/'] }),
    s('alerts-refs-failed-1440', 'alerts', { ...buyer, fail: ['/api/properties/id/'] }),
    s('toast-error-1440', 'loan-review?tab=applications', { ...lender, sides: ['after'], fail: ['/api/lender/applications/'], actions: moveStage }),
    // 390 sweep: every main page of every persona, checked for sideways scroll.
    s('sweep-guest-overview-390', 'dashboard', { ...guest, viewport: phone, sides: ['after'] }),
    s('sweep-guest-property-390', 'property/42', { ...guest, viewport: phone, sides: ['after'] }),
    s('sweep-buyer-overview-390', 'dashboard', { ...buyer, viewport: phone, sides: ['after'] }),
    s('sweep-buyer-explore-390', 'explore', { ...buyer, viewport: phone, sides: ['after'], actions: [florida] }),
    s('sweep-buyer-property-390', 'property/42', { ...buyer, viewport: phone, sides: ['after'] }),
    s('sweep-buyer-opportunities-390', 'opportunities', { ...buyer, viewport: phone, sides: ['after'] }),
    s('sweep-buyer-saved-390', 'saved', { ...buyer, viewport: phone, sides: ['after'] }),
    s('sweep-buyer-alerts-390', 'alerts', { ...buyer, viewport: phone, sides: ['after'] }),
    s('sweep-buyer-compare-390', 'compare', { ...buyer, viewport: phone, sides: ['after'] }),
    s('sweep-buyer-settings-390', 'settings', { ...buyer, viewport: phone, sides: ['after'] }),
    s('sweep-investor-overview-390', 'dashboard', { ...investor, viewport: phone, sides: ['after'] }),
    s('sweep-investor-portfolio-390', 'portfolio', { ...investor, viewport: phone, sides: ['after'] }),
    s('sweep-investor-studio-390', 'investment-studio?mode=rental', { ...investor, viewport: phone, sides: ['after'] }),
    s('sweep-investor-opportunities-390', 'opportunities', { ...investor, viewport: phone, sides: ['after'] }),
    s('sweep-realtor-overview-390', 'dashboard', { ...realtor, viewport: phone, sides: ['after'] }),
    s('sweep-realtor-crm-390', 'crm', { ...realtor, viewport: phone, sides: ['after'] }),
    s('sweep-realtor-leads-390', 'crm/leads', { ...realtor, viewport: phone, sides: ['after'] }),
    s('sweep-lender-overview-390', 'dashboard', { ...lender, viewport: phone, sides: ['after'] }),
    s('sweep-lender-applications-390', 'loan-review?tab=applications', { ...lender, viewport: phone, sides: ['after'] }),
    s('sweep-lender-team-390', 'loan-review?tab=team', { ...lender, viewport: phone, sides: ['after'] }),
    s('sweep-admin-jobs-390', 'admin/import-jobs', { ...buyer, ...admin, viewport: phone, sides: ['after'] }),
    s('sweep-admin-quality-390', 'admin/data-quality?rule=SALE_DUPLICATE', { ...buyer, ...admin, viewport: phone, sides: ['after'] }),
    s('sweep-admin-valuations-390', 'admin/valuations', { ...buyer, ...admin, viewport: phone, sides: ['after'] }),
    s('sweep-live-map-390', 'explore/live', { ...buyer, viewport: phone, sides: ['after'] }),
  ],
  '8-settings': [
    // Settings (reading page): the buyer (public shell), the realtor with a verified license and an
    // earlier rejection, the empty account (realtor with no license: the form), guests.
    s('settings-1440', 'settings', { ...buyer, fullPage: true }),
    s('settings-390', 'settings', { ...buyer, viewport: phone, fullPage: true }),
    s('settings-realtor-1440', 'settings', { ...realtor, fullPage: true }),
    s('settings-realtor-390', 'settings', { ...realtor, viewport: phone, fullPage: true }),
    s('settings-empty-1440', 'settings', { ...realtor, scenario: 'empty', fullPage: true }),
    s('settings-guest-1440', 'settings', { ...guest }),
    // Admin (an account that is only an admin: the pro shell with the Admin group).
    s('jobs-1440', 'admin/import-jobs', { ...buyer, ...admin, fullPage: true, pause: 1200 }),
    s('jobs-390', 'admin/import-jobs', { ...buyer, ...admin, viewport: phone, fullPage: true, pause: 1200 }),
    s('jobs-pane-1440', 'admin/import-jobs', { ...buyer, ...admin, sides: ['after'], actions: [openTableRow(0)] }),
    s('jobs-pane-390', 'admin/import-jobs', { ...buyer, ...admin, viewport: phone, fullPage: true, sides: ['after'], actions: [openTableRow(0)] }),
    s('jobs-upload-1440', 'admin/import-jobs', { ...buyer, ...admin, sides: ['after'], actions: [clickNew(/^Import county data$/)] }),
    s('jobs-empty-1440', 'admin/import-jobs', { ...buyer, ...admin, scenario: 'empty' }),
    s('quality-1440', 'admin/data-quality', { ...buyer, ...admin, fullPage: true }),
    s('quality-rule-1440', 'admin/data-quality', { ...buyer, ...admin, fullPage: true, actions: [firstRule] }),
    s('quality-rule-390', 'admin/data-quality', { ...buyer, ...admin, viewport: phone, fullPage: true, actions: [firstRule] }),
    s('quality-empty-1440', 'admin/data-quality', { ...buyer, ...admin, scenario: 'empty' }),
    s('valuations-1440', 'admin/valuations', { ...buyer, ...admin, fullPage: true }),
    s('valuations-390', 'admin/valuations', { ...buyer, ...admin, viewport: phone, fullPage: true }),
    s('valuations-pane-1440', 'admin/valuations', { ...buyer, ...admin, sides: ['after'], actions: [openTableRow(3)] }),
    s('valuations-empty-1440', 'admin/valuations', { ...buyer, ...admin, scenario: 'empty' }),
    s('admin-denied-1440', 'admin/import-jobs', { ...lender }),
    s('admin-guest-390', 'admin/data-quality', { ...guest, viewport: phone }),
  ],
  '7-crm': [
    // CRM (realtor, pro shell): the overview and the four registers; a record and a New form in the pane.
    s('crm-1440', 'crm', { ...realtor, fullPage: true }),
    s('crm-390', 'crm', { ...realtor, viewport: phone, fullPage: true }),
    s('crm-clients-1440', 'crm/clients', { ...realtor, fullPage: true }),
    s('crm-leads-1440', 'crm/leads', { ...realtor, fullPage: true }),
    s('crm-leads-390', 'crm/leads', { ...realtor, viewport: phone, fullPage: true }),
    s('crm-tasks-1440', 'crm/tasks', { ...realtor, fullPage: true }),
    s('crm-deals-1440', 'crm/deals', { ...realtor, fullPage: true }),
    s('crm-deals-offer-1440', 'crm/deals?stage=OFFER', { ...realtor, fullPage: true }),
    s('crm-lead-pane-1440', 'crm/leads', { ...realtor, sides: ['after'], actions: [openTableRow(0)] }),
    s('crm-task-pane-1440', 'crm/tasks', { ...realtor, sides: ['after'], actions: [openTableRow(0)] }),
    s('crm-client-pane-1280', 'crm/clients', { ...realtor, viewport: laptop, sides: ['after'], actions: [openTableRow(0)] }),
    s('crm-deal-pane-390', 'crm/deals', { ...realtor, viewport: phone, fullPage: true, sides: ['after'], actions: [openTableRow(0)] }),
    s('crm-new-lead-1440', 'crm/leads', { ...realtor, sides: ['after'], actions: [clickNew(/^New lead$/)] }),
    s('crm-empty-1440', 'crm/clients', { ...realtor, scenario: 'empty' }),
    s('crm-guest-1440', 'crm', { ...guest }),
    // Loan review (lender, pro shell): the four tabs; an application and New application in the pane.
    s('loan-1440', 'loan-review?tab=pipeline', { ...lender, fullPage: true }),
    s('loan-390', 'loan-review?tab=pipeline', { ...lender, viewport: phone, fullPage: true }),
    s('loan-apps-1440', 'loan-review?tab=applications', { ...lender, fullPage: true }),
    s('loan-apps-390', 'loan-review?tab=applications', { ...lender, viewport: phone, fullPage: true }),
    s('loan-apps-1280', 'loan-review?tab=applications', { ...lender, viewport: laptop, fullPage: true }),
    s('loan-app-pane-1440', 'loan-review?tab=applications', { ...lender, sides: ['after'], actions: [openTableRow(0)] }),
    s('loan-app-pane-390', 'loan-review?tab=applications', { ...lender, viewport: phone, fullPage: true, sides: ['after'], actions: [openTableRow(0)] }),
    s('loan-new-app-1440', 'loan-review?tab=applications', { ...lender, sides: ['after'], actions: [clickNew(/^New application$/)] }),
    s('loan-import-1440', 'loan-review?tab=import', { ...lender, fullPage: true }),
    s('loan-team-1440', 'loan-review?tab=team', { ...lender, fullPage: true }),
    s('loan-noorg-1440', 'loan-review', { ...lender, scenario: 'empty' }),
    s('loan-guest-390', 'loan-review', { ...guest, viewport: phone }),
  ],
  '6-saved': [
    // Saved (buyer, public shell): properties, then searches; the investor's pro shell.
    s('saved-1440', 'saved', { ...buyer, fullPage: true }),
    s('saved-390', 'saved', { ...buyer, viewport: phone, fullPage: true }),
    s('saved-searches-1440', 'saved?view=searches', { ...buyer, fullPage: true }),
    s('saved-searches-390', 'saved?view=searches', { ...buyer, viewport: phone, fullPage: true }),
    s('saved-search-pane-1440', 'saved?view=searches', { ...buyer, sides: ['after'], actions: [openTableRow(0)] }),
    s('saved-search-pane-390', 'saved?view=searches', { ...buyer, viewport: phone, fullPage: true, sides: ['after'], actions: [openTableRow(0)] }),
    s('saved-investor-1440', 'saved', { ...investor, fullPage: true }),
    s('saved-empty-1440', 'saved', { ...buyer, scenario: 'empty' }),
    s('saved-guest-1440', 'saved', { ...guest }),
    s('saved-error-1440', 'saved', { ...buyer, fail: ['/api/favorites'] }),
    // Alerts: the rules, a rule's checks in the pane, the New alert form, none, a guest.
    s('alerts-1440', 'alerts', { ...buyer, fullPage: true }),
    s('alerts-390', 'alerts', { ...buyer, viewport: phone, fullPage: true }),
    s('alerts-1280', 'alerts', { ...buyer, viewport: laptop, fullPage: true }),
    s('alerts-pane-1440', 'alerts', { ...buyer, sides: ['after'], actions: [openTableRow(3)] }),
    s('alerts-blocked-1440', 'alerts', { ...buyer, sides: ['after'], actions: [openTableRow(1)] }),
    s('alerts-pane-390', 'alerts', { ...buyer, viewport: phone, fullPage: true, sides: ['after'], actions: [openTableRow(3)] }),
    s('alerts-new-1440', 'alerts', { ...buyer, sides: ['after'], actions: [newAlert] }),
    s('alerts-investor-1440', 'alerts', { ...investor, fullPage: true }),
    s('alerts-empty-1440', 'alerts', { ...buyer, scenario: 'empty' }),
    s('alerts-guest-390', 'alerts', { ...guest, viewport: phone }),
  ],
  '5-studio': [
    // Mortgage payment (the default tab): empty, then a calculation with tax and insurance.
    s('studio-mortgage-1440', 'investment-studio', { ...investor }),
    s('studio-mortgage-390', 'investment-studio', { ...investor, viewport: phone, fullPage: true }),
    s('studio-mortgage-result-1440', 'investment-studio', { ...investor, fullPage: true, actions: [fill(MORTGAGE), submit('price')] }),
    s('studio-mortgage-result-390', 'investment-studio', { ...investor, viewport: phone, fullPage: true, actions: [fill(MORTGAGE), submit('price')] }),
    s('studio-mortgage-buyer-1440', 'investment-studio', { ...buyer, fullPage: true, actions: [fill(MORTGAGE), submit('price')] }),
    // Affordability.
    s('studio-afford-1440', 'investment-studio?mode=affordability', { ...buyer }),
    s('studio-afford-result-1440', 'investment-studio?mode=affordability', { ...buyer, fullPage: true, actions: [fill(AFFORD), submit('income')] }),
    s('studio-afford-result-390', 'investment-studio?mode=affordability', { ...buyer, viewport: phone, fullPage: true, actions: [fill(AFFORD), submit('income')] }),
    // Rental investment: the saved scenarios, a full analysis with financing and a 10-year projection.
    s('studio-rental-1440', 'investment-studio?mode=rental', { ...investor, fullPage: true }),
    s('studio-rental-390', 'investment-studio?mode=rental', { ...investor, viewport: phone, fullPage: true }),
    s('studio-rental-result-1440', 'investment-studio?mode=rental', { ...investor, fullPage: true, actions: RENTAL_RUN }),
    s('studio-rental-result-390', 'investment-studio?mode=rental', { ...investor, viewport: phone, fullPage: true, actions: RENTAL_RUN }),
    s('studio-rental-1280', 'investment-studio?mode=rental', { ...investor, viewport: laptop, fullPage: true, actions: RENTAL_RUN }),
    s('studio-rental-768', 'investment-studio?mode=rental', { ...investor, viewport: tablet, fullPage: true, actions: RENTAL_RUN }),
    s('studio-scenario-1440', 'investment-studio?mode=rental', { ...investor, fullPage: true, actions: [openScenario] }),
    s('studio-rent-only-1440', 'investment-studio?mode=rental', { ...investor, fullPage: true, actions: [fill({ 'ra-rent': 2800 }), submit('ra-rent')] }),
    // Opened from a property record (Open in Studio).
    s('studio-property-1440', 'investment-studio/42?mode=rental', { ...investor, fullPage: true }),
    s('studio-property-390', 'investment-studio/42', { ...investor, viewport: phone, fullPage: true }),
    // No scenarios, a guest, a failed calculation.
    s('studio-rental-empty-1440', 'investment-studio?mode=rental', { ...investor, scenario: 'empty' }),
    s('studio-guest-1440', 'investment-studio?mode=rental', { ...guest, fullPage: true }),
    s('studio-error-1440', 'investment-studio?mode=rental', { ...investor, fail: ['/api/calculations/investment'], actions: RENTAL_RUN }),
  ],
  '4-dashboards': [
    // Buyer (public shell): the full account is PARTIAL (budget and goals saved, not applied).
    s('buyer-1440', 'dashboard', { ...buyer, fullPage: true }),
    s('buyer-390', 'dashboard', { ...buyer, viewport: phone, fullPage: true }),
    s('buyer-768', 'dashboard', { ...buyer, viewport: tablet, fullPage: true }),
    s('buyer-noprefs-1440', 'dashboard', { ...buyer, scenario: 'empty', fullPage: true }),
    s('buyer-noprefs-390', 'dashboard', { ...buyer, scenario: 'empty', viewport: phone, fullPage: true }),
    s('buyer-nomatch-1440', 'dashboard', { ...buyer, fullPage: true, ...prefs({ targetLocations: [{ countyId: 99 }] }) }),
    s('buyer-nomatch-390', 'dashboard', { ...buyer, viewport: phone, fullPage: true, ...prefs({ targetLocations: [{ countyId: 99 }] }) }),
    s('buyer-error-1440', 'dashboard', { ...buyer, fullPage: true, fail: ['/api/dashboards/user/saved-searches'] }),
    s('buyer-guest-1440', 'dashboard', { ...guest }),
    s('buyer-guest-390', 'dashboard', { ...guest, viewport: phone }),
    // Investor: all portfolios (partial), one partial portfolio with cash flow, one complete.
    s('investor-1440', 'dashboard', { ...investor, fullPage: true }),
    s('investor-390', 'dashboard', { ...investor, viewport: phone, fullPage: true }),
    s('investor-1280', 'dashboard', { ...investor, viewport: laptop, fullPage: true }),
    s('investor-portfolio-1440', 'dashboard', { ...investor, fullPage: true, actions: [pick('dash-portfolio', '1')] }),
    s('investor-portfolio-390', 'dashboard', { ...investor, viewport: phone, fullPage: true, actions: [pick('dash-portfolio', '1')] }),
    s('investor-complete-1440', 'dashboard', { ...investor, fullPage: true, actions: [pick('dash-portfolio', '2')] }),
    s('investor-complete-390', 'dashboard', { ...investor, viewport: phone, fullPage: true, actions: [pick('dash-portfolio', '2')] }),
    s('investor-empty-1440', 'dashboard', { ...investor, scenario: 'empty', fullPage: true }),
    s('investor-empty-390', 'dashboard', { ...investor, scenario: 'empty', viewport: phone, fullPage: true }),
    // Realtor.
    s('realtor-1440', 'dashboard', { ...realtor, fullPage: true }),
    s('realtor-390', 'dashboard', { ...realtor, viewport: phone, fullPage: true }),
    s('realtor-empty-1440', 'dashboard', { ...realtor, scenario: 'empty', fullPage: true }),
    s('realtor-empty-390', 'dashboard', { ...realtor, scenario: 'empty', viewport: phone, fullPage: true }),
    s('realtor-loading-1440', 'dashboard', { ...realtor, hold: ['/api/dashboards/realtor/tasks-pipeline'] }),
    // Lender: Biscayne (8 waiting), the pilot organization with no applications, no organization.
    s('lender-1440', 'dashboard', { ...lender, fullPage: true }),
    s('lender-390', 'dashboard', { ...lender, viewport: phone, fullPage: true }),
    s('lender-1280', 'dashboard', { ...lender, viewport: laptop, fullPage: true }),
    s('lender-nowaiting-1440', 'dashboard', { ...lender, fullPage: true, actions: [pick('dash-org', '6')] }),
    s('lender-nowaiting-390', 'dashboard', { ...lender, viewport: phone, fullPage: true, actions: [pick('dash-org', '6')] }),
    s('lender-empty-1440', 'dashboard', { ...lender, scenario: 'empty', fullPage: true }),
    s('lender-error-1440', 'dashboard', { ...lender, fullPage: true, fail: ['/api/lender/pipeline'] }),
    // The admin role: an admin-only account lands on Import jobs; an admin lender keeps the lender overview.
    s('admin-1440', 'dashboard', { ...buyer, admin: true, pause: 1500 }),
    s('admin-390', 'dashboard', { ...buyer, admin: true, viewport: phone, pause: 1500 }),
    s('admin-lender-1440', 'dashboard', { ...lender, admin: true, fullPage: true }),
  ],
  '3-opportunities': [
    s('opp-scored-1440', 'opportunities', { ...buyer, fullPage: true }),
    s('opp-scored-390', 'opportunities', { ...buyer, viewport: phone, fullPage: true }),
    s('opp-scored-investor-1440', 'opportunities', { ...investor, fullPage: true }),
    s('opp-scored-768', 'opportunities', { ...buyer, viewport: tablet, fullPage: true }),
    s('opp-filtered-empty-1440', 'opportunities', { ...buyer, actions: [minScore(99)] }),
    s('opp-unscored-1440', 'opportunities', { ...buyer, scenario: 'empty' }),
    s('opp-unscored-390', 'opportunities', { ...buyer, scenario: 'empty', viewport: phone }),
    s('opp-error-1440', 'opportunities', { ...buyer, fail: ['/api/opportunities'] }),
    s('opp-loading-1440', 'opportunities', { ...buyer, hold: ['/api/opportunities'] }),
    // Opening a row shows its score and factors in the record pane (the before build's cards link
    // straight to the property page).
    s('opp-pane-1440', 'opportunities', { ...buyer, sides: ['after'], actions: [openRow(0)] }),
    s('opp-pane-investor-1440', 'opportunities', { ...investor, sides: ['after'], fullPage: true, actions: [openRow(4)] }),
    s('opp-pane-1280', 'opportunities', { ...buyer, viewport: laptop, sides: ['after'], actions: [openRow(1)] }),
    s('opp-pane-390', 'opportunities', { ...buyer, viewport: phone, fullPage: true, sides: ['after'], actions: [openRow(5)] }),
    s('opp-matches-1440', MATCHES, { ...buyer, fullPage: true }),
    s('opp-matches-390', MATCHES, { ...buyer, viewport: phone, fullPage: true }),
    s('opp-matches-768', MATCHES, { ...buyer, viewport: tablet, fullPage: true }),
    s('opp-matches-ready-1440', MATCHES, { ...buyer, fullPage: true, ...prefs({ targetLocations: [{ countyId: 17 }] }) }),
    s('opp-matches-noprefs-1440', MATCHES, { ...buyer, scenario: 'empty' }),
    s('opp-matches-noprefs-390', MATCHES, { ...buyer, scenario: 'empty', viewport: phone, fullPage: true }),
    s('opp-matches-location-1440', MATCHES, { ...buyer, ...prefs({ minBudget: 400000, maxBudget: 900000 }) }),
    s('opp-matches-filled-1440', MATCHES, { ...buyer, scenario: 'empty', sides: ['after'], actions: setArea }),
    s('opp-matches-saved-1440', MATCHES, { ...buyer, scenario: 'empty', sides: ['after'], fullPage: true, actions: [...setArea, { eval: clickText('gz-area-budget-form button', /Show matches/), pause: 2500 }] }),
    s('opp-matches-nomatch-1440', MATCHES, { ...buyer, ...prefs({ targetLocations: [{ countyId: 99 }] }) }),
    s('opp-matches-nomatch-390', MATCHES, { ...buyer, viewport: phone, ...prefs({ targetLocations: [{ countyId: 99 }] }) }),
    s('opp-matches-values-error-1440', MATCHES, { ...buyer, fail: ['/api/predictions/bulk'] }),
    s('opp-matches-error-1440', MATCHES, { ...buyer, fail: ['/api/recommendations'] }),
    s('opp-matches-guest-1440', MATCHES, { ...guest }),
    s('opp-matches-guest-390', MATCHES, { ...guest, viewport: phone }),
  ],
  '2-explore': [
    s('explore-start-1440', 'explore', { ...buyer, pause: 2500 }),
    s('explore-start-390', 'explore', { ...buyer, viewport: phone }),
    s('explore-1440', 'explore', { ...buyer, actions: [florida] }),
    s('explore-pick-1440', 'explore', { ...buyer, sides: ['after'], actions: [florida, { eval: `document.querySelectorAll('gz-explore-card')[8]?.querySelector('.xc-show')?.click()`, pause: 3500 }] }),
    s('explore-pin-1440', 'explore', { ...buyer, sides: ['after'], actions: [florida, { eval: `[...document.querySelectorAll('.xm-pin.pill')].at(-1)?.dispatchEvent(new MouseEvent('click',{bubbles:true}))`, pause: 3500 }] }),
    s('explore-390', 'explore', { ...buyer, viewport: phone, fullPage: true, actions: [florida] }),
    s('explore-map-390', 'explore', { ...buyer, viewport: phone, actions: [florida, { eval: clickText('button', /^Map( \+ list)?$/), pause: 4500 }] }),
    s('explore-pick-390', 'explore', { ...buyer, viewport: phone, sides: ['after'], actions: [florida, { eval: `document.querySelectorAll('gz-explore-card')[1]?.querySelector('.xc-show')?.click()`, pause: 4500 }] }),
    s('explore-1280', 'explore', { ...buyer, viewport: laptop, actions: [florida] }),
    s('explore-1024', 'explore', { ...buyer, viewport: { width: 1024, height: 768, mobile: false }, actions: [florida] }),
    s('explore-pro-1024', 'explore', { ...investor, viewport: { width: 1024, height: 768, mobile: false }, actions: [florida] }),
    s('explore-768', 'explore', { ...buyer, viewport: tablet, actions: [florida] }),
    s('explore-pro-768', 'explore', { ...investor, viewport: tablet, actions: [florida] }),
    s('explore-guest-1440', 'explore', { ...guest, actions: [florida] }),
    s('explore-sorted-1440', 'explore', { ...buyer, actions: [florida, { eval: sortLivingDesc, pause: 3500 }] }),
    s('explore-page2-1440', 'explore', { ...buyer, actions: [florida, { eval: clickText('button', /^Next( page)?$/), pause: 4000 }] }),
    s('explore-empty-1440', 'explore', { ...buyer, actions: [florida, { eval: typeInto('City', 'Atlantis'), pause: 2500 }] }),
    // The map stays under the shell's toasts and menus (its Leaflet layers are isolated). The top-bar
    // search list can't be shown here: this harness has never kept it open (see 0-shell nav-search).
    s('explore-toast-1440', 'explore', { ...guest, sides: ['after'], actions: [florida, { eval: `document.querySelector('gz-explore-card .favorite-control')?.click()`, pause: 600 }] }),
    s('live-1440', 'explore/live', { ...buyer, pause: 2500 }),
    s('live-390', 'explore/live', { ...buyer, viewport: phone, fullPage: true, pause: 2500 }),
    s('live-folio-1440', 'explore/live', { ...buyer, actions: [...liveFolio('0141370120450'), { pause: 2500 }] }),
    s('live-folio-390', 'explore/live', { ...buyer, viewport: phone, actions: [...liveFolio('0141370120450'), { pause: 2500 }] }),
    s('live-matches-1440', 'explore/live', { ...buyer, fullPage: true, actions: [...liveAddress('SW 27th Ter'), { pause: 2500 }] }),
    // The comparables map now gets Leaflet's stylesheet lazily: it should look as it did.
    s('comparables-1440', 'property/42', { ...buyer, sides: ['after'], actions: [{ tab: 'comparables', pause: 3000 }] }),
    s('live-heatmap-1440', 'explore/live', { ...buyer, fullPage: true, actions: [...liveFolio('0141370120450'), { click: '.leaflet-control-zoom-out', pause: 700 }, { click: '.leaflet-control-zoom-out', pause: 700 }, { click: '.leaflet-control-zoom-out', pause: 1500 }, { eval: clickText('button', /Growth/), pause: 3000 }] }),
  ],
  '1-property': [
    s('p42-overview-1440', 'property/42', { ...buyer, fullPage: true }),
    s('p42-overview-390', 'property/42', { ...buyer, viewport: phone, fullPage: true }),
    s('p42-valuation-1440', 'property/42', { ...buyer, fullPage: true, actions: [{ tab: 'valuation' }] }),
    s('p42-valuation-390', 'property/42', { ...buyer, viewport: phone, fullPage: true, actions: [{ tab: 'valuation' }] }),
    s('p42-location-1440', 'property/42', { ...buyer, fullPage: true, actions: [{ tab: 'location' }] }),
    s('p42-location-390', 'property/42', { ...buyer, viewport: phone, fullPage: true, actions: [{ tab: 'location' }] }),
    s('p42-sales-1440', 'property/42', { ...buyer, fullPage: true, actions: [{ tab: 'sales' }] }),
    s('p42-sales-390', 'property/42', { ...buyer, viewport: phone, fullPage: true, actions: [{ tab: 'sales' }] }),
    s('p42-features-1440', 'property/42', { ...buyer, fullPage: true, actions: [{ tab: 'features' }] }),
    s('p42-features-390', 'property/42', { ...buyer, viewport: phone, fullPage: true, actions: [{ tab: 'features' }] }),
    s('p42-comparables-1440', 'property/42', { ...buyer, fullPage: true, actions: [{ tab: 'comparables', pause: 2500 }] }),
    s('p42-comparables-390', 'property/42', { ...buyer, viewport: phone, fullPage: true, actions: [{ tab: 'comparables', pause: 2500 }] }),
    s('p42-ask-1440', 'property/42', { ...buyer, actions: askSheet }),
    s('p42-ask-390', 'property/42', { ...buyer, viewport: phone, actions: askSheet }),
    s('p42-guest-1440', 'property/42', { ...guest, fullPage: true }),
    s('p42-guest-390', 'property/42', { ...guest, viewport: phone, fullPage: true }),
    s('p44-limited-1440', 'property/44', { ...buyer, fullPage: true }),
    s('p48-gaps-1440', 'property/48', { ...buyer, fullPage: true }),
    s('p48-gaps-390', 'property/48', { ...buyer, viewport: phone, fullPage: true }),
    s('p49-unsupported-1440', 'property/49', { ...buyer, fullPage: true }),
    s('p49-unsupported-390', 'property/49', { ...buyer, viewport: phone, fullPage: true }),
    s('p49-valuation-1440', 'property/49', { ...buyer, fullPage: true, actions: [{ tab: 'valuation' }] }),
    s('dialog-42-1440', 'explore/live', { ...buyer, actions: liveDialog('0141370120450') }),
    s('dialog-42-390', 'explore/live', { ...buyer, viewport: phone, actions: liveDialog('0141370120450') }),
    s('dialog-46-1440', 'explore/live', { ...buyer, actions: liveDialog('3059010041870') }),
  ],
  '0-shell': [
    s('boot-public-1440', 'explore', { ...guest, holdApp: true }),
    s('boot-public-390', 'explore', { ...guest, holdApp: true, viewport: phone }),
    s('boot-pro-1440', 'dashboard', { ...lender, holdApp: true, storage: { 'gz.shell': 'pro' } }),
    s('boot-pro-390', 'dashboard', { ...lender, holdApp: true, viewport: phone, storage: { 'gz.shell': 'pro' } }),
    s('boot-slow-1440', 'dashboard', { ...lender, holdApp: true, storage: { 'gz.shell': 'pro' }, pause: 9000 }),
    s('nav-pro-lender-1440', 'dashboard', { ...lender }),
    s('nav-pro-realtor-1280', 'crm/leads', { ...realtor, viewport: laptop }),
    s('nav-pro-lender-390', 'loan-review', { ...lender, viewport: phone }),
    s('nav-more-390', 'crm/leads', { ...realtor, viewport: phone, actions: [{ click: '.bottombar .more', wait: '!!document.querySelector(".more-sheet")' }] }),
    s('nav-public-buyer-1440', 'explore', { ...buyer }),
    s('nav-public-buyer-768', 'saved', { ...buyer, viewport: tablet }),
    s('nav-public-guest-390', 'explore', { ...guest, viewport: phone }),
    s('nav-account-menu-1440', 'explore', { ...buyer, actions: [{ click: '.account-trigger', wait: '!!document.querySelector(".account-menu")' }] }),
    s('nav-search-1440', 'dashboard', { ...investor, actions: typeSearch('SW 27th') }),
    s('nav-search-390', 'explore', { ...buyer, viewport: phone, actions: [{ wait: '!!document.querySelector(".search-toggle")' }, { click: '.search-toggle', pause: 400 }, ...typeSearch('SW 27th')] }),
  ],
  // Item 0's start-up frame was reverted after review to the centred logo (before = item 0's frame).
  '0-startup': [
    s('boot-public-1440', 'explore', { ...guest, holdApp: true }),
    s('boot-public-390', 'explore', { ...guest, holdApp: true, viewport: phone }),
    s('boot-pro-1440', 'dashboard', { ...lender, holdApp: true, storage: { 'gz.shell': 'pro' } }),
    s('boot-pro-390', 'dashboard', { ...lender, holdApp: true, viewport: phone, storage: { 'gz.shell': 'pro' } }),
    s('boot-slow-1440', 'dashboard', { ...lender, holdApp: true, storage: { 'gz.shell': 'pro' }, pause: 9000 }),
    s('boot-slow-390', 'dashboard', { ...lender, holdApp: true, viewport: phone, storage: { 'gz.shell': 'pro' }, pause: 9000 }),
  ],
};
const NOTES = {
  '10-compare':
    'Left: the build at the start of item 10 (after item 9, design-audit/.build-pre-10). Right: after item 10. Same mock fixtures and viewport. side-*: Side by side from /compare?ids= (the compare tray link): a full set, a set with gaps (45 no lot or sale, 46 no ZentraValue, 55 vacant land), nothing chosen, a failed comparison, a guest, and at 390 two, four and one properties (before, the page scrolled sideways by 11 and 353 px). sales-*: Comparable sales from /compare/:id (the property page\'s Open in Compare): a full set, vacant land (residential only), a thin area (one sale). Some 390 before shots show the guest top bar: the harness\'s sign-in check is flaky on phones; the page content is the same.',
  '9-final':
    'Left: the build at the start of this task (after the foundation). Right: after item 9. Same mock fixtures and viewport. alerts-pane and opp-pane: a docked record pane in the public shell now meets the window edge (compare with ../6-saved/after/alerts-pane-1440.png and ../3-opportunities/after/opp-pane-1440.png, where a strip of page showed beside it). explore and compare: the §9 confidence line ("Confidence 70 of 100 · Medium"; Compare has the score alone). alerts-refs-loading holds every property lookup (a skeleton, not "Property #42"), alerts-refs-failed fails them ("Address unavailable"). toast-error fails a stage move and waits 6.5 s: the error toast stays until dismissed. sweep-* is every main page of every persona at 390 px, checked for sideways scroll (after only).',
  '8-settings':
    'Left: the build at the start of this task (after the foundation). Right: after item 8. Same mock fixtures and viewport. settings-* is Settings: the buyer, the realtor (a verified license and an earlier rejection), the empty account (a realtor with no license yet: the form) and guests. jobs-*, quality-* and valuations-* are the admin pages for an account that is only an admin: Import jobs (two running, failures, an image backfill), a job in the record pane and the upload form in the pane (after only), Data quality with the first rule’s issues, Valuation operations with a failed request in the pane (after only); "empty" is a fresh environment. admin-denied is a lender without the admin role; admin-guest a signed-out phone.',
  '7-crm':
    'Left: the build at the start of this task (after the foundation). Right: after item 7. Same mock fixtures and viewport. crm-* is the realtor’s CRM: the overview, then clients, leads, tasks and deals ("deals-offer" opens the deals filtered on Offer, as the overview’s pipeline links do); the *-pane shots open a record in the record pane and "new-lead" the New lead form there (after-only: the before build lists records with their buttons and puts its forms above the lists); "empty" has no CRM records; "guest" is signed out. loan-* is the lender’s Loan review (Biscayne Community Lending): the pipeline, the applications, an application in the pane, New application, import and team; "noorg" has no organization.',
  '6-saved':
    'Left: the build at the start of this task (after the foundation). Right: after item 6. Same mock fixtures and viewport. saved-* is the buyer’s Saved page (6 saved properties, 5 saved searches; "searches" opens the Searches tab, which the before build shows under the properties on one page); "search-pane" opens a saved search in the record pane (after-only); "investor" is the pro shell; "empty" has nothing saved; "error" fails the favorites. alerts-* is the Alerts page (7 rules): "pane" opens a valuation rule with its checks, "blocked" the listing-price rule that can’t run, "new" the New alert form in the pane (after-only; the before build shows its form above the list); "empty" has no rules; "guest" is signed out.',
  '5-studio':
    'Left: the build at the start of this task (after the foundation). Right: after item 5. Same mock fixtures and viewport, and the same figures typed in on both sides. studio-mortgage-* is the default tab (empty, then $650,000 with 20% down at 6.5% over 30 years, tax and insurance); "buyer" is the public shell. studio-afford-* is the Affordability tab ($145,000 income). studio-rental-* is the Rental investment tab with the saved scenarios: "result" types rent, costs, financing and a 10-year hold at 3% a year; "scenario" opens the first saved scenario; "rent-only" sends the rent alone, so what depends on the rest is Unavailable; "property" opens the Studio from 2847 SW 27th Ter (Open in Studio); "empty" has no scenarios; "guest" is signed out; "error" answers the calculation with a 500.',
  '4-dashboards':
    'Left: the build at the start of this task (after the foundation). Right: after item 4. Same mock fixtures and viewport. Every persona\'s Overview: one lead element, then at most two columns. buyer-* is the public shell: the full account is PARTIAL (matches table), "noprefs" the empty account (NO_PREFERENCES: the inline area-and-budget form; no saved searches or alerts), "nomatch" a county with no records (NO_MATCHES), "error" answers the saved searches card with a 500 (Retry). investor-* covers all portfolios (partial), "portfolio" Miami-Dade rentals (partial, with cash flow), "complete" Family homes (complete coverage, no records), "empty" no portfolio. realtor-* is the full CRM, "empty" no tasks or deals, "loading" holds the tasks card. lender-* is Biscayne Community Lending (8 waiting), "nowaiting" picks the pilot organization (no applications), "empty" has no organization, "error" fails the pipeline. admin-* is an account that is only an admin: it lands on Import jobs (the before build showed the buyer overview); admin-lender keeps the lender overview with the Admin group in the rail.',
  '3-opportunities':
    'Left: the build at the start of this task (after the foundation). Right: after item 3. Same mock fixtures and viewport. opp-* without "matches" is the Top scored tab (6 scored properties; the empty scenario has none scored yet). opp-pane-* open a row: its score and factors in the record pane (docked at 1440, a sheet at 1280, its own page at 390); after-only, since the before build links each card to the property page. opp-matches-* is the Matched to you tab: the full account is PARTIAL (budget and goals saved but not applied), "ready" saves a county only, "noprefs" is the empty account (NO_PREFERENCES), "location" a budget without a county (LOCATION_REQUIRED), "nomatch" a county with no records (NO_MATCHES); "filled" and "saved" fill the inline area-and-budget form and save it. error and values-error answer the API with a 500; loading never answers.',
  '2-explore':
    'Left: the build at the start of this task (after the foundation). Right: after item 2. Same mock fixtures and viewport. The before Explore is a card grid whose "Map + list" view embeds the live parcel map. The after Explore is Zillow-like: it opens on the country with a state to choose (explore-start), then shows the results as photo cards beside a map of ZentraValue pills; explore-pick and explore-pin pick a property from its card and from its pill, which zooms to its parcel outlined in copper (after-only). live-* is the parcel search page (/explore/live). comparables-1440 checks the map on the property page after leaflet.css became a lazy stylesheet; compare it with ../1-property/after/p42-comparables-1440.png (the start-of-task build has no Comparables tab).',
  '1-property':
    'Left: the build at the start of this task (after the foundation). Right: after item 1. Same mock fixtures and viewport. 42 is fully valued, 44 is a limited estimate, 48 is missing bedrooms, bathrooms and year built, 49 is an unsupported condo-hotel unit with no lot size. The p42-ask shots open the new "Ask about this property" sheet, which the before build does not have (its contact form sat under every tab).',
  '0-startup':
    "Left: item 0's start-up frame (rejected in review). Right: the centred logo restored, with the DESIGN.md logo, a still line under reduced motion and the reload line after 8 s. The start-up screen from before item 0 is in ../0-shell/before/. Reduced motion is emulated for every shot.",
};

const shots = SETS[ITEM];
if (!shots) {
  console.error('Unknown --item. Known: ' + Object.keys(SETS).join(', '));
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0;
const pending = new Map();
const inflight = new Map();
let current = null;
function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 30000);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(expression, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await evaluate(expression)) return true; } catch {}
    await pause(120);
  }
  return false;
}
async function settle(quiet = 700, max = 15000) {
  const end = Date.now() + max;
  let calmSince = Date.now();
  while (Date.now() < end) {
    if (inflight.size) calmSince = Date.now();
    else if (Date.now() - calmSince >= quiet) return true;
    await pause(80);
  }
  return false;
}
async function mock(pathname, body) {
  const r = await fetch(MOCK + pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
const matchesAny = (paths, pathname) => (paths || []).some((p) => pathname.startsWith(p));
async function onPaused({ request, requestId }) {
  const url = new URL(request.url);
  // Hold the app bundle: the start-up screen stays up for the shot.
  if (/\/main-[\w-]+\.js$/.test(url.pathname)) {
    if (current?.holdApp) return;
    return void cdp('Fetch.continueRequest', { requestId }).catch(() => {});
  }
  // An API path the shot fails (a 500) or holds (never answered: the loading state stays up).
  if (url.pathname.startsWith('/api/')) {
    if (matchesAny(current?.fail, url.pathname)) {
      const body = Buffer.from(JSON.stringify({ status: 500, error: 'Internal Server Error', message: 'Internal Server Error', path: url.pathname }));
      return void cdp('Fetch.fulfillRequest', { requestId, responseCode: 500, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: body.toString('base64') }).catch(() => {});
    }
    if (matchesAny(current?.hold, url.pathname)) return;
    return void cdp('Fetch.continueRequest', { requestId }).catch(() => {});
  }
  try {
    const res = await fetch(MOCK + '/kc' + url.pathname + url.search, { method: request.method, headers: request.headers, body: request.postData, redirect: 'manual' });
    const body = Buffer.from(await res.arrayBuffer());
    const headers = [];
    res.headers.forEach((value, name) => headers.push({ name, value }));
    await cdp('Fetch.fulfillRequest', { requestId, responseCode: res.status, responseHeaders: headers, body: body.toString('base64') });
  } catch (e) {
    current?.errors.push('keycloak forward failed: ' + e.message);
    await cdp('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {});
  }
}
function onEvent(m) {
  if (m.method === 'Fetch.requestPaused') return void onPaused(m.params);
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params.request.url;
    // Held requests never finish: they don't count as in flight, or every shot would wait them out.
    const held = (() => { try { return matchesAny(current?.hold, new URL(u).pathname); } catch { return false; } })();
    if (/^(https?:\/\/(127\.0\.0\.1|localhost))/.test(u) && !u.includes('/kc/') && !/\/main-[\w-]+\.js$/.test(u) && !held) inflight.set(m.params.requestId, u);
  }
  if (m.method === 'Network.loadingFinished' || m.method === 'Network.loadingFailed') inflight.delete(m.params.requestId);
  if (m.method === 'Runtime.exceptionThrown' && current)
    current.errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && current && m.params.type === 'error')
    current.errors.push('console: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
}
let initScript = null;
async function setStorage(entries) {
  if (initScript) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: initScript }).catch(() => {});
  // Only the app's own hints: clearing everything would also wipe keycloak-js's login state on the
  // redirect back from the sign-in server, and the sign-in would never complete.
  const src = `try{localStorage.removeItem('gz.signedIn');localStorage.removeItem('gz.shell');${Object.entries(entries).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('')}}catch{}`;
  initScript = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: src })).identifier;
}
async function runAction(a) {
  if (a.tab) await evaluate(`document.querySelector('[role=tab][data-tab="${a.tab}"]')?.click()`);
  if (a.click) await evaluate(`document.querySelector(${JSON.stringify(a.click)})?.click()`);
  if (a.eval) await evaluate(a.eval);
  if (a.wait) await waitFor(a.wait, 8000);
  await settle(500, 8000);
  await pause(a.pause ?? 250);
}
const SIGNED_IN = `(document.querySelector(".toptools .btn")?.textContent.trim()==="Sign out") || !!document.querySelector(".account-trigger")`;

async function shoot(shot) {
  const v = shot.viewport;
  current = { name: shot.name, route: shot.route, errors: [], holdApp: !!shot.holdApp, fail: shot.fail, hold: shot.hold };
  await mock('/__mock/reset');
  await mock('/__mock/state', { persona: shot.persona ?? 'USER', admin: !!shot.admin, scenario: shot.scenario ?? 'full', signedIn: shot.signedIn !== false });
  // Server state the shot starts from (e.g. saved preferences), written through the mock API.
  for (const p of shot.prep || [])
    await fetch(MOCK + p.path, { method: p.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(p.body) });
  // Drop anything still in flight (a held main.js would otherwise be reused by the next page), and
  // intercept main.js only for start-up shots.
  await cdp('Page.navigate', { url: 'about:blank' });
  await pause(150);
  const apiPaths = [...(shot.fail || []), ...(shot.hold || [])].map((p) => ({ urlPattern: `*${p}*`, requestStage: 'Request' }));
  await cdp('Fetch.enable', { patterns: [{ urlPattern: KEYCLOAK_HOST + '/*', requestStage: 'Request' }, ...(shot.holdApp ? [{ urlPattern: '*/main-*.js', requestStage: 'Request' }] : []), ...apiPaths] });
  await setStorage({ ...(shot.signedIn !== false ? { 'gz.signedIn': '1' } : {}), ...(shot.storage || {}) });
  await cdp('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: v.mobile });
  await cdp('Page.navigate', { url: `${MOCK}/${shot.route}` });
  if (shot.holdApp) {
    await waitFor('document.readyState !== "loading"', 10000);
  } else {
    await waitFor('!!document.querySelector("app-root main")', 20000);
    if (shot.signedIn !== false) await waitFor(SIGNED_IN, 15000);
    await settle();
    await waitFor('!document.querySelector("gz-loading-spinner, .spinner, [aria-busy=true]")', 6000);
    for (const a of shot.actions || []) await runAction(a);
  }
  await evaluate('document.fonts.ready.then(()=>true)');
  await pause(shot.pause ?? 500);
  let height = v.height;
  if (shot.fullPage) {
    height = Math.min(await evaluate('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)'), 7000);
    if (height > v.height) {
      await cdp('Emulation.setDeviceMetricsOverride', { width: v.width, height, deviceScaleFactor: 1, mobile: v.mobile });
      await pause(400);
    }
  }
  // A page wider than the viewport scrolls sideways (item 4 onwards checks it on every shot).
  const wide = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth').catch(() => 0);
  if (wide > 0) current.errors.push(`horizontal scroll: ${wide}px wider than the viewport`);
  const data = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(out, shot.name + '.png'), Buffer.from(data.data, 'base64'));
  console.log(`${current.errors.length ? '!' : ' '} ${shot.name.padEnd(30)}${current.errors.length ? ' errors: ' + current.errors.slice(0, 2).join(' | ') : ''}`);
  return current;
}

function servedCopy(app) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-redesign-app-'));
  fs.cpSync(app, dir, { recursive: true });
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const file = path.join(dir, f);
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes('http://localhost:8081/api')) fs.writeFileSync(file, src.split('http://localhost:8081/api').join('/api'));
  }
  return dir;
}

function writeIndex() {
  const pairs = shots.map((x) => x.name);
  const ex = (side, n) => fs.existsSync(path.join(ROOT, side, n + '.png'));
  let h = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${ITEM}: before and after</title><style>body{margin:0;padding:24px 32px 64px;font:14px/1.45 system-ui,sans-serif;color:#172735;background:#f5f6f7}h1{font-size:24px;margin:0 0 4px}h2{font-size:14px;margin:28px 0 6px;border-top:2px solid #172735;padding-top:10px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0}figcaption{font-size:12px;color:#4e6170;margin-bottom:4px}img{max-width:100%;border:1px solid #c5ced4;background:#fff}.none{padding:16px;border:1px dashed #c5ced4;color:#4e6170;font-size:13px}p{max-width:80ch;color:#4e6170}</style></head><body><h1>${ITEM}: before and after</h1><p>${NOTES[ITEM] ?? 'Left: the build at the start of this task. Right: after this item. Same mock fixtures and viewport.'}</p>`;
  for (const n of pairs) {
    h += `<h2>${n}</h2><div class="pair">`;
    for (const side of ['before', 'after'])
      h += `<figure><figcaption>${side}</figcaption>${ex(side, n) ? `<a href="${side}/${n}.png"><img loading="lazy" src="${side}/${n}.png" alt="${n}, ${side}"></a>` : '<div class="none">Not taken</div>'}</figure>`;
    h += '</div>';
  }
  fs.writeFileSync(path.join(ROOT, 'index.html'), h + '</body></html>');
}

(async () => {
  if (!fs.existsSync(path.join(APP, 'index.html'))) throw new Error('No build at ' + APP);
  const served = servedCopy(APP);
  const server = spawn(process.execPath, [path.join(__dirname, 'mock', 'server.cjs'), '--port', String(PORT), '--api-port', '0', '--app', served], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve) => server.stdout.on('data', (d) => { if (String(d).includes('mock app')) resolve(); }));
  await pause(400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-redesign-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let tabs;
  for (let i = 0; i < 60 && !tabs; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json(); } catch { await pause(200); }
  }
  if (!tabs) throw new Error('Chrome DevTools endpoint unavailable');
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method) onEvent(m);
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }] });
  const results = [];
  // `sides` limits a shot to one build (an interaction the other build does not have).
  for (const shot of shots.filter((x) => (!only || x.name.includes(only)) && (!x.sides || x.sides.includes(SIDE)))) {
    try { results.push(await shoot(shot)); }
    catch (e) { console.log(`X ${shot.name}: ${e.message}`); results.push({ ...current, fatal: e.message }); }
  }
  fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify({ app: APP, capturedAt: new Date().toISOString(), shots: results }, null, 2));
  writeIndex();
  console.log(`\n${results.length} shots -> ${out}`);
  try { await cdp('Browser.close'); } catch {}
  chrome.kill(); server.kill();
  fs.rmSync(served, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
