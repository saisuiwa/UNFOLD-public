import test from 'node:test';
import assert from 'node:assert/strict';
import { vertexShader } from '../../app/motion.js';

const count = (s, part) => s.split(part).length - 1;

test('the vertex shader has the two places custom methods plug into, in the right order', () => {
  assert.equal(count(vertexShader, '//@CUSTOM_FUNCTIONS'), 1);
  assert.equal(count(vertexShader, '//@CUSTOM_DISPATCH'), 1);
  const functions = vertexShader.indexOf('//@CUSTOM_FUNCTIONS');
  const breakAt = vertexShader.indexOf('vec3 breakAt(float m,vec2 p,float amount){');
  const dispatch = vertexShader.indexOf('//@CUSTOM_DISPATCH');
  assert.ok(functions < breakAt && breakAt < dispatch, 'functions, then breakAt, then the dispatch inside it');
  // the functions have to come after the helpers a custom method may call
  for (const helper of ['float hash(vec2 p)', 'mat2 rot(float a)', 'vec2 partC()', 'float ph(float k)']) assert.ok(vertexShader.indexOf(helper) < functions, helper);
});

test('only the line-art built-ins (28 line, 29-33 the newer line-art methods) switch off the tile shuffle, numbers for custom methods do not', () => {
  assert.ok(vertexShader.includes('lineA=step(27.5,uMethod)*step(uMethod,33.5),lineB=step(27.5,uMethod2)*step(uMethod2,33.5)'));
});
