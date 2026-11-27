<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GeoZentra</title>
  <link rel="stylesheet" href="${url.resourcesPath}/css/styles.css">
</head>

<body>

<main class="auth-wrapper">

  <section class="auth-card">

    <!-- LEFT PANEL -->
    <aside class="auth-left">
      <div>
        <p class="brand">GEOZENTRA</p>
        <h2>Spatial Intelligence for Modern Real Estate Teams</h2>
      </div>

      <p class="subtitle">
        Monitor parcels, evaluate opportunities, and collaborate in one secure workspace.
      </p>
    </aside>

    <!-- RIGHT PANEL -->
    <div class="auth-right">

      <h1>Sign in</h1>
      <p class="muted">Use your account to continue</p>

      <form id="kc-form-login" action="${url.loginAction}" method="post">

        <input
          type="text"
          name="username"
          placeholder="Email or Username"
          value="${(login.username!'')}"
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          required
        />

        <button type="submit">Sign in</button>

      </form>
      <button class="auth-close" type="submit" form="kc-form-login" name="cancel" value="true" formnovalidate aria-label="Close sign-in and continue as guest" title="Continue as guest"><span aria-hidden="true">&times;</span></button>

      <div class="divider">OR</div>

      <!-- Google login -->
      <#if social.providers??>
        <#list social.providers as p>
          <a class="google-btn" href="${p.loginUrl}">
            Continue with Google
          </a>
        </#list>
      </#if>

      <p class="switch">
        New here?
        <a href="${url.registrationUrl}">Create an account</a>
      </p>

    </div>

  </section>

</main>

</body>
</html>