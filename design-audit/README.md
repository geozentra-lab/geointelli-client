Audit screenshots, mock server and fixtures live here. Nothing in this folder is imported by app code
or included in the build.

- AUDIT.md: the audit (step 1), the design directions (step 2), and fonts, the unavailable marker and the layouts (step 3). The decisions are written up in ../DESIGN.md.
- mock/server.cjs and mock/fixtures/: mock backend and fake Keycloak (no dependencies).
- capture.cjs and shots.cjs: screenshot every page through Chrome's DevTools protocol.
- directions/specimen.html: the three directions on one screen (?d=a, ?d=b, ?d=c).
- directions/unavailable.html: the final unavailable marker.
- layouts/specimen.html: the two shell layouts (?l=desk, ?l=register; &h=manrope for Manrope headings).
- layouts/property.html and layouts/explore.html: the public shell on the property page (?u=guest) and Explore with the docked map; they share layouts/public.css and read layouts/data.js.
- layouts/make-data.cjs: rebuilds layouts/data.js from the running mock (node design-audit/mock/server.cjs --port 4399 --api-port 0).
- specimen-shots.cjs and frame.html: screenshots of the static specimens (phone widths go through frame.html).

Run:

    npx ng build --output-path design-audit/.build
    node --experimental-websocket design-audit/capture.cjs        # or: --only <name>
    node design-audit/mock/server.cjs                              # app on :4310, API on :8081
    node design-audit/specimen-shots.cjs                           # specimen screenshots

.build/ is ignored by design-audit/.gitignore.
