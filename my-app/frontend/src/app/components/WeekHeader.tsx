import { formatWeekRange } from './week.ts'
import styles from './WeekHeader.module.css'

type WeekHeaderProps = {
  weekStart: Date
  isCurrentWeek: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

function WeekHeader({
  weekStart,
  isCurrentWeek,
  onPrev,
  onNext,
  onToday,
}: WeekHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.arrow}
          onClick={onPrev}
          aria-label="Previous week"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <h1 className={styles.range} aria-live="polite">
          {formatWeekRange(weekStart)}
        </h1>
        <button
          type="button"
          className={styles.arrow}
          onClick={onNext}
          aria-label="Next week"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <button
        type="button"
        className={styles.today}
        onClick={onToday}
        disabled={isCurrentWeek}
      >
        Today
      </button>
    </div>
  )
}

export default WeekHeader
