import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import {
  readApiErrors,
  toIsoDateTime,
  type ApiErrors,
  type CalendarEvent,
  type NewEvent,
} from './events.ts'
import { toIsoDate } from './week.ts'
import Field from './ui/Field.tsx'
import styles from './AddClassDialog.module.css'

type AddClassDialogProps = {
  // Date the form starts on, e.g. today or the first day of the week being viewed.
  defaultDate: Date
  // Called with the saved event so the page can refresh what the grid shows.
  onCreated?: (event: CalendarEvent) => void
}

const NO_ERRORS: ApiErrors = { form: [], fields: {} }

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text === '' ? undefined : text
}

// How long the "Added ..." message stays before it clears
const STATUS_MS = 5000

function AddClassDialog({ defaultDate, onCreated }: AddClassDialogProps) {
  const { apiFetch } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<ApiErrors>(NO_ERRORS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  // Clear the "Added ..." message after a while so it doesn't linger
  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(''), STATUS_MS)
    return () => clearTimeout(timer)
  }, [status])

  function open() {
    formRef.current?.reset()
    setErrors(NO_ERRORS)
    setStatus('')
    dialogRef.current?.showModal()
  }

  function close() {
    dialogRef.current?.close()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors(NO_ERRORS)
    setIsSubmitting(true)

    // Everything that can throw (including turning the form's date and time into an ISO
    // string, which fails for an incomplete or out-of-range date) is inside the try, so
    // "Saving..." can never get stuck.
    try {
      const formData = new FormData(event.currentTarget)
      const date = String(formData.get('date'))
      const body: NewEvent = {
        title: String(formData.get('title') ?? ''),
        start: toIsoDateTime(date, String(formData.get('startTime'))),
        end: toIsoDateTime(date, String(formData.get('endTime'))),
        location: optional(formData.get('location')),
        notes: optional(formData.get('notes')),
      }

      const response = await apiFetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        setErrors(readApiErrors(result, response.status))
        return
      }

      const created = result as CalendarEvent
      setStatus(`Added “${created.title}”.`)
      onCreated?.(created)
      close()
    } catch (error) {
      const message =
        error instanceof RangeError
          ? 'Enter a valid date and time.'
          : 'Could not reach the server. Check your connection and try again.'
      setErrors({ form: [message], fields: {} })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className={styles.trigger}>
        <p className={styles.status} role="status">
          {status}
        </p>
        <button type="button" className={styles.primary} onClick={open}>
          Add class
        </button>
      </div>

      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="add-class-title">
        <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
          <h2 id="add-class-title" className={styles.title}>
            Add class
          </h2>

          <Field
            label="Name"
            name="title"
            placeholder="CS 2340"
            required
            autoComplete="off"
            error={errors.fields.title}
          />
          <Field
            label="Date"
            name="date"
            type="date"
            defaultValue={toIsoDate(defaultDate)}
            required
          />
          <div className={styles.row}>
            <Field
              label="Start"
              name="startTime"
              type="time"
              defaultValue="09:00"
              required
              error={errors.fields.start}
            />
            <Field
              label="End"
              name="endTime"
              type="time"
              defaultValue="10:15"
              required
              error={errors.fields.end}
            />
          </div>
          <Field
            label="Location (optional)"
            name="location"
            placeholder="Klaus 1443"
            error={errors.fields.location}
          />
          <Field label="Notes (optional)" name="notes" error={errors.fields.notes} />

          {errors.form.length > 0 && (
            <div className={styles.alert} role="alert">
              {errors.form.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={close}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save class'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}

export default AddClassDialog
