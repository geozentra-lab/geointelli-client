# GeoZentra Keycloak login branding

Inspected live setup: `http://localhost:8090`, realm `geozentra`, client `frontend-app`, container `infallible_noether`. Its bind mount maps **`C:/keycloak-themes`** to **`/opt/keycloak/themes`**. The backend Compose file describes a different instance on port 8082; do not change it to modify the running login.

The running theme already has `login.ftl`, `register.ftl` and `theme.properties`. The asset directory is incorrectly named **`ressources`**. The login's `${url.resourcesPath}/css/styles.css` request returns 404 because Keycloak requires **`resources`**.

## Apply the design

1. Rename `C:\keycloak-themes\geozentra\login\ressources` to `resources` (if a `resources` directory already exists, merge the files instead).
2. Replace `C:\keycloak-themes\geozentra\login\resources\css\styles.css` with [the prepared stylesheet](themes/geozentra/login/resources/css/styles.css). It styles the existing templates using the application's navy, copper and pale-gray palette, with a responsive split layout.
3. Add these tags inside `<head>` in both existing `login.ftl` and `register.ftl`:

   ```html
   <meta charset="UTF-8" />
   <meta name="viewport" content="width=device-width, initial-scale=1" />
   <title>GeoZentra</title>
   ```

4. Keep the existing stylesheet link:

   ```html
   <link rel="stylesheet" href="${url.resourcesPath}/css/styles.css" />
   ```

5. In the Keycloak Admin Console select **geozentra → Realm settings → Themes → Login theme → geozentra → Save**. The live page already serves this theme, so this setting is likely already selected. If the client has a login-theme override, keep it set to the same theme.
6. Restart the Keycloak container if cached resources still show the old appearance, then hard-refresh a newly opened login page. Restarting interrupts authentication temporarily; no running container was changed during this inspection.

For theme development, configure these Keycloak startup flags on your existing container/deployment and restore normal caching for production:

```text
--spi-theme-static-max-age=-1
--spi-theme-cache-themes=false
--spi-theme-cache-templates=false
```

## What to edit next

- `resources/css/styles.css`: colors, spacing, typography and responsive layout.
- `login.ftl`: sign-in layout and copy. Keep Keycloak's `${url.loginAction}` and provider URLs.
- `register.ftl`: registration layout and fields, consistent with the realm's user-profile requirements.
- `theme.properties`: theme inheritance, styles and other theme settings.

This stylesheet targets the existing custom templates. Password-reset, MFA and other inherited pages retain the parent theme until their templates/styles are also customized. Fonts use local fallbacks unless the theme is supplied with locally hosted DM Sans/Manrope font files.

References: [Keycloak 24 theme documentation](https://www.keycloak.org/docs/24.0.5/server_development/index.html#_themes), [current theme documentation](https://www.keycloak.org/ui-customization/themes).

## Close sign-in and browse as a guest

`login/login.ftl` now includes a close button that submits Keycloak's native `cancel` action. `formnovalidate` permits cancellation with empty required fields. The button occurs after the normal submit button in DOM order so Enter still signs in. The standard OIDC cancellation callback returns users to their original frontend route, where initialization continues anonymously. Deploy the template together with the stylesheet.
