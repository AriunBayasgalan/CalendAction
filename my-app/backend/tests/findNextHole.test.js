import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNextHole, overlaps } from '../services/findNextHole.js';
import { zonedDateTime, zonedParts } from '../services/timeZone.js';

const ET = 'America/New_York';
const PT = 'America/Los_Angeles';

function at(year, month, day, hour, minute, timeZone = ET) {
  const date = zonedDateTime(year, month, day, hour, minute, 0, 0, timeZone);
  assert.ok(date, `expected a valid civil time ${year}-${month}-${day} ${hour}:${minute} in ${timeZone}`);
  return date;
}

function stamp(date, timeZone = ET) {
  const p = zonedParts(date, timeZone);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

function ev(start, end) {
  return { start, end };
}

test('CA-17 AC1: 2-hour task with class 9:30–10:45 does not land inside that class', () => {
  const klass = ev(at(2026, 11, 10, 9, 30), at(2026, 11, 10, 10, 45));
  const result = findNextHole({
    durationMinutes: 120,
    events: [klass],
    from: at(2026, 11, 10, 8, 0),
    timeZone: ET,
  });
  assert.equal(result.found, true, result.message);
  assert.equal(stamp(result.start), '2026-11-10 10:45');
  assert.equal(stamp(result.end), '2026-11-10 12:45');
  assert.equal(overlaps(result.start, result.end, klass.start, klass.end), false);
});

test('CA-17 AC2: not after 18:00 never returns a start that would end after 18:00', () => {
  const result = findNextHole({
    durationMinutes: 120,
    rules: [{ notBefore: '09:00', notAfter: '18:00' }],
    events: [ev(at(2026, 11, 10, 9, 0), at(2026, 11, 10, 16, 0))],
    from: at(2026, 11, 10, 8, 0),
    timeZone: ET,
  });
  assert.equal(result.found, true, result.message);
  assert.equal(stamp(result.start), '2026-11-10 16:00');
  assert.equal(stamp(result.end), '2026-11-10 18:00');
});

test('CA-17 AC3: nothing fits returns a clear no-hole result, not a throw', () => {
  const events = [];
  for (let day = 0; day < 16; day++) {
    events.push(ev(at(2026, 11, 10 + day, 0, 0), at(2026, 11, 11 + day, 0, 0)));
  }
  const result = findNextHole({
    durationMinutes: 60,
    events,
    from: at(2026, 11, 10, 8, 0),
    timeZone: ET,
  });
  assert.equal(result.found, false);
  assert.match(result.message, /no open time/i);
});

test('no rules: default window is 07:00–22:00, not midnight or 6 AM', () => {
  const early = findNextHole({
    durationMinutes: 60,
    from: at(2026, 11, 10, 6, 0),
    timeZone: ET,
  });
  assert.equal(early.found, true, early.message);
  assert.equal(stamp(early.start), '2026-11-10 07:00');

  const packedToday = findNextHole({
    durationMinutes: 60,
    events: [ev(at(2026, 11, 16, 15, 0), at(2026, 11, 17, 0, 0))],
    from: at(2026, 11, 16, 15, 0),
    timeZone: ET,
  });
  assert.equal(packedToday.found, true, packedToday.message);
  assert.equal(stamp(packedToday.start), '2026-11-17 07:00');

  const late = findNextHole({
    durationMinutes: 60,
    from: at(2026, 11, 10, 22, 30),
    timeZone: ET,
  });
  assert.equal(late.found, true, late.message);
  assert.equal(stamp(late.start), '2026-11-11 07:00');
});

test('a rule may widen the window to 03:00', () => {
  const result = findNextHole({
    durationMinutes: 60,
    rules: [{ notBefore: '03:00', notAfter: '22:00' }],
    from: at(2026, 11, 10, 2, 0),
    timeZone: ET,
  });
  assert.equal(result.found, true, result.message);
  assert.equal(stamp(result.start), '2026-11-10 03:00');
});

test('a rule may narrow the window; notBefore 09:00 skips 07:00', () => {
  const result = findNextHole({
    durationMinutes: 30,
    rules: [{ notBefore: '09:00', notAfter: '17:00' }],
    from: at(2026, 11, 10, 7, 0),
    timeZone: ET,
  });
  assert.equal(stamp(result.start), '2026-11-10 09:00');
});

test('same inputs land at the user-zone wall time regardless of process TZ', () => {
  const from = new Date('2026-11-16T20:00:00.000Z'); // 15:00 ET / 12:00 PT
  const events = [ev(new Date('2026-11-16T20:00:00.000Z'), new Date('2026-11-17T02:00:00.000Z'))];
  const rules = [{ notBefore: '09:00', notAfter: '18:00' }];

  const inEt = findNextHole({ durationMinutes: 60, events, rules, from, timeZone: ET });
  assert.equal(inEt.found, true, inEt.message);
  assert.equal(inEt.start.toISOString(), '2026-11-17T14:00:00.000Z'); // 09:00 ET
  assert.equal(stamp(inEt.start, ET), '2026-11-17 09:00');

  const inPt = findNextHole({ durationMinutes: 60, events, rules, from, timeZone: PT });
  assert.equal(inPt.found, true, inPt.message);
  assert.equal(inPt.start.toISOString(), '2026-11-17T17:00:00.000Z'); // 09:00 PT
  assert.equal(stamp(inPt.start, PT), '2026-11-17 09:00');

  const inUtc = findNextHole({ durationMinutes: 60, events, rules, from, timeZone: 'UTC' });
  assert.equal(inUtc.found, true, inUtc.message);
  assert.equal(inUtc.start.toISOString(), '2026-11-17T09:00:00.000Z');
});

test('DST spring-forward: afternoon notAfter 18:00 still ends by 18:00 ET', () => {
  const result = findNextHole({
    durationMinutes: 120,
    rules: [{ notBefore: '09:00', notAfter: '18:00' }],
    events: [ev(at(2026, 3, 8, 9, 0), at(2026, 3, 8, 16, 0))],
    from: at(2026, 3, 8, 8, 0),
    timeZone: ET,
  });
  assert.equal(result.found, true, result.message);
  assert.equal(stamp(result.end), '2026-03-08 18:00');
});

test('DST spring-forward: skipped 02:30 civil time is not chosen', () => {
  const result = findNextHole({
    durationMinutes: 30,
    rules: [{ notBefore: '02:00', notAfter: '04:00' }],
    from: at(2026, 3, 8, 1, 45),
    timeZone: ET,
  });
  assert.equal(result.found, true, result.message);
  // 02:00 and 02:15 do not exist; next valid slot in the window is 03:00
  assert.equal(stamp(result.start), '2026-03-08 03:00');
});

test('date-only due date (end of day in the user zone) still allows placement that afternoon', () => {
  const due = new Date('2026-11-21T04:59:59.999Z'); // end of 20 Nov in ET
  const result = findNextHole({
    durationMinutes: 60,
    dueDate: due,
    from: at(2026, 11, 20, 21, 0),
    timeZone: ET,
  });
  assert.equal(result.found, true, result.message);
  assert.equal(stamp(result.start), '2026-11-20 21:00');
  assert.ok(result.end <= due);
});

test('a due instant just after a late slot still rejects finishing past the deadline', () => {
  const due = new Date('2026-11-21T04:59:59.999Z');
  const result = findNextHole({
    durationMinutes: 60,
    dueDate: due,
    from: at(2026, 11, 20, 21, 15),
    timeZone: ET,
  });
  // 21:15–22:15 is past 22:00 default window; no later day stays within the due date
  assert.equal(result.found, false);
});
