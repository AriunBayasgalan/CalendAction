import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret';

const { default: authRoutes } = await import('../routes/authRoutes.js');
const { default: eventRoutes } = await import('../routes/eventRoutes.js');
const { default: taskRoutes } = await import('../routes/taskRoutes.js');
const { default: ruleRoutes } = await import('../routes/rule.routes.js');
const { notFound, errorHandler } = await import('../middleware/errorHandler.js');
const { default: Task } = await import('../models/Task.js');
const { default: Rule } = await import('../models/rule.model.js');
const { default: Event } = await import('../models/Event.js');
const { default: User } = await import('../models/User.js');

let mongod;
let server;
let baseUrl;

const user = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ sub: user }, process.env.JWT_SECRET);

async function call(method, path, { body, raw, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const type = res.headers.get('content-type') ?? '';
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = undefined;
    }
    return { status: res.status, type, json, text };
}

// { error: string, details?: [{ field: string, message: string }] }
function assertErrorShape(res, status) {
    assert.equal(res.status, status, res.text);
    assert.match(res.type, /application\/json/, `expected JSON, got ${res.type}: ${res.text}`);
    assert.equal(typeof res.json.error, 'string');
    assert.ok(res.json.error.length > 0);
    for (const key of Object.keys(res.json)) assert.ok(['error', 'details'].includes(key), `unexpected key ${key}`);
    if (res.json.details !== undefined) {
        assert.ok(Array.isArray(res.json.details), 'details must be an array');
        for (const d of res.json.details) {
            assert.deepEqual(Object.keys(d).sort(), ['field', 'message']);
            assert.equal(typeof d.field, 'string');
            assert.equal(typeof d.message, 'string');
        }
    }
}

const fields = (res) => res.json.details.map((d) => d.field);

// Replaces obj[key] for one test and silences the expected console.error
async function withStub(obj, key, impl, fn) {
    const original = obj[key];
    const originalError = console.error;
    obj[key] = impl;
    console.error = () => {};
    try {
        await fn();
    } finally {
        obj[key] = original;
        console.error = originalError;
    }
}

before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await User.init();
    const app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    app.use('/rules', ruleRoutes);
    app.use('/tasks', taskRoutes);
    app.use('/events', eventRoutes);
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
    await Promise.all([Task.deleteMany({}), Rule.deleteMany({}), Event.deleteMany({}), User.deleteMany({})]);
});

describe('validation errors share one shape', () => {
    test('events: bad create and end-before-start update', async () => {
        const bad = await call('POST', '/events', { body: { title: '', start: 'nope' } });
        assertErrorShape(bad, 400);
        assert.ok(fields(bad).includes('title'));
        assert.ok(fields(bad).includes('start'));

        const created = await call('POST', '/events', {
            body: { title: 'Class', start: '2026-11-17T09:00:00Z', end: '2026-11-17T10:00:00Z' },
        });
        assert.equal(created.status, 201);
        const flipped = await call('PATCH', `/events/${created.json._id}`, { body: { end: '2026-11-17T08:00:00Z' } });
        assertErrorShape(flipped, 400);
        assert.deepEqual(flipped.json.details, [{ field: 'end', message: 'End must not be before start' }]);

        const empty = await call('PATCH', `/events/${created.json._id}`, { body: {} });
        assertErrorShape(empty, 400);
        assert.equal(empty.json.error, 'No fields to update');
    });

    test('tasks: field errors list the field', async () => {
        const res = await call('POST', '/tasks', { body: { title: '', durationMinutes: 0 } });
        assertErrorShape(res, 400);
        assert.equal(res.json.error, 'Invalid input');
        assert.deepEqual(fields(res).sort(), ['durationMinutes', 'title']);
    });

    test('rules: field errors list the field', async () => {
        const res = await call('POST', '/rules', { body: { notBefore: '9am', notAfter: '17:00' } });
        assertErrorShape(res, 400);
        assert.ok(fields(res).includes('notBefore'));
    });

    test('auth: register and login validation', async () => {
        const register = await call('POST', '/auth/register', { auth: false, body: { email: 'nope', password: '' } });
        assertErrorShape(register, 400);
        assert.deepEqual(fields(register).sort(), ['email', 'password']);

        const login = await call('POST', '/auth/login', { auth: false, body: { email: 'nope' } });
        assertErrorShape(login, 400);
        assert.ok(fields(login).includes('email'));

        const wrong = await call('POST', '/auth/login', { auth: false, body: { email: 'a@b.co', password: 'x' } });
        assertErrorShape(wrong, 401);
    });

    test('auth: duplicate registration', async () => {
        const body = { email: 'dup@example.com', password: 'secret123' };
        assert.equal((await call('POST', '/auth/register', { auth: false, body })).status, 201);
        assertErrorShape(await call('POST', '/auth/register', { auth: false, body }), 409);
    });
});

describe('non-validation errors are JSON too', () => {
    test('unknown route is a JSON 404', async () => {
        const res = await call('GET', '/nope');
        assertErrorShape(res, 404);
        assert.equal(res.json.error, 'Route not found: GET /nope');
    });

    test('malformed JSON body is a JSON 400', async () => {
        const res = await call('POST', '/tasks', { raw: '{"title":' });
        assertErrorShape(res, 400);
        assert.equal(res.json.error, 'Invalid JSON body');
    });

    test('missing or bad token is a JSON 401', async () => {
        assertErrorShape(await call('GET', '/tasks', { auth: false }), 401);
        assertErrorShape(await call('GET', '/rules', { auth: false }), 401);
        assertErrorShape(await call('GET', '/events', { auth: false }), 401);
    });

    test('a failing task update is a JSON 500 without internal details', async () => {
        const created = await call('POST', '/tasks', { body: { title: 'Essay', durationMinutes: 30 } });
        assert.equal(created.status, 201);
        await withStub(Task.prototype, 'save', async () => {
            throw new Error('disk on fire');
        }, async () => {
            const res = await call('PATCH', `/tasks/${created.json.task._id}`, { body: { title: 'New' } });
            assertErrorShape(res, 500);
            assert.deepEqual(res.json, { error: 'Server error' });
        });
    });

    test('a failing task list is a JSON 500', async () => {
        await withStub(Task, 'find', () => {
            throw new Error('db down');
        }, async () => {
            assert.deepEqual((await call('GET', '/tasks')).json, { error: 'Server error' });
        });
    });

    test('a failing rule update is a JSON 500 without internal details', async () => {
        const created = await call('POST', '/rules', { body: { notBefore: '09:00', notAfter: '17:00' } });
        assert.equal(created.status, 201);
        await withStub(Rule, 'findOneAndUpdate', async () => {
            throw new Error('db down');
        }, async () => {
            const res = await call('PUT', `/rules/${created.json._id}`, { body: { notBefore: '10:00', notAfter: '12:00' } });
            assertErrorShape(res, 500);
            assert.deepEqual(res.json, { error: 'Server error' });
        });
    });

    test('the real error is logged with console.error', async () => {
        const logged = [];
        const originalError = console.error;
        const originalFind = Rule.find;
        console.error = (...args) => logged.push(args);
        Rule.find = () => {
            throw new Error('secret internals');
        };
        try {
            const res = await call('GET', '/rules');
            assertErrorShape(res, 500);
            assert.ok(!res.text.includes('secret internals'));
        } finally {
            console.error = originalError;
            Rule.find = originalFind;
        }
        assert.ok(logged.some((args) => args.some((a) => a instanceof Error && a.message === 'secret internals')));
    });
});

describe('malformed ids are 400 Invalid id', () => {
    const routes = [
        ['GET', '/events/not-an-id'],
        ['PATCH', '/events/not-an-id'],
        ['DELETE', '/events/not-an-id'],
        ['GET', '/tasks/not-an-id'],
        ['PATCH', '/tasks/not-an-id'],
        ['DELETE', '/tasks/not-an-id'],
        ['POST', '/tasks/not-an-id/place'],
        ['POST', '/tasks/not-an-id/skip'],
        ['PUT', '/rules/not-an-id'],
        ['DELETE', '/rules/not-an-id'],
    ];

    test('every :id route rejects a malformed id the same way', async () => {
        for (const [method, path] of routes) {
            const res = await call(method, path);
            assertErrorShape(res, 400);
            assert.deepEqual(res.json, { error: 'Invalid id' });
        }
    });

    test('a well-formed id that is not found stays 404', async () => {
        const id = new mongoose.Types.ObjectId();
        const cases = [
            ['GET', `/events/${id}`],
            ['PATCH', `/events/${id}`, { title: 'x' }],
            ['DELETE', `/events/${id}`],
            ['GET', `/tasks/${id}`],
            ['PATCH', `/tasks/${id}`, { title: 'x' }],
            ['DELETE', `/tasks/${id}`],
            ['POST', `/tasks/${id}/place`],
            ['POST', `/tasks/${id}/skip`],
            ['PUT', `/rules/${id}`, { notBefore: '09:00', notAfter: '17:00' }],
            ['DELETE', `/rules/${id}`],
        ];
        const expected = (path) => {
            if (path.startsWith('/events/')) return 'Event not found';
            if (path.startsWith('/tasks/')) return 'Task not found';
            if (path.startsWith('/rules/')) return 'Rule not found';
            return null;
        };
        for (const [method, path, body] of cases) {
            const res = await call(method, path, { body });
            assertErrorShape(res, 404);
            assert.equal(res.json.error, expected(path));
        }
    });
});
