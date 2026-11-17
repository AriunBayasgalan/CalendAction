import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import {
  readApiErrors,
  toIsoDateTime,
  type ApiErrors,
  type EventSaveResult,
  type NewEvent,
} from './events.ts'
import { toIsoDate } from './week.ts'
import Button from './ui/Button.tsx'
import Field from './ui/Field.tsx'
import styles from './AddEventDialog.module.css'

type AddEventDialogProps = {
  // Date the form starts on, e.g. today or the first day of the week being viewed.
  defaultDate: Date
  // Called with the saved event (and any tasks moved or unscheduled to make room).
  onCreated?: (event: EventSaveResult) => void
}

const NO_ERRORS: ApiErrors = { form: [], fields: {} }
// 16 weekly dates: the first day plus 15 more weeks.
const WEEKLY_SPAN = 15
const STATUS_MS = 5000

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text === '' ? undefined : text
}

function plusWeeks(isoDate: string, weeks: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return ''
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setDate(date.getDate() + weeks * 7)
  return toIsoDate(date)
}

function AddEventDialog({ defaultDate, onCreated }: AddEventDialogProps) {
  const { apiFetch, logout } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<ApiErrors>(NO_ERRORS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [repeat, setRepeat] = useState<'none' | 'weekly'>('none')
  const [date, setDate] = useState(() => toIsoDate(defaultDate))
  const [until, setUntil] = useState('')
  const [untilTouched, setUntilTouched] = useState(false)

  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(''), STATUS_MS)
    return () => clearTimeout(timer)
  }, [status])

  function open() {
    const nextDate = toIsoDate(defaultDate)
    formRef.current?.reset()
    setErrors(NO_ERRORS)
    setStatus('')
    setRepeat('none')
    setDate(nextDate)
    setUntil('')
    setUntilTouched(false)
    dialogRef.current?.showModal()
  }

  function close() {
    dialogRef.current?.close()
  }

  function chooseRepeat(next: 'none' | 'weekly') {
    setRepeat(next)
    if (next === 'weekly' && !untilTouched) setUntil(plusWeeks(date, WEEKLY_SPAN))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors(NO_ERRORS)
    setIsSubmitting(true)
    setStatus('')

    // Everything that can throw (including turning the form's date and time into an ISO
    // string, which fails for an incomplete or out-of-range date) is inside the try, so
    // "Saving..." can never get stuck.
    try {
      const formData = new FormData(event.currentTarget)
      const body: NewEvent = {
        title: String(formData.get('title') ?? ''),
        start: toIsoDateTime(date, String(formData.get('startTime'))),
        end: toIsoDateTime(date, String(formData.get('endTime'))),
        location: optional(formData.get('location')),
        notes: optional(formData.get('notes')),
        ...(repeat === 'weekly' ? { repeat: 'weekly', repeatUntil: until } : {}),
      }

      const response = await apiFetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      // Expired or invalid login: sign out like the rest of the app
      if (response.status === 401) {
        logout()
        return
      }
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        setErrors(readApiErrors(result, response.status))
        return
      }

      const created = result as EventSaveResult
      const times = created.repeated && created.repeated > 1 ? ` every week (${created.repeated} times)` : ''
      setStatus(`Added “${created.title}”${times}.`)
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
        <Button type="button" data-add-event onClick={open}>
          Add event
        </Button>
      </div>

      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="add-event-title">
        <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
          <h2 id="add-event-title" className={styles.title}>
            Add event
          </h2>

          <Field
            label="Name"
            name="title"
            placeholder="CS 2340, birthday party, meeting"
            required
            autoComplete="off"
            error={errors.fields.title}
          />
          <Field
            label="Date"
            name="date"
            type="date"
            required
            value={date}
            onChange={(change) => {
              setDate(change.target.value)
              if (repeat === 'weekly' && !untilTouched) setUntil(plusWeeks(change.target.value, WEEKLY_SPAN))
            }}
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
          <label className={styles.choice}>
            Repeats
            <select
              className={styles.select}
              name="repeat"
              value={repeat}
              onChange={(change) => chooseRepeat(change.target.value === 'weekly' ? 'weekly' : 'none')}
            >
              <option value="none">Does not repeat</option>
              <option value="weekly">Every week</option>
            </select>
          </label>
          {repeat === 'weekly' && (
            <Field
              label="Until"
              name="repeatUntil"
              type="date"
              required
              min={date}
              value={until}
              error={errors.fields.repeatUntil}
              hint="Same day and time each week, for up to 16 weeks."
              onChange={(change) => {
                setUntilTouched(true)
                setUntil(change.target.value)
              }}
            />
          )}
          <Field
            label="Location (optional)"
            name="location"
            placeholder="Room, park, address"
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
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save event'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  )
}

export default AddEventDialog
