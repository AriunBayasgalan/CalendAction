import { DAY_END_HOUR, DAY_START_HOUR, HOURS, isSameDay } from './week.ts'

export type CalendarEvent = {
  _id: string
  title: string
  start: string
  end: string
  location?: string
  notes?: string
}

export type PlacedEvent = {
  event: CalendarEvent
  start: Date
  end: Date
  // Fractions of the visible day: 0 is DAY_START_HOUR, 1 is DAY_END_HOUR.
  top: number
  height: number
  // Overlapping events sit side by side: this one is in `lane` out of `lanes`.
  lane: number
  lanes: number
  // Zero-minute events (start === end) have no height: they are drawn as a marker at `top`.
  instant: boolean
}

function hourOf(date: Date) {
  return date.getHours() + date.getMinutes() / 60
}

// Events that overlap `day` (so multi-day events show on every day they cover), clipped to
// the visible hours and split into lanes so overlapping events stay visible.
export function layoutDay(events: CalendarEvent[], day: Date) {
  const placed: PlacedEvent[] = []
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)

  for (const event of events) {
    const start = new Date(event.start)
    const end = new Date(event.end)
    const instant = start.getTime() === end.getTime()

    // A zero-minute event belongs to the day it happens on; others to every day they overlap.
    const onDay = instant
      ? start >= dayStart && start < dayEnd
      : start < dayEnd && end > dayStart
    if (!onDay) continue

    const from = Math.max(isSameDay(start, day) ? hourOf(start) : 0, DAY_START_HOUR)
    const to = isSameDay(end, day) ? Math.min(hourOf(end), DAY_END_HOUR) : DAY_END_HOUR

    if (instant) {
      // Outside the visible hours there is nowhere to draw the marker.
      if (hourOf(start) < DAY_START_HOUR || hourOf(start) > DAY_END_HOUR) continue
    } else if (to <= from) {
      continue
    }

    placed.push({
      event,
      start,
      end,
      top: (from - DAY_START_HOUR) / HOURS.length,
      height: instant ? 0 : (to - from) / HOURS.length,
      lane: 0,
      lanes: 1,
      instant,
    })
  }

  placed.sort((a, b) => a.start.getTime() - b.start.getTime())

  // A group is a run of events chained together by overlaps. Each event takes the
  // first lane that is free when it starts, and the whole group shares one lane count.
  let group: PlacedEvent[] = []
  let laneEnds: number[] = []
  let groupEnd = 0

  for (const item of placed) {
    if (item.start.getTime() >= groupEnd) {
      for (const member of group) member.lanes = laneEnds.length
      group = []
      laneEnds = []
    }

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.start.getTime())
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = item.end.getTime()
    item.lane = lane

    group.push(item)
    groupEnd = Math.max(groupEnd, item.end.getTime())
  }
  for (const member of group) member.lanes = laneEnds.length

  return placed
}

export type NewEvent = {
  title: string
  start: string
  end: string
  location?: string
  notes?: string
}

export type EventField = keyof NewEvent

export type ApiErrors = {
  form: string[]
  fields: Partial<Record<EventField, string>>
}

// Error body from the API, e.g. validationError (zod flattenError):
// { error: 'Validation failed', details: { end: ['End cannot be before start'] } }
type ErrorBody = {
  error?: string
  details?: Record<string, string[] | undefined>
}

const KNOWN_FIELDS: EventField[] = ['title', 'start', 'end', 'location', 'notes']

// Turns any non-2xx event response into messages the form can show.
export function readApiErrors(body: unknown, status: number): ApiErrors {
  const { error, details } = (body ?? {}) as ErrorBody
  const form: string[] = []
  const fields: ApiErrors['fields'] = {}

  for (const [key, messages] of Object.entries(details ?? {})) {
    const message = messages?.[0]
    if (!message) continue
    if ((KNOWN_FIELDS as string[]).includes(key)) fields[key as EventField] = message
    else form.push(`${key}: ${message}`)
  }

  // With field errors, `error` is just the "Validation failed" summary, so skip it.
  if (error && Object.keys(fields).length === 0) form.push(error)
  if (form.length === 0 && Object.keys(fields).length === 0) {
    form.push(`Something went wrong (${status}). Please try again.`)
  }
  return { form, fields }
}

// "YYYY-MM-DD" + "HH:MM" in the browser's timezone -> ISO string for the API.
// Throws a RangeError if the date or time is missing or invalid.
export function toIsoDateTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  // Date treats years 0-99 as 1900-1999, so a typed "26" would become 1926.
  // Read two-digit years as 20xx instead.
  const fullYear = year >= 0 && year < 100 ? 2000 + year : year
  return new Date(fullYear, month - 1, day, hours, minutes).toISOString()
}
