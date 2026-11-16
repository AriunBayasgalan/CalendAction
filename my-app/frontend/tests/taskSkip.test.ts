import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placedFormat, scheduledTasks, skipMessage } from '../src/app/components/tasks.ts'
import type { Task } from '../src/app/components/TaskForm.tsx'

function task(overrides: Partial<Task>): Task {
  return {
    _id: 'a',
    title: 'Essay',
    durationMinutes: 60,
    todoText: '',
    status: 'unscheduled',
    ...overrides,
  }
}

test('skipMessage shows the new time when the task moved to a later slot', () => {
  const start = '2026-11-12T19:00:00.000Z'
  const moved = task({ status: 'scheduled', start, end: '2026-11-12T20:00:00.000Z' })

  assert.equal(skipMessage(moved), `Moved “Essay” to ${placedFormat.format(new Date(start))}.`)
})

test('skipMessage says the task is back in Needs a slot when no later hole exists', () => {
  const unscheduled = task({ status: 'unscheduled' })

  assert.equal(skipMessage(unscheduled), 'No later open time, so “Essay” is back in Needs a slot.')
})

test('scheduledTasks keeps only placed tasks, earliest first', () => {
  const later = task({
    _id: 'later',
    status: 'scheduled',
    start: '2026-11-13T15:00:00.000Z',
    end: '2026-11-13T16:00:00.000Z',
  })
  const sooner = task({
    _id: 'sooner',
    status: 'scheduled',
    start: '2026-11-12T15:00:00.000Z',
    end: '2026-11-12T16:00:00.000Z',
  })
  const unplaced = task({ _id: 'unplaced' })
  const missingTimes = task({ _id: 'missing', status: 'scheduled' })

  const ids = scheduledTasks([later, unplaced, sooner, missingTimes]).map((t) => t._id)

  assert.deepEqual(ids, ['sooner', 'later'])
})
