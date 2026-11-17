import { countStart } from './streak.js';
import { dayContaining } from './timeZone.js';

export const NOT_ITS_DAY = 'A block can only be started on its own day';
export const BLOCK_CHANGED = 'This block changed, try again';

// Whether a block falls on `day` ({ start, end } from dayContaining): it overlaps the
// day, or, for a zero-minute block, happens on it. The week grid uses the same rule
// to decide which days to draw a block on (frontend events.ts isOnDay).
export function isOnDay(block, day) {
    return block.start < day.end && (block.end > day.start || block.start >= day.start);
}

// Start rules (CA-25), for a class or a placed task the caller already found:
// - Only the first Start counts. A started block is returned unchanged.
// - Start works only on the block's own day in the user's time zone, so the streak
//   (CA-28) can't be filled in ahead of time or a missed day made up afterwards.
// - A start belongs to one time slot. Moving the block clears startedAt (see the Task
//   model hooks and updateEvent).
// - The first Start of a block counts toward the streak (CA-28, services/streak.js).
// Returns { block } on success, or { status, error } for the caller to send.
export async function markStarted(Model, block, timeZone, now = new Date()) {
    if (block.startedAt) return { block };
    if (!isOnDay(block, dayContaining(now, timeZone))) return { status: 400, error: NOT_ITS_DAY };

    const filter = { _id: block._id, owner: block.owner };
    // Matching start and end too: a block moved since the caller read it is not started
    const started = await Model.findOneAndUpdate(
        { ...filter, start: block.start, end: block.end, startedAt: null },
        { $set: { startedAt: now } },
        { returnDocument: 'after' }
    );
    if (started) {
        try {
            await countStart(block.owner, timeZone, now);
        } catch (error) {
            // The block is started either way; a failed streak update shouldn't report a failed Start
            console.error('countStart', error);
        }
        return { block: started };
    }

    // Another request got there first: fine if it started the block, not if it moved it
    const current = await Model.findOne(filter);
    if (current?.startedAt) return { block: current };
    return { status: 409, error: BLOCK_CHANGED };
}
