import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streakHint, streakLabel } from '../src/app/components/streak.ts'

test('the badge names the streak in days, or says there is none', () => {
  assert.equal(streakLabel({ count: 0, countedToday: false }), 'No streak yet')
  assert.equal(streakLabel({ count: 1, countedToday: true }), '1-day streak')
  assert.equal(streakLabel({ count: 12, countedToday: false }), '12-day streak')
})

test('the hint says whether today still needs a Start', () => {
  assert.equal(streakHint({ count: 3, countedToday: true }), 'Today counts toward your streak.')
  assert.match(streakHint({ count: 3, countedToday: false }), /^Start a block today/)
})
