import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { layoutDay, type CalendarEvent } from './events.ts'
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  HOURS,
  SCROLL_TO_HOUR,
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

// Pixels kept above the 7 AM line when the grid opens
const LABEL_ROOM = 12

function WeekGrid({ weekStart, now, events, onSelectEvent }: WeekGridProps) {
  const days = getWeekDays(weekStart)
  const nowHours = now.getHours() + now.getMinutes() / 60
  const showNowLine = nowHours >= GRID_START_HOUR && nowHours <= GRID_END_HOUR
  const scrollerRef = useRef<HTMLElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)

  // The grid draws all 24 hours but opens at SCROLL_TO_HOUR (7 AM), so the usual
  // day looks the same as before while early or late blocks are a scroll away.
  // The day headers are sticky, so scrolling by the hours above 7 AM puts the
  // 7 AM line right under them; LABEL_ROOM leaves space for its "7 AM" label,
  // which is centered on the line. Runs once on mount, so changing weeks keeps
  // the user's scroll position.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const column = columnRef.current
    if (!scroller || !column) return
    const hourHeight = column.getBoundingClientRect().height / HOURS.length
    scroller.scrollTop = Math.max(0, (SCROLL_TO_HOUR - GRID_START_HOUR) * hourHeight - LABEL_ROOM)
  }, [])

  return (
    <section
      ref={scrollerRef}
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
          {/* Midnight at the top and bottom edges is left unlabeled */}
          {HOURS.map((hour, i) =>
            i === 0 ? null : (
            <span
              key={hour}
              className={styles.hourLabel}
              style={{ top: `${(i / HOURS.length) * 100}%` }}
            >
              {formatHour(hour)}
            </span>
            ),
          )}
        </div>
        {days.map((day, dayIndex) => {
          const isToday = isSameDay(day, now)
          return (
            <div
              key={day.toISOString()}
              ref={dayIndex === 0 ? columnRef : undefined}
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
                    top: `${((nowHours - GRID_START_HOUR) / HOURS.length) * 100}%`,
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
