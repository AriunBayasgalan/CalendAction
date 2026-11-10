import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import { toIsoDate } from './week.ts'
import styles from './TaskForm.module.css'

type Task = {
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

// 90 -> "1 h 30 min"
function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours && `${hours} h`, rest && `${rest} min`].filter(Boolean).join(' ')
}

function TaskForm() {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Title cannot be empty.')
      return
    }

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
        <button type="submit">{editingId ? 'Save changes' : 'Add task'}</button>
        {editingId && (
          <button type="button" className={styles.secondary} onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>

      {error && <p className={styles.error}>{error}</p>}

      <h2>Needs a slot</h2>
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
              <div className={styles.cardActions}>
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
