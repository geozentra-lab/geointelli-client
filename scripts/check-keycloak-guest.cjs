// Verify the deployed guest-close action without credentials or account changes.
const base = 'http://localhost:8090';
const returnUrl = 'http://localhost:4200/explore';
const cookies = new Map();
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0],
      separator = pair.indexOf('=');
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return response;
}
(async () => {
  const url = new URL('/realms/geozentra/protocol/openid-connect/auth', base);
  url.search = new URLSearchParams({
    client_id: 'frontend-app',
    redirect_uri: returnUrl,
    response_type: 'code',
    response_mode: 'fragment',
    scope: 'openid',
    state: 'guest-close-verification',
    code_challenge: 'F2s7hz18L5pVWqIV0AAmojLv-PGl2V41vMnH8Vll6bA',
    code_challenge_method: 'S256',
  });
  let response;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      response = await request(url);
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  for (let hop = 0; response.status === 302 && hop < 5; hop++) {
    const next = new URL(response.headers.get('location'), base);
    if (next.origin !== base) throw new Error('Unexpected redirect before sign-in form.');
    response = await request(next);
  }
  const html = await response.text();
  if (response.status !== 200 || !/class="auth-close"/.test(html) || !/formnovalidate/.test(html))
    throw new Error('Deployed close button is missing.');
  const action = html.match(/<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/);
  if (!action) throw new Error('Login form action not found.');
  const result = await request(new URL(action[1].replaceAll('&amp;', '&'), base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ cancel: 'true' }),
  });
  if (result.status !== 302) throw new Error('Cancel did not redirect back to the app.');
  const destination = new URL(result.headers.get('location'));
  const params = new URLSearchParams(destination.hash.slice(1));
  if (
    destination.origin + destination.pathname !== returnUrl ||
    params.get('error') !== 'access_denied'
  )
    throw new Error('Cancel did not preserve the frontend route and OIDC cancellation response.');
  console.log('PASS live login close button is present.');
  console.log('PASS cancel works without username or password.');
  console.log('PASS returns to the original frontend route for guest browsing.');
})().catch(() => {
  console.error(
    'Guest-close verification failed; inspect the deployed theme and Keycloak availability.',
  );
  process.exitCode = 1;
});
