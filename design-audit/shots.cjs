// What capture.cjs photographs. persona is the backend enum the mock returns from /users/me:
// USER (Buyer), RESIDENTIAL_INVESTOR, REALTOR, BANK_LENDER. admin adds the realm role "admin".
// scenario: "full" (populated, with partial/unavailable values mixed in) or "empty" (new account).

const desktop = { width: 1440, height: 900, mobile: false };
const laptop = { width: 1280, height: 800, mobile: false };
const mobile = { width: 390, height: 844, mobile: true };

const s = (name, route, opts = {}) => ({ name, route, viewport: desktop, ...opts });
const buyer = { persona: 'USER' };
const investor = { persona: 'RESIDENTIAL_INVESTOR' };
const realtor = { persona: 'REALTOR' };
const lender = { persona: 'BANK_LENDER' };
const guest = { signedIn: false };
const empty = { scenario: 'empty' };

module.exports = [
  // ---- guest (public) ------------------------------------------------------------------------
  s('guest-dashboard', 'dashboard', guest),
  s('guest-explore', 'explore', guest),
  s('guest-explore-live-map', 'explore/live', { ...guest, pause: 4000, wait: 'document.querySelectorAll(".leaflet-tile-loaded").length>4' }),
  s('guest-property-42-overview', 'property/42', guest),
  s('guest-saved', 'saved', guest),
  s('guest-not-found', 'no-such-page', guest),

  // ---- buyer (USER) --------------------------------------------------------------------------
  s('buyer-dashboard', 'dashboard', buyer),
  s('buyer-explore', 'explore', buyer),
  s('buyer-notifications-open', 'explore', { ...buyer, actions: [{ click: 'gz-notification-menu button', wait: '!!document.querySelector("#notification-popup")' }], fullPage: false }),
  s('buyer-property-42-overview', 'property/42', buyer),
  s('buyer-property-42-valuation', 'property/42', { ...buyer, actions: [{ tab: 'valuation' }] }),
  s('buyer-property-42-location', 'property/42', { ...buyer, actions: [{ tab: 'location' }] }),
  s('buyer-property-42-sales', 'property/42', { ...buyer, actions: [{ tab: 'sales' }] }),
  s('buyer-property-42-features', 'property/42', { ...buyer, actions: [{ tab: 'features' }] }),
  s('buyer-property-42-comparables', 'property/42', { ...buyer, actions: [{ tab: 'comparables', pause: 1500 }] }),
  s('buyer-property-46-no-valuation', 'property/46', { ...buyer, actions: [{ tab: 'valuation' }] }),
  s('buyer-property-49-gaps', 'property/49', buyer),
  // The live map opens the Material property dialog after a folio search finds a parcel.
  s('buyer-property-dialog', 'explore/live', {
    ...buyer,
    fullPage: false,
    actions: [
      { eval: `(()=>{const s=document.querySelector('select[aria-label="Property state"]');s.selectedIndex=1;s.dispatchEvent(new Event('change',{bubbles:true}))})()`, wait: `document.querySelector('select[aria-label="Property county"]')?.options.length>1` },
      { eval: `(()=>{const s=document.querySelector('select[aria-label="Property county"]');s.selectedIndex=[...s.options].findIndex(o=>o.textContent.includes('Miami-Dade'));s.dispatchEvent(new Event('change',{bubbles:true}))})()` },
      { eval: `(()=>{const i=document.querySelector('.parcel-search input');i.value='0141370120450';i.dispatchEvent(new Event('input',{bubbles:true}))})()` },
      { clickText: 'Search', within: '.parcel-search button, button', wait: 'document.querySelectorAll("path.leaflet-interactive").length>0', pause: 1500 },
      // Click the highlighted parcel (the one drawn with a different fill), as a user would.
      { eval: `(()=>{const ps=[...document.querySelectorAll('path.leaflet-interactive')];const fills=ps.map(p=>p.getAttribute('fill'));const odd=ps.find((p,i)=>fills.filter(f=>f===fills[i]).length===1)||ps[0];const r=odd.getBoundingClientRect();odd.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))})()`, wait: '!!document.querySelector("mat-dialog-container")', pause: 1500 },
    ],
  }),
  s('buyer-compare-empty', 'compare', buyer),
  s('buyer-compare-42', 'compare/42', buyer),
  s('buyer-opportunities-scored', 'opportunities', buyer),
  s('buyer-opportunities-matches', 'opportunities?view=matches', buyer),
  s('buyer-saved', 'saved', buyer),
  s('buyer-alerts', 'alerts', buyer),
  s('buyer-settings', 'settings', buyer),
  s('buyer-investment-mortgage', 'investment-studio', buyer),
  s('buyer-investment-affordability', 'investment-studio?mode=affordability', buyer),
  s('buyer-assistant', 'assistant', buyer),
  s('buyer-dashboard-empty', 'dashboard', { ...buyer, ...empty }),
  s('buyer-saved-empty', 'saved', { ...buyer, ...empty }),
  s('buyer-alerts-empty', 'alerts', { ...buyer, ...empty }),

  // ---- investor ------------------------------------------------------------------------------
  s('investor-dashboard', 'dashboard', investor),
  s('investor-portfolio', 'portfolio', investor),
  s('investor-investment-rental', 'investment-studio/42?mode=rental', investor),
  s('investor-dashboard-empty', 'dashboard', { ...investor, ...empty }),
  s('investor-portfolio-empty', 'portfolio', { ...investor, ...empty }),

  // ---- realtor -------------------------------------------------------------------------------
  s('realtor-dashboard', 'dashboard', realtor),
  s('realtor-crm-overview', 'crm', realtor),
  s('realtor-crm-clients', 'crm/clients', realtor),
  s('realtor-crm-leads', 'crm/leads', realtor),
  s('realtor-crm-tasks', 'crm/tasks', realtor),
  s('realtor-crm-deals', 'crm/deals', realtor),
  s('realtor-settings-license', 'settings', realtor),
  s('realtor-dashboard-empty', 'dashboard', { ...realtor, ...empty }),
  s('realtor-crm-empty', 'crm', { ...realtor, ...empty }),

  // ---- lender --------------------------------------------------------------------------------
  s('lender-dashboard', 'dashboard', lender),
  s('lender-loan-review-pipeline', 'loan-review', lender),
  s('lender-loan-review-applications', 'loan-review', { ...lender, actions: [{ tab: 'applications' }] }),
  s('lender-loan-review-import', 'loan-review', { ...lender, actions: [{ tab: 'import' }] }),
  s('lender-loan-review-team', 'loan-review', { ...lender, actions: [{ tab: 'team' }] }),
  s('lender-dashboard-empty', 'dashboard', { ...lender, ...empty }),
  s('lender-loan-review-empty', 'loan-review', { ...lender, ...empty }),

  // ---- admin (realm role) --------------------------------------------------------------------
  s('admin-import-jobs', 'admin/import-jobs', { ...buyer, admin: true }),
  s('admin-data-quality', 'admin/data-quality', { ...buyer, admin: true }),
  s('admin-valuations', 'admin/valuations', { ...buyer, admin: true }),
  s('admin-import-jobs-empty', 'admin/import-jobs', { ...buyer, admin: true, ...empty }),
  s('admin-data-quality-empty', 'admin/data-quality', { ...buyer, admin: true, ...empty }),
  s('admin-valuations-empty', 'admin/valuations', { ...buyer, admin: true, ...empty }),
  s('nonadmin-admin-page', 'admin/import-jobs', buyer),

  // ---- smaller screens -----------------------------------------------------------------------
  s('laptop-investor-portfolio', 'portfolio', { ...investor, viewport: laptop }),
  s('laptop-lender-applications', 'loan-review', { ...lender, viewport: laptop, actions: [{ tab: 'applications' }] }),
  s('mobile-buyer-dashboard', 'dashboard', { ...buyer, viewport: mobile }),
  s('mobile-buyer-explore', 'explore', { ...buyer, viewport: mobile }),
  s('mobile-buyer-property-42', 'property/42', { ...buyer, viewport: mobile }),
  s('mobile-investor-portfolio', 'portfolio', { ...investor, viewport: mobile }),
  s('mobile-realtor-crm-leads', 'crm/leads', { ...realtor, viewport: mobile }),
  s('mobile-lender-applications', 'loan-review', { ...lender, viewport: mobile, actions: [{ tab: 'applications' }] }),
  s('mobile-admin-data-quality', 'admin/data-quality', { ...buyer, admin: true, viewport: mobile }),
];
