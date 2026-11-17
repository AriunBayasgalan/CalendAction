import { firstErrorMessage, parseApiError } from './components/apiErrors.ts'

export type AuthMode = 'login' | 'register'

export type AuthFieldErrors = {
  email?: string
  password?: string
}

export const UNREACHABLE_MESSAGE =
  'Could not reach the server. It may be waking up, which can take up to a minute. Check your connection and try again.'

export const SLOW_SERVER_HINT = 'Still connecting. The server can take up to a minute to wake up.'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateAuthFields(email: string, password: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  const trimmed = email.trim()

  if (!trimmed) errors.email = 'Enter your email.'
  else if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Enter your password.'
  else if (password.length > 72) errors.password = 'Use 72 characters or fewer.'

  return errors
}

export function fieldErrorsFromApi(body: unknown): AuthFieldErrors {
  const { details } = parseApiError(body)
  const errors: AuthFieldErrors = {}
  for (const detail of details) {
    if (detail.field === 'email' || detail.field === 'password') {
      errors[detail.field] ??= detail.message
    }
  }
  return errors
}

export function isUnreachableError(error: unknown) {
  return error instanceof TypeError
}

// Status 0 is a failed fetch. 502/503/504 are the usual cold-start and proxy failures.
export function messageForAuthFailure(status: number, body: unknown, mode: AuthMode) {
  if (status === 0 || status === 502 || status === 503 || status === 504) return UNREACHABLE_MESSAGE
  if (status === 401) return firstErrorMessage(body, 'Invalid email or password.')
  if (status === 409) return firstErrorMessage(body, 'That email is already registered.')
  const fallback = mode === 'login' ? 'Unable to log in.' : 'Unable to create your account.'
  return firstErrorMessage(body, fallback)
}
