import { useState } from 'react'
import WeekGrid from '../components/WeekGrid.tsx'
import WeekHeader from '../components/WeekHeader.tsx'
import { useNow } from '../components/useNow.ts'
import { addWeeks, isSameDay, startOfWeek } from '../components/week.ts'
import styles from './WeekPage.module.css'

function WeekPage() {
  const now = useNow()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  return (
    <div className={styles.page}>
      <WeekHeader
        weekStart={weekStart}
        isCurrentWeek={isSameDay(weekStart, startOfWeek(now))}
        onPrev={() => setWeekStart((week) => addWeeks(week, -1))}
        onNext={() => setWeekStart((week) => addWeeks(week, 1))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
      />
      <WeekGrid weekStart={weekStart} now={now} />
    </div>
  )
}

export default WeekPage
