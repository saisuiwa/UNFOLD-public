// Makes the public copy of this repository and, with --push, updates the public repository with it.
// The working repository stays private (the daily routine and the Mac push there). The public one gets main only,
// rewritten by git filter-repo with the rules in public-mirror/, which Git ignores and which stay on this Mac
// (they contain the very words they remove):
//   mailmap.txt          old commit mail -> the GitHub noreply address
//   replace-text.txt     words and paths replaced in every file version (git filter-repo --replace-text format)
//   replace-message.txt  the same for commit messages
//   strip-blobs.txt      file versions left out of the copy (old screenshots), one blob id per line
//   forbidden.txt        what must not be left anywhere in the copy, one per line ("regex:" for a pattern), on top of tools/lib/public-hygiene.mjs
//   public-remote.txt    the URL of the public repository (without it, the copy is only made and checked)
// The same rules and the same commits give the same commit ids, so each run only adds the new commits (a fast-forward).
// When the rules change, the old commits get new ids: the run stops before pushing (docs/公開用リポジトリへの反映.md).
//   node tools/public_mirror.mjs           make and check the copy, show what would be pushed
//   node tools/public_mirror.mjs --push    the same, then push it (ask the author first, every time)
// MIRROR_SOURCE=<path or URL> copies another repository than origin (to try the rules before pushing to origin);
// MIRROR_RULES=<folder> reads the rules from another folder (to try a change to them).
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, readFileSync, mkdtempSync, copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {HYGIENE_RULES, hygieneProblems} from './lib/public-hygiene.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const RULES = process.env.MIRROR_RULES || join(REPO, 'public-mirror');
const PUSH = process.argv.includes('--push');
const NOREPLY = /(@users\.noreply\.github\.com|^noreply@github\.com|^noreply@anthropic\.com)$/;

const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', maxBuffer: 1 << 30}).trim();
const stop = message => { console.error('STOP  ' + message); process.exit(1); };
const ruleFile = name => { const path = join(RULES, name); if (!existsSync(path)) stop(`${path} is missing (docs/公開用リポジトリへの反映.md)`); return path; };
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- 0. tools and rules
if (spawnSync('git', ['filter-repo', '--version']).status !== 0) stop('git filter-repo is not installed (brew install git-filter-repo)');
const rules = {mailmap: ruleFile('mailmap.txt'), text: ruleFile('replace-text.txt'), message: ruleFile('replace-message.txt'), strip: ruleFile('strip-blobs.txt'), forbidden: ruleFile('forbidden.txt')};
const remoteFile = join(RULES, 'public-remote.txt');
const publicRemote = existsSync(remoteFile) ? readFileSync(remoteFile, 'utf8').trim() : '';
if (PUSH && !publicRemote) stop('public-remote.txt is missing: there is no public repository to push to');
const forbidden = readFileSync(rules.forbidden, 'utf8').split('\n')
  .map((l, i) => [l.trim(), i + 1]).filter(([l]) => l && !l.startsWith('#'))
  .map(([l, n]) => [new RegExp(l.startsWith('regex:') ? l.slice(6) : escapeRe(l), 'i'), `forbidden.txt line ${n}`]);

// ---- 1. a fresh copy of the private main (what is on GitHub, not this folder)
const source = process.env.MIRROR_SOURCE || git(REPO, 'remote', 'get-url', 'origin');
const work = mkdtempSync(join(tmpdir(), 'unfold-public-'));
execFileSync('git', ['clone', '--quiet', '--no-local', '--single-branch', '--branch', 'main', source, work], {stdio: 'inherit'});
const sourceHead = git(work, 'rev-parse', 'HEAD'), sourceTree = git(work, 'rev-parse', 'HEAD^{tree}');
console.log(`source   main ${sourceHead.slice(0, 7)}, ${git(work, 'rev-list', '--count', 'HEAD')} commits`);

// ---- 2. rewrite
execFileSync('git', ['filter-repo', '--mailmap', rules.mailmap, '--replace-text', rules.text, '--replace-message', rules.message, '--strip-blobs-with-ids', rules.strip], {cwd: work, stdio: ['ignore', 'ignore', 'inherit']});
const head = git(work, 'rev-parse', 'HEAD');
copyFileSync(join(work, '.git/filter-repo/commit-map'), join(RULES, 'commit-map.txt'));   // private id -> public id, for looking up the numbers in the docs

// ---- 3. checks
// the newest files must be exactly the private main's: the rules only clean the past (the present is kept clean by tools/test/public-hygiene.test.mjs)
if (git(work, 'rev-parse', 'HEAD^{tree}') !== sourceTree) stop('the rules changed the current files too: clean them in the private repository first');
const mails = [...new Set(git(work, 'log', '--format=%ae%n%ce').split('\n'))].filter(m => !NOREPLY.test(m));
if (mails.length) stop(`${mails.length} commit mail address(es) are not noreply ones: add them to mailmap.txt`);
const blobs = git(work, 'rev-list', '--objects', '--all').split('\n').map(l => l.split(' ')).filter(([, path]) => path);
const batch = execFileSync('git', ['cat-file', '--batch'], {cwd: work, input: blobs.map(([id]) => id).join('\n') + '\n', maxBuffer: 2 ** 31});
const problems = [];
let at = 0, scanned = 0;
for (const [, path] of blobs) {
  const nl = batch.indexOf(10, at), [, type, size] = batch.subarray(at, nl).toString().split(' ');
  const data = batch.subarray(nl + 1, nl + 1 + Number(size));
  at = nl + 2 + Number(size);
  if (type !== 'blob' || data.subarray(0, 8000).includes(0)) continue;   // trees, binary files
  const text = data.toString('utf8');
  scanned++;
  const found = [...(path.startsWith('app/vendor/') ? [] : hygieneProblems(text, HYGIENE_RULES)), ...hygieneProblems(text, forbidden)];
  for (const {line, what} of found) problems.push(`${path}:${line}  ${what}`);
}
git(work, 'log', '--format=%h%x00%B%x01').split('\x01').forEach(entry => {
  const [id, message = ''] = entry.trim().split('\0');
  for (const {what} of hygieneProblems(message, [...HYGIENE_RULES, ...forbidden])) problems.push(`commit ${id} message  ${what}`);
});
if (problems.length) stop(`${problems.length} thing(s) left in the copy (the words are not shown):\n  ${[...new Set(problems)].slice(0, 30).join('\n  ')}`);
console.log(`checked  ${scanned} text file versions and every commit message: clean; the files are the same as the private main`);

// ---- 4. the public repository: the copy must only add commits to it
let base = null;
if (publicRemote) {
  const fetched = spawnSync('git', ['fetch', '--quiet', publicRemote, 'main'], {cwd: work, encoding: 'utf8'});
  if (fetched.status === 0) base = git(work, 'rev-parse', 'FETCH_HEAD');
  else if (!/couldn.t find remote ref/i.test(fetched.stderr)) stop('could not read the public repository: ' + fetched.stderr.trim());
  if (base && spawnSync('git', ['merge-base', '--is-ancestor', base, 'HEAD'], {cwd: work}).status !== 0)
    stop('the public main is not part of the new copy (did the rules change?). Nothing was pushed (docs/公開用リポジトリへの反映.md)');
}
const fresh = Number(git(work, 'rev-list', '--count', base ? `${base}..HEAD` : 'HEAD'));
console.log(`public   ${publicRemote || '(no public repository yet)'}: ${base ? 'main ' + base.slice(0, 7) + ', ' : 'empty, '}${fresh} new commit(s); the copy's main is ${head.slice(0, 7)}`);

// ---- 5. push (only when asked)
if (!PUSH) { console.log(`DRY RUN  nothing pushed. The copy is in ${work}`); process.exit(0); }
if (!fresh) { console.log('the public main is already up to date'); process.exit(0); }
execFileSync('git', ['push', publicRemote, 'HEAD:refs/heads/main'], {cwd: work, stdio: 'inherit'});
console.log(`PUSHED   ${fresh} commit(s): public main ${head.slice(0, 7)} = private main ${sourceHead.slice(0, 7)}`);
