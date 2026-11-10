import { DAY_END_HOUR, DAY_START_HOUR } from './dayWindow.js';
import { defaultTimeZone, isValidTimeZone, zonedDateTime, zonedParts } from './timeZone.js';

// Converts a time into minutes after midnight (630)
export function toMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

// True if two time ranges overlap
export function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

const STEP_MINUTES = 15; // try a new start time every 15 minutes
const HORIZON_DAYS = 14; // this week and next
const DEFAULT_WINDOW_START = DAY_START_HOUR * 60;
const DEFAULT_WINDOW_END = DAY_END_HOUR * 60;

function parseRuleMinutes(value) {
  if (value == null || String(value).trim() === '') return null;
  const minutes = toMinutes(value);
  return Number.isFinite(minutes) ? minutes : null;
}

// Option B: default 07:00–22:00 when no rule sets that bound.
// A rule may widen (e.g. notBefore 03:00) or narrow the window.
function dailyWindow(rules) {
  let windowStart = DEFAULT_WINDOW_START;
  let windowEnd = DEFAULT_WINDOW_END;
  let hasStart = false;
  let hasEnd = false;
  for (const rule of rules) {
    const start = parseRuleMinutes(rule.notBefore);
    if (start != null) {
      windowStart = hasStart ? Math.max(windowStart, start) : start;
      hasStart = true;
    }
    const end = parseRuleMinutes(rule.notAfter);
    if (end != null) {
      windowEnd = hasEnd ? Math.min(windowEnd, end) : end;
      hasEnd = true;
    }
  }
  return { windowStart, windowEnd };
}

function endsWithinWindow(end, windowEnd, timeZone, year, month, day) {
  const parts = zonedParts(end, timeZone);
  const endMinutes = parts.hour * 60 + parts.minute + parts.second / 60;
  const sameDay = parts.year === year && parts.month === month && parts.day === day;
  if (sameDay) return endMinutes <= windowEnd;
  // Ending at the next midnight counts as 24:00 of the start day
  if (windowEnd >= 24 * 60 && endMinutes === 0) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return (
      parts.year === next.getUTCFullYear() &&
      parts.month === next.getUTCMonth() + 1 &&
      parts.day === next.getUTCDate()
    );
  }
  return false;
}

export function findNextHole({
  durationMinutes,
  dueDate,
  rules = [],
  events = [],
  from = new Date(),
  timeZone = defaultTimeZone(),
}) {
  if (!(durationMinutes > 0)) {
    return { found: false, message: 'Duration must be greater than 0' };
  }

  const zone = isValidTimeZone(timeZone) ? timeZone : defaultTimeZone();
  const { windowStart, windowEnd } = dailyWindow(rules);

  const parsedDue = dueDate ? new Date(dueDate) : null;
  const due = parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue : null;
  const busy = events
    .map((event) => ({ start: new Date(event.start), end: new Date(event.end) }))
    .filter((event) => !Number.isNaN(event.start.getTime()) && !Number.isNaN(event.end.getTime()));

  const lastStart = windowEnd - durationMinutes;
  const fromParts = zonedParts(from, zone);

  for (let day = 0; day < HORIZON_DAYS; day++) {
    const cursor = new Date(Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day + day));
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const date = cursor.getUTCDate();

    for (let m = windowStart; m <= lastStart; m += STEP_MINUTES) {
      const start = zonedDateTime(year, month, date, Math.floor(m / 60), m % 60, 0, 0, zone);
      if (!start) continue; // civil time skipped by DST
      const end = new Date(start.getTime() + durationMinutes * 60000);

      if (start < from) continue; // already in the past
      if (due && end > due) continue; // would finish after the due date
      if (!endsWithinWindow(end, windowEnd, zone, year, month, date)) continue;
      if (busy.some((event) => overlaps(start, end, event.start, event.end))) continue;

      return { found: true, start, end };
    }
  }

  return { found: false, message: 'No open time this week or next' };
}
