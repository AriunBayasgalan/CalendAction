import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eventKind } from '../src/app/components/events.ts'

test('events without a category still read as a class, and a task stays a task', () => {
  assert.equal(eventKind({}), 'Class')
  assert.equal(eventKind({ category: '  ' }), 'Class')
  assert.equal(eventKind({ category: 'Birthday' }), 'Birthday')
  assert.equal(eventKind({ isTask: true, category: 'Class' }), 'Task')
})
