import { useEffect, useRef } from 'react'
import { formatEventTime, type CalendarEvent } from './events.ts'
import { formatFullDate } from './week.ts'
// Same dialog frame and buttons as "Add class"; panel-only bits live in EventPanel.module.css
import dialogStyles from './AddClassDialog.module.css'
import styles from './EventPanel.module.css'

type EventPanelProps = {
  // The clicked block (a class or a placed task); null keeps the panel closed.
  event: CalendarEvent | null
  onClose: () => void
  // Classes only: hand the event to the edit dialog.
  onEdit: (event: CalendarEvent) => void
}

// Read-only details for a block on the week grid: title, time, and the to-do the user
// wrote when creating it. Closing it just returns to the week.
function EventPanel({ event, onClose, onEdit }: EventPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (event && !dialog?.open) dialog?.showModal()
    if (!event && dialog?.open) dialog.close()
  }, [event])

  if (!event) return <dialog ref={dialogRef} className={dialogStyles.dialog} onClose={onClose} />

  const start = new Date(event.start)
  const end = new Date(event.end)
  const time = formatEventTime(start, end, start.getTime() === end.getTime())
  // A task's to-do comes from the task form; a class's from its Notes field
  const todo = (event.isTask ? event.todoText : event.notes) ?? ''

  return (
    <dialog
      ref={dialogRef}
      className={dialogStyles.dialog}
      aria-labelledby="event-panel-title"
      onClose={onClose}
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

        <div className={dialogStyles.actions}>
          {!event.isTask && (
            <button type="button" className={dialogStyles.secondary} onClick={() => onEdit(event)}>
              Edit
            </button>
          )}
          <button
            type="button"
            className={dialogStyles.primary}
            onClick={() => dialogRef.current?.close()}
            autoFocus
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default EventPanel
