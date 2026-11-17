import Event from '../models/Event.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { dayContaining, endOfDayInTimeZone, zonedParts } from './timeZone.js';

/*
 * Streak rule (CA-28). Keep this and the issue's "Streak rule" section the same.
 *
 * Days are calendar days in the user's time zone. A block is a class or a placed task.
 *
 *   1. Starting a block adds 1 to the streak. Only the first Start of a day counts.
 *   2. The streak goes back to 0 after a day that had blocks planned but none started.
 *   3. Nothing else changes it. A day with no blocks neither adds to it nor breaks it.
 *
 * Start only works on a block's own day (CA-25), so a missed day can't be made up later.
 *
 * How it works: User.streak is { count, lastDay }, where lastDay is the last day a Start
 * counted. No day after lastDay had a Start, so rule 2 only needs to find one block that
 * began after lastDay and was over before today without being started. That check runs
 * whenever the streak is read or a Start is counted, so a missed day is caught even if
 * the app wasn't opened the day after.
 */

const pad = (n) => String(n).padStart(2, '0');

// "2026-11-16": the calendar day `date` falls on in `timeZone`
export function dayKey(date, timeZone) {
    const { year, month, day } = zonedParts(date, timeZone);
    return `${year}-${pad(month)}-${pad(day)}`;
}

// Rule 2: reset the streak if a day between lastDay and today had a block nobody started
async function settle(ownerId, timeZone, now) {
    const user = await User.findById(ownerId, 'streak');
    const lastDay = user?.streak?.lastDay;
    if (!lastDay) return;

    const [year, month, day] = lastDay.split('-').map(Number);
    const endOfLastDay = endOfDayInTimeZone(year, month, day, timeZone);
    if (!endOfLastDay) return;
    const from = new Date(endOfLastDay.getTime() + 1); // start of the day after lastDay
    const to = dayContaining(now, timeZone).start; // start of today
    if (from >= to) return; // lastDay is yesterday or today, so no day to check

    // A block still running today can still be started, so only finished ones count
    const missed = { owner: ownerId, startedAt: null, start: { $gte: from, $lt: to }, end: { $lte: to } };
    const [missedClass, missedTask] = await Promise.all([
        Event.exists(missed),
        Task.exists({ ...missed, status: 'scheduled' }),
    ]);
    if (!missedClass && !missedTask) return;

    // Matching lastDay means a Start counted in the meantime isn't wiped out
    await User.updateOne(
        { _id: ownerId, 'streak.lastDay': lastDay },
        { $set: { 'streak.count': 0 }, $unset: { 'streak.lastDay': '' } }
    );
}

// The current streak, for GET /streak. Returns null if the user no longer exists.
export async function getStreak(ownerId, timeZone, now = new Date()) {
    await settle(ownerId, timeZone, now);
    const user = await User.findById(ownerId, 'streak');
    if (!user) return null;
    const { count = 0, lastDay } = user.streak ?? {};
    return { count, countedToday: lastDay === dayKey(now, timeZone) };
}

// Rule 1. Called by markStarted (startBlock.js) after a block's first Start.
export async function countStart(ownerId, timeZone, now = new Date()) {
    await settle(ownerId, timeZone, now);
    const today = dayKey(now, timeZone);
    // Matching on lastDay keeps this to once a day, even for two Starts at the same moment
    await User.updateOne(
        { _id: ownerId, 'streak.lastDay': { $ne: today } },
        { $inc: { 'streak.count': 1 }, $set: { 'streak.lastDay': today } }
    );
}
