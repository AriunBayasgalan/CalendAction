import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutDay, type CalendarEvent } from '../src/app/components/events.ts'
import { GRID_END_HOUR, GRID_START_HOUR, HOURS, SCROLL_TO_HOUR, pickVisibleDay, startOfWeek } from '../src/app/components/week.ts'

const day = new Date(2026, 10, 17) // local midnight, Tue Nov 17 2026

function block(id: string, start: Date, end: Date, isTask = false): CalendarEvent {
  return { _id: id, title: id, start: start.toISOString(), end: end.toISOString(), isTask }
}

test('the grid draws all 24 hours and opens at 7 AM', () => {
  assert.equal(GRID_START_HOUR, 0)
  assert.equal(GRID_END_HOUR, 24)
  assert.equal(HOURS.length, 24)
  assert.equal(SCROLL_TO_HOUR, 7)
})

test('a task placed at 3 AM is laid out on the grid', () => {
  const start = new Date(2026, 10, 17, 3, 0)
  const end = new Date(2026, 10, 17, 3, 45)
  const [placed] = layoutDay([block('early', start, end, true)], day)

  assert.ok(placed, 'the 3 AM block should be drawn')
  assert.equal(placed.top, 3 / 24)
  assert.equal(placed.height, 0.75 / 24)
})

test('a block running to midnight ends at the bottom of the grid', () => {
  const start = new Date(2026, 10, 17, 22, 30)
  const end = new Date(2026, 10, 18, 0, 0)
  const [placed] = layoutDay([block('late', start, end)], day)

  assert.ok(placed)
  assert.equal(placed.top, 22.5 / 24)
  assert.equal(placed.top + placed.height, 1)
})

test('a zero-minute marker at 5 AM is drawn', () => {
  const at = new Date(2026, 10, 17, 5, 0)
  const [placed] = layoutDay([block('marker', at, at)], day)

  assert.ok(placed)
  assert.equal(placed.instant, true)
  assert.equal(placed.top, 5 / 24)
})

test('pickVisibleDay uses today when it is in the week, otherwise Monday', () => {
  const tuesday = new Date(2026, 10, 17) // Tue Nov 17 2026
  const weekStart = startOfWeek(tuesday)
  const visible = pickVisibleDay(weekStart, tuesday)
  assert.equal(visible.getFullYear(), 2026)
  assert.equal(visible.getMonth(), 10)
  assert.equal(visible.getDate(), 17)

  const laterNow = new Date(2026, 10, 30)
  const monday = pickVisibleDay(weekStart, laterNow)
  assert.equal(monday.getDate(), 16) // Mon Nov 16
})
