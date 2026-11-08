// Renders assets/icon.svg to the PNG sizes the extension uses, with
// headless Chrome (set CHROME to its path if it is not in the default macOS location).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = resolve(import.meta.dirname, '..');
const work = mkdtempSync(join(tmpdir(), 'icons-'));
const SIZES = [16, 32, 48, 96, 128];

const svg = readFileSync(join(root, 'assets', 'icon.svg'), 'utf8');
for (const size of SIZES) {
  const page = join(work, `${size}.html`);
  writeFileSync(
    page,
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
  );
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${join(root, 'src/public', `icon-${size}.png`)}`,
      `file://${page}`,
    ],
    { stdio: 'ignore' }
  );
}
console.log(`Rendered ${SIZES.length} icons into src/public`);
