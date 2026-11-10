import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Task from '../models/Task.js';
import { placeTask } from '../controllers/taskController.js';

let mongod;
const owner = new mongoose.Types.ObjectId();

const call = async (id) => {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await placeTask({ params: { id: String(id) }, user: { id: String(owner) } }, res);
  return res;
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Task.init();
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(() => Task.deleteMany({}));

const mk = (extra = {}) => Task.create({ owner, title: 't', durationMinutes: 30, ...extra });

test('invalid id returns 400', async () => {
  const res = await call('not-an-id');
  assert.equal(res.statusCode, 400);
});

test('unknown task returns 404', async () => {
  const res = await call(new mongoose.Types.ObjectId());
  assert.equal(res.statusCode, 404);
});

test('placement stores start/end from findNextHole and marks scheduled', async () => {
  const t = await mk();
  const res = await call(t._id);
  assert.equal(res.statusCode, 200);
  const saved = await Task.findById(t._id);
  assert.equal(saved.status, 'scheduled');
  assert.equal(saved.end - saved.start, 30 * 60000);
});

test('simultaneous placement of the same task: one wins, the other gets 409', async () => {
  const t = await mk();
  const results = await Promise.all([call(t._id), call(t._id), call(t._id)]);
  const codes = results.map((r) => r.statusCode).sort();
  assert.equal(codes.filter((c) => c === 200).length, 1);
  assert.ok(codes.filter((c) => c === 409 || c === 400).length === 2);
  assert.equal(await Task.countDocuments({ status: 'scheduled' }), 1);
});

test('scheduled task requires start and end with end after start', async () => {
  await assert.rejects(Task.create({ owner, title: 'x', durationMinutes: 10, status: 'scheduled' }));
  const s = new Date();
  await assert.rejects(
    Task.create({ owner, title: 'x', durationMinutes: 10, status: 'scheduled', start: s, end: s }),
  );
});

test('unscheduled task has start/end cleared', async () => {
  const t = await mk({ start: new Date(), end: new Date(Date.now() + 60000) });
  assert.equal(t.start, undefined);
  assert.equal(t.end, undefined);
});

test('findOneAndUpdate cannot schedule without valid times', async () => {
  const t = await mk();
  await assert.rejects(Task.findOneAndUpdate({ _id: t._id }, { $set: { status: 'scheduled' } }));
  const s = new Date();
  await assert.rejects(
    Task.findOneAndUpdate({ _id: t._id }, { $set: { status: 'scheduled', start: s, end: s } }),
  );
});

test('index on { owner, start } exists', async () => {
  const idx = await Task.collection.indexes();
  assert.ok(idx.some((i) => i.key.owner === 1 && i.key.start === 1));
});
