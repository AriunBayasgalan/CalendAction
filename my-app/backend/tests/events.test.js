import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret';

const { default: eventRoutes } = await import('../routes/eventRoutes.js');
const { default: taskRoutes } = await import('../routes/taskRoutes.js');
const { notFound, errorHandler } = await import('../middleware/errorHandler.js');
const { default: Event } = await import('../models/Event.js');
const { default: Task } = await import('../models/Task.js');

let mongod;
let server;
let baseUrl;

const userA = new mongoose.Types.ObjectId().toString();
const userB = new mongoose.Types.ObjectId().toString();
const tokenFor = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET);

async function call(method, path, { user, body } = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Timezone': 'America/New_York' };
  if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined || method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body),
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

const at = (iso) => new Date(iso);
// Tuesday 2 March 2027, wall times in America/New_York (UTC-5)
const slot = {
  nine: '2027-03-02T14:00:00.000Z', // 9:00 AM
  ten: '2027-03-02T15:00:00.000Z',
  tenFifteen: '2027-03-02T15:15:00.000Z',
  eleven: '2027-03-02T16:00:00.000Z',
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const app = express();
  app.use(express.json());
  app.use('/events', eventRoutes);
  app.use('/tasks', taskRoutes);
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
  await Promise.all([Event.deleteMany({}), Task.deleteMany({})]);
});

describe('event overlaps', () => {
  test('create is rejected with 409 when it overlaps another of the user\'s events', async () => {
    const first = await call('POST', '/events', {
      user: userA,
      body: { title: 'CS 2340', start: slot.nine, end: slot.tenFifteen },
    });
    assert.equal(first.status, 201, first.text);

    const clash = await call('POST', '/events', {
      user: userA,
      body: { title: 'Office hours', start: slot.ten, end: slot.eleven },
    });
    assert.equal(clash.status, 409, clash.text);
    assert.equal(Object.keys(clash.json).join(), 'error');
    assert.equal(typeof clash.json.error, 'string');
    assert.match(clash.json.error, /^Overlaps CS 2340 \(/);
    assert.equal((await Event.countDocuments({ owner: userA })), 1);
  });

  test('update is rejected with 409 when the new time overlaps another event', async () => {
    const a = await call('POST', '/events', {
      user: userA,
      body: { title: 'CS 2340', start: slot.nine, end: slot.ten },
    });
    const b = await call('POST', '/events', {
      user: userA,
      body: { title: 'Lab', start: slot.ten, end: slot.eleven },
    });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const clash = await call('PATCH', `/events/${b.json._id}`, {
      user: userA,
      body: { start: slot.nine, end: slot.tenFifteen },
    });
    assert.equal(clash.status, 409, clash.text);
    assert.match(clash.json.error, /^Overlaps CS 2340 \(/);
    const stored = await Event.findById(b.json._id).lean();
    assert.equal(stored.start.toISOString(), slot.ten);
    assert.equal(stored.end.toISOString(), slot.eleven);
  });

  test('adjacent times are allowed (end === start)', async () => {
    const first = await call('POST', '/events', {
      user: userA,
      body: { title: 'CS 2340', start: slot.nine, end: slot.ten },
    });
    assert.equal(first.status, 201, first.text);
    const second = await call('POST', '/events', {
      user: userA,
      body: { title: 'Lab', start: slot.ten, end: slot.eleven },
    });
    assert.equal(second.status, 201, second.text);
    assert.equal((await Event.countDocuments({ owner: userA })), 2);
  });

  test("another user's event is not treated as an overlap", async () => {
    const theirs = await call('POST', '/events', {
      user: userB,
      body: { title: 'Theirs', start: slot.nine, end: slot.ten },
    });
    assert.equal(theirs.status, 201);
    const mine = await call('POST', '/events', {
      user: userA,
      body: { title: 'Mine', start: slot.nine, end: slot.ten },
    });
    assert.equal(mine.status, 201, mine.text);
  });

  test('a title-only update does not run the overlap check', async () => {
    const created = await call('POST', '/events', {
      user: userA,
      body: { title: 'CS 2340', start: slot.nine, end: slot.ten },
    });
    const renamed = await call('PATCH', `/events/${created.json._id}`, {
      user: userA,
      body: { title: 'CS 2340 lecture' },
    });
    assert.equal(renamed.status, 200, renamed.text);
    assert.equal(renamed.json.title, 'CS 2340 lecture');
    assert.equal(renamed.json.start, slot.nine);
  });
});

describe('scheduled tasks displaced by an event', () => {
  test('an overlapping event is saved and the task is re-placed', async () => {
    const task = await Task.create({
      owner: userA,
      title: 'Essay',
      durationMinutes: 60,
      status: 'scheduled',
      start: at(slot.ten),
      end: at(slot.eleven),
    });

    const event = await call('POST', '/events', {
      user: userA,
      body: { title: 'CS 2340', start: slot.ten, end: slot.eleven },
    });
    assert.equal(event.status, 201, event.text);
    assert.equal(event.json.title, 'CS 2340');
    assert.equal(event.json.moved?.length, 1);
    assert.equal(event.json.moved[0].title, 'Essay');
    assert.ok(event.json.moved[0].start);
    assert.notEqual(event.json.moved[0].start, slot.ten);
    assert.deepEqual(event.json.unscheduled, []);

    const saved = await Task.findById(task._id);
    assert.equal(saved.status, 'scheduled');
    assert.equal(saved.start.toISOString(), event.json.moved[0].start);
    assert.ok(saved.end <= at(slot.ten) || saved.start >= at(slot.eleven));
  });

  test('the task is unscheduled when no later hole fits', async () => {
    const task = await Task.create({
      owner: userA,
      title: 'Essay',
      durationMinutes: 60,
      status: 'scheduled',
      start: at(slot.nine),
      end: at(slot.ten),
      dueDate: at('2020-01-01T00:00:00.000Z'),
    });

    const event = await call('POST', '/events', {
      user: userA,
      body: { title: 'CS 2340', start: slot.nine, end: slot.ten },
    });
    assert.equal(event.status, 201, event.text);
    assert.deepEqual(event.json.moved, []);
    assert.deepEqual(event.json.unscheduled, [{ title: 'Essay' }]);

    const saved = await Task.findById(task._id);
    assert.equal(saved.status, 'unscheduled');
    assert.equal(saved.start, undefined);
    assert.equal(saved.end, undefined);
  });

  test('updating an event onto a task re-places it', async () => {
    const created = await call('POST', '/events', {
      user: userA,
      body: { title: 'CS 2340', start: slot.nine, end: slot.ten },
    });
    assert.equal(created.status, 201);
    const task = await Task.create({
      owner: userA,
      title: 'Essay',
      durationMinutes: 60,
      status: 'scheduled',
      start: at(slot.ten),
      end: at(slot.eleven),
    });

    const updated = await call('PATCH', `/events/${created.json._id}`, {
      user: userA,
      body: { start: slot.ten, end: slot.eleven },
    });
    assert.equal(updated.status, 200, updated.text);
    assert.equal(updated.json.moved?.length, 1);
    assert.equal(updated.json.moved[0].title, 'Essay');
    const saved = await Task.findById(task._id);
    assert.equal(saved.status, 'scheduled');
    assert.notEqual(saved.start.toISOString(), slot.ten);
  });
});
