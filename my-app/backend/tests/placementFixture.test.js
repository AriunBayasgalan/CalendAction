import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNextHole } from '../services/findNextHole.js';
import { zonedDateTime, zonedParts } from '../services/timeZone.js';

// CA-22 placement fixture (all times America/New_York):
//   Search starts   Tue 2026-11-10 12:00
//   Class 1         Tue 12:00–13:15
//   Class 2         Tue 13:30–17:30
//   Rule            nothing after 18:00
//   Task            45 minutes
//   Expected slot   Wed 2026-11-11 07:00–07:45
// The 15-minute gap between the classes is too short, 17:30–18:15 would break the
// 18:00 rule, so the task rolls to the next morning at the default 07:00 start.

const ET = 'America/New_York';

function at(year, month, day, hour, minute) {
  return zonedDateTime(year, month, day, hour, minute, 0, 0, ET);
}

function stamp(date) {
  const p = zonedParts(date, ET);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

const fixture = {
  from: at(2026, 11, 10, 12, 0),
  events: [
    { title: 'Class 1', start: at(2026, 11, 10, 12, 0), end: at(2026, 11, 10, 13, 15) },
    { title: 'Class 2', start: at(2026, 11, 10, 13, 30), end: at(2026, 11, 10, 17, 30) },
  ],
  rules: [{ notAfter: '18:00' }],
  durationMinutes: 45,
};

test('CA-22 fixture: two classes, not after 18:00, 45-minute task lands Wed 07:00–07:45', () => {
  const result = findNextHole({ ...fixture, timeZone: ET });

  assert.equal(result.found, true, result.message);
  assert.equal(stamp(result.start), '2026-11-11 07:00');
  assert.equal(stamp(result.end), '2026-11-11 07:45');
});
