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
const { dayContaining } = await import('../services/timeZone.js');
const { BLOCK_CHANGED, NOT_ITS_DAY, isOnDay, markStarted } = await import('../services/startBlock.js');

const ET = 'America/New_York';
const HOUR = 60 * 60 * 1000;

// Start depends on the real date, so blocks are placed relative to today in ET
const today = dayContaining(new Date(), ET);
const todayAt = (hours) => new Date(today.start.getTime() + hours * HOUR);

let mongod;
let server;
let baseUrl;

const userA = new mongoose.Types.ObjectId().toString();
const userB = new mongoose.Types.ObjectId().toString();
const tokenFor = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET);

async function call(method, path, { user = userA, body } = {}) {
    const headers = { 'Content-Type': 'application/json', 'X-Timezone': ET };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = undefined;
    }
    return { status: res.status, json };
}

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
    await Event.deleteMany({});
    await Task.deleteMany({});
});

// A placed task today, 10:00–11:00
const placedTask = (extra = {}) =>
    Task.create({
        owner: userA,
        title: 'Read chapter 3',
        durationMinutes: 60,
        status: 'scheduled',
        start: todayAt(10),
        end: todayAt(11),
        ...extra,
    });

// A class today, 8:00–9:00
const aClass = (extra = {}) =>
    Event.create({
        owner: userA,
        title: 'Biology',
        start: todayAt(8),
        end: todayAt(9),
        ...extra,
    });

const earlierToday = todayAt(7);

describe('Start on a placed task', () => {
    test('sets startedAt to now', async () => {
        const task = await placedTask();
        const pressedAt = Date.now();
        const res = await call('POST', `/tasks/${task._id}/start`);
        assert.equal(res.status, 200);
        const startedAt = Date.parse(res.json.startedAt);
        assert.ok(startedAt >= pressedAt && startedAt <= Date.now());
        assert.equal(res.json.status, 'scheduled');
        assert.equal((await Task.findById(task._id)).startedAt.getTime(), startedAt);
    });

    test('again keeps the first startedAt', async () => {
        const task = await placedTask({ startedAt: earlierToday });
        const res = await call('POST', `/tasks/${task._id}/start`);
        assert.equal(res.status, 200);
        assert.equal(res.json.startedAt, earlierToday.toISOString());
    });

    test('is refused for an unscheduled task', async () => {
        const task = await Task.create({ owner: userA, title: 'No slot', durationMinutes: 30 });
        const res = await call('POST', `/tasks/${task._id}/start`);
        assert.equal(res.status, 400);
        assert.equal(res.json.error, 'Task is not scheduled');
        assert.equal((await Task.findById(task._id)).startedAt, undefined);
    });

    test('is refused for a block on a later day', async () => {
        const task = await placedTask({
            start: new Date(today.end.getTime() + 10 * HOUR),
            end: new Date(today.end.getTime() + 11 * HOUR),
        });
        const res = await call('POST', `/tasks/${task._id}/start`);
        assert.equal(res.status, 400);
        assert.equal(res.json.error, NOT_ITS_DAY);
        assert.equal((await Task.findById(task._id)).startedAt, undefined);
    });

    test("finds no task belonging to another user", async () => {
        const task = await placedTask();
        const res = await call('POST', `/tasks/${task._id}/start`, { user: userB });
        assert.equal(res.status, 404);
        assert.equal((await Task.findById(task._id)).startedAt, undefined);
    });
});

describe('Start on a class', () => {
    test('sets startedAt, and starting again keeps it', async () => {
        const event = await aClass();
        const first = await call('POST', `/events/${event._id}/start`);
        assert.equal(first.status, 200);
        assert.ok(first.json.startedAt);

        const second = await call('POST', `/events/${event._id}/start`);
        assert.equal(second.status, 200);
        assert.equal(second.json.startedAt, first.json.startedAt);
    });

    test('is refused for a missed class on an earlier day', async () => {
        const event = await aClass({
            start: new Date(today.start.getTime() - 3 * HOUR),
            end: new Date(today.start.getTime() - 2 * HOUR),
        });
        const res = await call('POST', `/events/${event._id}/start`);
        assert.equal(res.status, 400);
        assert.equal(res.json.error, NOT_ITS_DAY);
        assert.equal((await Event.findById(event._id)).startedAt, undefined);
    });

    test("finds no class belonging to another user", async () => {
        const event = await aClass();
        const res = await call('POST', `/events/${event._id}/start`, { user: userB });
        assert.equal(res.status, 404);
        assert.equal(res.json.error, 'Event not found');
        assert.equal((await Event.findById(event._id)).startedAt, undefined);
    });
});

describe('startedAt can only be set by Start', () => {
    test('PATCH ignores startedAt on a task', async () => {
        const task = await placedTask();
        const res = await call('PATCH', `/tasks/${task._id}`, {
            body: { title: 'Renamed', startedAt: earlierToday.toISOString() },
        });
        assert.equal(res.status, 200);
        assert.equal(res.json.task.startedAt, undefined);
    });

    test('PATCH rejects startedAt on a class', async () => {
        const event = await aClass();
        const res = await call('PATCH', `/events/${event._id}`, {
            body: { startedAt: earlierToday.toISOString() },
        });
        assert.equal(res.status, 400);
        assert.equal((await Event.findById(event._id)).startedAt, undefined);
    });

    test('Start requires sign-in and a valid id', async () => {
        const task = await placedTask();
        assert.equal((await call('POST', `/tasks/${task._id}/start`, { user: null })).status, 401);
        assert.equal((await call('POST', '/events/not-an-id/start')).status, 400);
    });
});

describe('Moving a started block clears startedAt', () => {
    test('Skip clears it', async () => {
        const task = await placedTask({ startedAt: earlierToday });
        const res = await call('POST', `/tasks/${task._id}/skip`);
        assert.equal(res.status, 200);
        assert.equal(res.json.startedAt, undefined);
        assert.equal((await Task.findById(task._id)).startedAt, undefined);
    });

    test('a duration change (back to Needs a slot) clears it', async () => {
        const task = await placedTask({ startedAt: earlierToday });
        const res = await call('PATCH', `/tasks/${task._id}`, { body: { durationMinutes: 90 } });
        assert.equal(res.status, 200);
        assert.equal(res.json.task.status, 'unscheduled');
        assert.equal(res.json.task.startedAt, undefined);
    });

    test('a class added on top of the task clears it', async () => {
        const task = await placedTask({ startedAt: earlierToday });
        const res = await call('POST', '/events', {
            body: { title: 'Lab', start: todayAt(10).toISOString(), end: todayAt(11).toISOString() },
        });
        assert.equal(res.status, 201);
        const moved = await Task.findById(task._id);
        assert.notEqual(moved.start?.getTime(), todayAt(10).getTime(), 'the task should have moved');
        assert.equal(moved.startedAt, undefined);
    });

    test("renaming a task keeps it", async () => {
        const task = await placedTask({ startedAt: earlierToday });
        const res = await call('PATCH', `/tasks/${task._id}`, { body: { title: 'Read chapter 4' } });
        assert.equal(res.status, 200);
        assert.equal(res.json.task.startedAt, earlierToday.toISOString());
    });

    test('a new time for a class clears it, a new title keeps it', async () => {
        const event = await aClass({ startedAt: earlierToday });

        const renamed = await call('PATCH', `/events/${event._id}`, { body: { title: 'Biology 101' } });
        assert.equal(renamed.status, 200);
        assert.equal(renamed.json.startedAt, earlierToday.toISOString());

        const moved = await call('PATCH', `/events/${event._id}`, {
            body: { start: todayAt(12).toISOString(), end: todayAt(13).toISOString() },
        });
        assert.equal(moved.status, 200);
        assert.equal(moved.json.startedAt, undefined);
    });

    test('Start on a block that moved since it was read is refused', async () => {
        const stale = await placedTask();
        await Task.findOneAndUpdate(
            { _id: stale._id },
            { $set: { start: todayAt(14), end: todayAt(15) } }
        );
        const result = await markStarted(Task, stale, ET);
        assert.deepEqual(result, { status: 409, error: BLOCK_CHANGED });
        assert.equal((await Task.findById(stale._id)).startedAt, undefined);
    });
});

describe('Which day a block is on', () => {
    // 3 March 2027 03:00 UTC is still 2 March in New York but already 3 March in Tokyo
    const now = new Date('2027-03-03T03:00:00.000Z');

    test("the day is the user's calendar day", () => {
        assert.deepEqual(dayContaining(now, ET), {
            start: new Date('2027-03-02T05:00:00.000Z'),
            end: new Date('2027-03-03T05:00:00.000Z'),
        });
        const block = { start: new Date('2027-03-02T14:00:00.000Z'), end: new Date('2027-03-02T15:00:00.000Z') };
        assert.equal(isOnDay(block, dayContaining(now, ET)), true);
        assert.equal(isOnDay(block, dayContaining(now, 'Asia/Tokyo')), false);
    });

    test('the day DST starts is 23 hours long', () => {
        const day = dayContaining(new Date('2027-03-14T12:00:00.000Z'), ET);
        assert.equal(day.end - day.start, 23 * HOUR);
    });

    test('edges: overlaps count, touching midnight does not, zero-minute blocks count on their day', () => {
        const day = dayContaining(now, ET);
        const block = (startMs, endMs) => ({ start: new Date(startMs), end: new Date(endMs) });
        const s = day.start.getTime();
        const e = day.end.getTime();

        assert.equal(isOnDay(block(s - HOUR, s + HOUR), day), true, 'runs past midnight into the day');
        assert.equal(isOnDay(block(s - HOUR, s), day), false, 'ends exactly at midnight');
        assert.equal(isOnDay(block(e, e + HOUR), day), false, 'starts at the next midnight');
        assert.equal(isOnDay(block(s, s), day), true, 'zero-minute block at midnight');
        assert.equal(isOnDay(block(e, e), day), false, 'zero-minute block at the next midnight');
    });
});
