import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import { toIsoDate } from './week.ts'
import styles from './TaskForm.module.css'

export type Task = {
  _id: string
  title: string
  durationMinutes: number
  dueDate?: string
  todoText: string
  // #51 adds 'scheduled' (with start and end)
  status: 'unscheduled' | 'scheduled'
  start?: string
  end?: string
}

// Same limits as the API (CA-10)
const TITLE_MAX = 200
const TODO_MAX = 2000

// Pulls the first validation message out of an error response without assuming its shape.
// Handles Zod's treeified `details` ({ errors, properties: { field: { errors } } }),
// a `details: [{ message }]` list, and a plain `{ error }` string.
async function readErrorMessage(res: Response, fallback: string) {
  if (!res.headers.get('content-type')?.includes('application/json')) return fallback

  try {
    const data = await res.json()
    const details = data?.details
    const fieldErrors = details?.properties
      ? Object.values(details.properties as Record<string, { errors?: string[] }>).flatMap(
          (field) => field?.errors ?? [],
        )
      : []
    return (
      fieldErrors[0] ??
      details?.errors?.[0] ??
      (Array.isArray(details) ? details[0]?.message : undefined) ??
      data?.error ??
      fallback
    )
  } catch {
    return fallback
  }
}

const dueFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

// "Tue, Nov 10, 2:00 PM"
const placedFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

// 90 -> "1 h 30 min"
function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours && `${hours} h`, rest && `${rest} min`].filter(Boolean).join(' ')
}

type TaskFormProps = {
  // Gets the full task list whenever it changes, so the page can draw placed tasks on the grid.
  onTasksChange: (tasks: Task[]) => void
}

function TaskForm({ onTasksChange }: TaskFormProps) {
  const { apiFetch, logout } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('60')
  const [dueDate, setDueDate] = useState('')
  const [todoText, setTodoText] = useState('')
  const [error, setError] = useState('')
  // The task loaded into the form for editing; null means the form adds a new task
  const [editingId, setEditingId] = useState<string | null>(null)
  // 'failed' keeps "No tasks yet" from showing when the list just didn't load
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [placingIds, setPlacingIds] = useState<string[]>([])
  // Why the last Place failed (e.g. no open time), shown on that task's card
  const [placeError, setPlaceError] = useState<{ id: string; message: string } | null>(null)
  // Where the last placed task went, since it may land in a week that isn't on screen
  const [placedMessage, setPlacedMessage] = useState('')

  useEffect(() => {
    onTasksChange(tasks)
  }, [tasks, onTasksChange])

  useEffect(() => {
    apiFetch('/tasks')
      .then((res) => {
        // Expired or invalid sign-in: clear the token so RequireAuth sends us to /login
        if (res.status === 401) {
          logout()
          return Promise.reject()
        }
        return res.ok ? res.json() : Promise.reject()
      })
      .then((data) => {
        setTasks(data.tasks)
        setLoadState('loaded')
      })
      .catch(() => {
        setError('Could not load tasks.')
        setLoadState('failed')
      })
  }, [apiFetch, logout])

  function startEdit(task: Task) {
    setError('')
    setEditingId(task._id)
    setTitle(task.title)
    setDuration(String(task.durationMinutes))
    setDueDate(task.dueDate ? toIsoDate(new Date(task.dueDate)) : '')
    setTodoText(task.todoText)
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setDuration('60')
    setDueDate('')
    setTodoText('')
  }

  async function handleDelete(id: string) {
    if (deletingIds.includes(id)) return
    if (!window.confirm('Delete this task?')) return

    setError('')
    setDeletingIds((prev) => [...prev, id])

    try {
      const res = await apiFetch(`/tasks/${id}`, { method: 'DELETE' })

      if (res.status === 401) {
        logout()
        return
      }

      if (!res.ok) {
        setError(await readErrorMessage(res, 'Could not delete task.'))
        return
      }

      setTasks((prev) => prev.filter((task) => task._id !== id))
      if (editingId === id) resetForm()
    } catch {
      setError('Could not delete task.')
    } finally {
      setDeletingIds((prev) => prev.filter((deletingId) => deletingId !== id))
    }
  }

  // Asks the API for the next open slot. On success the task becomes 'scheduled', leaves this
  // list, and the page draws it on the grid.
  async function handlePlace(id: string) {
    if (placingIds.includes(id)) return

    setPlaceError(null)
    setPlacedMessage('')
    setPlacingIds((prev) => [...prev, id])

    try {
      const res = await apiFetch(`/tasks/${id}/place`, { method: 'POST' })

      if (res.status === 401) {
        logout()
        return
      }

      if (!res.ok) {
        // 409 with "No open time this week or next" when nothing fits
        setPlaceError({ id, message: await readErrorMessage(res, 'Could not place task.') })
        return
      }

      const placed: Task = await res.json()
      setTasks((prev) => prev.map((task) => (task._id === placed._id ? placed : task)))
      if (editingId === id) resetForm()
      if (placed.start) {
        setPlacedMessage(`Placed “${placed.title}” on ${placedFormat.format(new Date(placed.start))}.`)
      }
    } catch {
      setPlaceError({ id, message: 'Could not place task.' })
    } finally {
      setPlacingIds((prev) => prev.filter((placingId) => placingId !== id))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setError('')

    if (!title.trim()) {
      setError('Title cannot be empty.')
      return
    }

    setSaving(true)

    try {
      const res = await apiFetch(editingId ? `/tasks/${editingId}` : '/tasks', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          durationMinutes: Number(duration),
          // Due by the end of the chosen day in the user's timezone; null means no due date
          dueDate: dueDate ? new Date(`${dueDate}T23:59`) : null,
          todoText,
        }),
      })

      if (res.status === 401) {
        logout()
        return
      }

      if (!res.ok) {
        setError(await readErrorMessage(res, 'Could not save task.'))
        return
      }

      const data = await res.json()
      setTasks((prev) =>
        editingId
          ? prev.map((task) => (task._id === data.task._id ? data.task : task))
          : [data.task, ...prev],
      )
      resetForm()
    } catch {
      setError('Could not save task.')
    } finally {
      setSaving(false)
    }
  }

  const unscheduled = tasks.filter((task) => task.status === 'unscheduled')

  return (
    <aside className={styles.panel}>
      <h2>{editingId ? 'Edit task' : 'Add a task'}</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Title
          <input
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label>
          Duration (minutes)
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />
        </label>
        <label>
          Due date (optional)
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label>
          To-do
          <textarea
            rows={3}
            maxLength={TODO_MAX}
            value={todoText}
            placeholder="What needs to get done?"
            onChange={(e) => setTodoText(e.target.value)}
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add task'}
        </button>
        {editingId && (
          <button type="button" className={styles.secondary} onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>

      <div role="alert" aria-live="assertive" className={error ? styles.error : undefined}>
        {error}
      </div>

      <h2>Needs a slot</h2>
      {placedMessage && (
        <p role="status" className={styles.placed}>
          {placedMessage}
        </p>
      )}
      {loadState === 'loading' ? (
        <p className={styles.empty}>Loading tasks…</p>
      ) : loadState === 'failed' ? (
        <p className={styles.empty}>Tasks couldn’t be loaded.</p>
      ) : unscheduled.length === 0 ? (
        <p className={styles.empty}>No tasks yet.</p>
      ) : (
        <ul className={styles.list}>
          {unscheduled.map((task) => (
            <li key={task._id} className={styles.card}>
              <strong className={styles.title}>{task.title}</strong>
              <span className={styles.meta}>
                {formatDuration(task.durationMinutes)}
                {task.dueDate && ` · Due ${dueFormat.format(new Date(task.dueDate))}`}
              </span>
              {task.todoText && <p className={styles.todo}>{task.todoText}</p>}
              {placeError?.id === task._id && (
                <p role="alert" className={styles.error}>
                  {placeError.message}
                </p>
              )}
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.place}
                  disabled={placingIds.includes(task._id)}
                  onClick={() => handlePlace(task._id)}
                >
                  {placingIds.includes(task._id) ? 'Placing…' : 'Place'}
                </button>
                <button type="button" onClick={() => startEdit(task)}>
                  Edit
                </button>
                <button
                  type="button"
                  disabled={deletingIds.includes(task._id)}
                  onClick={() => handleDelete(task._id)}
                >
                  {deletingIds.includes(task._id) ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

export default TaskForm
