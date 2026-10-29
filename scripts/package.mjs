// Builds dist/trpc-devtools-<version>.zip, ready for the Chrome Web Store or addons.mozilla.org.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('manifest.json', 'utf8'));
const out = `dist/trpc-devtools-${version}.zip`;
mkdirSync('dist', { recursive: true });
rmSync(out, { force: true });
execFileSync(
  'zip',
  ['-r', out, 'manifest.json', 'devtools.html', 'devtools.js', 'panel.html', 'panel.css', 'panel.js', 'src', 'icons',
   '-x', 'src/fixtures.js'],
  { stdio: 'inherit' },
);
console.log(`→ ${out}`);
