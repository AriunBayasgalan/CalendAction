import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import { readErrorMessage } from './apiErrors.ts'
import { formatEventTime, startState, type CalendarEvent } from './events.ts'
import { formatFullDate, formatTime } from './week.ts'
// Same dialog frame and buttons as "Add class"; panel-only bits live in EventPanel.module.css
import dialogStyles from './AddClassDialog.module.css'
import styles from './EventPanel.module.css'

// "Tue, Mar 2", for when an upcoming block can be started
const startDayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

type EventPanelProps = {
  // The clicked block (a class or a placed task); null keeps the panel closed.
  event: CalendarEvent | null
  // Decides whether today is the block's day, so Start turns on at midnight without a reload
  now: Date
  onClose: () => void
  // Start succeeded: gets the same block with its new startedAt (CA-25).
  onStarted: (event: CalendarEvent) => void
  // Classes only: hand the event to the edit dialog.
  onEdit: (event: CalendarEvent) => void
}

// Details for a block on the week grid: title, time, and the to-do the user wrote when
// creating it. Start marks the block started (the streak counts it), but only on the
// block's own day; Close returns to the week.
function EventPanel({ event, now, onClose, onStarted, onEdit }: EventPanelProps) {
  const { apiFetch, logout } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  // The block whose Start request is in flight
  const [startingId, setStartingId] = useState<string | null>(null)
  // Why the last Start failed, shown only on that block's panel
  const [startError, setStartError] = useState<{ id: string; message: string } | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (event && !dialog?.open) dialog?.showModal()
    if (!event && dialog?.open) dialog.close()
  }, [event])

  function close() {
    setStartError(null)
    onClose()
  }

  async function handleStart(block: CalendarEvent) {
    if (startingId) return

    setStartError(null)
    setStartingId(block._id)

    try {
      const res = await apiFetch(`/${block.isTask ? 'tasks' : 'events'}/${block._id}/start`, {
        method: 'POST',
      })

      if (res.status === 401) {
        logout()
        return
      }

      if (!res.ok) {
        setStartError({ id: block._id, message: await readErrorMessage(res, 'Could not start this block.') })
        return
      }

      // Starting again returns the first startedAt, so this is always the original time
      const started: { startedAt: string } = await res.json()
      onStarted({ ...block, startedAt: started.startedAt })
    } catch {
      setStartError({ id: block._id, message: 'Could not start this block.' })
    } finally {
      setStartingId(null)
    }
  }

  if (!event) return <dialog ref={dialogRef} className={dialogStyles.dialog} onClose={close} />

  const start = new Date(event.start)
  const end = new Date(event.end)
  const time = formatEventTime(start, end, start.getTime() === end.getTime())
  // A task's to-do comes from the task form; a class's from its Notes field
  const todo = (event.isTask ? event.todoText : event.notes) ?? ''

  const state = startState(event, now)
  const startLabel =
    state === 'started'
      ? `Started ${formatTime(new Date(event.startedAt!))}`
      : startingId === event._id
        ? 'Starting…'
        : state === 'upcoming'
          ? `Start on ${startDayFormat.format(start)}`
          : state === 'missed'
            ? 'Not started'
            : 'Start'

  return (
    <dialog
      ref={dialogRef}
      className={dialogStyles.dialog}
      aria-labelledby="event-panel-title"
      onClose={close}
    >
      <div className={dialogStyles.form}>
        <div>
          <p className={styles.kind}>{event.isTask ? 'Task' : 'Class'}</p>
          <h2 id="event-panel-title" className={dialogStyles.title}>
            {event.title}
          </h2>
        </div>

        <dl className={styles.details}>
          <dt>When</dt>
          <dd>
            {formatFullDate(start)} · {time}
          </dd>
          {event.location && (
            <>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </>
          )}
          <dt>To-do</dt>
          {todo.trim() ? (
            <dd className={styles.todo}>{todo}</dd>
          ) : (
            <dd className={styles.empty}>No to-do written.</dd>
          )}
        </dl>

        {startError?.id === event._id && (
          <div className={dialogStyles.alert} role="alert">
            <p>{startError.message}</p>
          </div>
        )}

        <div className={dialogStyles.actions}>
          {!event.isTask && (
            <button type="button" className={dialogStyles.secondary} onClick={() => onEdit(event)}>
              Edit
            </button>
          )}
          <button
            type="button"
            className={dialogStyles.secondary}
            onClick={() => dialogRef.current?.close()}
            autoFocus
          >
            Close
          </button>
          <button
            type="button"
            className={dialogStyles.primary}
            disabled={startingId !== null || state !== 'ready'}
            onClick={() => handleStart(event)}
          >
            {startLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default EventPanel
