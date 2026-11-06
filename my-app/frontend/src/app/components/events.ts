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
}

function hourOf(date: Date) {
  return date.getHours() + date.getMinutes() / 60
}

// Events that start on `day`, clipped to the visible hours and split into lanes
// so overlapping events stay visible instead of covering each other.
export function layoutDay(events: CalendarEvent[], day: Date) {
  const placed: PlacedEvent[] = []

  for (const event of events) {
    const start = new Date(event.start)
    const end = new Date(event.end)
    if (!isSameDay(start, day)) continue

    const from = Math.max(hourOf(start), DAY_START_HOUR)
    const to = isSameDay(end, day) ? Math.min(hourOf(end), DAY_END_HOUR) : DAY_END_HOUR
    if (to <= from) continue

    placed.push({
      event,
      start,
      end,
      top: (from - DAY_START_HOUR) / HOURS.length,
      height: (to - from) / HOURS.length,
      lane: 0,
      lanes: 1,
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
