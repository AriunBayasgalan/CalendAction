import type { CSSProperties } from 'react'
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOURS,
  formatFullDate,
  formatHour,
  formatWeekday,
  getWeekDays,
  isSameDay,
} from './week.ts'
import styles from './WeekGrid.module.css'

type WeekGridProps = {
  weekStart: Date
  now: Date
}

function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function WeekGrid({ weekStart, now }: WeekGridProps) {
  const days = getWeekDays(weekStart)
  const nowHours = now.getHours() + now.getMinutes() / 60
  const showNowLine = nowHours >= DAY_START_HOUR && nowHours <= DAY_END_HOUR

  return (
    <section
      className={styles.scroller}
      style={{ '--hour-count': HOURS.length } as CSSProperties}
      aria-label={`Week of ${formatFullDate(weekStart)}`}
    >
      <div className={styles.grid}>
        <div className={styles.corner} />
        {days.map((day) => {
          const isToday = isSameDay(day, now)
          return (
            <div
              key={day.toISOString()}
              className={isToday ? `${styles.dayHeader} ${styles.today}` : styles.dayHeader}
              aria-current={isToday ? 'date' : undefined}
            >
              <time dateTime={toIsoDate(day)}>
                <span className={styles.weekday}>{formatWeekday(day)}</span>{' '}
                <span className={styles.date}>{day.getDate()}</span>
              </time>
            </div>
          )
        })}

        <div className={styles.gutter} aria-hidden="true">
          {[...HOURS, DAY_END_HOUR].map((hour, i) => (
            <span
              key={hour}
              className={styles.hourLabel}
              style={{ top: `${(i / HOURS.length) * 100}%` }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const isToday = isSameDay(day, now)
          return (
            <div
              key={day.toISOString()}
              className={isToday ? `${styles.dayColumn} ${styles.today}` : styles.dayColumn}
            >
              {HOURS.map((hour) => (
                <div key={hour} className={styles.hourCell} />
              ))}
              {isToday && showNowLine && (
                <div
                  className={styles.nowLine}
                  style={{
                    top: `${((nowHours - DAY_START_HOUR) / HOURS.length) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default WeekGrid
