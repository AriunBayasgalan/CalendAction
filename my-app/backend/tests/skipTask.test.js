import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret';

const { default: taskRoutes } = await import('../routes/taskRoutes.js');
const { notFound, errorHandler } = await import('../middleware/errorHandler.js');
const { default: Task } = await import('../models/Task.js');
const { zonedDateTime } = await import('../services/timeZone.js');

const ET = 'America/New_York';
const at = (year, month, day, hour, minute) =>
    zonedDateTime(year, month, day, hour, minute, 0, 0, ET);

let mongod;
let server;
let baseUrl;

const userA = new mongoose.Types.ObjectId().toString();
const userB = new mongoose.Types.ObjectId().toString();
const tokenFor = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET);

async function call(method, path, { user, headers: extraHeaders } = {}) {
    const headers = { 'Content-Type': 'application/json', 'X-Timezone': ET, ...extraHeaders };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const res = await fetch(`${baseUrl}${path}`, { method, headers });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = undefined;
    }
    return { status: res.status, json, text };
}

const skip = (id, opts = {}) => call('POST', `/tasks/${id}/skip`, { user: userA, ...opts });

before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.use(express.json());
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
    await Task.deleteMany({});
});

const scheduled = (extra = {}) =>
    Task.create({
        owner: userA,
        title: 'Skip me',
        durationMinutes: 30,
        status: 'scheduled',
        start: at(2027, 3, 2, 10, 0),
        end: at(2027, 3, 2, 10, 30),
        ...extra,
    });

test('skipping a scheduled task moves it to a later slot, start >= old end', async () => {
    const task = await scheduled();
    const oldEnd = task.end;
    const res = await skip(task._id);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.status, 'scheduled');
    const start = new Date(res.json.start);
    const end = new Date(res.json.end);
    assert.ok(start >= oldEnd, `start ${start.toISOString()} should be >= old end ${oldEnd.toISOString()}`);
    assert.equal(end - start, 30 * 60000);
    assert.equal(start.toISOString(), at(2027, 3, 2, 10, 30).toISOString());
    assert.equal(end.toISOString(), at(2027, 3, 2, 11, 0).toISOString());
});

test('when no later hole exists, skip unschedules the task and clears start/end', async () => {
    const task = await scheduled({
        start: at(2027, 3, 2, 21, 30),
        end: at(2027, 3, 2, 22, 0),
        dueDate: at(2027, 3, 2, 22, 0),
    });
    const res = await skip(task._id);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.status, 'unscheduled');
    assert.equal(res.json.start, undefined);
    assert.equal(res.json.end, undefined);
    const saved = await Task.findById(task._id);
    assert.equal(saved.status, 'unscheduled');
    assert.equal(saved.start, undefined);
    assert.equal(saved.end, undefined);
});

test('invalid id returns 400', async () => {
    const res = await skip('not-an-id');
    assert.equal(res.status, 400);
    assert.deepEqual(res.json, { error: 'Invalid id' });
});

test('unscheduled task returns 400', async () => {
    const task = await Task.create({
        owner: userA,
        title: 'Not placed',
        durationMinutes: 30,
    });
    const res = await skip(task._id);
    assert.equal(res.status, 400);
});

test("another user's task returns 404", async () => {
    const task = await Task.create({
        owner: userB,
        title: 'Not yours',
        durationMinutes: 30,
        status: 'scheduled',
        start: at(2027, 3, 2, 10, 0),
        end: at(2027, 3, 2, 10, 30),
    });
    const res = await skip(task._id);
    assert.equal(res.status, 404);
});
