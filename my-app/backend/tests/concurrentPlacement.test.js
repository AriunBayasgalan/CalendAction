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
const { default: Event } = await import('../models/Event.js');
const { findNextHole } = await import('../services/findNextHole.js');
const { withOwnerLock, activeLockCount } = await import('../services/ownerLock.js');

const ET = 'America/New_York';
let mongod;
let server;
let baseUrl;

const user = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ sub: user }, process.env.JWT_SECRET);

async function place(id) {
    const res = await fetch(`${baseUrl}/tasks/${id}/place`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Timezone': ET },
    });
    return { status: res.status, json: await res.json() };
}

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
    await Event.deleteMany({});
});

// Leaves exactly one free hour, [S, S + 60 min), where S is the first hour-long
// hole from now; an event blocks everything after it for the next 16 days.
async function oneFreeHour() {
    const hole = findNextHole({ durationMinutes: 60, from: new Date(), timeZone: ET });
    assert.ok(hole.found);
    const gapEnd = new Date(hole.start.getTime() + 60 * 60000);
    await Event.create({
        owner: user,
        title: 'Busy',
        start: gapEnd,
        end: new Date(Date.now() + 16 * 24 * 60 * 60000),
    });
    return { start: hole.start, end: gapEnd };
}

const halfHourTask = (title) => Task.create({ owner: user, title, durationMinutes: 30 });

test('concurrent place requests for different tasks land in distinct, non-overlapping slots', async () => {
    const gap = await oneFreeHour();
    const [a, b] = await Promise.all([halfHourTask('A'), halfHourTask('B')]);

    // Slow down the "read the calendar" step so, without the lock, both requests
    // would read the same free hour before either writes and pick the same slot.
    const originalFind = Task.find;
    Task.find = function (...args) {
        return originalFind
            .apply(this, args)
            .exec()
            .then((docs) => new Promise((resolve) => setTimeout(() => resolve(docs), 50)));
    };
    let results;
    try {
        results = await Promise.all([place(a._id), place(b._id)]);
    } finally {
        Task.find = originalFind;
    }
    for (const res of results) assert.equal(res.status, 200, JSON.stringify(res.json));

    const slots = results
        .map((r) => ({ start: new Date(r.json.start), end: new Date(r.json.end) }))
        .sort((x, y) => x.start - y.start);
    assert.ok(slots[0].end <= slots[1].start, 'the two placed tasks must not overlap');
    assert.equal(slots[0].start.toISOString(), gap.start.toISOString());
    assert.equal(slots[1].end.toISOString(), gap.end.toISOString());
    assert.equal(activeLockCount(), 0, 'locks are released afterwards');
});

test('a third concurrent placement with no room left gets 409 and stays unscheduled', async () => {
    await oneFreeHour();
    const tasks = await Promise.all([halfHourTask('A'), halfHourTask('B'), halfHourTask('C')]);

    const results = await Promise.all(tasks.map((t) => place(t._id)));
    const codes = results.map((r) => r.status).sort();
    assert.deepEqual(codes, [200, 200, 409]);
    const rejected = results.find((r) => r.status === 409);
    assert.equal(rejected.json.error, 'No open time this week or next');

    const placed = await Task.find({ owner: user, status: 'scheduled' }).sort({ start: 1 });
    assert.equal(placed.length, 2);
    assert.ok(placed[0].end <= placed[1].start);
});

test('a conflicting write that slips in after placing makes it move to the next slot', async () => {
    const gap = await oneFreeHour();
    const task = await halfHourTask('A');

    // Simulates another server instance: right as this request writes its slot,
    // an event appears over the first half hour of the gap.
    const original = Task.findOneAndUpdate;
    let injected = false;
    Task.findOneAndUpdate = function (...args) {
        if (!injected) {
            injected = true;
            return Event.create({
                owner: user,
                title: 'Raced in',
                start: gap.start,
                end: new Date(gap.start.getTime() + 30 * 60000),
            }).then(() => original.apply(this, args));
        }
        return original.apply(this, args);
    };
    try {
        const res = await place(task._id);
        assert.equal(res.status, 200, JSON.stringify(res.json));
        assert.equal(new Date(res.json.start).getTime(), gap.start.getTime() + 30 * 60000);
    } finally {
        Task.findOneAndUpdate = original;
    }
});

test('withOwnerLock runs jobs for one owner one at a time, other owners in parallel', async () => {
    const order = [];
    const job = (name, ms) => async () => {
        order.push(`${name}:start`);
        await new Promise((resolve) => setTimeout(resolve, ms));
        order.push(`${name}:end`);
    };
    await Promise.all([
        withOwnerLock('x', job('x1', 20)),
        withOwnerLock('x', job('x2', 1)),
        withOwnerLock('y', job('y1', 1)),
    ]);
    assert.ok(order.indexOf('x1:end') < order.indexOf('x2:start'));
    assert.ok(order.indexOf('y1:end') < order.indexOf('x1:end'));

    await assert.rejects(withOwnerLock('x', async () => { throw new Error('boom'); }), /boom/);
    let ran = false;
    await withOwnerLock('x', async () => { ran = true; });
    assert.ok(ran, 'a failed job releases the lock');
    assert.equal(activeLockCount(), 0);
});
