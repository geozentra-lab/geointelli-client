#!/usr/bin/env node
// Before/after screenshots for the foundation session (shell and shared components), taken against
// the audit's mock server. Same approach as capture.cjs (Chrome over the DevTools protocol, fake
// Keycloak), but it takes the build to serve and the output folder, works with both the old and
// the new shell, and can clip a shot to one element.
//
//   npx ng build --output-path design-audit/.build-before      (from the commit before the change)
//   npx ng build --output-path design-audit/.build
//   node design-audit/foundation-shots.cjs --app design-audit/.build-before/browser --out design-audit/screenshots/foundation/before
//   node design-audit/foundation-shots.cjs --app design-audit/.build/browser --out design-audit/screenshots/foundation/after
//   add --only <name-substring> to take some of them. Node 20 needs --experimental-websocket.
//
// A clipped shot names a CSS selector; when the element doesn't exist in that build (a component
// that is new or gone), the shot is skipped and the log says so.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const only = arg('--only', null);
const APP = path.resolve(arg('--app', path.join(__dirname, '.build', 'browser')));
const out = path.resolve(arg('--out', path.join(__dirname, 'screenshots', 'foundation', 'after')));
const PORT = 4310;
const MOCK = `http://127.0.0.1:${PORT}`;
const KEYCLOAK_HOST = 'http://3.229.63.159:8090'; // from src/environments/environment.ts
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = 9336;
fs.mkdirSync(out, { recursive: true });

const desktop = { width: 1440, height: 900, mobile: false };
const laptop = { width: 1280, height: 800, mobile: false };
const phone = { width: 390, height: 844, mobile: true };
const buyer = { persona: 'USER' };
const investor = { persona: 'RESIDENTIAL_INVESTOR' };
const realtor = { persona: 'REALTOR' };
const lender = { persona: 'BANK_LENDER' };
const guest = { signedIn: false };
const empty = { scenario: 'empty' };
const s = (name, route, opts = {}) => ({ name, route, viewport: desktop, ...opts });

// The live map opens the Material property dialog after a folio search finds a parcel (as in shots.cjs).
const openDialog = [
  { eval: `(()=>{const s=document.querySelector('select[aria-label="Property state"]');s.selectedIndex=1;s.dispatchEvent(new Event('change',{bubbles:true}))})()`, wait: `document.querySelector('select[aria-label="Property county"]')?.options.length>1` },
  { eval: `(()=>{const s=document.querySelector('select[aria-label="Property county"]');s.selectedIndex=[...s.options].findIndex(o=>o.textContent.includes('Miami-Dade'));s.dispatchEvent(new Event('change',{bubbles:true}))})()` },
  { eval: `(()=>{const i=document.querySelector('.parcel-search input');i.value='0141370120450';i.dispatchEvent(new Event('input',{bubbles:true}))})()` },
  { clickText: 'Search', within: '.parcel-search button, button', wait: 'document.querySelectorAll("path.leaflet-interactive").length>0', pause: 1500 },
  { eval: `(()=>{const ps=[...document.querySelectorAll('path.leaflet-interactive')];const fills=ps.map(p=>p.getAttribute('fill'));const odd=ps.find((p,i)=>fills.filter(f=>f===fills[i]).length===1)||ps[0];const r=odd.getBoundingClientRect();odd.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))})()`, wait: '!!document.querySelector("mat-dialog-container")', pause: 1500 },
];

// What the pointer would hit over the navigation (left edge) and the top bar while a dialog is open,
// and whether the shell is inert: the evidence for bug 2.
const PROBE_NAV = `(()=>{const d=(x,y)=>{const e=document.elementFromPoint(x,y);return e?(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+'.'+[...e.classList].join('.')):null};
  const b=document.querySelector('.cdk-overlay-backdrop');const s=b&&getComputedStyle(b);
  return {navLeft:d(30,300),topBar:d(700,20),backdrop:b?{cls:b.className,bg:s.backgroundColor,z:s.zIndex,opacity:s.opacity}:null,
    container:(()=>{const c=document.querySelector('.cdk-overlay-container');if(!c)return null;const r=c.getBoundingClientRect();return {z:getComputedStyle(c).zIndex,popover:c.matches(':popover-open')||!!c.querySelector(':popover-open'),rect:[r.x,r.y,r.width,r.height]}})(),
    appInert:!!document.querySelector('app-root [inert], app-root[inert]')}})()`;

const shots = [
  // ---- shell -----------------------------------------------------------------------------------
  s('shell-pro-lender-1440', 'dashboard', { ...lender, fullPage: false }),
  s('shell-pro-admin-1440', 'admin/import-jobs', { ...buyer, admin: true, fullPage: false }),
  s('shell-pro-investor-1280', 'portfolio', { ...investor, viewport: laptop, fullPage: false }),
  s('shell-pro-realtor-390', 'crm/leads', { ...realtor, viewport: phone, fullPage: false }),
  s('shell-pro-more-390', 'crm/leads', { ...realtor, viewport: phone, fullPage: false, actions: [{ click: '.bottombar .more', wait: '!!document.querySelector(".more-sheet")' }], requires: '.bottombar .more' }),
  s('shell-public-buyer-1440', 'explore', { ...buyer, fullPage: false }),
  s('shell-public-guest-1440', 'property/42', { ...guest, fullPage: false }),
  s('shell-public-buyer-390', 'dashboard', { ...buyer, viewport: phone, fullPage: false }),
  s('shell-public-guest-390', 'explore', { ...guest, viewport: phone, fullPage: false }),
  s('shell-account-menu-1440', 'explore', { ...buyer, fullPage: false, actions: [{ click: '.account-trigger', wait: '!!document.querySelector(".account-menu")' }], requires: '.account-trigger' }),
  // Bug 2: the dialog backdrop and the navigation.
  s('bug2-dialog-scrim-1440', 'explore/live', { ...buyer, fullPage: false, actions: openDialog, probe: PROBE_NAV }),
  s('bug2-dialog-scrim-pro-1440', 'explore/live', { ...investor, fullPage: false, actions: openDialog, probe: PROBE_NAV }),

  // ---- shared components (clipped) ------------------------------------------------------------
  s('kpi-investor-partial', 'dashboard', { ...investor, clip: '.kpi-row' }),
  s('kpi-lender-unavailable', 'dashboard', { ...lender, ...empty, clip: '.kpi-row' }),
  s('kpi-buyer-390', 'dashboard', { ...buyer, viewport: phone, clip: '.kpi-row' }),
  s('stage-bars-realtor', 'dashboard', { ...realtor, clip: 'gz-stage-bars', pad: 24 }),
  s('stage-bars-lender', 'dashboard', { ...lender, clip: 'gz-stage-bars', pad: 24 }),
  s('empty-realtor-crm', 'crm', { ...realtor, ...empty, fullPage: true }),
  s('empty-buyer-saved', 'saved', { ...buyer, ...empty, fullPage: true }),
  s('empty-buyer-dashboard', 'dashboard', { ...buyer, ...empty, clip: 'gz-recommended' }),
  s('property-cards-1440', 'explore', { ...buyer, clip: '.propertygrid', maxClipHeight: 1150 }),
  s('property-cards-390', 'explore', { ...buyer, viewport: phone, clip: '.propertygrid', maxClipHeight: 1400 }),
  s('property-cards-saved', 'saved', { ...buyer, clip: '.propertygrid', maxClipHeight: 900 }),
  // Bug 1: recommendation reasons.
  s('bug1-recommended-1440', 'dashboard', { ...buyer, clip: 'gz-recommended' }),
  s('bug1-recommended-1280', 'dashboard', { ...buyer, viewport: laptop, clip: 'gz-recommended' }),
  // Bug 3 and the chart language: sale history.
  s('bug3-sales-390', 'property/42', { ...buyer, viewport: phone, clip: 'gz-sale-history' }),
  s('sales-1440', 'property/42', { ...buyer, clip: 'gz-sale-history' }),
  s('sales-dialog-1440', 'explore/live', { ...buyer, fullPage: false, actions: [...openDialog, { eval: `document.querySelector('mat-dialog-container gz-sale-history')?.scrollIntoView({block:'start'})`, pause: 500 }] }),
  // Full pages, to see the tokens across a whole screen.
  s('page-investor-dashboard', 'dashboard', { ...investor }),
  s('page-lender-dashboard', 'dashboard', { ...lender }),
  s('page-property-42', 'property/42', { ...buyer }),
  s('page-property-42-390', 'property/42', { ...buyer, viewport: phone }),
  s('page-lender-applications', 'loan-review', { ...lender, actions: [{ tab: 'applications' }] }),
  s('page-admin-data-quality', 'admin/data-quality', { ...buyer, admin: true }),
  s('page-settings', 'settings', { ...buyer }),
];

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
async function forwardToMock({ request, requestId }) {
  const url = new URL(request.url);
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
  if (m.method === 'Fetch.requestPaused') return void forwardToMock(m.params);
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params.request.url;
    if (/^(https?:\/\/(127\.0\.0\.1|localhost))/.test(u) && !u.includes('/kc/')) inflight.set(m.params.requestId, u);
  }
  if (m.method === 'Network.loadingFinished' || m.method === 'Network.loadingFailed') inflight.delete(m.params.requestId);
  if (m.method === 'Runtime.exceptionThrown' && current)
    current.errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && current && m.params.type === 'error')
    current.errors.push('console: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
}
let initScript = null;
async function setSessionHint(signedIn) {
  if (initScript) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: initScript });
  const src = signedIn ? "try{localStorage.setItem('gz.signedIn','1')}catch{}" : "try{localStorage.removeItem('gz.signedIn')}catch{}";
  initScript = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: src })).identifier;
}
async function runAction(a) {
  if (a.tab) await evaluate(`document.querySelector('[role=tab][data-tab="${a.tab}"]')?.click()`);
  if (a.clickText) await evaluate(`(()=>{const t=${JSON.stringify(a.clickText)};const el=[...document.querySelectorAll(${JSON.stringify(a.within || 'button, a, [role=tab]')})].find(e=>e.textContent.trim().startsWith(t));el?.click();return !!el})()`);
  if (a.click) await evaluate(`document.querySelector(${JSON.stringify(a.click)})?.click()`);
  if (a.eval) await evaluate(a.eval);
  if (a.wait) await waitFor(a.wait, 8000);
  await settle(500, 8000);
  await pause(a.pause ?? 250);
}
// Old shell: the top bar's button reads "Sign out". New shell: the account menu button exists.
const SIGNED_IN = `(document.querySelector(".toptools .btn")?.textContent.trim()==="Sign out") || !!document.querySelector(".account-trigger")`;

async function shoot(shot) {
  const v = shot.viewport;
  current = { name: shot.name, route: shot.route, errors: [] };
  await mock('/__mock/reset');
  await mock('/__mock/state', { persona: shot.persona ?? 'USER', admin: !!shot.admin, scenario: shot.scenario ?? 'full', signedIn: shot.signedIn !== false });
  await setSessionHint(shot.signedIn !== false);
  await cdp('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: v.mobile });
  await cdp('Page.navigate', { url: `${MOCK}/${shot.route}` });
  await waitFor('!!document.querySelector("app-root main")', 20000);
  if (shot.signedIn !== false) await waitFor(SIGNED_IN, 15000);
  await settle();
  await waitFor('!document.querySelector("gz-loading-spinner, .spinner, [aria-busy=true]")', 6000);
  if (shot.requires && !(await evaluate(`!!document.querySelector(${JSON.stringify(shot.requires)})`))) {
    current.skipped = `no ${shot.requires} in this build`;
    console.log(`- ${shot.name.padEnd(36)} skipped: ${current.skipped}`);
    return current;
  }
  for (const a of shot.actions || []) await runAction(a);
  await evaluate('document.fonts.ready.then(()=>true)');
  await pause(shot.pause ?? 500);
  current.signedIn = await evaluate(SIGNED_IN);
  if (shot.probe) current.probe = await evaluate(shot.probe).catch((e) => 'probe failed: ' + e.message);

  let clip;
  const fullPage = shot.fullPage ?? !!shot.clip;
  const docHeight = Math.min(await evaluate('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)'), 7000);
  const height = fullPage ? docHeight : v.height;
  if (height > v.height) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: v.width, height, deviceScaleFactor: 1, mobile: v.mobile });
    await pause(400);
  }
  if (shot.clip) {
    const rect = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(shot.clip)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`);
    if (!rect || !rect.w || !rect.h) {
      current.skipped = `no ${shot.clip} in this build`;
      console.log(`- ${shot.name.padEnd(36)} skipped: ${current.skipped}`);
      return current;
    }
    const pad = shot.pad ?? 16;
    const x = Math.max(0, rect.x - pad), y = Math.max(0, rect.y - pad);
    clip = { x, y, width: Math.min(v.width - x, rect.w + pad * 2), height: Math.min(shot.maxClipHeight ?? 4000, rect.h + pad * 2), scale: 1 };
  }
  const data = await cdp('Page.captureScreenshot', clip ? { format: 'png', clip, captureBeyondViewport: true } : { format: 'png' });
  fs.writeFileSync(path.join(out, shot.name + '.png'), Buffer.from(data.data, 'base64'));
  console.log(`${current.errors.length ? '!' : ' '} ${shot.name.padEnd(36)} ${current.signedIn ? 'signed in' : 'guest    '}${current.errors.length ? ' errors=' + current.errors.length : ''}`);
  return current;
}

/**
 * environment.ts hard-codes http://localhost:8081/api, and a real backend may own that port. The
 * shots serve a temporary copy of the build whose API base is the mock's own origin, so no request
 * leaves the mock and port 8081 is never needed. The build itself is not changed.
 */
function servedCopy(app) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-foundation-app-'));
  fs.cpSync(app, dir, { recursive: true });
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const file = path.join(dir, f);
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes('http://localhost:8081/api')) fs.writeFileSync(file, src.split('http://localhost:8081/api').join('/api'));
  }
  return dir;
}

(async () => {
  if (!fs.existsSync(path.join(APP, 'index.html'))) throw new Error('No build at ' + APP);
  const served = servedCopy(APP);
  const server = spawn(process.execPath, [path.join(__dirname, 'mock', 'server.cjs'), '--port', String(PORT), '--api-port', '0', '--app', served], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve) => server.stdout.on('data', (d) => { if (String(d).includes('mock api') || String(d).includes('mock app')) resolve(); }));
  await pause(400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-foundation-'));
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
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }] });
  await cdp('Fetch.enable', { patterns: [{ urlPattern: KEYCLOAK_HOST + '/*', requestStage: 'Request' }] });

  const results = [];
  for (const shot of shots.filter((x) => !only || x.name.includes(only))) {
    try { results.push(await shoot(shot)); }
    catch (e) { console.log(`X ${shot.name}: ${e.message}`); results.push({ ...current, fatal: e.message }); }
  }
  fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify({ app: APP, capturedAt: new Date().toISOString(), shots: results }, null, 2));
  console.log(`\n${results.length} shots -> ${out}`);
  try { await cdp('Browser.close'); } catch {}
  chrome.kill(); server.kill();
  fs.rmSync(served, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
