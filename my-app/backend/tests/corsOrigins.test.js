import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, corsOriginCallback } from '../services/corsOrigins.js';

test('allowedOrigins reads a single origin or a comma-separated list', () => {
  assert.deepEqual(allowedOrigins(undefined), ['http://localhost:5173']);
  assert.deepEqual(allowedOrigins(''), ['http://localhost:5173']);
  assert.deepEqual(allowedOrigins('https://calend-action.vercel.app'), [
    'https://calend-action.vercel.app',
  ]);
  assert.deepEqual(
    allowedOrigins('https://calend-action.vercel.app, http://localhost:5173'),
    ['https://calend-action.vercel.app', 'http://localhost:5173'],
  );
});

test('corsOriginCallback allows listed origins and requests with no Origin', async () => {
  const decide = corsOriginCallback(['https://calend-action.vercel.app']);
  const allow = (origin) =>
    new Promise((resolve, reject) => {
      decide(origin, (err, ok) => (err ? reject(err) : resolve(ok)));
    });
  assert.equal(await allow(undefined), true);
  assert.equal(await allow('https://calend-action.vercel.app'), true);
  assert.equal(await allow('https://evil.example'), false);
});
