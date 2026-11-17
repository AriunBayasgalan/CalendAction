import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_WEEKLY_OCCURRENCES, weeklyOccurrences } from '../services/weeklyRepeat.js';
import { zonedParts } from '../services/timeZone.js';

const ET = 'America/New_York';

test('weekly dates stay on the same wall-clock time through DST', () => {
  const expanded = weeklyOccurrences({
    start: new Date('2027-03-07T14:00:00.000Z'), // 9:00 EST
    end: new Date('2027-03-07T15:00:00.000Z'),
    repeatUntil: '2027-03-21',
    timeZone: ET,
  });
  assert.equal(expanded.occurrences.length, 3);
  for (const slot of expanded.occurrences) {
    const start = zonedParts(slot.start, ET);
    const end = zonedParts(slot.end, ET);
    assert.equal(start.hour, 9);
    assert.equal(start.minute, 0);
    assert.equal(end.hour, 10);
    assert.equal(start.day === 7 || start.day === 14 || start.day === 21, true);
  }
});

test('the last day has to include the first event, and the series stops at 16 weeks', () => {
  const tooSoon = weeklyOccurrences({
    start: new Date('2027-03-02T14:00:00.000Z'),
    end: new Date('2027-03-02T15:00:00.000Z'),
    repeatUntil: '2027-03-01',
    timeZone: ET,
  });
  assert.equal(tooSoon.field, 'repeatUntil');
  assert.match(tooSoon.error, /on or after/);

  const tooLong = weeklyOccurrences({
    start: new Date('2027-03-02T14:00:00.000Z'),
    end: new Date('2027-03-02T15:15:00.000Z'),
    repeatUntil: '2027-08-01',
    timeZone: ET,
  });
  assert.equal(tooLong.field, 'repeatUntil');
  assert.match(tooLong.error, new RegExp(String(MAX_WEEKLY_OCCURRENCES)));
});

test('a weekly event that lasts a week or more is rejected', () => {
  const expanded = weeklyOccurrences({
    start: new Date('2027-03-02T14:00:00.000Z'),
    end: new Date('2027-03-09T15:00:00.000Z'),
    repeatUntil: '2027-03-16',
    timeZone: ET,
  });
  assert.equal(expanded.field, 'end');
});
