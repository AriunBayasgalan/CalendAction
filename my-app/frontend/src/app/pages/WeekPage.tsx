import { useState } from 'react'
import AddClassDialog from '../components/AddClassDialog.tsx'
import WeekGrid from '../components/WeekGrid.tsx'
import WeekHeader from '../components/WeekHeader.tsx'
import { useNow } from '../components/useNow.ts'
import { addWeeks, isSameDay, startOfWeek } from '../components/week.ts'
import styles from './WeekPage.module.css'

function WeekPage() {
  const now = useNow()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(now))

  return (
    <div className={styles.page}>
      <WeekHeader
        weekStart={weekStart}
        isCurrentWeek={isCurrentWeek}
        onPrev={() => setWeekStart((week) => addWeeks(week, -1))}
        onNext={() => setWeekStart((week) => addWeeks(week, 1))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
        actions={<AddClassDialog defaultDate={isCurrentWeek ? now : weekStart} />}
      />
      <WeekGrid weekStart={weekStart} now={now} />
    </div>
  )
}

export default WeekPage
