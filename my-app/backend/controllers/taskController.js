import { z } from 'zod';
import Task from '../models/Task.js';
import { dueDateEndOfDay, resolveTimeZone } from '../services/timeZone.js';
import { withOwnerLock } from '../services/ownerLock.js';
import { sendValidationError } from '../services/apiErrors.js';
import { hasValidId } from '../middleware/requireValidId.js';
import { markStarted } from '../services/startBlock.js';
import {
    MAX_SLOT_ATTEMPTS,
    NO_OPEN_TIME,
    findSlotForTask,
    overlapsOtherBlock,
    rePlaceOrUnschedule,
} from '../services/placement.js';

// Input validation
// Unexpected fields are stripped (Zod's default): they are ignored, not rejected.
// Text lengths are capped here and mirrored as maxlength in the Task model.
const TITLE_MAX = 200;
const TEXT_MAX = 2000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// dueDate must be an ISO date string ("2026-11-20" or "2026-11-20T17:00:00Z").
// A date-only value means end of that day (23:59:59.999) in the user's time zone.
// Datetimes are stored as the given instant. Numbers and other types are rejected.
// null means "no deadline".
const dueDateInput = (timeZone) =>
    z
        .union([z.iso.date(), z.iso.datetime({ offset: true })])
        .transform((value, ctx) => {
            if (DATE_ONLY.test(value)) {
                const end = dueDateEndOfDay.fromDateOnly(value, timeZone);
                if (!end) {
                    ctx.addIssue({ code: 'custom', message: 'Invalid due date' });
                    return z.NEVER;
                }
                return end;
            }
            return new Date(value);
        });

const taskInput = (timeZone) =>
    z.object({
        title: z.string().trim().min(1).max(TITLE_MAX),
        durationMinutes: z.number().int().positive(), // must be greater than 0
        dueDate: dueDateInput(timeZone).nullable().optional(),
        notes: z.string().max(TEXT_MAX).optional(),
        todoText: z.string().max(TEXT_MAX).optional(), // not trimmed: stored as entered
    });

// Updates may send only some fields, but at least one known field is required
const taskUpdate = (timeZone) =>
    taskInput(timeZone)
        .partial()
        .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

const readTimeZone = (req, res) => {
    const resolved = resolveTimeZone(req);
    if (resolved.error) {
        res.status(400).json({ error: resolved.error });
        return null;
    }
    return resolved.timeZone;
};

// Find one of the signed-in user's tasks; the query always includes owner
const findMyTask = (req) => {
    return Task.findOne({ _id: req.params.id, owner: req.user.id });
};

// CREATE  POST /tasks
export const createTask = async (req, res) => {
    const timeZone = readTimeZone(req, res);
    if (!timeZone) return;
    const parsed = taskInput(timeZone).safeParse(req.body);
    if (!parsed.success) {
        return sendValidationError(res, parsed.error, 'Invalid input');
    }
    const { dueDate, ...rest } = parsed.data;
    // null (or missing) dueDate means no deadline: leave the field unset
    const task = await Task.create({ ...rest, ...(dueDate ? { dueDate } : {}), owner: req.user.id });
    return res.status(201).json({ task });
};

// GET /tasks
export const listTasks = async (req, res) => {
    const tasks = await Task.find({ owner: req.user.id }).sort({ createdAt: -1 });
    return res.json({ tasks });
};

// GET /tasks/:id
export const getTask = async (req, res) => {
    const task = await findMyTask(req);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json({ task });
};

// UPDATE  PATCH /tasks/:id
export const updateTask = async (req, res) => {
    const timeZone = readTimeZone(req, res);
    if (!timeZone) return;
    const parsed = taskUpdate(timeZone).safeParse(req.body);
    if (!parsed.success) {
        return sendValidationError(res, parsed.error, 'Invalid input');
    }
    const task = await findMyTask(req);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { dueDate, ...rest } = parsed.data;
    const durationChanged =
        task.status === 'scheduled' &&
        rest.durationMinutes !== undefined &&
        rest.durationMinutes !== task.durationMinutes;
    // A new due date before the slot's end would leave the task scheduled after
    // its deadline. (Clearing the due date, or a later due date, keeps the slot.)
    const dueDateBeforeSlot =
        task.status === 'scheduled' &&
        dueDate &&
        task.end &&
        dueDate < task.end;
    Object.assign(task, rest);
    // dueDate: null clears the deadline, a date sets it, undefined leaves it alone
    if (dueDate !== undefined) task.dueDate = dueDate ?? undefined;

    // A duration change always unschedules; the Task model clears start/end.
    if (durationChanged) {
        task.status = 'unscheduled';
        await task.save();
        return res.json({ task });
    }

    // Due date now before the slot: try to re-place, and only unschedule if
    // no earlier hole fits. findSlotForTask ignores this task's own old slot.
    if (dueDateBeforeSlot) {
        const ownerId = req.user.id;
        try {
            return await withOwnerLock(ownerId, async () => {
                const result = await rePlaceOrUnschedule(task, timeZone, ownerId);
                return res.json(result.moved ? { task: result.task, moved: true } : { task: result.task });
            });
        } catch (error) {
            console.error('updateTask', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    await task.save();
    return res.json({ task });
};

// DELETE  DELETE /tasks/:id
export const deleteTask = async (req, res) => {
    const task = await findMyTask(req);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await task.deleteOne();
    return res.status(204).end();
};

// START  POST /tasks/:id/start (CA-25)
// Only a placed task has a block to start. The rules are in services/startBlock.js.
export const startTask = async (req, res) => {
    const timeZone = readTimeZone(req, res);
    if (!timeZone) return;
    const task = await findMyTask(req);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'scheduled') return res.status(400).json({ error: 'Task is not scheduled' });

    const result = await markStarted(Task, task, timeZone);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json(result.block);
};

export const placeTask = async (req, res) => {
    if (!hasValidId(req, res)) return;
    const timeZone = readTimeZone(req, res);
    if (!timeZone) return;
    const ownerId = req.user.id;

    try {
        // One place/skip at a time per user, so two requests can't pick the same slot
        return await withOwnerLock(ownerId, async () => {
            const task = await Task.findOne({ _id: req.params.id, owner: ownerId });
            if (!task) return res.status(404).json({ error: "Task not found" });
            if (task.status == 'scheduled') return res.status(400).json({ error: "Task is already scheduled" });

            for (let attempt = 0; attempt < MAX_SLOT_ATTEMPTS; attempt++) {
                const result = await findSlotForTask(task, timeZone, ownerId);
                if (!result.found) return res.status(409).json({ error: result.message });

                const updated = await Task.findOneAndUpdate(
                    { _id: task._id, owner: ownerId, status: 'unscheduled' },
                    { $set: { start: result.start, end: result.end, status: 'scheduled' } },
                    { returnDocument: "after", runValidators: true }
                );
                if (!updated) return res.status(409).json({ error: 'Task is already scheduled' });

                if (!(await overlapsOtherBlock(ownerId, task._id, result.start, result.end))) {
                    return res.json(updated);
                }

                // Another write took this slot at the same moment: give it back and try the next one
                await Task.findOneAndUpdate(
                    { _id: task._id, owner: ownerId, status: 'scheduled', start: result.start },
                    { $set: { status: 'unscheduled' }, $unset: { start: 1, end: 1 } }
                );
            }

            return res.status(409).json({ error: NO_OPEN_TIME });
        });
    } catch (error) {
        console.error('placeTask', error);
        return res.status(500).json({ error: "Server error" });
    }
}

export const skipTask = async (req, res) => {
    if (!hasValidId(req, res)) return;
    const timeZone = readTimeZone(req, res);
    if (!timeZone) return;
    const ownerId = req.user.id;

    try {
        // Shares the per-user lock with placeTask
        return await withOwnerLock(ownerId, async () => {
            const task = await Task.findOne({ _id: req.params.id, owner: ownerId });
            if (!task) return res.status(404).json({ error: "Task not found" });
            if (task.status == 'unscheduled') return res.status(400).json({ error: "Task is not scheduled" });
            const from = new Date(Math.max(task.end.getTime(), Date.now()));
            const filter = { _id: task._id, owner: ownerId, status: "scheduled" };

            for (let attempt = 0; attempt < MAX_SLOT_ATTEMPTS; attempt++) {
                const result = await findSlotForTask(task, timeZone, ownerId, from);
                if (!result.found) break;

                const updated = await Task.findOneAndUpdate(
                    filter,
                    { $set: { start: result.start, end: result.end } },
                    { returnDocument: "after", runValidators: true }
                );
                if (!updated) return res.status(409).json({ error: "Task changed, try again" });

                if (!(await overlapsOtherBlock(ownerId, task._id, result.start, result.end))) {
                    return res.json(updated);
                }
                // Another write took this slot at the same moment: try the next one.
                // The task's own (conflicting) slot is ignored by findSlotForTask.
            }

            // No later hole (or every try collided): back to "Needs a slot" (CA-19)
            const updated = await Task.findOneAndUpdate(
                filter,
                { $set: { status: "unscheduled" }, $unset: { start: 1, end: 1 } }, // removes start and end from the document
                { returnDocument: "after", runValidators: true }
            );
            if (!updated) return res.status(409).json({ error: "Task changed, try again" });
            return res.json(updated);
        });
    } catch (error) {
        console.error('skipTask', error);
        return res.status(500).json({ error: "Server error" });
    }
}
