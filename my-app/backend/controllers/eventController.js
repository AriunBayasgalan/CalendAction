import { z } from 'zod';
import Event from '../models/Event.js';
import { sendValidationError } from '../services/apiErrors.js';
import { fetchEvents } from '../services/eventQuery.js';
import { withOwnerLock } from '../services/ownerLock.js';
import { defaultTimeZone, resolveTimeZone } from '../services/timeZone.js';
import { markStarted } from '../services/startBlock.js';
import {
  evictOverlappingTasks,
  findOverlappingEvent,
  overlapError,
} from '../services/placement.js';

export { fetchEvents };

const dateValue = z
  .union([z.iso.datetime({ offset: true, local: true }), z.iso.date()], {
    error: 'Enter a valid date',
  })
  .transform((s) => new Date(s));

const eventFields = z.object({
  title: z.string().trim().min(1).max(200),
  start: dateValue,
  end: dateValue,
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// set as true if end is correctly not before start
const endNotBeforeStart = (d) => !d.start || !d.end || d.end >= d.start;

const createEventSchema = eventFields
  .strict() // rejects unknown keys, so a client can't send `owner`
  .refine(endNotBeforeStart, { message: "End cannot be before start", path: ["end"] });

const updateEventSchema = eventFields
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" })
  .refine(endNotBeforeStart, { message: "End cannot be before start", path: ["end"] });

  const listQuerySchema = z
  .object({
    from: dateValue.optional(),
    to: dateValue.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "from must not be after to",
    path: ['to'],
  });




const notFound = (res) => res.status(404).json({ error: "Event not found" });

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
};

const validationError = (res, zodError) => sendValidationError(res, zodError, 'Validation failed');

const timeZoneOf = (req) => {
  const resolved = resolveTimeZone(req);
  return resolved.timeZone ?? defaultTimeZone();
};

function eventPayload(event, placements) {
  return {
    ...event.toJSON(),
    moved: placements.moved,
    unscheduled: placements.unscheduled,
  };
}



export async function createEvent(req, res) {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const ownerId = req.user.id;
  const timeZone = timeZoneOf(req);
  const { start, end } = parsed.data;

  try {
    return await withOwnerLock(ownerId, async () => {
      const clash = await findOverlappingEvent(ownerId, start, end);
      if (clash) {
        return res.status(409).json({ error: overlapError(clash, timeZone) });
      }

      const event = await Event.create({ ...parsed.data, owner: ownerId });
      const placements = await evictOverlappingTasks(ownerId, event, timeZone);
      res.status(201).json(eventPayload(event, placements));
    });
  } catch (err) {
    serverError(res, err);
  }
}

export async function listEvents(req, res) {
    const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const list = await fetchEvents(req.user.id, parsed.data);
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
}


export async function getEvent(req, res) {
  try {
    const event = await Event.findOne({ _id: req.params.id, owner: req.user.id });
    if (!event) return notFound(res);
    res.json(event);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateEvent(req, res) {
  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const ownerId = req.user.id;
  const timeZone = timeZoneOf(req);

  try {
    const existing = await Event.findOne({ _id: req.params.id, owner: ownerId });
    if (!existing) return notFound(res);

    const start = parsed.data.start ?? existing.start;
    const end = parsed.data.end ?? existing.end;
    if (end < start) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'end', message: 'End must not be before start' }],
      });
    }

    const timeChanged =
      (parsed.data.start !== undefined && +parsed.data.start !== +existing.start) ||
      (parsed.data.end !== undefined && +parsed.data.end !== +existing.end);

    if (!timeChanged) {
      const updated = await Event.findOneAndUpdate(
        { _id: existing._id, owner: ownerId },
        { $set: parsed.data },
        { returnDocument: "after", runValidators: true }
      );
      if (!updated) return notFound(res);
      return res.json(eventPayload(updated, { moved: [], unscheduled: [] }));
    }

    return await withOwnerLock(ownerId, async () => {
      const clash = await findOverlappingEvent(ownerId, start, end, existing._id);
      if (clash) {
        return res.status(409).json({ error: overlapError(clash, timeZone) });
      }

      const updated = await Event.findOneAndUpdate(
        { _id: existing._id, owner: ownerId },
        // A start belongs to one time slot (CA-25), so a new time clears it
        { $set: parsed.data, $unset: { startedAt: '' } },
        { returnDocument: "after", runValidators: true }
        // returns updated object and validates schema model -- does not run the pre validate hooks
      );
      if (!updated) return notFound(res);
      const placements = await evictOverlappingTasks(ownerId, updated, timeZone);
      res.json(eventPayload(updated, placements));
    });
  } catch (err) {
    serverError(res, err);
  }
}

// POST /events/:id/start (CA-25). The rules are in services/startBlock.js.
export async function startEvent(req, res) {
  try {
    const event = await Event.findOne({ _id: req.params.id, owner: req.user.id });
    if (!event) return notFound(res);
    const result = await markStarted(Event, event, timeZoneOf(req));
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.block);
  } catch (err) {
    serverError(res, err);
  }
}

export async function deleteEvent(req, res) {
  try {
    const result = await Event.deleteOne({ _id: req.params.id, owner: req.user.id });
    if (result.deletedCount === 0) return notFound(res);
    res.status(204).end();
  } catch (err) {
    serverError(res, err);
  }
}
