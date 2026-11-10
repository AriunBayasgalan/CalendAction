import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import { readApiErrors, toIsoDateTime, type ApiErrors, type CalendarEvent } from './events.ts'
import { toIsoDate } from './week.ts'
import Field from './ui/Field.tsx'
// Same look as the "Add class" dialog
import styles from './AddClassDialog.module.css'

type EditEventDialogProps = {
  // The event being edited; null keeps the dialog closed.
  event: CalendarEvent | null
  onClose: () => void
  // Called after a save or delete so the page can reload the grid.
  onChanged: () => void
}

const NO_ERRORS: ApiErrors = { form: [], fields: {} }

// ISO string -> "YYYY-MM-DDTHH:MM" in the browser's timezone, the format datetime-local uses
function toLocalInput(iso: string) {
  const date = new Date(iso)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${toIsoDate(date)}T${hours}:${minutes}`
}

function fromLocalInput(value: string) {
  const [date, time] = value.split('T')
  return toIsoDateTime(date, time ?? '')
}

function EditEventDialog({ event, onClose, onChanged }: EditEventDialogProps) {
  const { apiFetch, logout } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [errors, setErrors] = useState<ApiErrors>(NO_ERRORS)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (event && !dialog?.open) dialog?.showModal()
    if (!event && dialog?.open) dialog.close()
  }, [event])

  function close() {
    setErrors(NO_ERRORS)
    onClose()
  }

  // Shared by save and delete: shows the API's errors, or closes and reloads on success.
  async function send(path: string, init: RequestInit) {
    setErrors(NO_ERRORS)
    setIsBusy(true)

    try {
      const response = await apiFetch(path, init)
      if (response.status === 401) {
        logout()
        return
      }
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null)
        setErrors(readApiErrors(result, response.status))
        return
      }

      onChanged()
      close()
    } catch {
      setErrors({
        form: ['Could not reach the server. Check your connection and try again.'],
        fields: {},
      })
    } finally {
      setIsBusy(false)
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!event) return

    const formData = new FormData(e.currentTarget)
    let start: string
    let end: string
    try {
      start = fromLocalInput(String(formData.get('start')))
      end = fromLocalInput(String(formData.get('end')))
    } catch {
      setErrors({ form: ['Enter a valid date and time.'], fields: {} })
      return
    }

    send(`/events/${event._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: String(formData.get('title') ?? ''),
        start,
        end,
        // Empty strings clear these fields
        location: String(formData.get('location') ?? '').trim(),
        notes: String(formData.get('notes') ?? '').trim(),
      }),
    })
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="edit-event-title"
      onClose={close}
    >
      {event && (
        <form key={event._id} className={styles.form} onSubmit={handleSubmit}>
          <h2 id="edit-event-title" className={styles.title}>
            Edit event
          </h2>

          <Field
            label="Name"
            name="title"
            defaultValue={event.title}
            required
            autoComplete="off"
            error={errors.fields.title}
          />
          <Field
            label="Start"
            name="start"
            type="datetime-local"
            defaultValue={toLocalInput(event.start)}
            required
            error={errors.fields.start}
          />
          <Field
            label="End"
            name="end"
            type="datetime-local"
            defaultValue={toLocalInput(event.end)}
            required
            error={errors.fields.end}
          />
          <Field
            label="Location (optional)"
            name="location"
            defaultValue={event.location ?? ''}
            error={errors.fields.location}
          />
          <Field
            label="Notes (optional)"
            name="notes"
            defaultValue={event.notes ?? ''}
            error={errors.fields.notes}
          />

          {errors.form.length > 0 && (
            <div className={styles.alert} role="alert">
              {errors.form.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={isBusy}
              onClick={() => {
                if (!window.confirm('Delete this event?')) return
                send(`/events/${event._id}`, { method: 'DELETE' })
              }}
            >
              Delete
            </button>
            <button type="button" className={styles.secondary} disabled={isBusy} onClick={close}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={isBusy}>
              Save
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}

export default EditEventDialog
