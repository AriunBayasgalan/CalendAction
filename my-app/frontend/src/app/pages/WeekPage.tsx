import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import AddClassDialog from '../components/AddClassDialog.tsx'
import EditEventDialog from '../components/EditEventDialog.tsx'
import EventPanel from '../components/EventPanel.tsx'
import TaskForm, { type Task, type TaskNotice } from '../components/TaskForm.tsx'
import type { CalendarEvent, EventSaveResult } from '../components/events.ts'
import { placedFormat } from '../components/tasks.ts'
import WeekGrid from '../components/WeekGrid.tsx'
import WeekHeader from '../components/WeekHeader.tsx'
import { useNow } from '../components/useNow.ts'
import { addWeeks, isSameDay, startOfWeek } from '../components/week.ts'
import styles from './WeekPage.module.css'

type LoadStatus = 'loading' | 'error' | 'ready'

function WeekPage() {
  const { apiFetch, logout } = useAuth()
  const now = useNow()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  // The result remembers which request (week + attempt) it belongs to. While the current
  // request has no result yet, the page is "loading".
  const [result, setResult] = useState<{ key: string; status: LoadStatus; events: CalendarEvent[] }>({
    key: '',
    status: 'loading',
    events: [],
  })
  // Bumped by the Retry button to run the fetch again for the same week.
  const [attempt, setAttempt] = useState(0)
  // The block open in the event panel (CA-23), or null when it's closed.
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  // The event open in the edit dialog, or null when it's closed.
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  // Kept in sync by TaskForm, so placed tasks show on the grid right away
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskReload, setTaskReload] = useState(0)
  const [taskNotices, setTaskNotices] = useState<TaskNotice[]>([])
  const taskBlocks: CalendarEvent[] = tasks.flatMap((task) =>
    task.status === 'scheduled' && task.start && task.end
      ? [
          {
            _id: task._id,
            title: task.title,
            start: task.start,
            end: task.end,
            isTask: true,
            todoText: task.todoText,
            startedAt: task.startedAt,
          },
        ]
      : [],
  )

  function handleEventSaved(result?: EventSaveResult) {
    setAttempt((n) => n + 1)
    setTaskReload((n) => n + 1)
    if (!result) {
      setTaskNotices([])
      return
    }
    const classTitle = result.title
    const notices: TaskNotice[] = [
      ...(result.moved ?? []).map((task) => ({
        text: `“${task.title}” moved to ${placedFormat.format(new Date(task.start!))} to make room for “${classTitle}”`,
      })),
      ...(result.unscheduled ?? []).map((task) => ({
        text: `“${task.title}” unscheduled because “${classTitle}” now uses its time`,
        alert: true,
      })),
    ]
    setTaskNotices(notices)
  }

  // Start in the panel succeeded (CA-25): show it in the open panel and in the block's source
  function handleStarted(block: CalendarEvent) {
    setSelected((open) => (open?._id === block._id ? block : open))
    if (block.isTask) {
      // TaskForm owns the task list, so reload it to pick up the task's startedAt
      setTaskNotices([])
      setTaskReload((n) => n + 1)
    } else {
      setResult((current) => ({
        ...current,
        events: current.events.map((event) => (event._id === block._id ? block : event)),
      }))
    }
  }

  // Fetch only the selected week and refetch when it changes. The cleanup aborts the
  // previous request, so a slow response for an old week can't overwrite the current one.
  const requestKey = `${weekStart.toISOString()}#${attempt}`
  const status: LoadStatus = result.key === requestKey ? result.status : 'loading'

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      from: weekStart.toISOString(),
      to: addWeeks(weekStart, 1).toISOString(),
    })

    async function loadEvents() {
      try {
        const res = await apiFetch(`/events?${params}`, { signal: controller.signal })
        if (res.status === 401) {
          logout()
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data: CalendarEvent[] = await res.json()
        setResult({ key: requestKey, status: 'ready', events: data })
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Could not load events:', error)
        setResult({ key: requestKey, status: 'error', events: [] })
      }
    }

    loadEvents()

    return () => controller.abort()
  }, [apiFetch, logout, weekStart, requestKey])

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(now))

  return (
    <div className={styles.page}>
      <WeekHeader
        weekStart={weekStart}
        isCurrentWeek={isCurrentWeek}
        onPrev={() => setWeekStart((week) => addWeeks(week, -1))}
        onNext={() => setWeekStart((week) => addWeeks(week, 1))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
        actions={
          <AddClassDialog
            defaultDate={isCurrentWeek ? now : weekStart}
            onCreated={handleEventSaved}
          />
        }
      />
      {status === 'loading' && (
        <p role="status" className={styles.notice}>
          Loading events…
        </p>
      )}
      {status === 'error' && (
        <div role="alert" className={`${styles.notice} ${styles.error}`}>
          <span>Could not load your events. The grid below may be missing some.</span>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      <div className={styles.body}>
        <WeekGrid
          weekStart={weekStart}
          now={now}
          events={[...result.events, ...taskBlocks]}
          onSelectEvent={setSelected}
        />
        <TaskForm onTasksChange={setTasks} reloadToken={taskReload} extraNotices={taskNotices} />
      </div>
      <EventPanel
        event={selected}
        now={now}
        onClose={() => setSelected(null)}
        onStarted={handleStarted}
        onEdit={(event) => {
          setSelected(null)
          setEditing(event)
        }}
      />
      <EditEventDialog
        event={editing}
        onClose={() => setEditing(null)}
        onChanged={handleEventSaved}
      />
    </div>
  )
}

export default WeekPage
