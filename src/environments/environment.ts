export const environment = {
  production: false,
  // Both services are reached on the page's own origin, so the browser needs no CORS: `ng serve`
  // forwards them with proxy.conf.mjs, and in production the web server does (deploy/nginx.conf).
  notificationApiUrl: '/notification-api',
  apiUrl: '/api',
  // Public property browsing can remain anonymous; owner-scoped APIs use Keycloak identity.
  authenticationEnabled: true,
  keycloak: { url: 'https://d12fj7533mgu4t.cloudfront.net', realm: 'geozentra', clientId: 'frontend-app' },
};
