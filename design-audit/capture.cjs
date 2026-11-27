#!/usr/bin/env node
// Screenshots every page against the mock server, signed in or as a guest, per persona and scenario.
// No dependencies: drives installed Google Chrome over the DevTools protocol (Node 20+, built-in
// WebSocket needs --experimental-websocket on Node 20; Node 22+ has it by default).
//
//   npx ng build --output-path design-audit/.build
//   node --experimental-websocket design-audit/capture.cjs [--only <name-substring>] [--keep-open]
//
// Writes design-audit/screenshots/<name>.png and design-audit/screenshots/capture-log.json
// (per shot: console errors, requests without a fixture, failed requests).
//
// Auth: environment.ts points Keycloak at a remote host. This script intercepts every request for
// that host and forwards it to the mock server's fake OIDC endpoints (/kc/*), so keycloak-js runs
// its real check-sso → code → token flow against a token the mock signs with realm roles of the
// shot's choosing. Nothing is sent to the real identity server or backend.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const shots = require('./shots.cjs');

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const MOCK = 'http://127.0.0.1:4310';
const KEYCLOAK_HOST = 'http://3.229.63.159:8090'; // from src/environments/environment.ts
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = 9335;
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0;
const pending = new Map();
let current = null; // per-shot log
const inflight = new Map();
const fontBytes = new Map();

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
/** Waits until no API/app request has been in flight for `quiet` ms. */
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

async function forwardToMock(params) {
  const { request, requestId } = params;
  const url = new URL(request.url);
  const target = MOCK + '/kc' + url.pathname + url.search;
  try {
    const res = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.postData,
      redirect: 'manual',
    });
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
  if (m.method === 'Network.responseReceived' && current) {
    const { response } = m.params;
    if (response.status >= 400) current.failed.push(`${response.status} ${response.url.replace(/^https?:\/\/[^/]+/, '')}`);
  }
  if (m.method === 'Network.loadingFinished') {
    inflight.delete(m.params.requestId);
    if (fontBytes.has(m.params.requestId)) fontBytes.set(m.params.requestId, { ...fontBytes.get(m.params.requestId), bytes: m.params.encodedDataLength });
  }
  if (m.method === 'Network.loadingFailed') {
    inflight.delete(m.params.requestId);
    if (current && !m.params.canceled) current.failed.push(`${m.params.errorText} ${m.params.type}`);
  }
  if (m.method === 'Network.requestWillBeSent' && /fonts\.(gstatic|googleapis)\.com/.test(m.params.request.url))
    fontBytes.set(m.params.requestId, { url: m.params.request.url, bytes: 0 });
  if (m.method === 'Runtime.exceptionThrown' && current)
    current.errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && current && m.params.type === 'error')
    current.errors.push('console: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
}

let initScript = null;
async function setSessionHint(signedIn) {
  if (initScript) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: initScript });
  const src = signedIn
    ? "try{localStorage.setItem('gz.signedIn','1')}catch{}"
    : "try{localStorage.removeItem('gz.signedIn')}catch{}";
  initScript = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: src })).identifier;
}

async function viewport(v) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: v.mobile });
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

async function shoot(shot) {
  const v = shot.viewport;
  current = { name: shot.name, route: shot.route, errors: [], failed: [], noFixture: [] };
  await mock('/__mock/reset');
  await mock('/__mock/state', { persona: shot.persona ?? 'USER', admin: !!shot.admin, scenario: shot.scenario ?? 'full', signedIn: shot.signedIn !== false });
  await setSessionHint(shot.signedIn !== false);
  await viewport(v);
  await cdp('Page.navigate', { url: `${MOCK}/${shot.route}` });
  // Signed-in loads go app → fake Keycloak → app#code=… → token; wait for the second document.
  await waitFor('!!document.querySelector("app-root main")', 20000);
  if (shot.signedIn !== false) await waitFor('document.querySelector(".toptools .btn")?.textContent.trim()==="Sign out"', 15000);
  await settle();
  await waitFor('!document.querySelector("gz-loading-spinner, .spinner, [aria-busy=true]")', 6000);
  for (const a of shot.actions || []) await runAction(a);
  if (shot.wait) await waitFor(shot.wait, 8000);
  await evaluate('document.fonts.ready.then(()=>true)');
  await pause(shot.pause ?? 400);

  const signedIn = await evaluate('document.querySelector(".toptools .btn")?.textContent.trim()');
  current.signedInAs = signedIn === 'Sign out' ? 'signed in' : 'guest';
  current.h1 = await evaluate('document.querySelector("main h1")?.textContent.trim() || null');
  // Full-page capture: grow the viewport to the document height (capped), then shoot.
  const height = shot.fullPage === false ? v.height : Math.min(await evaluate('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)'), 7000);
  if (height > v.height) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: v.width, height, deviceScaleFactor: 1, mobile: v.mobile });
    await pause(300);
  }
  const shotData = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(out, shot.name + '.png'), Buffer.from(shotData.data, 'base64'));
  const log = await (await fetch(MOCK + '/__mock/log')).json();
  current.noFixture = log.filter((l) => !l.fixture).map((l) => `${l.method} ${l.path}`);
  current.fixtureErrors = log.filter((l) => l.error).map((l) => `${l.method} ${l.path}: ${l.error.split('\n')[0]}`);
  current.apiCalls = log.length;
  current.height = height;
  const flag = current.errors.length || current.noFixture.length || current.fixtureErrors.length ? '!' : ' ';
  console.log(`${flag} ${shot.name.padEnd(44)} ${current.signedInAs.padEnd(9)} h1=${JSON.stringify(current.h1)} api=${log.length}${current.noFixture.length ? ' missing=' + current.noFixture.length : ''}${current.errors.length ? ' errors=' + current.errors.length : ''}`);
  return current;
}

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'mock', 'server.cjs'), '--port', '4310', '--api-port', '8081'], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve) => server.stdout.on('data', (d) => { process.stdout.write('[mock] ' + d); if (String(d).includes('mock api') || String(d).includes('mock app')) resolve(); }));
  await pause(400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-audit-'));
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
  await cdp('Network.setCacheDisabled', { cacheDisabled: false });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }] });
  await cdp('Fetch.enable', { patterns: [{ urlPattern: KEYCLOAK_HOST + '/*', requestStage: 'Request' }] });

  const results = [];
  const list = shots.filter((s) => !only || s.name.includes(only));
  for (const shot of list) {
    try { results.push(await shoot(shot)); }
    catch (e) { console.log(`X ${shot.name}: ${e.message}`); results.push({ ...current, fatal: e.message }); }
  }
  const fonts = [...fontBytes.values()].filter((f) => f.bytes);
  const uniqueFonts = Object.values(Object.fromEntries(fonts.map((f) => [f.url, f])));
  // --only runs update their entries in the existing log instead of replacing the whole file.
  const logFile = path.join(out, 'capture-log.json');
  let previous = [];
  if (only && fs.existsSync(logFile)) {
    try { previous = JSON.parse(fs.readFileSync(logFile, 'utf8')).shots.filter((s) => !results.some((r) => r.name === s.name)); } catch {}
  }
  const order = shots.map((s) => s.name);
  const merged = [...previous, ...results].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  fs.writeFileSync(logFile, JSON.stringify({ capturedAt: new Date().toISOString(), fonts: uniqueFonts, shots: merged }, null, 2));
  console.log(`\n${results.length} shots → ${out}`);
  if (!args.includes('--keep-open')) {
    try { await cdp('Browser.close'); } catch {}
    chrome.kill(); server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
