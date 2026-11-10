import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import styles from './TaskForm.module.css'

type Task = {
  _id: string
  title: string
  durationMinutes: number
  dueDate?: string
  todoText: string
  status: 'unscheduled'
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
  const { apiFetch } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('60')
  const [dueDate, setDueDate] = useState('')
  const [todoText, setTodoText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/tasks')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setTasks(data.tasks))
      .catch(() => setError('Could not load tasks.'))
  }, [apiFetch])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    try {
      const res = await apiFetch('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          durationMinutes: Number(duration),
          // Due by the end of the chosen day in the user's timezone
          dueDate: dueDate ? new Date(`${dueDate}T23:59`) : undefined,
          todoText,
        }),
      })

      if (!res.ok) {
        setError('Could not save task.')
        return
      }

      const data = await res.json()
      setTasks([data.task, ...tasks])
      setTitle('')
      setDueDate('')
      setTodoText('')
    } catch {
      setError('Could not save task.')
    }
  }

  const unscheduled = tasks.filter((task) => task.status === 'unscheduled')

  return (
    <aside className={styles.panel}>
      <h2>Add a task</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
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
            value={todoText}
            placeholder="What needs to get done?"
            onChange={(e) => setTodoText(e.target.value)}
          />
        </label>
        <button type="submit">Add task</button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      <h2>Needs a slot</h2>
      {unscheduled.length === 0 ? (
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
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

export default TaskForm
