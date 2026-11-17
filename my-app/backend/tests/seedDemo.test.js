import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Task from '../models/Task.js';
import Rule from '../models/rule.model.js';
import { zonedParts } from '../services/timeZone.js';
import { mondayOf, seedDemoAccount } from '../scripts/seedDemo.js';

const TZ = 'America/New_York';
// A Wednesday in Eastern Time, so the seeded week is Mon Nov 16 – Sun Nov 22 2026
const NOW = new Date('2026-11-18T17:00:00.000Z');

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('mondayOf lands on the Monday of the given week in the zone', () => {
  const monday = mondayOf(NOW, TZ);
  assert.deepEqual(monday, { year: 2026, month: 11, day: 16 });
});

test('seeding a fresh database produces the demo week', async () => {
  const result = await seedDemoAccount({
    email: 'demo@calendaction.app',
    password: 'test-demo-pass',
    timeZone: TZ,
    now: NOW,
  });

  const user = await User.findOne({ email: 'demo@calendaction.app' });
  assert.ok(user);
  assert.equal(result.userId, user._id.toString());
  assert.ok(await bcrypt.compare('test-demo-pass', user.password));

  const events = await Event.find({ owner: user._id }).sort({ start: 1 });
  assert.equal(events.length, 3);
  assert.equal(events[0].title, 'CS 3510');
  assert.equal(events[1].title, 'Team meeting');
  assert.equal(events[2].title, 'CS 3510');

  const tue = zonedParts(events[0].start, TZ);
  assert.equal(tue.year, 2026);
  assert.equal(tue.month, 11);
  assert.equal(tue.day, 17);
  assert.equal(tue.hour, 9);
  assert.equal(tue.minute, 30);
  const tueEnd = zonedParts(events[0].end, TZ);
  assert.equal(tueEnd.hour, 10);
  assert.equal(tueEnd.minute, 45);

  const thu = zonedParts(events[2].start, TZ);
  assert.equal(thu.day, 19);
  assert.equal(thu.hour, 9);
  assert.equal(thu.minute, 30);

  const meeting = zonedParts(events[1].start, TZ);
  assert.equal(meeting.day, 18);
  assert.equal(meeting.hour, 15);
  assert.equal(meeting.minute, 0);

  const rules = await Rule.find({ owner: user._id });
  assert.equal(rules.length, 1);
  assert.equal(rules[0].label, 'Gym before 18:00');
  assert.equal(rules[0].notBefore, '07:00');
  assert.equal(rules[0].notAfter, '18:00');

  const tasks = await Task.find({ owner: user._id }).sort({ title: 1 });
  assert.equal(tasks.length, 2);
  const lab = tasks.find((t) => t.title === 'Lab writeup');
  const study = tasks.find((t) => t.title === 'Study for CS 3510');
  assert.equal(study.status, 'unscheduled');
  assert.equal(study.start, undefined);
  assert.equal(lab.status, 'scheduled');
  assert.ok(lab.todoText.includes('Write the introduction'));
  const labStart = zonedParts(lab.start, TZ);
  assert.equal(labStart.day, 16);
  assert.equal(labStart.hour, 14);
  assert.equal(labStart.minute, 0);
});

test('running the seed again replaces the week and updates the password', async () => {
  await seedDemoAccount({
    email: 'demo@calendaction.app',
    password: 'new-demo-pass',
    timeZone: TZ,
    now: NOW,
  });
  const user = await User.findOne({ email: 'demo@calendaction.app' });
  assert.ok(await bcrypt.compare('new-demo-pass', user.password));
  assert.equal(await Event.countDocuments({ owner: user._id }), 3);
  assert.equal(await Task.countDocuments({ owner: user._id }), 2);
  assert.equal(await Rule.countDocuments({ owner: user._id }), 1);
});

test('seedDemoAccount refuses to run without a password', async () => {
  await assert.rejects(
    () => seedDemoAccount({ email: 'demo@calendaction.app', timeZone: TZ, now: NOW }),
    /DEMO_PASSWORD/,
  );
});
