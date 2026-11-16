import type { CSSProperties } from 'react'
import { layoutDay, type CalendarEvent } from './events.ts'
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOURS,
  formatFullDate,
  formatHour,
  formatTime,
  formatWeekday,
  getWeekDays,
  isSameDay,
  toIsoDate,
} from './week.ts'
import styles from './WeekGrid.module.css'

type WeekGridProps = {
  weekStart: Date
  now: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}

// "9:00 AM – 10:00 AM", "Mon 9:00 AM – Wed 5:00 PM" for multi-day events, "9:00 AM" for zero-minute ones
function formatEventTime(start: Date, end: Date, instant: boolean) {
  if (instant) return formatTime(start)
  if (isSameDay(start, end)) return `${formatTime(start)} – ${formatTime(end)}`
  return `${formatWeekday(start)} ${formatTime(start)} – ${formatWeekday(end)} ${formatTime(end)}`
}

function WeekGrid({ weekStart, now, events, onSelectEvent }: WeekGridProps) {
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
              {layoutDay(events, day).map(({ event, start, end, top, height, lane, lanes, instant }) => {
                const time = formatEventTime(start, end, instant)
                const style = {
                  top: `${top * 100}%`,
                  ...(instant ? {} : { height: `${height * 100}%` }),
                  left: `${(lane / lanes) * 100}%`,
                  width: `${100 / lanes}%`,
                }
                const label = (
                  <>
                    <span className={styles.eventTitle}>{event.title}</span>
                    <span className={styles.eventTime}>{time}</span>
                  </>
                )

                // Placed tasks are only shown; events open the edit dialog when clicked
                if (event.isTask) {
                  return (
                    <div
                      key={event._id}
                      className={styles.task}
                      style={style}
                      title={`Task: ${event.title}, ${time}`}
                    >
                      {label}
                    </div>
                  )
                }

                return (
                  <button
                    type="button"
                    key={event._id}
                    className={instant ? styles.eventMarker : styles.event}
                    onClick={() => onSelectEvent(event)}
                    style={style}
                    title={`${event.title}, ${time}`}
                  >
                    {label}
                  </button>
                )
              })}
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
