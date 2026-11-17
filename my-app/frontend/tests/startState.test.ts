import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOnDay, startState, type CalendarEvent } from '../src/app/components/events.ts'

// Local times, Tue Nov 17 2026 at 9:30 AM
const now = new Date(2026, 10, 17, 9, 30)

function block(start: Date, end: Date, startedAt?: Date): CalendarEvent {
  return {
    _id: 'b',
    title: 'Block',
    start: start.toISOString(),
    end: end.toISOString(),
    startedAt: startedAt?.toISOString(),
  }
}

test("a block later today can be started, even before its start time", () => {
  assert.equal(startState(block(new Date(2026, 10, 17, 14), new Date(2026, 10, 17, 15)), now), 'ready')
})

test('a block that already ended today can still be started', () => {
  assert.equal(startState(block(new Date(2026, 10, 17, 7), new Date(2026, 10, 17, 8)), now), 'ready')
})

test('a block on a later day is upcoming, one on an earlier day is missed', () => {
  assert.equal(startState(block(new Date(2026, 10, 18, 9), new Date(2026, 10, 18, 10)), now), 'upcoming')
  assert.equal(startState(block(new Date(2026, 10, 16, 9), new Date(2026, 10, 16, 10)), now), 'missed')
})

test('a started block stays started, whatever day it is', () => {
  const yesterday = block(new Date(2026, 10, 16, 9), new Date(2026, 10, 16, 10), new Date(2026, 10, 16, 9, 2))
  assert.equal(startState(yesterday, now), 'started')
})

test('isOnDay: overlaps count, touching midnight does not, zero-minute blocks count on their day', () => {
  const midnight = new Date(2026, 10, 17)
  const nextMidnight = new Date(2026, 10, 18)
  const lateYesterday = new Date(2026, 10, 16, 23)

  assert.equal(isOnDay(lateYesterday, new Date(2026, 10, 17, 1), now), true, 'runs past midnight into today')
  assert.equal(isOnDay(lateYesterday, midnight, now), false, 'ends exactly at midnight')
  assert.equal(isOnDay(nextMidnight, new Date(2026, 10, 18, 1), now), false, 'starts at the next midnight')
  assert.equal(isOnDay(midnight, midnight, now), true, 'zero-minute block at midnight')
  assert.equal(isOnDay(nextMidnight, nextMidnight, now), false, 'zero-minute block at the next midnight')
})
