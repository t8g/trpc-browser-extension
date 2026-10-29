import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExchange, looksLikeTrpc } from '../src/trpc.js';
import { deserialize, parsePath } from '../src/superjson.js';
import { fixtures } from '../src/fixtures.js';

const [batchedGet, plainMutation, batchedError] = fixtures;

test('splits a batched GET into one call per procedure', () => {
  const { isBatch, calls } = parseExchange(batchedGet);
  assert.equal(isBatch, true);
  assert.deepEqual(
    calls.map((c) => [c.path, c.type]),
    [
      ['post.byId', 'query'],
      ['user.me', 'query'],
    ],
  );
  assert.deepEqual(calls[0].input, { id: 42 });
  assert.equal(calls[1].input, undefined);
});

test('decodes superjson output (Date, Set, BigInt, Map)', () => {
  const [post, user] = parseExchange(batchedGet).calls;
  assert.equal(post.superjson, true);
  assert.ok(post.output.createdAt instanceof Date);
  assert.deepEqual(post.output.tags, new Set(['news', 'trpc']));
  assert.equal(post.output.views, 9007199254740993n);
  assert.deepEqual(user.output.roles, new Map([['admin', true]]));
});

test('parses a plain JSON mutation', () => {
  const { isBatch, calls } = parseExchange(plainMutation);
  assert.equal(isBatch, false);
  assert.equal(calls[0].type, 'mutation');
  assert.deepEqual(calls[0].input, { title: 'New post', body: 'Lorem ipsum' });
  assert.deepEqual(calls[0].output, { id: 43, title: 'New post' });
  assert.equal(calls[0].superjson, false);
});

test('extracts tRPC errors', () => {
  const [call] = parseExchange(batchedError).calls;
  assert.deepEqual(call.input, { id: 1 });
  assert.equal(call.error.message, 'You are not allowed to delete this post');
  assert.equal(call.error.code, 'FORBIDDEN');
  assert.equal(call.error.httpStatus, 403);
});

test('ignores non-tRPC traffic', () => {
  assert.equal(looksLikeTrpc({ url: 'https://example.com/api/users', responseBody: '[{"id":1}]' }), false);
  assert.equal(parseExchange({ url: 'https://example.com/', method: 'GET', responseBody: '<html>' }), null);
});

test('superjson: nested annotations and escaped paths', () => {
  assert.deepEqual(parsePath('a.b\\.c.0'), ['a', 'b.c', '0']);
  const value = deserialize({
    json: { 'x.y': '2020-01-01T00:00:00.000Z', m: [[1, ['1999-01-01T00:00:00.000Z']]] },
    meta: { values: { 'x\\.y': ['Date'], m: ['map', { '0.1.0': ['Date'] }] } },
  });
  assert.ok(value['x.y'] instanceof Date);
  assert.ok(value.m.get(1)[0] instanceof Date);
});

test('superjson: root-level annotation', () => {
  assert.equal(deserialize({ json: '10', meta: { values: ['bigint'] } }), 10n);
  assert.ok(Number.isNaN(deserialize({ json: 'NaN', meta: { values: ['number'] } })));
});
