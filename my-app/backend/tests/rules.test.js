import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret';

const { default: ruleRoutes } = await import('../routes/rule.routes.js');
const { notFound, errorHandler } = await import('../middleware/errorHandler.js');
const { default: Rule } = await import('../models/rule.model.js');

let mongod;
let server;
let baseUrl;

const userA = new mongoose.Types.ObjectId().toString();
const userB = new mongoose.Types.ObjectId().toString();
const tokenFor = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET);

async function call(method, path, { user, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
  const hasBody = body !== undefined && method !== 'GET' && method !== 'DELETE';
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text };
}

const validRule = { notBefore: '09:00', notAfter: '17:00', label: 'Work hours' };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const app = express();
  app.use(express.json());
  app.use('/rules', ruleRoutes);
  // Lets a test push a raw Mongoose ValidationError (Zod bypassed) through the error handler
  app.post('/model-bypass', async (_req, res) => {
    await Rule.create({ owner: userA, notBefore: '18:00', notAfter: '09:00' });
    res.status(201).end();
  });
  app.use(notFound);
  app.use(errorHandler);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Rule.deleteMany({});
});

describe('rule ownership', () => {
  test('rejects unauthenticated requests on every route', async () => {
    const id = new mongoose.Types.ObjectId();
    for (const [method, path] of [
      ['GET', '/rules'],
      ['POST', '/rules'],
      ['PUT', `/rules/${id}`],
      ['DELETE', `/rules/${id}`],
    ]) {
      const res = await call(method, path, { body: validRule });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
    const bad = await fetch(`${baseUrl}/rules`, { headers: { Authorization: 'Bearer nope' } });
    assert.equal(bad.status, 401);
  });

  test("user B cannot list, update or delete user A's rule", async () => {
    const created = await call('POST', '/rules', { user: userA, body: validRule });
    assert.equal(created.status, 201);
    const id = created.json._id;

    const listA = await call('GET', '/rules', { user: userA });
    assert.equal(listA.json.length, 1);

    const listB = await call('GET', '/rules', { user: userB });
    assert.equal(listB.status, 200);
    assert.deepEqual(listB.json, []);

    const put = await call('PUT', `/rules/${id}`, {
      user: userB,
      body: { notBefore: '01:00', notAfter: '02:00' },
    });
    assert.equal(put.status, 404);

    const del = await call('DELETE', `/rules/${id}`, { user: userB });
    assert.equal(del.status, 404);

    // A's rule is untouched
    const stored = await Rule.findById(id).lean();
    assert.equal(stored.notBefore, '09:00');
    assert.equal(String(stored.owner), userA);
  });

  test('owner comes from the token, not the request body', async () => {
    const res = await call('POST', '/rules', { user: userA, body: { ...validRule, owner: userB } });
    assert.equal(res.status, 201);
    assert.equal(res.json.owner, userA);
    assert.equal((await call('GET', '/rules', { user: userB })).json.length, 0);
  });

  test('owner can update and delete their own rule', async () => {
    const created = await call('POST', '/rules', { user: userA, body: validRule });
    const id = created.json._id;
    const put = await call('PUT', `/rules/${id}`, {
      user: userA,
      body: { notBefore: '10:00', notAfter: '12:00', label: 'Morning' },
    });
    assert.equal(put.status, 200);
    assert.equal(put.json.notBefore, '10:00');
    assert.equal((await call('DELETE', `/rules/${id}`, { user: userA })).status, 204);
  });
});

describe('rule validation', () => {
  test('Zod rejects bad rules with { error, details: [{ field, message }] }', async () => {
    const res = await call('POST', '/rules', { user: userA, body: { notBefore: '17:00', notAfter: '09:00' } });
    assert.equal(res.status, 400);
    assert.equal(typeof res.json.error, 'string');
    assert.deepEqual(res.json.details, [{ field: 'notAfter', message: 'notBefore must be earlier than notAfter' }]);
  });

  test('unexpected fields are ignored, not rejected', async () => {
    const res = await call('POST', '/rules', { user: userA, body: { ...validRule, color: 'red' } });
    assert.equal(res.status, 201);
    assert.equal(res.json.color, undefined);
  });

  test('model rejects notBefore >= notAfter even if the controller is bypassed', async () => {
    await assert.rejects(Rule.create({ owner: userA, notBefore: '17:00', notAfter: '09:00' }), {
      name: 'ValidationError',
    });
    await assert.rejects(Rule.create({ owner: userA, notBefore: '09:00', notAfter: '09:00' }), {
      name: 'ValidationError',
    });
    await assert.rejects(Rule.create({ owner: userA, notBefore: '9am', notAfter: '17:00' }), {
      name: 'ValidationError',
    });
    await assert.rejects(Rule.create({ notBefore: '09:00', notAfter: '17:00' }), { name: 'ValidationError' });
  });

  test('update validators run on findOneAndUpdate', async () => {
    const rule = await Rule.create({ owner: userA, ...validRule });
    await assert.rejects(
      Rule.findOneAndUpdate({ _id: rule._id }, { notBefore: '20:00', notAfter: '08:00' }, { runValidators: true }),
      { name: 'ValidationError' },
    );
    const stored = await Rule.findById(rule._id).lean();
    assert.equal(stored.notBefore, '09:00');
  });

  test('Mongoose ValidationErrors are mapped to the same JSON shape as Zod', async () => {
    const res = await call('POST', '/model-bypass');
    assert.equal(res.status, 400);
    assert.equal(typeof res.json.error, 'string');
    assert.ok(Array.isArray(res.json.details));
    assert.deepEqual(res.json.details, [{ field: 'notAfter', message: 'notBefore must be earlier than notAfter' }]);
  });
});
