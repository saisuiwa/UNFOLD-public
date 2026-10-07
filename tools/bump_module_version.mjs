// After a module in app/ changed, raise the ?v=N on every import of it, so browsers do not keep the old copy
// and no page ends up with two different copies of one module.
// Raising a number rewrites the file that holds the import, so that file has changed too: its own imports are raised as well,
// all the way up to the HTML page (which is why one run can touch several files).
// Run:  node tools/bump_module_version.mjs app/lyric-motion.js [more files...]
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionedImport } from './lib/module-version.mjs';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const TEST_PAGES = fileURLToPath(new URL('./test/', import.meta.url));   // the browser test pages import app modules with ?v= too
const walk = dir => readdirSync(dir).flatMap(name => {
  if (name === 'vendor' || name === 'guide' || name === 'fixtures') return [];
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.(js|html)$/.test(name) ? [path] : [];
});
const files = [...walk(APP), ...walk(TEST_PAGES)];
const bumped = new Set();                            // each module is raised once per run, however many of its own imports changed

function bump(target) {
  const name = basename(target);
  if (bumped.has(name)) return;
  bumped.add(name);
  const pattern = versionedImport(name);
  const found = files.map(file => ({ file, text: readFileSync(file, 'utf8') })).filter(({ text }) => text.match(pattern));
  const numbers = found.flatMap(({ text }) => [...text.matchAll(pattern)].map(m => Number(m[2])));
  if (!numbers.length) { console.log(`${name}: no import with ?v= found (nothing to raise)`); return; }
  const next = Math.max(...numbers) + 1;
  for (const { file, text } of found) writeFileSync(file, text.replace(pattern, `$1${next}`));
  console.log(`${name}: ?v=${[...new Set(numbers)].sort((a, b) => a - b).join('/')} -> ?v=${next} in ${found.map(({ file }) => relative(join(APP, '..'), file)).join(', ')}`);
  for (const { file } of found) if (file.startsWith(APP) && file.endsWith('.js')) bump(file);          // that file changed too: raise the imports of it
}

for (const target of process.argv.slice(2)) bump(target);
