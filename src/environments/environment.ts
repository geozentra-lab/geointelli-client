export const environment = {
  production: false,
  notificationApiUrl: '/notification-api',
  apiUrl: 'http://localhost:8081/api',
  // Public property browsing can remain anonymous; owner-scoped APIs use Keycloak identity.
  authenticationEnabled: true,
  keycloak: { url: 'http://100.26.199.78:8090', realm: 'geozentra', clientId: 'frontend-app' },
};
