// The repository is public: the tracked text files must not name the people behind it.
// No nickname of the author or of the AI, no Mac user folder (/Users/<name>/…), no personal mail address.
// Write 作者 (the author) and Claude, and ~/… or a path relative to the repository instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TEXT = /\.(md|txt|js|mjs|html|json|css|py)$/;
// the words are put together from pieces so that this file does not match itself
const RULES = [
  [new RegExp('/Users/' + '[A-Za-z0-9._-]+/'), 'a Mac user folder: write ~/… or a path relative to the repository'],
  [new RegExp('ひろ' + 'くん'), 'the author’s nickname: write 作者'],
  [new RegExp('コ' + 'コ(?![アナッ])'), 'the AI’s nickname: write Claude'],
  [new RegExp('[A-Za-z0-9._%+-]+@' + '(gmail|yahoo|icloud|outlook|hotmail)\\.[a-z.]+', 'i'), 'a personal mail address'],
];

let files = null;
try { files = execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files', '-z'], {cwd: ROOT, encoding: 'utf8'}).split('\0').filter(Boolean); } catch {}

test('no nickname, Mac user folder or personal mail address in the tracked text files', {skip: files ? false : 'not a git checkout'}, () => {
  const found = [];
  for (const file of files) {
    if (!TEXT.test(file) || file.startsWith('app/vendor/')) continue;
    let text;
    try { text = readFileSync(ROOT + file, 'utf8'); } catch { continue; }   // listed but not on disk (deleted, not yet committed)
    text.split('\n').forEach((line, i) => {
      for (const [re, what] of RULES) if (re.test(line)) found.push(`${file}:${i + 1}  ${what}`);
    });
  }
  assert.deepEqual(found, []);
});
