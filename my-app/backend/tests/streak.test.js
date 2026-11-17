import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret';

const { default: eventRoutes } = await import('../routes/eventRoutes.js');
const { default: taskRoutes } = await import('../routes/taskRoutes.js');
const { default: streakRoutes } = await import('../routes/streakRoutes.js');
const { notFound, errorHandler } = await import('../middleware/errorHandler.js');
const { default: Event } = await import('../models/Event.js');
const { default: Task } = await import('../models/Task.js');
const { default: User } = await import('../models/User.js');
const { countStart, dayKey, getStreak } = await import('../services/streak.js');
const { dayContaining, zonedDateTime } = await import('../services/timeZone.js');

const ET = 'America/New_York';
const HOUR = 60 * 60 * 1000;

let mongod;
let server;
let baseUrl;
let userId;
let otherId;

const tokenFor = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET);

async function call(method, path, { user = userId, headers: extra } = {}) {
    const headers = { 'Content-Type': 'application/json', 'X-Timezone': ET, ...extra };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const res = await fetch(`${baseUrl}${path}`, { method, headers });
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
    app.use('/streak', streakRoutes);
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
    await Promise.all([Event.deleteMany({}), Task.deleteMany({}), User.deleteMany({})]);
    userId = (await User.create({ email: 'a@example.com', password: 'x' }))._id.toString();
    otherId = (await User.create({ email: 'b@example.com', password: 'x' }))._id.toString();
});

const setStreak = (count, lastDay, id = userId) =>
    User.updateOne({ _id: id }, { $set: { streak: { count, lastDay } } });
const storedStreak = async () => (await User.findById(userId)).streak.toObject();

// The rule, with a fixed "now": Thursday 4 March 2027, noon in New York.
// Wall times in ET for days in March 2027.
const at = (day, hour) => zonedDateTime(2027, 3, day, hour, 0, 0, 0, ET);
const now = at(4, 12);

const aClass = (start, end, extra = {}) =>
    Event.create({ owner: userId, title: 'Biology', start, end, ...extra });
const placedTask = (start, end, extra = {}) =>
    Task.create({ owner: userId, title: 'Essay', durationMinutes: 60, status: 'scheduled', start, end, ...extra });

describe('Rule 1: starting a block adds 1, once per day', () => {
    test('the first Start of the day counts, a second does not', async () => {
        await countStart(userId, ET, now);
        await countStart(userId, ET, now);
        assert.deepEqual(await getStreak(userId, ET, now), { count: 1, countedToday: true });
    });

    test('a Start the day after a counted day continues the streak', async () => {
        await setStreak(4, '2027-03-03');
        await countStart(userId, ET, now);
        assert.deepEqual(await storedStreak(), { count: 5, lastDay: '2027-03-04' });
    });

    test('two Starts at the same moment still count once', async () => {
        await Promise.all([countStart(userId, ET, now), countStart(userId, ET, now)]);
        assert.equal((await storedStreak()).count, 1);
    });

    test('a Start after a missed day begins again at 1', async () => {
        await setStreak(4, '2027-03-02');
        await aClass(at(3, 9), at(3, 10)); // Wednesday, never started
        await countStart(userId, ET, now);
        assert.deepEqual(await storedStreak(), { count: 1, lastDay: '2027-03-04' });
    });
});

describe('Rule 2: a day with blocks planned but none started resets it', () => {
    test('a class nobody started yesterday resets the streak', async () => {
        await setStreak(5, '2027-03-02');
        await aClass(at(3, 9), at(3, 10));
        assert.deepEqual(await getStreak(userId, ET, now), { count: 0, countedToday: false });
        assert.equal((await storedStreak()).lastDay, undefined);
    });

    test('a placed task nobody started yesterday resets it too', async () => {
        await setStreak(5, '2027-03-02');
        await placedTask(at(3, 14), at(3, 15));
        assert.equal((await getStreak(userId, ET, now)).count, 0);
    });

    test('a missed day is caught even when it was not yesterday', async () => {
        await setStreak(5, '2027-02-28');
        await aClass(at(2, 9), at(2, 10)); // Tuesday missed, Wednesday empty
        assert.equal((await getStreak(userId, ET, now)).count, 0);
    });

    test('skipping one block is fine if another was started that day', async () => {
        // Yesterday counted (something was started), so its unstarted block doesn't matter
        await setStreak(5, '2027-03-03');
        await aClass(at(3, 9), at(3, 10));
        assert.equal((await getStreak(userId, ET, now)).count, 5);
    });

    test("today's blocks don't count against it yet, even ones already over", async () => {
        await setStreak(5, '2027-03-03');
        await aClass(at(4, 8), at(4, 9));
        assert.deepEqual(await getStreak(userId, ET, now), { count: 5, countedToday: false });
    });

    test('a block still running past midnight into today is not missed yet', async () => {
        await setStreak(5, '2027-03-02');
        await aClass(at(3, 23), at(4, 13));
        assert.equal((await getStreak(userId, ET, now)).count, 5);
    });

    test("another user's missed block doesn't touch this streak", async () => {
        await setStreak(5, '2027-03-02');
        await Event.create({ owner: otherId, title: 'Not mine', start: at(3, 9), end: at(3, 10) });
        assert.equal((await getStreak(userId, ET, now)).count, 5);
    });
});

describe('Rule 3: days without blocks change nothing', () => {
    test('empty days between counted days keep the streak', async () => {
        await setStreak(5, '2027-03-01');
        assert.deepEqual(await getStreak(userId, ET, now), { count: 5, countedToday: false });
    });

    test('an unscheduled task is not a planned block', async () => {
        await setStreak(5, '2027-03-02');
        await Task.create({ owner: userId, title: 'No slot', durationMinutes: 30 });
        assert.equal((await getStreak(userId, ET, now)).count, 5);
    });

    test('a new user starts with no streak', async () => {
        assert.deepEqual(await getStreak(userId, ET, now), { count: 0, countedToday: false });
    });
});

describe('Through the API, today', () => {
    const today = dayContaining(new Date(), ET);
    const todayAt = (hours) => new Date(today.start.getTime() + hours * HOUR);
    const yesterday = dayKey(new Date(today.start.getTime() - HOUR), ET);

    test('starting blocks raises the streak once for the day', async () => {
        const cls = await aClass(todayAt(8), todayAt(9));
        const task = await placedTask(todayAt(10), todayAt(11));

        assert.deepEqual((await call('GET', '/streak')).json, { count: 0, countedToday: false });

        assert.equal((await call('POST', `/events/${cls._id}/start`)).status, 200);
        assert.deepEqual((await call('GET', '/streak')).json, { count: 1, countedToday: true });

        assert.equal((await call('POST', `/tasks/${task._id}/start`)).status, 200);
        assert.equal((await call('POST', `/events/${cls._id}/start`)).status, 200);
        assert.deepEqual((await call('GET', '/streak')).json, { count: 1, countedToday: true });
    });

    test('a Start today continues yesterday’s streak', async () => {
        await setStreak(2, yesterday);
        const cls = await aClass(todayAt(8), todayAt(9));
        await call('POST', `/events/${cls._id}/start`);
        assert.deepEqual((await call('GET', '/streak')).json, { count: 3, countedToday: true });
    });

    test('a refused Start (wrong day) does not count', async () => {
        const tomorrow = await aClass(new Date(today.end.getTime() + 8 * HOUR), new Date(today.end.getTime() + 9 * HOUR));
        assert.equal((await call('POST', `/events/${tomorrow._id}/start`)).status, 400);
        assert.equal((await call('GET', '/streak')).json.count, 0);
    });

    test('GET /streak needs sign-in and a valid time zone', async () => {
        assert.equal((await call('GET', '/streak', { user: null })).status, 401);
        assert.equal((await call('GET', '/streak', { headers: { 'X-Timezone': 'Not/AZone' } })).status, 400);
    });
});
