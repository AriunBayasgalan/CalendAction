import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstErrorMessage, parseApiError, readErrorMessage } from '../src/app/components/apiErrors.ts'
import { readApiErrors } from '../src/app/components/events.ts'

const json = (body: unknown, status = 400) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('readApiErrors puts field errors next to their inputs', () => {
  const errors = readApiErrors(
    {
      error: 'Validation failed',
      details: [
        { field: 'end', message: 'End must not be before start' },
        { field: 'title', message: 'Too small' },
        { field: 'title', message: 'second title message is dropped' },
      ],
    },
    400,
  )
  assert.deepEqual(errors.fields, { end: 'End must not be before start', title: 'Too small' })
  assert.deepEqual(errors.form, [])
})

test('readApiErrors shows unknown fields and summaries at the top of the form', () => {
  assert.deepEqual(readApiErrors({ error: 'Validation failed', details: [{ field: 'owner', message: 'Nope' }] }, 400), {
    form: ['owner: Nope', 'Validation failed'],
    fields: {},
  })
  assert.deepEqual(readApiErrors({ error: 'No fields to update' }, 400), { form: ['No fields to update'], fields: {} })
  assert.deepEqual(readApiErrors(null, 502), { form: ['Something went wrong (502). Please try again.'], fields: {} })
})

test('parseApiError ignores bodies that are not the documented shape', () => {
  assert.deepEqual(parseApiError('500 Internal server error'), { details: [] })
  assert.deepEqual(parseApiError({ error: 42, details: { end: ['old shape'] } }), { error: undefined, details: [] })
})

test('firstErrorMessage prefers the first field message, then the summary', () => {
  assert.equal(
    firstErrorMessage({ error: 'Invalid input', details: [{ field: 'email', message: 'Invalid email address' }] }, 'x'),
    'Invalid email address',
  )
  assert.equal(firstErrorMessage({ error: 'Invalid email or password' }, 'x'), 'Invalid email or password')
  assert.equal(firstErrorMessage({}, 'Unable to authenticate.'), 'Unable to authenticate.')
})

test('readErrorMessage reads JSON errors and falls back for anything else', async () => {
  assert.equal(
    await readErrorMessage(json({ error: 'Invalid rule', details: [{ field: 'notAfter', message: 'Too early' }] }), 'f'),
    'Too early',
  )
  assert.equal(await readErrorMessage(json({ error: 'Server error' }, 500), 'Could not save task.'), 'Server error')
  assert.equal(
    await readErrorMessage(new Response('<html>bad gateway</html>', { status: 502 }), 'Could not save task.'),
    'Could not save task.',
  )
})
