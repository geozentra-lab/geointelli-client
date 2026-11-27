// Dev server proxy (`ng serve`): the app calls /api and /notification-api on its own address and
// this forwards them, so the browser needs no CORS. In production the web server does the same
// (deploy/nginx.conf).
//
// Without settings, both go to the backend on the server. To use services running on this computer:
//   PowerShell: $env:API_TARGET = "http://localhost:8081"; npx ng serve
//               (Remove-Item Env:API_TARGET to go back to the server)
//   Git Bash:   API_TARGET=http://localhost:8081 npx ng serve
// NOTIFICATION_TARGET does the same for the notification service.
const SERVER = 'http://3.229.63.159';
const api = process.env.API_TARGET || `${SERVER}:8081`;
const notifications = process.env.NOTIFICATION_TARGET || `${SERVER}:8082`;

console.log(`Proxy: /api -> ${api}, /notification-api -> ${notifications}`);

export default {
  '/api/**': {
    target: api,
    secure: false,
    changeOrigin: true,
  },
  '/notification-api/**': {
    target: notifications,
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/notification-api': '/api' },
  },
};
