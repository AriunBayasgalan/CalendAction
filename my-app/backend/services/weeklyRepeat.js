import { zonedDateTime, zonedParts } from './timeZone.js';

// A semester of a weekly class, including the first date.
export const MAX_WEEKLY_OCCURRENCES = 16;

function addCalendarDays(year, month, day, delta) {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function dateKey(year, month, day) {
  return year * 10000 + month * 100 + day;
}

function parseDateKey(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return dateKey(year, month, day);
}

// Same wall-clock time, `days` later, in `timeZone` (so a 9:00 class stays 9:00 across DST).
function shiftWall(date, days, timeZone) {
  const parts = zonedParts(date, timeZone);
  const next = addCalendarDays(parts.year, parts.month, parts.day, days);
  for (let hour = parts.hour; hour < 24; hour += 1) {
    const minute = hour === parts.hour ? parts.minute : 0;
    const second = hour === parts.hour ? parts.second : 0;
    const instant = zonedDateTime(next.year, next.month, next.day, hour, minute, second, 0, timeZone);
    if (instant) return instant;
  }
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// The first date plus every 7 days through `repeatUntil` (a YYYY-MM-DD the user picked).
export function weeklyOccurrences({ start, end, repeatUntil, timeZone }) {
  const untilKey = parseDateKey(repeatUntil);
  const occurrences = [];
  let currentStart = new Date(start);
  let currentEnd = new Date(end);

  for (let index = 0; index < MAX_WEEKLY_OCCURRENCES; index += 1) {
    const parts = zonedParts(currentStart, timeZone);
    const key = dateKey(parts.year, parts.month, parts.day);
    if (key > untilKey) {
      if (index === 0) {
        return { field: 'repeatUntil', error: 'The last day has to be on or after the event.' };
      }
      break;
    }

    const nextStart = shiftWall(currentStart, 7, timeZone);
    if (currentEnd > nextStart) {
      return { field: 'end', error: 'A weekly event has to end before it repeats.' };
    }

    occurrences.push({ start: new Date(currentStart), end: new Date(currentEnd) });

    const nextParts = zonedParts(nextStart, timeZone);
    const nextKey = dateKey(nextParts.year, nextParts.month, nextParts.day);
    if (nextKey > untilKey) break;
    if (index === MAX_WEEKLY_OCCURRENCES - 1) {
      return {
        field: 'repeatUntil',
        error: `Weekly events can repeat for up to ${MAX_WEEKLY_OCCURRENCES} weeks.`,
      };
    }

    currentStart = nextStart;
    currentEnd = shiftWall(currentEnd, 7, timeZone);
  }

  return { occurrences };
}
