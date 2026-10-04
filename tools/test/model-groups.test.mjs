import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL, DEFAULT_GROUPS, UNGROUPED, cleanGroupName, filterByGroup, groupNames, groupOf, inGroup, tabList, validActive, wantsTabs } from '../../app/model-groups.js';

const m = (name, group) => ({ id: name, name, ...(group === undefined ? {} : { group }) });

test('cleanGroupName: trims, drops control characters, cuts to 20, refuses the reserved names', () => {
  assert.equal(cleanGroupName('  動物・生き物 '), '動物・生き物');
  assert.equal(cleanGroupName('a\u0000b\tc'), 'abc');            // control characters (tab included) are dropped
  assert.equal(cleanGroupName('人物   と   物'), '人物 と 物');      // runs of spaces become one
  assert.equal(cleanGroupName('あ'.repeat(30)).length, 20);
  assert.equal(cleanGroupName('*'), '');
  assert.equal(cleanGroupName('未分類'), '');
  assert.equal(cleanGroupName(undefined), '');
  assert.equal(cleanGroupName(42), '');
  assert.equal(cleanGroupName('   '), '');
});

test('groupOf: a model without (or with a bad) group is ungrouped', () => {
  assert.equal(groupOf(m('a')), UNGROUPED);
  assert.equal(groupOf({ group: null }), UNGROUPED);
  assert.equal(groupOf({ group: ' 人物 ' }), '人物');
  assert.equal(groupOf(undefined), UNGROUPED);
});

test('groupNames: standard groups in their own order, then the user\'s own alphabetically', () => {
  const models = [m('a', '人物'), m('b', '動物・生き物'), m('c', 'ぞう'), m('d', 'あひる'), m('e')];
  assert.deepEqual(groupNames(models), ['動物・生き物', '人物', 'あひる', 'ぞう']);
  assert.deepEqual(groupNames([], { includeDefaults: true }), DEFAULT_GROUPS);
});

test('tabList: すべて first with the total, groups with counts, 未分類 only when something is ungrouped', () => {
  const models = [m('a', '人物'), m('b', '人物'), m('c', '植物'), m('d')];
  assert.deepEqual(tabList(models), [
    { key: ALL, label: 'すべて', count: 4 },
    { key: '植物', label: '植物', count: 1 },
    { key: '人物', label: '人物', count: 2 },
    { key: UNGROUPED, label: '未分類', count: 1 },
  ]);
  assert.deepEqual(tabList([m('x', '人物')]).map(t => t.key), [ALL, '人物']);
  assert.deepEqual(tabList([]).map(t => t.key), [ALL]);
});

test('filterByGroup: all, one group, or the ungrouped ones', () => {
  const models = [m('a', '人物'), m('b', '植物'), m('c')];
  assert.equal(filterByGroup(models, ALL).length, 3);
  assert.deepEqual(filterByGroup(models, '人物').map(x => x.name), ['a']);
  assert.deepEqual(filterByGroup(models, UNGROUPED).map(x => x.name), ['c']);
  assert.equal(inGroup(m('z', '植物'), '人物'), false);
});

test('wantsTabs: for many models, or as soon as there are real groups to switch between', () => {
  assert.equal(wantsTabs([m('a'), m('b')]), false);
  assert.equal(wantsTabs([m('a', '人物'), m('b')]), true);          // すべて + 人物 + 未分類
  assert.equal(wantsTabs([m('a', '人物'), m('b', '人物')]), false); // すべて + 人物 only
  assert.equal(wantsTabs(Array.from({ length: 9 }, (_, i) => m('n' + i))), true);
});

test('validActive: a remembered tab that disappeared falls back to すべて', () => {
  const models = [m('a', '人物'), m('b')];
  assert.equal(validActive(models, '人物'), '人物');
  assert.equal(validActive(models, UNGROUPED), UNGROUPED);
  assert.equal(validActive(models, '植物'), ALL);
  assert.equal(validActive(models, ALL), ALL);
});
