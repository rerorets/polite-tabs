// Renders the Chrome Web Store images in assets/store from the layouts in
// assets/store/src. The built popup and settings page are embedded with fake
// chrome.* APIs (stub.js), so run `npm run build` first. Uses headless Chrome
// (set CHROME to its path if it is not in the default macOS location).
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = resolve(import.meta.dirname, '..');
const build = join(root, 'build');
const src = join(root, 'assets/store/src');

const IMAGES = [
  { page: 'shot-1.html', out: 'screenshot-1.png', size: [1280, 800], scheme: 'light' },
  { page: 'shot-2.html', out: 'screenshot-2.png', size: [1280, 800], scheme: 'dark' },
  { page: 'shot-3.html', out: 'screenshot-3.png', size: [1280, 800], scheme: 'light' },
  { page: 'promo.html', out: 'promo-small.png', size: [440, 280], scheme: 'dark' },
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

// Layouts live under /__store/; everything else is the build, with the stub
// injected into its pages so they run without the extension APIs.
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = path.startsWith('/__store/') ? join(src, path.slice(9)) : join(build, path);
  try {
    let body = readFileSync(file);
    if (!path.startsWith('/__store/') && extname(file) === '.html') {
      body = body.toString().replace('<head>', '<head><script src="/__store/stub.js"></script>');
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => server.listen(0, ok));
const { port } = server.address();

for (const image of IMAGES) {
  const profile = mkdtempSync(join(tmpdir(), 'store-'));
  // Async on purpose: a sync call would block the server Chrome is loading from.
  await promisify(execFile)(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
    `--blink-settings=preferredColorScheme=${image.scheme === 'dark' ? 0 : 1}`,
    '--force-device-scale-factor=1',
    '--virtual-time-budget=4000',
    `--window-size=${image.size.join(',')}`,
    `--screenshot=${join(root, 'assets/store', image.out)}`,
    `http://localhost:${port}/__store/${image.page}`,
  ]);
  rmSync(profile, { recursive: true, force: true });
}
server.close();
console.log(`Rendered ${IMAGES.length} images into assets/store`);
