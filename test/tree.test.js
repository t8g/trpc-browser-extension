import { test } from 'node:test';
import assert from 'node:assert/strict';
import { treeMatches } from '../src/tree.js';

const value = {
  user: { name: 'Thomas', roles: new Map([['admin', true]]) },
  createdAt: new Date('2026-10-29T12:00:00.000Z'),
  views: 12n,
};

test('search matches keys and values, case-insensitively', () => {
  assert.equal(treeMatches(value, 'thom'), true);
  assert.equal(treeMatches(value, 'ROLES'), true);
  assert.equal(treeMatches(value, 'admin'), true);
  assert.equal(treeMatches(value, '2026-10-29'), true);
  assert.equal(treeMatches(value, '12n'), true);
  assert.equal(treeMatches(value, 'nothing here'), false);
});

test('an empty query matches nothing', () => {
  assert.equal(treeMatches(value, '   '), false);
});
