#!/usr/bin/env node
// Screenshots of the static specimens (directions/, layouts/) with headless Chrome. No dependencies.
//   node design-audit/specimen-shots.cjs [name ...]
// The specimens are served from a local static server (not file://) because OpenStreetMap's tile
// servers refuse requests without a page origin.
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.SPECIMEN_PORT || 4320);
const here = __dirname;
const out = path.join(here, 'screenshots');
const shots = [
  // [name, file, query, width, height]
  ['directions/unavailable', 'directions/unavailable.html', '', 1280, 2480],
  ['layouts/desk', 'layouts/specimen.html', '?l=desk', 1440, 900],
  ['layouts/desk-390', 'layouts/specimen.html', '?l=desk', 390, 844],
  ['layouts/desk-390-record', 'layouts/specimen.html', '?l=desk&open=1', 390, 1400],
  ['layouts/register', 'layouts/specimen.html', '?l=register', 1440, 900],
  ['layouts/register-390', 'layouts/specimen.html', '?l=register', 390, 1400],
  ['layouts/desk-manrope', 'layouts/specimen.html', '?l=desk&h=manrope', 1440, 900],
  ['layouts/public-property', 'layouts/property.html', '', 1440, 1700],
  ['layouts/public-property-guest-390', 'layouts/property.html', '?u=guest', 390, 2080],
  ['layouts/explore-docked-map', 'layouts/explore.html', '', 1440, 900],
];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.resolve(here, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(here) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const run = (args) => new Promise((resolve) => execFile(CHROME, args, () => resolve()));
server.listen(PORT, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${PORT}/`;
  const only = process.argv.slice(2);
  for (const [name, file, query, w, h] of shots) {
    if (only.length && !only.includes(name)) continue;
    const page = file + query + (query ? '&' : '?') + 'shot=1';
    // Below ~500 px the window itself won't shrink, so phone widths go through frame.html.
    const url = w < 500 ? base + 'frame.html?' + new URLSearchParams({ src: page, w, h }) : base + page;
    const target = path.join(out, name + '.png');
    await run([
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
      `--user-data-dir=${path.join(os.tmpdir(), 'gz-specimen-shots')}`,
      `--window-size=${w},${h}`, '--virtual-time-budget=10000', `--screenshot=${target}`, url,
    ]);
    console.log(name, '->', path.relative(process.cwd(), target));
  }
  server.close();
});
