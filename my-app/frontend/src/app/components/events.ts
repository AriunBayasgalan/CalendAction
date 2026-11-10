// Event API types and helpers. Matches backend/controllers/eventController.js.

export type CalendarEvent = {
  _id: string
  title: string
  start: string
  end: string
  location?: string
  notes?: string
}

export type NewEvent = {
  title: string
  start: string
  end: string
  location?: string
  notes?: string
}

export type EventField = keyof NewEvent

export type ApiErrors = {
  form: string[]
  fields: Partial<Record<EventField, string>>
}

// Error body from the API, e.g. validationError (zod flattenError):
// { error: 'Validation failed', details: { end: ['End cannot be before start'] } }
type ErrorBody = {
  error?: string
  details?: Record<string, string[] | undefined>
}

const KNOWN_FIELDS: EventField[] = ['title', 'start', 'end', 'location', 'notes']

// Turns any non-2xx event response into messages the form can show.
export function readApiErrors(body: unknown, status: number): ApiErrors {
  const { error, details } = (body ?? {}) as ErrorBody
  const form: string[] = []
  const fields: ApiErrors['fields'] = {}

  for (const [key, messages] of Object.entries(details ?? {})) {
    const message = messages?.[0]
    if (!message) continue
    if ((KNOWN_FIELDS as string[]).includes(key)) fields[key as EventField] = message
    else form.push(`${key}: ${message}`)
  }

  // With field errors, `error` is just the "Validation failed" summary, so skip it.
  if (error && Object.keys(fields).length === 0) form.push(error)
  if (form.length === 0 && Object.keys(fields).length === 0) {
    form.push(`Something went wrong (${status}). Please try again.`)
  }
  return { form, fields }
}

// "YYYY-MM-DD" + "HH:MM" in the browser's timezone -> ISO string for the API.
export function toIsoDateTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}
