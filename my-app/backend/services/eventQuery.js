import Event from '../models/Event.js';

export async function fetchEvents(ownerId, { from, to } = {}) {
  const conditions = [{ owner: ownerId }];

  if (to) conditions.push({ start: { $lt: to } });
  if (from) {
    conditions.push({
      $or: [
        { end: { $gt: from } },
        { start: { $gte: from } },
      ],
    });
  }

  return Event.find({ $and: conditions }).sort({ start: 1 });
}
