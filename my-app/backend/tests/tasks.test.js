import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret';

const { default: taskRoutes } = await import('../routes/taskRoutes.js');
const { notFound, errorHandler } = await import('../middleware/errorHandler.js');
const { default: Task } = await import('../models/Task.js');

let mongod;
let server;
let baseUrl;

const userA = new mongoose.Types.ObjectId().toString();
const userB = new mongoose.Types.ObjectId().toString();
const tokenFor = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET);

async function call(method, path, { user, body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
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

const validTask = { title: 'Write essay', durationMinutes: 60 };

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

describe('task ownership', () => {
    test('rejects unauthenticated requests', async () => {
        for (const [method, path] of [
            ['GET', '/tasks'],
            ['POST', '/tasks'],
            ['GET', `/tasks/${new mongoose.Types.ObjectId()}`],
            ['PATCH', `/tasks/${new mongoose.Types.ObjectId()}`],
            ['DELETE', `/tasks/${new mongoose.Types.ObjectId()}`],
        ]) {
            const res = await call(method, path, { body: validTask });
            assert.equal(res.status, 401, `${method} ${path}`);
        }
    });

    test("user B cannot list, read, update or delete user A's task", async () => {
        const created = await call('POST', '/tasks', { user: userA, body: validTask });
        assert.equal(created.status, 201);
        const id = created.json.task._id;

        const list = await call('GET', '/tasks', { user: userB });
        assert.equal(list.status, 200);
        assert.deepEqual(list.json.tasks, []);

        assert.equal((await call('GET', `/tasks/${id}`, { user: userB })).status, 404);
        assert.equal((await call('PATCH', `/tasks/${id}`, { user: userB, body: { title: 'hijack' } })).status, 404);
        assert.equal((await call('DELETE', `/tasks/${id}`, { user: userB })).status, 404);

        // Task is untouched and still belongs to A
        const own = await call('GET', `/tasks/${id}`, { user: userA });
        assert.equal(own.status, 200);
        assert.equal(own.json.task.title, validTask.title);
    });

    test('owner in the request body is ignored', async () => {
        const res = await call('POST', '/tasks', { user: userA, body: { ...validTask, owner: userB } });
        assert.equal(res.status, 201);
        assert.equal(res.json.task.owner, userA);
    });
});

describe('task validation', () => {
    test('rejects a malformed task id with 404', async () => {
        assert.equal((await call('GET', '/tasks/not-an-id', { user: userA })).status, 404);
    });

    test('dueDate accepts ISO date strings and null means no deadline', async () => {
        const dated = await call('POST', '/tasks', { user: userA, body: { ...validTask, dueDate: '2026-11-20' } });
        assert.equal(dated.status, 201);
        assert.equal(new Date(dated.json.task.dueDate).toISOString(), '2026-11-20T00:00:00.000Z');

        const withTime = await call('POST', '/tasks', {
            user: userA,
            body: { ...validTask, dueDate: '2026-11-20T17:00:00Z' },
        });
        assert.equal(withTime.status, 201);

        const none = await call('POST', '/tasks', { user: userA, body: { ...validTask, dueDate: null } });
        assert.equal(none.status, 201);
        assert.equal(none.json.task.dueDate, undefined);
    });

    test('dueDate rejects numbers, garbage, and impossible dates', async () => {
        for (const dueDate of [0, 1700000000000, 'tomorrow', '2026-02-30', true, {}]) {
            const res = await call('POST', '/tasks', { user: userA, body: { ...validTask, dueDate } });
            assert.equal(res.status, 400, JSON.stringify(dueDate));
        }
    });

    test('PATCH dueDate null clears the deadline instead of storing an epoch date', async () => {
        const created = await call('POST', '/tasks', { user: userA, body: { ...validTask, dueDate: '2026-11-20' } });
        const id = created.json.task._id;
        const res = await call('PATCH', `/tasks/${id}`, { user: userA, body: { dueDate: null } });
        assert.equal(res.status, 200);
        assert.equal(res.json.task.dueDate, undefined);
        const stored = await Task.findById(id).lean();
        assert.equal(stored.dueDate, undefined);
    });

    test('rejects empty updates, including bodies with only unknown fields', async () => {
        const created = await call('POST', '/tasks', { user: userA, body: validTask });
        const id = created.json.task._id;
        assert.equal((await call('PATCH', `/tasks/${id}`, { user: userA, body: {} })).status, 400);
        assert.equal((await call('PATCH', `/tasks/${id}`, { user: userA, body: { nope: 1 } })).status, 400);
    });

    test('unexpected fields are stripped, not stored and not rejected', async () => {
        const res = await call('POST', '/tasks', {
            user: userA,
            body: { ...validTask, status: 'scheduled', isAdmin: true },
        });
        assert.equal(res.status, 201);
        assert.equal(res.json.task.status, 'unscheduled');
        assert.equal(res.json.task.isAdmin, undefined);
    });

    test('enforces text length limits on create and update', async () => {
        const tooLongTitle = 'x'.repeat(201);
        const tooLongText = 'x'.repeat(2001);
        assert.equal((await call('POST', '/tasks', { user: userA, body: { ...validTask, title: tooLongTitle } })).status, 400);
        assert.equal((await call('POST', '/tasks', { user: userA, body: { ...validTask, notes: tooLongText } })).status, 400);
        assert.equal((await call('POST', '/tasks', { user: userA, body: { ...validTask, todoText: tooLongText } })).status, 400);

        const ok = await call('POST', '/tasks', { user: userA, body: { ...validTask, title: 'x'.repeat(200) } });
        assert.equal(ok.status, 201);
        const id = ok.json.task._id;
        assert.equal((await call('PATCH', `/tasks/${id}`, { user: userA, body: { notes: tooLongText } })).status, 400);
    });

    test('rejects missing title and non-positive durations', async () => {
        assert.equal((await call('POST', '/tasks', { user: userA, body: { durationMinutes: 30 } })).status, 400);
        assert.equal((await call('POST', '/tasks', { user: userA, body: { title: 'a', durationMinutes: 0 } })).status, 400);
        assert.equal((await call('POST', '/tasks', { user: userA, body: { title: '   ', durationMinutes: 30 } })).status, 400);
    });
});
