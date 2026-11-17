import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/auth.ts'
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
  // CA-24: a check-off was saved; `todo` is the text the line numbers refer to.
  onTodoSaved: (event: CalendarEvent, todo: string, done: number[]) => void
}

type TodoChecklistProps = {
  event: CalendarEvent
  todo: string
  onSaved: (done: number[]) => void
}

// CA-24: one checkbox per non-blank line of the to-do. Each click saves right away
// (PATCH todoDone), so checks survive a refresh. On failure the click is undone.
function TodoChecklist({ event, todo, onSaved }: TodoChecklistProps) {
  const { apiFetch, logout } = useAuth()
  const [done, setDone] = useState<number[]>(event.todoDone ?? [])
  const [error, setError] = useState('')

  // Line numbers count every line, blank ones too, so they match the stored text
  const items = todo
    .split('\n')
    .map((text, line) => ({ text, line }))
    .filter((item) => item.text.trim() !== '')
  const doneCount = items.filter((item) => done.includes(item.line)).length

  async function toggle(line: number) {
    const before = done
    const next = done.includes(line)
      ? done.filter((n) => n !== line)
      : [...done, line].sort((a, b) => a - b)
    setDone(next)
    setError('')

    try {
      const path = event.isTask ? `/tasks/${event._id}` : `/events/${event._id}`
      const res = await apiFetch(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoDone: next }),
      })
      if (res.status === 401) {
        logout()
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onSaved(next)
    } catch (err) {
      console.error('Could not save the check-off:', err)
      setDone(before)
      setError("Couldn't save that. Try again.")
    }
  }

  if (items.length === 0) return <dd className={styles.empty}>No to-do written.</dd>

  return (
    <dd>
      <p className={styles.progress}>
        {doneCount} of {items.length} done
      </p>
      <ul className={styles.checklist}>
        {items.map(({ text, line }) => {
          const checked = done.includes(line)
          return (
            <li key={line}>
              <label className={styles.item}>
                <input type="checkbox" checked={checked} onChange={() => toggle(line)} />
                <span className={checked ? `${styles.todo} ${styles.checked}` : styles.todo}>
                  {text}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </dd>
  )
}

// Read-only details for a block on the week grid: title, time, and the to-do the user
// wrote when creating it. Closing it just returns to the week.
function EventPanel({ event, onClose, onEdit, onTodoSaved }: EventPanelProps) {
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
          {/* key: a different block (or new to-do text) starts from its own saved checks */}
          <TodoChecklist
            key={`${event._id}:${todo}`}
            event={event}
            todo={todo}
            onSaved={(done) => onTodoSaved(event, todo, done)}
          />
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
