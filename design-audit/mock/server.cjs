#!/usr/bin/env node
// Design-audit mock server. No dependencies; Node 20+.
//
//   node design-audit/mock/server.cjs [--port 4310] [--api-port 8081] [--app design-audit/.build/browser]
//
// One process serves:
//   :<port>      the production build (SPA fallback), /notification-api/*, /kc/* (fake Keycloak),
//                /api/* (same fixtures), and /__mock/* control endpoints
//   :<api-port>  /api/* only, because environment.ts hard-codes http://localhost:8081/api
//
// Keycloak lives at a remote host in environment.ts, so the browser cannot reach /kc/* by itself:
// capture.cjs rewrites requests for that host to this server through the DevTools protocol.
// Pass --api-port 0 to skip the second listener (e.g. when a real backend owns 8081).
//
// Control:
//   POST /__mock/state  {"persona":"REALTOR","admin":true,"scenario":"empty","signedIn":true}
//   POST /__mock/reset  restore every fixture module's in-memory data
//   GET  /__mock/log    requests seen since the last reset, and which had no fixture

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { scenarioFlags } = require('./fixtures/_shared.cjs');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => {
    if (a.startsWith('--')) pairs.push([a.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const PORT = Number(args.port ?? 4310);
const API_PORT = Number(args['api-port'] ?? 8081);
const APP = path.resolve(args.app ?? path.join(__dirname, '..', '.build', 'browser'));
const REALM = 'geozentra';

const defaults = () => ({ persona: 'USER', admin: false, scenario: 'full', signedIn: true });
let state = defaults();
let log = [];

// ---- fixtures -----------------------------------------------------------------------------
const fixtureDir = path.join(__dirname, 'fixtures');
const modules = fs
  .readdirSync(fixtureDir)
  .filter((f) => f.endsWith('.cjs') && !f.startsWith('_'))
  .sort()
  .flatMap((f) => {
    try {
      return [{ name: f, mod: require(path.join(fixtureDir, f)) }];
    } catch (e) {
      console.error(`fixture ${f} failed to load, skipped: ${e.message}`);
      return [];
    }
  });
const routes = modules.flatMap(({ name, mod }) =>
  (mod.routes || []).map(([method, pattern, handle]) => ({ name, method, pattern, handle })),
);
function resetFixtures() {
  for (const { mod } of modules) mod.reset?.();
  log = [];
}
resetFixtures();

function findRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    if (typeof r.pattern === 'string' ? r.pattern === pathname : r.pattern.test(pathname)) {
      return { ...r, params: typeof r.pattern === 'string' ? null : pathname.match(r.pattern) };
    }
  }
  return null;
}

// ---- fake Keycloak ------------------------------------------------------------------------
let lastNonce = '';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.mock-signature`;
function claims() {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'audit-user',
    preferred_username: 'audit.user',
    email: 'audit.user@example.test',
    iat: now,
    exp: now + 3600,
    nonce: lastNonce,
    session_state: 'audit-session',
    realm_access: { roles: state.admin ? ['admin', 'user'] : ['user'] },
  };
}
function keycloak(req, res, url) {
  const p = url.pathname.replace(/^\/kc/, '');
  const realm = `/realms/${REALM}`;
  if (p === `${realm}/.well-known/openid-configuration`) {
    const issuer = `http://${req.headers.host}/kc${realm}`;
    return json(res, 200, { issuer, authorization_endpoint: `${issuer}/protocol/openid-connect/auth` }, req);
  }
  if (p === `${realm}/protocol/openid-connect/auth`) {
    lastNonce = url.searchParams.get('nonce') || '';
    const back = url.searchParams.get('redirect_uri');
    const s = url.searchParams.get('state');
    const mode = url.searchParams.get('response_mode') === 'query' ? '?' : '#';
    const answer = state.signedIn ? `code=audit-code&state=${s}` : `error=login_required&state=${s}`;
    res.writeHead(302, { Location: back + mode + answer }).end();
    return;
  }
  if (p === `${realm}/protocol/openid-connect/token`) {
    const c = claims();
    return json(res, 200, {
      access_token: jwt(c),
      id_token: jwt(c),
      refresh_token: jwt({ ...c, exp: c.exp + 1800 }),
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_expires_in: 5400,
    }, req);
  }
  if (p === `${realm}/protocol/openid-connect/logout`) {
    state.signedIn = false;
    res.writeHead(302, { Location: url.searchParams.get('post_logout_redirect_uri') || '/' }).end();
    return;
  }
  // 3p-cookie probe and login-status iframe: answer "unsupported" so keycloak-js falls back to a
  // full-page check-sso redirect, which this server answers above.
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<script>parent.postMessage("unsupported","*")</script>');
}

// ---- http helpers -------------------------------------------------------------------------
function cors(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type,idempotency-key',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
function json(res, status, body, req) {
  const headers = { ...cors(req), 'Cache-Control': 'no-store' };
  if (status === 204 || body === undefined) {
    res.writeHead(status === 200 && body === undefined ? 204 : status, headers).end();
    return;
  }
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
};
function serveApp(req, res, url) {
  let file = path.resolve(APP, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(APP)) return res.writeHead(403).end();
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(APP, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end(`No build at ${APP}. Run: npx ng build --output-path design-audit/.build`);
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') return json(res, 204, undefined, req);
  const raw = await readBody(req);
  let body = null;
  if (raw.length && (req.headers['content-type'] || '').includes('json')) {
    try { body = JSON.parse(raw.toString('utf8')); } catch { body = null; }
  }
  const route = findRoute(req.method, url.pathname);
  const entry = { method: req.method, path: url.pathname + url.search, fixture: route?.name ?? null };
  log.push(entry);
  if (!route) return json(res, 404, { status: 404, error: 'Not Found', message: `No fixture: ${req.method} ${url.pathname}` }, req);
  const ctx = { state, flags: scenarioFlags(state) };
  let out;
  try {
    out = route.handle({ method: req.method, path: url.pathname, query: url.searchParams, body, headers: req.headers, params: route.params }, ctx) || {};
  } catch (e) {
    entry.error = String(e?.stack || e);
    return json(res, 500, { status: 500, message: 'Fixture threw: ' + e.message }, req);
  }
  entry.status = out.status ?? 200;
  const send = () => json(res, out.status ?? 200, out.body, req);
  out.delay ? setTimeout(send, out.delay) : send();
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/__mock/')) {
    if (req.method === 'OPTIONS') return json(res, 204, undefined, req);
    const raw = await readBody(req);
    if (url.pathname === '/__mock/state') {
      if (req.method === 'POST' && raw.length) Object.assign(state, JSON.parse(raw.toString('utf8')));
      return json(res, 200, state, req);
    }
    if (url.pathname === '/__mock/reset') {
      state = defaults();
      resetFixtures();
      return json(res, 200, state, req);
    }
    if (url.pathname === '/__mock/log') return json(res, 200, log, req);
    return json(res, 404, { message: 'unknown control endpoint' }, req);
  }
  if (url.pathname.startsWith('/kc/')) return keycloak(req, res, url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/notification-api/')) return handleApi(req, res, url);
  return serveApp(req, res, url);
}

const app = http.createServer((req, res) => handle(req, res).catch((e) => { console.error(e); res.writeHead(500).end(); }));
app.listen(PORT, '127.0.0.1', () => console.log(`mock app+api  http://127.0.0.1:${PORT}  (${routes.length} fixture routes from ${modules.length} modules; app ${APP})`));
if (API_PORT) {
  const api = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!url.pathname.startsWith('/api/')) return res.writeHead(404).end();
    handleApi(req, res, url).catch((e) => { console.error(e); res.writeHead(500).end(); });
  });
  api.on('error', (e) => console.error(`api listener on ${API_PORT} failed: ${e.message}`));
  api.listen(API_PORT, 'localhost', () => console.log(`mock api      http://localhost:${API_PORT}/api`));
}
module.exports = { app };
