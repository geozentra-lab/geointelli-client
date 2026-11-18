// Browser smoke checks against the production bundle; no browser packages required.
// Run with Node 20's --experimental-websocket flag and installed Google Chrome.
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  os = require('node:os');
const { spawn } = require('node:child_process');
const root = path.resolve('dist/property-client/browser'),
  output = path.resolve('artifacts/screenshots');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + requested);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const ext = path.extname(file);
  res.setHeader(
    'Content-Type',
    {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.webp': 'image/webp',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    }[ext] || 'application/octet-stream',
  );
  fs.createReadStream(file).pipe(res);
});
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, ws;
let seq = 0;
const pending = new Map(),
  errors = [];
async function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('CDP timeout: ' + method));
    }, 20000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject,
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression, label) {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error('Timeout: ' + label);
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await pause(250);
}
async function screenshot(name) {
  await evaluate('document.fonts.ready');
  await pause(150);
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(r.data, 'base64'));
}
async function go(route) {
  await cdp('Page.navigate', { url: 'http://127.0.0.1:4300/' + route });
  await waitFor('!!document.querySelector("h1")', route);
  await pause(200);
}
async function check(condition, label) {
  if (!(await evaluate(condition))) throw new Error('Failed: ' + label);
  console.log('PASS ' + label);
}

const page = (content) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  first: true,
  last: true,
});
const profile = {
  id: 1,
  keycloakUserId: 'test-user',
  username: 'apiuser',
  email: 'api@example.test',
  firstName: 'API user',
  lastName: 'Test',
  persona: 'USER',
};
const property = {
  id: 42,
  folio: '000123',
  countyId: 17,
  countyName: 'Miami-Dade',
  stateCode: 'FL',
  address: { address: 'API fixture property' },
  bedroomCount: 3,
  bathroomCount: 2,
  buildingActualArea: 1840,
  yearBuilt: '2018',
  owners: [],
  assessments: [],
  sales: [],
  buildings: [],
  lands: [],
  taxes: [],
  parcels: [],
};
const searchItem = {
  id: 42,
  folio: '000123',
  countyId: 17,
  countyName: 'Miami-Dade',
  stateCode: 'FL',
  address: 'API fixture property',
  city: 'Miami',
  zip: '33133',
  bedrooms: 3,
  bathrooms: 2,
  livingAreaSqft: 1840,
  yearBuilt: '2018',
};
const portfolio = {
  id: 2,
  name: 'API portfolio',
  description: null,
  currency: 'USD',
  holdingCount: 1,
};
const holding = {
  id: 8,
  portfolioId: 2,
  propertyId: 42,
  folio: '000123',
  countyId: 17,
  currency: 'USD',
  ownershipSharePercent: 100,
  financing: { type: 'UNKNOWN' },
  occupancy: { status: 'UNKNOWN' },
};
const metric = {
  status: 'UNAVAILABLE',
  total: null,
  knownTotal: 0,
  coveredHoldings: 0,
  totalHoldings: 1,
};
const inbox = Array.from({length:5},(_,i)=>({id:100-i,eventType:'NEW_MATCH',title:'Matching property available',message:'New matches for your saved search',propertyId:42,alertRuleId:3,savedSearchId:5,payload:{},occurredAt:'2026-10-30T12:00:00Z',createdAt:'2026-10-30T12:01:00Z',readAt:null,read:false}));
let favorites = [];
let authNonce = '',
  failFavorite = false,
  favoriteDelay = 0,
  searchFailures = 0,
  saveSearchFailures = 0,
  deleteRequests = 0;
let searches = [
  { id: 5, name: 'API search', filters: { countyId: 17 }, cadence: 'DAILY', paused: false },
];
let guestMode = false;
const jwt = (payload) =>
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
  '.' +
  Buffer.from(JSON.stringify(payload)).toString('base64url') +
  '.test-signature';
function mockApi(url, req) {
  if (url.pathname === '/notification-api/notifications') return {body:page(inbox)};
  if (url.pathname.startsWith('/notification-api/notifications/') && request.method === 'PATCH') {
    const id = Number(url.pathname.split('/').pop());
    const item = inbox.find(item => item.id === id);
    if (!item) return {status:404,body:{message:'Not found'}};
    item.read = true; item.readAt ||= new Date().toISOString();
    return {body:item};
  }

  const p = url.pathname;
  const body = req.postData ? JSON.parse(req.postData) : {};
  if (req.method === 'OPTIONS') return { body: {} };
  if (p.endsWith('/users/me/preferences'))
    return {
      body: {
        minBudget: null,
        maxBudget: 900000,
        targetLocations: [{ countyId: 17 }],
        investmentGoals: [],
      },
    };
  if (p.endsWith('/users/me')) {
    if (req.method === 'PATCH') Object.assign(profile, body);
    return { body: profile };
  }
  if (p.endsWith('/properties/search')) {
    if (searchFailures-- > 0) return { status: 503, body: { message: 'Temporary search failure' } };
    return { body: page([searchItem]) };
  }
  if (p.endsWith('/images/property/42'))
    return {
      body: [
        {
          id: 1,
          storagePath: 'http://127.0.0.1:4300/assets/images/property.webp',
          primaryImage: true,
          displayOrder: 0,
        },
      ],
    };
  if (p.endsWith('/properties/id/42')) return { body: property };
  if (p.endsWith('/properties/favorites')) return { body: favorites };
  if (p.endsWith('/properties/42/favorite')) {
    if (failFavorite) {
      failFavorite = false;
      return { status: 503, body: { message: 'Favorite unavailable' }, delay: favoriteDelay };
    }
    favorites =
      req.method === 'DELETE' ? [] : [{ propertyId: 42, favorite: true, createdAt: '2026-10-01' }];
    return { body: favorites[0] || {}, delay: favoriteDelay };
  }
  if (p.endsWith('/saved-searches/5') && req.method === 'DELETE') {
    deleteRequests++;
    searches = searches.filter((s) => s.id !== 5);
    return { body: {} };
  }
  if (p.endsWith('/saved-searches')) {
    if (req.method === 'POST') {
      if (saveSearchFailures-- > 0)
        return { status: 503, body: { message: 'Temporary save failure' } };
      const item = { id: 9, ...body };
      searches.push(item);
      return { body: item };
    }
    return { body: page(searches) };
  }
  if (p.endsWith('/alerts'))
    return {
      body: page([
        {
          id: 6,
          name: 'API alert',
          eventType: 'NEW_MATCH',
          savedSearchId: 5,
          propertyId: null,
          cadence: 'DAILY',
          paused: false,
          effectivePaused: false,
        },
      ]),
    };
  if (p.endsWith('/monitoring'))
    return {
      body: {
        alertRuleId: 6,
        status: 'READY',
        monitoringEnabled: true,
        publisherEnabled: true,
        baselineEstablished: true,
        effectivePaused: false,
        scannedMatches: 1,
        pendingEvents: 0,
        sentEvents: 0,
        failedEvents: 0,
      },
    };
  if (p.endsWith('/portfolios')) return { body: page([portfolio]) };
  if (p.endsWith('/portfolios/2/holdings')) return { body: page([holding]) };
  if (p.endsWith('/financial-records')) return { body: page([]) };
  if (p.endsWith('/summary'))
    return {
      body: {
        portfolioId: 2,
        portfolioName: 'API portfolio',
        status: 'PARTIAL',
        fromDate: '2026-01-01',
        toDate: '2026-10-29',
        asOfDate: '2026-10-29',
        errors: [],
        valuationAndDebt: {
          currency: 'USD',
          value: metric,
          debt: metric,
          equity: metric,
          note: 'Unknown source values',
        },
        financials: {
          income: 0,
          expenses: 0,
          cashFlow: 0,
          recordCount: 0,
          holdingsWithRecords: 0,
          totalHoldings: 1,
          note: 'Recorded transactions',
        },
        occupancyAndExposure: {
          totalHoldings: 1,
          knownOccupancyHoldings: 0,
          rentalHoldings: 0,
          rentalOccupancyPercent: null,
          states: [],
          counties: [],
          note: 'Current exposure',
        },
      },
    };
  if (p.endsWith('/comparables'))
    return {
      body: {
        propertyId: 42,
        subject: { propertyId: 42 },
        status: 'SUCCESS',
        comparables: [
          {
            rank: 1,
            candidate: {
              propertyId: 43,
              address: 'API comparable',
              salePrice: 400000,
              saleDate: '2026-09-01',
              distanceMeters: 500,
            },
            similarityScore: 85,
            evidenceCoveragePercent: 90,
            selectionReasons: [],
            missingData: [],
          },
        ],
        warnings: [],
        returnedCount: 1,
        consideredCandidates: 1,
        selectionVersion: 'v1',
        rankingVersion: 'v1',
      },
    };
  if (p.endsWith('/locations/states')) return { body: [{ id: 99, code: 'FL', name: 'Florida' }] };
  if (p.endsWith('/locations/counties'))
    return { body: [{ countyId: 17, countyName: 'Miami-Dade', stateCode: 'FL' }] };
  if (p.endsWith('/bulk')) return { body: {} };
  if (p.endsWith('/predictions/bypropertyid'))
    return {
      body: {
        propertyId: 42,
        predictedPrice: 500000,
        predictedPriceLow: 450000,
        predictedPriceHigh: 550000,
      },
    };
  return { status: 404, body: { message: 'No fixture: ' + p } };
}

(async () => {
  await new Promise((r) => server.listen(4300, '127.0.0.1', r));
  chrome = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=9334',
      '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'geozentra-qa-')),
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let tabs;
  for (let i = 0; i < 50; i++) {
    try {
      tabs = await (await fetch('http://127.0.0.1:9334/json')).json();
      break;
    } catch {
      await pause(200);
    }
  }
  if (!tabs) throw new Error('Chrome debugging endpoint unavailable');
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.id) {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      }
    } else if (m.method === 'Fetch.requestPaused') {
      const request = m.params.request,
        url = new URL(request.url);
      if (url.port === '8090') {
        if (url.pathname.endsWith('/auth')) {
          authNonce = url.searchParams.get('nonce');
          const callback =
            url.searchParams.get('redirect_uri') +
            (guestMode ? '#error=login_required&state=' : '#code=test-authorization-code&state=') +
            url.searchParams.get('state');
          cdp('Fetch.fulfillRequest', {
            requestId: m.params.requestId,
            responseCode: 302,
            responseHeaders: [{ name: 'Location', value: callback }],
          }).catch(() => {});
          return;
        }
        if (url.pathname.endsWith('/token')) {
          const now = Math.floor(Date.now() / 1000),
            claims = {
              sub: 'qa-user',
              preferred_username: 'apiuser',
              iat: now,
              exp: now + 300,
              nonce: authNonce,
              session_state: 'qa-session',
            };
          cdp('Fetch.fulfillRequest', {
            requestId: m.params.requestId,
            responseCode: 200,
            responseHeaders: [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'Access-Control-Allow-Origin', value: 'http://127.0.0.1:4300' },
              { name: 'Access-Control-Allow-Credentials', value: 'true' },
              { name: 'Access-Control-Allow-Headers', value: 'content-type,authorization' },
            ],
            body: Buffer.from(
              JSON.stringify({
                access_token: jwt(claims),
                id_token: jwt(claims),
                refresh_token: jwt({ ...claims, exp: now + 1800 }),
                token_type: 'Bearer',
                expires_in: 300,
                refresh_expires_in: 1800,
              }),
            ).toString('base64'),
          }).catch(() => {});
          return;
        }
        cdp('Fetch.fulfillRequest', {
          requestId: m.params.requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'text/html' }],
          body: Buffer.from('<script>parent.postMessage("unsupported","*")</script>').toString(
            'base64',
          ),
        }).catch(() => {});
        return;
      }
      const result = mockApi(url, request);
      const fulfill = () =>
        cdp('Fetch.fulfillRequest', {
          requestId: m.params.requestId,
          responseCode: result.status || 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,PUT,DELETE,OPTIONS' },
            { name: 'Access-Control-Allow-Headers', value: 'content-type,authorization' },
          ],
          body: Buffer.from(JSON.stringify(result.body)).toString('base64'),
        }).catch((e) => {
          if (!e.message.includes('Invalid InterceptionId')) errors.push(e.message);
        });
      if (result.delay) setTimeout(fulfill, result.delay);
      else fulfill();
    } else if (m.method === 'Runtime.exceptionThrown')
      errors.push(
        m.params.exceptionDetails.text +
          ': ' +
          (m.params.exceptionDetails.exception?.description || ''),
      );
  };
  await cdp('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Fetch.enable', {
    patterns: [
      { urlPattern: 'http://localhost:8081/api/*', requestStage: 'Request' },
      { urlPattern: 'http://127.0.0.1:4300/notification-api/*', requestStage: 'Request' },
      { urlPattern: 'http://localhost:8090/*', requestStage: 'Request' },
    ],
  });
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await go('dashboard');
  await waitFor('document.querySelector("h1")?.textContent.includes("API user")', 'real profile');
  await screenshot('dashboard-api-desktop');
  await go('explore');
  await waitFor('document.querySelectorAll("gz-property-card").length===1', 'API property search');
  await check(
    'document.querySelector("main").textContent.includes("API fixture property")',
    'actual property record',
  );
  favoriteDelay = 900;
  await click('gz-property-card gz-favorite-button button');
  await check(
    'document.querySelector("gz-property-card .favorite-control").getAttribute("aria-pressed")==="true" && document.querySelector("gz-property-card .favorite-control").disabled',
    'favorite responds immediately while saving',
  );
  await check(
    'getComputedStyle(document.querySelector("gz-property-card .favorite-control")).color==="rgb(215, 53, 80)" && document.querySelector("gz-property-card gz-icon[name=heart] path").getAttribute("fill")==="currentColor"',
    'favorite heart is filled red',
  );
  await waitFor(
    '!document.querySelector("gz-property-card .favorite-control").disabled',
    'favorite acknowledgement',
  );
  failFavorite = true;
  await click('gz-property-card .favorite-control');
  await check(
    'document.querySelector("gz-property-card .favorite-control").getAttribute("aria-pressed")==="false"',
    'removal responds immediately',
  );
  await waitFor(
    '!document.querySelector("gz-property-card .favorite-control").disabled && document.querySelector("gz-property-card .favorite-control").getAttribute("aria-pressed")==="true"',
    'failed removal rolls back',
  );
  favoriteDelay = 0;
  await click('gz-property-card .favorite-control');
  await waitFor(
    '!document.querySelector("gz-property-card .favorite-control").disabled && document.querySelector("gz-property-card .favorite-control").getAttribute("aria-pressed")==="false"',
    'successful removal restores heart',
  );
  await click('gz-property-card .favorite-control');
  await waitFor(
    '!document.querySelector("gz-property-card .favorite-control").disabled',
    're-added favorite',
  );
  searchFailures = 3;
  await evaluate(
    `(()=>{const input=document.querySelector('input[aria-label="City"]');input.value='New city';input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await waitFor(
    '!!document.querySelector("gz-request-status [role=alert]")',
    'bounded search failure',
  );
  await check(
    'document.querySelectorAll("gz-property-card").length===1',
    'previous results survive search failure',
  );
  await click('gz-request-status [role=alert] button');
  await waitFor(
    '!document.querySelector("gz-request-status [role=alert]")',
    'search retry recovers',
  );
  await evaluate(
    `(()=>{const input=document.querySelector('input[name=searchName]');input.value='Keep my search';input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  saveSearchFailures = 1;
  await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor(
    '!!document.querySelector("gz-request-status [role=alert]")',
    'saved search failure',
  );
  await check(
    'document.querySelector("input[name=searchName]").value==="Keep my search"',
    'failed saves preserve the draft',
  );
  await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor(
    'document.querySelector("input[name=searchName]").value===""',
    'saved draft clears after acknowledgement',
  );
  favoriteDelay = 0;
  for (let n = 0; n < 2; n++) {
    await click('gz-property-card gz-favorite-button button');
    await waitFor(
      '!document.querySelector("gz-property-card .favorite-control").disabled',
      'notification activity acknowledged',
    );
  }
  await click('gz-notification-menu button');
  await waitFor('!!document.querySelector("#notification-popup")', 'notification popup opens');
  await check(
    'document.querySelectorAll("#notification-popup li").length===5',
    'notification popup shows latest five',
  );
  await check(
    '!!document.querySelector("#notification-popup .notification-meta a[href]")',
    'notifications link to relevant pages',
  );
  await check(
    'document.querySelector("#notification-popup").getBoundingClientRect().right <= innerWidth',
    'notification popup stays in viewport',
  );
  await screenshot('notifications-api-desktop');
  await click('#notification-popup button');
  await check('!document.querySelector("#notification-popup")', 'notification popup closes');
  await screenshot('explore-api-desktop');
  await go('saved');
  await waitFor(
    'document.querySelectorAll("gz-property-card").length===1',
    'persisted API favorite',
  );
  await evaluate(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Delete').click()`,
  );
  await waitFor('!!document.querySelector("mat-dialog-container")', 'delete confirmation');
  await evaluate(
    `Array.from(document.querySelectorAll('mat-dialog-container button')).find(b=>b.textContent.trim()==='Cancel').click()`,
  );
  await waitFor('!document.querySelector("mat-dialog-container")', 'delete cancelled');
  if (deleteRequests !== 0) throw new Error('Delete request sent before confirmation');
  console.log('PASS cancelling deletion keeps the saved search');
  await go('property/42');
  await waitFor('document.querySelector(".main-photo")?.naturalWidth>0', 'property images');
  await screenshot('property-api-desktop');
  await go('compare/42');
  await waitFor(
    'document.querySelector("main").textContent.includes("API comparable")',
    'ranked comparable sales',
  );
  await go('portfolio');
  await waitFor(
    'document.querySelector("main").textContent.includes("API portfolio")',
    'portfolio API',
  );
  await waitFor('document.querySelector("main").textContent.includes("000123")', 'holding API');
  await check(
    'document.querySelector("main").textContent.includes("Unavailable")',
    'unknown portfolio totals stay unknown',
  );
  await evaluate(
    `(() => { const i=document.querySelector('#holding-address'); i.value='API fixture'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`,
  );
  await waitFor(
    '!!document.querySelector("gz-holding-property-picker .result img")',
    'holding address results with thumbnail',
  );
  await check(
    'document.querySelector("gz-holding-property-picker .result a").getAttribute("target")==="_blank" && document.querySelector("gz-holding-property-picker .result a").getAttribute("href")==="/property/42"',
    'holding details open separately',
  );
  await evaluate(
    `(() => { const i=document.querySelector('[name=purchasePrice]'); if(i){i.value='250000';i.dispatchEvent(new Event('input',{bubbles:true}));} })()`,
  );
  await click('gz-holding-property-picker .pick');
  await check(
    'document.querySelector("gz-holding-property-picker .chosen").textContent.includes("API fixture property") && !document.querySelector("#propertyId")',
    'holding selects property without asking for ID',
  );
  await screenshot('holding-picker-selected-desktop');
  await click('gz-holding-property-picker .chosen button');
  await check('!!document.querySelector("#holding-address")', 'holding selection can be changed');
  await screenshot('portfolio-api-desktop');
  await go('settings');
  await waitFor(
    'document.querySelector("input[name=firstName]")?.value==="API user"',
    'profile form',
  );
  await go('alerts');
  await waitFor('document.querySelector("main").textContent.includes("API alert")', 'alert rules');
  await screenshot('alerts-api-desktop');
  for (const route of ['investment-studio', 'assistant', 'crm', 'loan-review', 'opportunities']) {
    await go(route);
    await check('!!document.querySelector("h1")', 'route ' + route);
  }
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  for (const route of ['dashboard', 'explore', 'property/42', 'portfolio', 'alerts', 'settings']) {
    await go(route);
    await pause(400);
    await check('document.documentElement.scrollWidth<=390', 'mobile width ' + route);
    await screenshot(route.replace('/', '-') + '-api-mobile');
  }
  guestMode = true;
  await go('explore');
  await pause(500);
  await click('gz-property-card .favorite-control');
  await waitFor(
    'document.querySelector("#toast").textContent.includes("Sign in to save properties")',
    'guest save feedback',
  );
  await check('location.pathname==="/explore"', 'guest action does not force navigation');
  await check(
    '!document.querySelector("gz-request-status [role=alert]")',
    'guest browsing avoids authentication error banners',
  );
  if (errors.length) throw new Error('Browser exceptions: ' + errors.join('\n'));
  console.log('PASS no browser runtime exceptions');
})()
  .catch((error) => {
    console.error(error);
    if (errors.length) console.error(errors.join('\n'));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (ws?.readyState === 1) {
      try {
        await cdp('Browser.close');
      } catch {}
      ws.close();
    }
    chrome?.kill();
    server.close();
  });
