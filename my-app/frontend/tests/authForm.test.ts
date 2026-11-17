import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  UNREACHABLE_MESSAGE,
  fieldErrorsFromApi,
  messageForAuthFailure,
  validateAuthFields,
} from '../src/app/authForm.ts'

test('validateAuthFields asks for an email and a password', () => {
  assert.deepEqual(validateAuthFields('  ', ''), {
    email: 'Enter your email.',
    password: 'Enter your password.',
  })
  assert.equal(validateAuthFields('not-an-email', 'secret').email, 'Enter a valid email address.')
  assert.equal(validateAuthFields('ada@example.com', 'x'.repeat(73)).password, 'Use 72 characters or fewer.')
  assert.deepEqual(validateAuthFields(' ada@example.com ', 'secret'), {})
})

test('fieldErrorsFromApi keeps email and password messages', () => {
  assert.deepEqual(
    fieldErrorsFromApi({
      error: 'Invalid input',
      details: [
        { field: 'email', message: 'Invalid email address' },
        { field: 'password', message: 'Too big' },
        { field: 'email', message: 'second email message is dropped' },
      ],
    }),
    { email: 'Invalid email address', password: 'Too big' },
  )
  assert.deepEqual(fieldErrorsFromApi({ error: 'Invalid email or password' }), {})
})

test('messageForAuthFailure explains bad credentials, a taken email, and a sleeping server', () => {
  assert.equal(
    messageForAuthFailure(401, { error: 'Invalid email or password' }, 'login'),
    'Invalid email or password',
  )
  assert.equal(messageForAuthFailure(409, { error: 'Email already registered' }, 'register'), 'Email already registered')
  assert.equal(messageForAuthFailure(503, null, 'login'), UNREACHABLE_MESSAGE)
  assert.equal(messageForAuthFailure(0, null, 'register'), UNREACHABLE_MESSAGE)
  assert.equal(messageForAuthFailure(500, {}, 'login'), 'Unable to log in.')
  assert.equal(messageForAuthFailure(500, { error: 'Server error' }, 'register'), 'Server error')
})
