// Week helpers. Everything works in the browser's local timezone.

export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 22

// Hours that start a row: 7, 8, ... 21. DAY_END_HOUR is only the bottom line.
export const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
)

// Day arithmetic uses setDate (not milliseconds) so DST changes don't shift days.
export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function addWeeks(date: Date, weeks: number) {
  return addDays(date, weeks * 7)
}

// Local midnight of the Monday on or before `date`.
export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(start, -((start.getDay() + 6) % 7))
}

export function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const monthDayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
})
const fullDateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})
const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })

export function formatWeekday(date: Date) {
  return weekdayFormat.format(date)
}

export function formatFullDate(date: Date) {
  return fullDateFormat.format(date)
}

// "7 AM" ... "10 PM"
export function formatHour(hour: number) {
  return hourFormat.format(new Date(2000, 0, 1, hour))
}

// "October 19 – October 25, 2026", or with both years when the week spans two.
export function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  if (weekStart.getFullYear() !== weekEnd.getFullYear()) {
    return `${fullDateFormat.format(weekStart)} – ${fullDateFormat.format(weekEnd)}`
  }
  return `${monthDayFormat.format(weekStart)} – ${fullDateFormat.format(weekEnd)}`
}
