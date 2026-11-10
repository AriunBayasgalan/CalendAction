import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  defaultTimeZone,
  endOfDayInTimeZone,
  isValidTimeZone,
  parseDateOnlyEndOfDay,
  resolveTimeZone,
  zonedDateTime,
  zonedParts,
} from '../services/timeZone.js';

test('validates IANA time zones', () => {
  assert.equal(isValidTimeZone('America/New_York'), true);
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('Not/AZone'), false);
  assert.equal(isValidTimeZone(''), false);
});

test('defaultTimeZone is America/New_York unless DEFAULT_TIMEZONE is a valid zone', () => {
  // Use a child process so we do not mutate env for sibling test files.
  const run = (env) =>
    spawnSync(
      process.execPath,
      ['-e', "import { defaultTimeZone } from './services/timeZone.js'; process.stdout.write(defaultTimeZone());"],
      { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', env: { ...process.env, ...env } },
    );

  const unset = run({ DEFAULT_TIMEZONE: '' });
  assert.equal(unset.status, 0, unset.stderr);
  assert.equal(unset.stdout, 'America/New_York');

  const valid = run({ DEFAULT_TIMEZONE: 'America/Los_Angeles' });
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.stdout, 'America/Los_Angeles');

  const invalid = run({ DEFAULT_TIMEZONE: 'nope' });
  assert.equal(invalid.status, 0, invalid.stderr);
  assert.equal(invalid.stdout, 'America/New_York');
});

test('resolveTimeZone reads body, then header, then the default', () => {
  assert.equal(resolveTimeZone({ body: { timeZone: 'UTC' } }).timeZone, 'UTC');
  assert.equal(
    resolveTimeZone({ headers: { 'x-timezone': 'America/Los_Angeles' } }).timeZone,
    'America/Los_Angeles',
  );
  assert.equal(
    resolveTimeZone({
      get: (name) => (name === 'X-Timezone' ? 'Europe/Paris' : undefined),
    }).timeZone,
    'Europe/Paris',
  );
  assert.equal(resolveTimeZone({ body: { timeZone: 'Nope' } }).error, 'Invalid time zone');
  if (!process.env.DEFAULT_TIMEZONE) {
    assert.equal(resolveTimeZone({}).timeZone, 'America/New_York');
  }
});

test('zonedDateTime converts wall-clock times independently of process TZ', () => {
  assert.equal(zonedDateTime(2026, 11, 17, 9, 0, 0, 0, 'America/New_York').toISOString(), '2026-11-17T14:00:00.000Z');
  assert.equal(zonedDateTime(2026, 11, 17, 9, 0, 0, 0, 'America/Los_Angeles').toISOString(), '2026-11-17T17:00:00.000Z');
  assert.equal(zonedDateTime(2026, 11, 17, 9, 0, 0, 0, 'UTC').toISOString(), '2026-11-17T09:00:00.000Z');
});

test('DST spring-forward skips the missing hour; fall-back uses the earlier occurrence', () => {
  assert.equal(zonedDateTime(2026, 3, 8, 2, 30, 0, 0, 'America/New_York'), null);
  assert.equal(zonedDateTime(2026, 3, 8, 3, 0, 0, 0, 'America/New_York').toISOString(), '2026-03-08T07:00:00.000Z');
  assert.equal(zonedDateTime(2026, 11, 1, 1, 30, 0, 0, 'America/New_York').toISOString(), '2026-11-01T05:30:00.000Z');
});

test('date-only due dates are the last millisecond of that day in the user zone', () => {
  assert.equal(parseDateOnlyEndOfDay('2026-11-20', 'America/New_York').toISOString(), '2026-11-21T04:59:59.999Z');
  assert.equal(parseDateOnlyEndOfDay('2026-11-20', 'America/Los_Angeles').toISOString(), '2026-11-21T07:59:59.999Z');
  assert.equal(endOfDayInTimeZone(2026, 11, 20, 'UTC').toISOString(), '2026-11-20T23:59:59.999Z');
  const parts = zonedParts(parseDateOnlyEndOfDay('2026-11-20', 'America/New_York'), 'America/New_York');
  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 11);
  assert.equal(parts.day, 20);
  assert.equal(parts.hour, 23);
  assert.equal(parts.minute, 59);
  assert.equal(parts.second, 59);
});
