import Event from '../models/Event.js';
import Rule from '../models/rule.model.js';
import Task from '../models/Task.js';
import { fetchEvents } from './eventQuery.js';
import { findNextHole } from './findNextHole.js';
import { defaultTimeZone } from './timeZone.js';

// How many slots place/skip/re-place try when a write turns out to overlap
// something another request wrote at the same moment.
export const MAX_SLOT_ATTEMPTS = 3;
export const NO_OPEN_TIME = 'No open time this week or next';

export async function findSlotForTask(task, timeZone, ownerId, from = new Date()) {
  const to = new Date(from);
  to.setDate(to.getDate() + 15);

  const [events, scheduled, rules] = await Promise.all([
    fetchEvents(ownerId, { from, to }),
    Task.find({
      owner: ownerId,
      status: 'scheduled',
      _id: { $ne: task._id }, // leaves the task's own old slot out
      end: { $gt: from },
    }),
    Rule.find({ owner: ownerId }),
  ]);

  return findNextHole({
    durationMinutes: task.durationMinutes,
    dueDate: task.dueDate,
    rules,
    events: [...events, ...scheduled],
    from,
    timeZone,
  });
}

// True if [start, end) overlaps another scheduled task or an event of this owner.
// Runs after a write, to catch a conflicting write that raced this one (e.g. from
// another server instance, which the in-process lock can't see).
export async function overlapsOtherBlock(ownerId, taskId, start, end) {
  const [task, event] = await Promise.all([
    Task.exists({
      owner: ownerId,
      status: 'scheduled',
      _id: { $ne: taskId },
      start: { $lt: end },
      end: { $gt: start },
    }),
    Event.exists({ owner: ownerId, start: { $lt: end }, end: { $gt: start } }),
  ]);
  return Boolean(task || event);
}

// Caller must already hold withOwnerLock(ownerId). Tries to keep the task
// scheduled in a new hole; unschedules it if nothing fits.
export async function rePlaceOrUnschedule(task, timeZone, ownerId) {
  for (let attempt = 0; attempt < MAX_SLOT_ATTEMPTS; attempt++) {
    const result = await findSlotForTask(task, timeZone, ownerId);
    if (!result.found) break;

    task.start = result.start;
    task.end = result.end;
    task.status = 'scheduled';
    await task.save();

    if (!(await overlapsOtherBlock(ownerId, task._id, result.start, result.end))) {
      return { moved: true, task };
    }
    // Another write took this slot at the same moment: try the next one.
  }

  task.status = 'unscheduled';
  await task.save();
  return { moved: false, task };
}

// [start, end) overlap; adjacent times (end === start) are allowed.
export function findOverlappingEvent(ownerId, start, end, exceptId) {
  return Event.findOne({
    owner: ownerId,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    start: { $lt: end },
    end: { $gt: start },
  }).sort({ start: 1 });
}

export function findOverlappingScheduledTasks(ownerId, start, end) {
  return Task.find({
    owner: ownerId,
    status: 'scheduled',
    start: { $lt: end },
    end: { $gt: start },
  }).sort({ start: 1 });
}

export function overlapError(event, timeZone = defaultTimeZone()) {
  const startFmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
  const endFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
  return `Overlaps ${event.title} (${startFmt.format(event.start)}–${endFmt.format(event.end)})`;
}

// Caller must already hold withOwnerLock(ownerId). The event should already be saved
// so findSlotForTask treats it as busy.
export async function evictOverlappingTasks(ownerId, event, timeZone) {
  const tasks = await findOverlappingScheduledTasks(ownerId, event.start, event.end);
  const moved = [];
  const unscheduled = [];
  for (const task of tasks) {
    const result = await rePlaceOrUnschedule(task, timeZone, ownerId);
    if (result.moved) {
      moved.push({ title: result.task.title, start: result.task.start, end: result.task.end });
    } else {
      unscheduled.push({ title: result.task.title });
    }
  }
  return { moved, unscheduled };
}
