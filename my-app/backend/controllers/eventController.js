import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import Event from '../models/Event.js';


const dateValue = z
  .union([z.iso.datetime({ offset: true, local: true }), z.iso.date()], {
    error: 'Must put in a valid date',
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




const notFound = (res) => res.status(404).json({ error: "Not found" });

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
};

const validationError = (res, zodError) => {
  const { formErrors, fieldErrors } = z.flattenError(zodError);
  res.status(400).json({
    error: formErrors[0] || 'Validation failed',
    details: fieldErrors,
  });
};



export async function createEvent(req, res) {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const event = await Event.create({ ...parsed.data, owner: req.user.id });
    res.status(201).json(event);
  } catch (err) {
    serverError(res, err);
  }
}

export async function listEvents(req, res) {
    const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);

  const { from, to } = parsed.data;
  const conditions = [{ owner: req.user.id }];


  if (to) conditions.push({ start: { $lt: to } });
  if (from) {
    conditions.push({
      $or: [
        { end: { $gt: from } },     // started before "from" and still running from jan to feb
        { start: { $gte: from } },  // starts at/after "from" (covers 0-minute events)
      ],
    });
  }

  try {
    const list = await Event.find({ $and: conditions }).sort({ start: 1 });
    res.json(list);
  } catch (err) {
    serverError(res, err);
  }
}


export async function getEvent(req, res) {
  if (!isValidObjectId(req.params.id)) return notFound(res);

  try {
    const event = await Event.findOne({ _id: req.params.id, owner: req.user.id });
    if (!event) return notFound(res);
    res.json(event);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateEvent(req, res) {
  if (!isValidObjectId(req.params.id)) return notFound(res);

  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const existing = await Event.findOne({ _id: req.params.id, owner: req.user.id });
    if (!existing) return notFound(res);

   
    const start = parsed.data.start ?? existing.start;
    const end = parsed.data.end ?? existing.end;
    if (end < start) {
      return res
        .status(400)
        .json({ error: 'End must not be before start', details: { end: ['End must not be before start']},
        });
    }

    const updated = await Event.findOneAndUpdate(
      { _id: existing._id, owner: req.user.id }, 
      { $set: parsed.data },
      { new: true, runValidators: true }  
      // returns updated object and validates schema model -- does not run the pre validate hooks
    );
    if (!updated) return notFound(res);
    res.json(updated);
  } catch (err) {
    serverError(res, err);
  }
}

export async function deleteEvent(req, res) {
  if (!isValidObjectId(req.params.id)) return notFound(res);

  try {
    const result = await Event.deleteOne({ _id: req.params.id, owner: req.user.id });
    if (result.deletedCount === 0) return notFound(res);
    res.status(204).end();
  } catch (err) {
    serverError(res, err);
  }
}

