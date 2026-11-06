import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import type { CalendarEvent } from '../components/events.ts'
import WeekGrid from '../components/WeekGrid.tsx'
import WeekHeader from '../components/WeekHeader.tsx'
import { useNow } from '../components/useNow.ts'
import { addWeeks, isSameDay, startOfWeek } from '../components/week.ts'
import styles from './WeekPage.module.css'

function WeekPage() {
  const { apiFetch } = useAuth()
  const now = useNow()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    apiFetch('/events')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(setEvents)
      .catch((error) => console.error('Could not load events:', error))
  }, [apiFetch])

  return (
    <div className={styles.page}>
      <WeekHeader
        weekStart={weekStart}
        isCurrentWeek={isSameDay(weekStart, startOfWeek(now))}
        onPrev={() => setWeekStart((week) => addWeeks(week, -1))}
        onNext={() => setWeekStart((week) => addWeeks(week, 1))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
      />
      <WeekGrid weekStart={weekStart} now={now} events={events} />
    </div>
  )
}

export default WeekPage
