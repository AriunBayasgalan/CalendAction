// Converts a time into minutes after midnight (630)
export function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// True if two time ranges overlap
export function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}
const STEP_MINUTES = 15; // try a new start time every 15 minutes
const HORIZON_DAYS = 14; // this week and next

export function findNextHole({
  durationMinutes,
  dueDate,
  rules = [],
  events = [],
  from = new Date(),
}) {
  if (!(durationMinutes > 0)) {
    return { found: false, message: "Duration must be greater than 0" };
  }

  // Combine all rules into one allowed window of the day:
  // the latest notBefore and the earliest notAfter
  let windowStart = 0;
  let windowEnd = 24 * 60;
  for (const rule of rules) {
    windowStart = Math.max(windowStart, toMinutes(rule.notBefore));
    windowEnd = Math.min(windowEnd, toMinutes(rule.notAfter));
  }

  const due = dueDate ? new Date(dueDate) : null;
  const busy = events.map((e) => ({
    start: new Date(e.start),
    end: new Date(e.end),
  }));

  //\latest start that still ends by notAfter
  const lastStart = windowEnd - durationMinutes;

  for (let day = 0; day < HORIZON_DAYS; day++) {
    for (let m = windowStart; m <= lastStart; m += STEP_MINUTES) {
      const start = new Date(
        from.getFullYear(),
        from.getMonth(),
        from.getDate() + day,
        0,
        m,
      );
      const end = new Date(start.getTime() + durationMinutes * 60000);

      if (start < from) continue; // already in the past
      if (due && end > due) continue; // would finish after the due date
      if (busy.some((e) => overlaps(start, end, e.start, e.end))) continue;

      return { found: true, start, end };
    }
  }

  return { found: false, message: "No open time this week or next" };
}