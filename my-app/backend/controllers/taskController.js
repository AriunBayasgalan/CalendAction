import mongoose from 'mongoose';
import { z } from 'zod';
import Task from '../models/Task.js';
import { findNextHole } from '../services/findNextHole.js';
import { fetchEvents } from './eventController.js';
import Rule from '../models/rule.model.js';
import { dueDateEndOfDay, resolveTimeZone } from '../services/timeZone.js';

// 1) 입력 검증 규칙
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
        durationMinutes: z.number().int().positive(), // 0보다 커야 함
        dueDate: dueDateInput(timeZone).nullable().optional(),
        notes: z.string().max(TEXT_MAX).optional(),
        todoText: z.string().max(TEXT_MAX).optional(), // trim 없음: 입력한 그대로 저장
    });

// 수정할 때는 일부 필드만 보내도 되게 (but at least one known field is required)
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

// 2) 내 task 하나 찾기 (owner까지 같이 조건에 넣는 게 핵심)
const findMyTask = (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) return null;
    return Task.findOne({ _id: req.params.id, owner: req.user.id });
};

// CREATE  POST /tasks
export const createTask = async (req, res) => {
    const timeZone = readTimeZone(req, res);
    if (!timeZone) return;
    const parsed = taskInput(timeZone).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: z.treeifyError(parsed.error) });
    }
    const { dueDate, ...rest } = parsed.data;
    // null (or missing) dueDate means no deadline: leave the field unset
    const task = await Task.create({ ...rest, ...(dueDate ? { dueDate } : {}), owner: req.user.id });
    return res.status(201).json({ task });
};

// READ 목록  GET /tasks
export const listTasks = async (req, res) => {
    const tasks = await Task.find({ owner: req.user.id }).sort({ createdAt: -1 });
    return res.json({ tasks });
};

// READ 하나  GET /tasks/:id
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
        return res.status(400).json({ error: 'Invalid input', details: z.treeifyError(parsed.error) });
    }
    const task = await findMyTask(req);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { dueDate, ...rest } = parsed.data;
    Object.assign(task, rest);
    // dueDate: null clears the deadline, a date sets it, undefined leaves it alone
    if (dueDate !== undefined) task.dueDate = dueDate ?? undefined;
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

export async function findSlotForTask(task, timeZone, ownerId, from = new Date()) {
  const to = new Date(from);
  to.setDate(to.getDate() + 15);

  const [events, scheduled, rules] = await Promise.all([
    fetchEvents(ownerId, { from, to }),
    Task.find({
      owner: ownerId,
      status: "scheduled",
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

export const placeTask = async(req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid ID" });
    try {
        const timeZone = readTimeZone(req, res);
        if (!timeZone) return;

        const task = await Task.findOne({ _id: req.params.id, owner: req.user.id });
        if (!task) return res.status(404).json({ error: "Task not found"});
        if (task.status == 'scheduled') return res.status(400).json({error: "Task is already scheduled"});

        const result = await findSlotForTask(task, timeZone, req.user.id);
        if (!result.found) {
        return res.status(409).json({ error: result.message });
        }
        const updated = await Task.findOneAndUpdate(
            { _id: task._id, owner: req.user.id, status: 'unscheduled' },
            { $set: { start: result.start, end: result.end, status: 'scheduled' } },
            { new: true, runValidators: true }
        );

        if (!updated) {
        return res.status(409).json({ error: 'Task is already scheduled' });
        }

        return res.json(updated);

    } catch (error) {
        return res.status(500).json({error: "Server error"});
    }

}

export const skipTask = async(req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid ID" });
    try {
        const timeZone = readTimeZone(req, res);
        if (!timeZone) return;

        const task = await Task.findOne({ _id: req.params.id, owner: req.user.id });
        if (!task) return res.status(404).json({ error: "Task not found"});
        if (task.status == 'unscheduled') return res.status(400).json({error: "Task is not scheduled"});
        const from = new Date(Math.max(task.end.getTime(), Date.now()));

        const result = await findSlotForTask(task, timeZone, req.user.id, from);
        const filter = { _id: task._id, owner: req.user.id, status: "scheduled" };
        const update = result.found
        ? { $set: { start: result.start, end: result.end } }
        : { $set: { status: "unscheduled" }, $unset: { start: 1, end: 1 } }; // removes start and end from the document

        const updated = await Task.findOneAndUpdate(filter, update, {
            new: true,
            runValidators: true,
            });
        if (!updated) {
        return res.status(409).json({ error: "Task changed, try again" });
        }
        return res.json(updated);

    }
    catch (error) {
        return res.status(500).json({error: "Server error"});
    }
}
