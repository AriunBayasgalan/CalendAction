import { nagCopy } from './nagCopy.ts'

// A nag is due when a block starts in the next 15 minutes (not already started).
export const NAG_WINDOW_MS = 15 * 60 * 1000
export const DISMISS_STORAGE_KEY = 'calendaction.nagDismissed'

export type NagBlock = {
  _id: string
  title: string
  start: string
}

export function msUntilStart(block: { start: string }, now: Date) {
  return new Date(block.start).getTime() - now.getTime()
}

export function isStartingSoon(block: { start: string }, now: Date) {
  const ms = msUntilStart(block, now)
  return ms > 0 && ms <= NAG_WINDOW_MS
}

export function dismissId(block: { _id: string; start: string }) {
  return `${block._id}:${block.start}`
}

export function findSoonBlock<T extends NagBlock>(
  blocks: T[],
  now: Date,
  dismissed: ReadonlySet<string>,
): T | null {
  const soon = blocks
    .filter((block) => isStartingSoon(block, now) && !dismissed.has(dismissId(block)))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
  return soon[0] ?? null
}

// Pick one canned starting-soon line. The same block always gets the same line.
export function pickStartingSoonLine(block: { _id: string }) {
  const lines = nagCopy.startingSoon
  let hash = 0
  for (const ch of block._id) hash = (hash + ch.charCodeAt(0)) % lines.length
  return lines[hash] ?? lines[0]
}

export function readDismissed(storage: Pick<Storage, 'getItem'>): Set<string> {
  try {
    const raw = storage.getItem(DISMISS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

export function writeDismissed(storage: Pick<Storage, 'setItem'>, dismissed: ReadonlySet<string>) {
  storage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...dismissed]))
}
