import test from 'node:test';
import assert from 'node:assert/strict';
import { versionedImport, versionedImportGrep } from '../lib/module-version.mjs';

const numbers = (text, name) => [...text.matchAll(versionedImport(name))].map(m => Number(m[2]));

test('an import with a version is found, whatever quotes or folder it has', () => {
  assert.deepEqual(numbers(`import {a} from './project.js?v=9';`, 'project.js'), [9]);
  assert.deepEqual(numbers(`import {a} from "./project.js?v=10";`, 'project.js'), [10]);
  assert.deepEqual(numbers(`<script type="module" src="./sequence.js?v=81"></script>`, 'sequence.js'), [81]);
  assert.deepEqual(numbers(`import * as m from '../../app/method-samples.js?v=5';`, 'method-samples.js'), [5]);
});

test('a module whose name only ends the same way is not the same module', () => {
  const text = `import a from './lyric-project.js?v=9'; import b from './method-project.js?v=10'; import c from './project.js?v=3';`;
  assert.deepEqual(numbers(text, 'project.js'), [3]);
  assert.deepEqual(numbers(text, 'lyric-project.js'), [9]);
  assert.deepEqual(numbers(text, 'method-project.js'), [10]);
  assert.deepEqual(numbers(`import a from './image-method-editor.js?v=2';`, 'method-editor.js'), []);
});

test('the dot in a name is a dot, not "any character"', () => {
  assert.deepEqual(numbers(`import a from './motionXjs?v=1';`, 'motion.js'), []);
});

test('the pattern for git grep finds the same imports', () => {
  const grep = new RegExp(versionedImportGrep('project.js'), 'g');
  const text = `from './lyric-project.js?v=9'; from './project.js?v=3'; from "./project.js?v=4"`;
  assert.deepEqual(text.match(grep), [`/project.js?v=3`, `/project.js?v=4`]);
});
