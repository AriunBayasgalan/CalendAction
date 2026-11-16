// In-process async mutex keyed by owner id.
//
// Placing or skipping a task reads the owner's calendar, picks a free slot and
// writes it. Two requests for the same owner that interleave could both pick the
// same slot, so withOwnerLock runs them one at a time per owner. Different owners
// never wait on each other.
//
// This only serializes requests within one Node process. The controllers also
// recheck for overlaps after writing, which covers several server instances.

const tails = new Map(); // owner id -> promise that settles when the last queued job finishes

export async function withOwnerLock(ownerId, fn) {
  const key = String(ownerId);
  const previous = tails.get(key) ?? Promise.resolve();

  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  tails.set(key, tail);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    // Drop the entry once nobody else has queued behind us, so the map doesn't grow
    if (tails.get(key) === tail) tails.delete(key);
  }
}

// For tests: how many owners currently hold or wait on a lock
export function activeLockCount() {
  return tails.size;
}
