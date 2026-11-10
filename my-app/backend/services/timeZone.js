const FALLBACK_TIMEZONE = 'America/New_York';

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function defaultTimeZone() {
  const env = process.env.DEFAULT_TIMEZONE;
  if (env && isValidTimeZone(env)) return env;
  return FALLBACK_TIMEZONE;
}

// body.timeZone, then the X-Timezone header, then DEFAULT_TIMEZONE / America/New_York.
export function resolveTimeZone(req) {
  const fromBody = req?.body && typeof req.body === 'object' ? req.body.timeZone : undefined;
  const header = req?.get?.('X-Timezone') ?? req?.headers?.['x-timezone'];
  const raw = firstString(fromBody) ?? firstString(header);
  if (raw === undefined) return { timeZone: defaultTimeZone() };
  if (!isValidTimeZone(raw)) return { error: 'Invalid time zone' };
  return { timeZone: raw };
}

function firstString(value) {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}

export function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

function tzOffsetMs(instant, timeZone) {
  const parts = zonedParts(new Date(instant), timeZone);
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallAsUtc - instant;
}

function wallMatches(date, year, month, day, hour, minute, second, timeZone) {
  const parts = zonedParts(date, timeZone);
  return (
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute &&
    parts.second === second
  );
}

// Wall-clock time in `timeZone` → UTC Date. Returns null if that civil time
// is skipped (DST spring-forward). Ambiguous fall-back times use the earlier occurrence.
export function zonedDateTime(year, month, day, hour, minute, second = 0, millisecond = 0, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offset = tzOffsetMs(utcGuess, timeZone);
  let instant = utcGuess - offset;
  const offset2 = tzOffsetMs(instant, timeZone);
  if (offset2 !== offset) instant = utcGuess - offset2;

  const first = new Date(instant);
  if (wallMatches(first, year, month, day, hour, minute, second, timeZone)) return first;

  for (const candidate of new Set([utcGuess - offset, utcGuess - offset2])) {
    const date = new Date(candidate);
    if (wallMatches(date, year, month, day, hour, minute, second, timeZone)) return date;
  }
  return null;
}

// First existing wall time at or after 00:00 on this calendar day.
// Needed when DST starts at midnight, so 00:00 itself does not exist
// (e.g. Africa/Cairo 2026-04-24, America/Havana 2026-03-08).
function startOfDayInTimeZone(year, month, day, timeZone) {
  for (let minute = 0; minute < 24 * 60; minute++) {
    const instant = zonedDateTime(
      year,
      month,
      day,
      Math.floor(minute / 60),
      minute % 60,
      0,
      0,
      timeZone,
    );
    if (instant) return instant;
  }
  return null;
}

export function endOfDayInTimeZone(year, month, day, timeZone) {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const startOfNext = startOfDayInTimeZone(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone,
  );
  if (!startOfNext) return null;
  return new Date(startOfNext.getTime() - 1);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnlyEndOfDay(value, timeZone) {
  const match = typeof value === 'string' && DATE_ONLY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return endOfDayInTimeZone(year, month, day, timeZone);
}

// Mutable so tests can stub a failed conversion without rewriting ESM bindings.
export const dueDateEndOfDay = {
  fromDateOnly: parseDateOnlyEndOfDay,
};
