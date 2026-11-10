import { DAY_END_HOUR, DAY_START_HOUR, HOURS, isSameDay } from './week.ts'

export type CalendarEvent = {
  _id: string
  title: string
  start: string
  end: string
  location?: string
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
