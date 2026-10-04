import test from 'node:test';
import assert from 'node:assert/strict';
import { describeGlError } from '../../app/method-messages.js';

test('the common GPU compiler messages become plain Japanese', () => {
  assert.match(describeGlError("'undefinedThing' : undeclared identifier"), /「undefinedThing」という名前が見つかりません/);
  assert.match(describeGlError("'hash' : function already has a body"), /「hash」は、もともと用意されている関数と同じ名前/);
  assert.match(describeGlError("'}' : syntax error"), /書き方がおかしい/);
  assert.match(describeGlError("'=' : cannot convert from 'const 2-component vector of float' to 'float'"), /型が合っていません/);
  assert.match(describeGlError("'+' : wrong operand types - no operation '+' exists that takes a left-hand operand of type 'float' and a right operand of type 'vec2'"), /型の組み合わせが合っていません/);
  assert.match(describeGlError("'foo' : no matching overloaded function found"), /「foo」/);
  assert.match(describeGlError("'constructor' : not enough data provided for construction"), /値が足りません/);
});

test('an unknown message is returned as it is', () => {
  assert.equal(describeGlError("'x' : something new"), "'x' : something new");
  assert.equal(describeGlError(''), '');
});
