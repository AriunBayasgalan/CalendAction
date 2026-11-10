import mongoose from 'mongoose';
import { z } from 'zod';
import Task from '../models/Task.js';

// 1) 입력 검증 규칙
// Unexpected fields are stripped (Zod's default): they are ignored, not rejected.
// Text lengths are capped here and mirrored as maxlength in the Task model.
const TITLE_MAX = 200;
const TEXT_MAX = 2000;

// dueDate must be an ISO date string ("2026-11-20" or "2026-11-20T17:00:00Z").
// Numbers and other types are rejected. null means "no deadline".
const dueDateInput = z
    .union([z.iso.date(), z.iso.datetime({ offset: true })])
    .transform((value) => new Date(value));

const taskInput = z.object({
    title: z.string().trim().min(1).max(TITLE_MAX),
    durationMinutes: z.number().int().positive(), // 0보다 커야 함
    dueDate: dueDateInput.nullable().optional(),
    notes: z.string().max(TEXT_MAX).optional(),
    todoText: z.string().max(TEXT_MAX).optional(), // trim 없음: 입력한 그대로 저장
});

// 수정할 때는 일부 필드만 보내도 되게 (but at least one known field is required)
const taskUpdate = taskInput
    .partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

// 2) 내 task 하나 찾기 (owner까지 같이 조건에 넣는 게 핵심)
const findMyTask = (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) return null;
    return Task.findOne({ _id: req.params.id, owner: req.user.id });
};

// CREATE  POST /tasks
export const createTask = async (req, res) => {
    const parsed = taskInput.safeParse(req.body);
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
    const parsed = taskUpdate.safeParse(req.body);
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