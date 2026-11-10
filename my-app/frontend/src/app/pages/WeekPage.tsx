import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import type { CalendarEvent } from '../components/events.ts'
import WeekGrid from '../components/WeekGrid.tsx'
import WeekHeader from '../components/WeekHeader.tsx'
import { useNow } from '../components/useNow.ts'
import { addWeeks, isSameDay, startOfWeek } from '../components/week.ts'
import styles from './WeekPage.module.css'

type LoadStatus = 'loading' | 'error' | 'ready'

function WeekPage() {
  const { apiFetch } = useAuth()
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
  }, [apiFetch, weekStart, requestKey])

  return (
    <div className={styles.page}>
      <WeekHeader
        weekStart={weekStart}
        isCurrentWeek={isSameDay(weekStart, startOfWeek(now))}
        onPrev={() => setWeekStart((week) => addWeeks(week, -1))}
        onNext={() => setWeekStart((week) => addWeeks(week, 1))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
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
      <WeekGrid weekStart={weekStart} now={now} events={result.events} />
    </div>
  )
}

export default WeekPage
